import hashlib
import json
import os
import time
from threading import Lock
from typing import Any, Iterable, Optional

from src.runtime_config import PRODUCTION_MODE, REDIS_KEY_PREFIX, REDIS_URL, get_cache_versions
from src.tenancy import DATA_ROOT

CACHE_ROOT = os.path.join(DATA_ROOT, "cache")

_memory_cache: dict[tuple[str, str], dict[str, dict[str, Any]]] = {}
_memory_lock = Lock()
_disk_locks: dict[str, Lock] = {}
_disk_locks_guard = Lock()
_redis_client = None
_redis_lock = Lock()


def _get_redis_client():
    global _redis_client

    if not REDIS_URL:
        return None

    with _redis_lock:
        if _redis_client is not None:
            return _redis_client

        try:
            from redis import Redis
        except ImportError:
            if PRODUCTION_MODE:
                raise RuntimeError("redis package is required in production")
            return None

        try:
            client = Redis.from_url(REDIS_URL, decode_responses=True)
            client.ping()
            _redis_client = client
        except Exception:
            if PRODUCTION_MODE:
                raise
            _redis_client = None

        return _redis_client


def _redis_cache_key(org_slug: str, namespace: str, key: str) -> str:
    return f"{REDIS_KEY_PREFIX}:cache:{org_slug}:{namespace}:{key}"


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def stable_hash(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def build_cache_key(
    org_slug: str,
    namespace: str,
    payload: Any,
    versions: Optional[dict] = None,
) -> str:
    return stable_hash(
        {
            "org_slug": org_slug,
            "namespace": namespace,
            "versions": versions or get_cache_versions(),
            "payload": payload,
        }
    )


def _memory_bucket(org_slug: str, namespace: str) -> dict[str, dict[str, Any]]:
    return _memory_cache.setdefault((org_slug, namespace), {})


def get_memory_cache(org_slug: str, namespace: str, key: str) -> Any:
    client = _get_redis_client()
    if client is not None:
        try:
            payload = client.get(_redis_cache_key(org_slug, namespace, key))
            if payload is None:
                return None
            return json.loads(payload)
        except Exception:
            pass

    now = time.time()
    with _memory_lock:
        bucket = _memory_cache.get((org_slug, namespace), {})
        entry = bucket.get(key)
        if not entry:
            return None

        expires_at = entry.get("expires_at")
        if expires_at is not None and expires_at <= now:
            bucket.pop(key, None)
            return None

        return entry.get("value")


def set_memory_cache(
    org_slug: str,
    namespace: str,
    key: str,
    value: Any,
    ttl_seconds: int,
) -> Any:
    client = _get_redis_client()
    if client is not None:
        try:
            redis_key = _redis_cache_key(org_slug, namespace, key)
            payload = json.dumps(value, ensure_ascii=True, separators=(",", ":"))
            if ttl_seconds > 0:
                client.setex(redis_key, ttl_seconds, payload)
            else:
                client.set(redis_key, payload)
            return value
        except Exception:
            pass

    expires_at = time.time() + ttl_seconds if ttl_seconds > 0 else None
    with _memory_lock:
        _memory_bucket(org_slug, namespace)[key] = {
            "value": value,
            "expires_at": expires_at,
        }
    return value


def _disk_lock(path: str) -> Lock:
    with _disk_locks_guard:
        lock = _disk_locks.get(path)
        if lock is None:
            lock = Lock()
            _disk_locks[path] = lock
        return lock


def _namespace_path(org_slug: str, namespace: str) -> str:
    org_cache_dir = os.path.join(CACHE_ROOT, "orgs", org_slug)
    os.makedirs(org_cache_dir, exist_ok=True)
    return os.path.join(org_cache_dir, f"{namespace}.json")


def _load_disk_entries(path: str) -> dict[str, dict[str, Any]]:
    if not os.path.exists(path):
        return {}

    try:
        with open(path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        entries = payload.get("entries")
        return entries if isinstance(entries, dict) else {}
    except Exception:
        return {}


def _write_disk_entries(path: str, entries: dict[str, dict[str, Any]]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = f"{path}.tmp"
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump({"entries": entries}, handle, ensure_ascii=True, separators=(",", ":"))
    os.replace(temp_path, path)


def get_disk_cache(org_slug: str, namespace: str, key: str) -> Any:
    path = _namespace_path(org_slug, namespace)
    lock = _disk_lock(path)
    now = time.time()

    with lock:
        entries = _load_disk_entries(path)
        entry = entries.get(key)
        if not entry:
            return None

        expires_at = entry.get("expires_at")
        if expires_at is not None and expires_at <= now:
            entries.pop(key, None)
            _write_disk_entries(path, entries)
            return None

        return entry.get("value")


def set_disk_cache(
    org_slug: str,
    namespace: str,
    key: str,
    value: Any,
    ttl_seconds: int,
) -> Any:
    path = _namespace_path(org_slug, namespace)
    lock = _disk_lock(path)
    expires_at = time.time() + ttl_seconds if ttl_seconds > 0 else None

    with lock:
        entries = _load_disk_entries(path)
        entries[key] = {
            "value": value,
            "expires_at": expires_at,
        }
        _write_disk_entries(path, entries)

    return value


def invalidate_org_caches(org_slug: str, namespaces: Optional[Iterable[str]] = None) -> None:
    target_namespaces = set(namespaces or [])
    client = _get_redis_client()

    if client is not None:
        try:
            patterns = (
                [f"{REDIS_KEY_PREFIX}:cache:{org_slug}:*"]
                if not target_namespaces
                else [
                    f"{REDIS_KEY_PREFIX}:cache:{org_slug}:{namespace}:*"
                    for namespace in target_namespaces
                ]
            )
            for pattern in patterns:
                cursor = 0
                while True:
                    cursor, keys = client.scan(cursor=cursor, match=pattern, count=200)
                    if keys:
                        client.delete(*keys)
                    if cursor == 0:
                        break
        except Exception:
            pass

    with _memory_lock:
        for bucket_key in list(_memory_cache.keys()):
            bucket_org_slug, bucket_namespace = bucket_key
            if bucket_org_slug != org_slug:
                continue
            if target_namespaces and bucket_namespace not in target_namespaces:
                continue
            _memory_cache.pop(bucket_key, None)

    org_cache_dir = os.path.join(CACHE_ROOT, "orgs", org_slug)
    if not os.path.isdir(org_cache_dir):
        return

    if not target_namespaces:
        for filename in os.listdir(org_cache_dir):
            if filename.endswith(".json"):
                os.remove(os.path.join(org_cache_dir, filename))
        return

    for namespace in target_namespaces:
        path = os.path.join(org_cache_dir, f"{namespace}.json")
        if os.path.exists(path):
            os.remove(path)
