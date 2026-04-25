import time
from contextlib import contextmanager
from threading import BoundedSemaphore, Lock

from fastapi import HTTPException

from src.cache_store import _get_redis_client
from src.runtime_config import (
    API_MAX_CONCURRENT_REQUESTS,
    AUTH_RATE_LIMIT_PER_WINDOW,
    CHAT_RATE_LIMIT_PER_WINDOW,
    READ_RATE_LIMIT_PER_WINDOW,
    RATE_LIMIT_WINDOW_SECONDS,
    REDIS_KEY_PREFIX,
    SEARCH_RATE_LIMIT_PER_WINDOW,
    UPLOAD_RATE_LIMIT_PER_WINDOW,
)
from src.telemetry import log_event

_request_slots = BoundedSemaphore(API_MAX_CONCURRENT_REQUESTS)
_local_counters: dict[str, tuple[int, float]] = {}
_local_counter_lock = Lock()


def _limit_for_route(route_name: str) -> int:
    if route_name == "search":
        return SEARCH_RATE_LIMIT_PER_WINDOW
    if route_name == "chat":
        return CHAT_RATE_LIMIT_PER_WINDOW
    if route_name == "upload":
        return UPLOAD_RATE_LIMIT_PER_WINDOW
    if route_name in {"auth", "login", "register"}:
        return AUTH_RATE_LIMIT_PER_WINDOW
    if route_name in {"read", "evidence", "stats"}:
        return READ_RATE_LIMIT_PER_WINDOW
    return SEARCH_RATE_LIMIT_PER_WINDOW


def enforce_rate_limit(identifier: str, route_name: str) -> None:
    if not identifier:
        return

    limit = _limit_for_route(route_name)
    redis_key = f"{REDIS_KEY_PREFIX}:rate:{route_name}:{identifier}"
    client = _get_redis_client()

    if client is not None:
        try:
            count = client.incr(redis_key)
            if count == 1:
                client.expire(redis_key, RATE_LIMIT_WINDOW_SECONDS)
            if count > limit:
                log_event(30, "rate_limit_exceeded", route=route_name)
                raise HTTPException(status_code=429, detail="Rate limit exceeded")
            return
        except HTTPException:
            raise
        except Exception:
            pass

    import time

    now = time.time()
    with _local_counter_lock:
        count, expires_at = _local_counters.get(redis_key, (0, now + RATE_LIMIT_WINDOW_SECONDS))
        if now >= expires_at:
            count = 0
            expires_at = now + RATE_LIMIT_WINDOW_SECONDS
        count += 1
        _local_counters[redis_key] = (count, expires_at)
    if count > limit:
        log_event(30, "rate_limit_exceeded", route=route_name)
        raise HTTPException(status_code=429, detail="Rate limit exceeded")


@contextmanager
def request_capacity_guard():
    acquired = _request_slots.acquire(blocking=False)
    if not acquired:
        raise HTTPException(status_code=503, detail="Server is busy, please retry shortly")
    try:
        yield
    finally:
        _request_slots.release()


@contextmanager
def distributed_lock(lock_name: str, ttl_seconds: int = 300):
    client = _get_redis_client()
    redis_key = f"{REDIS_KEY_PREFIX}:lock:{lock_name}"
    token = None

    if client is not None:
        token = str(time.time())
        acquired = client.set(redis_key, token, nx=True, ex=ttl_seconds)
        if not acquired:
            raise HTTPException(status_code=409, detail="Another job is already running for this workspace")
        try:
            yield
        finally:
            try:
                if client.get(redis_key) == token:
                    client.delete(redis_key)
            except Exception:
                pass
        return

    with _local_counter_lock:
        if redis_key in _local_counters:
            raise HTTPException(status_code=409, detail="Another job is already running for this workspace")
        _local_counters[redis_key] = (1, time.time() + ttl_seconds)
    try:
        yield
    finally:
        with _local_counter_lock:
            _local_counters.pop(redis_key, None)
