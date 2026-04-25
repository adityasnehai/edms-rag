import random
import time
from typing import Callable, TypeVar

import requests

T = TypeVar("T")


def is_retryable_exception(error: Exception) -> bool:
    status_code = getattr(getattr(error, "response", None), "status_code", None)
    if status_code in {408, 409, 425, 429, 500, 502, 503, 504}:
        return True

    retryable_types = (
        TimeoutError,
        requests.Timeout,
        requests.ConnectionError,
        requests.exceptions.ChunkedEncodingError,
    )
    if isinstance(error, retryable_types):
        return True

    error_name = error.__class__.__name__.lower()
    if any(
        token in error_name
        for token in ("timeout", "connection", "rate", "apierror", "apiconnection")
    ):
        return True

    return False


def retry_with_backoff(
    fn: Callable[[], T],
    *,
    max_attempts: int,
    base_delay_seconds: float,
    max_delay_seconds: float,
) -> T:
    last_error = None

    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except Exception as error:  # noqa: BLE001
            last_error = error
            if attempt >= max_attempts or not is_retryable_exception(error):
                raise

            delay = min(
                max_delay_seconds,
                base_delay_seconds * (2 ** (attempt - 1)),
            )
            jitter = random.uniform(0, delay * 0.2)
            time.sleep(delay + jitter)

    raise last_error  # pragma: no cover
