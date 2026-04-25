from typing import Optional, Dict

from src.state_store import get_eval_result as _get_eval_result
from src.state_store import save_eval_result as _save_eval_result


def save_eval_result(org_slug: str, result: Dict):
    _save_eval_result(org_slug, result)


def get_eval_result(org_slug: str) -> Optional[Dict]:
    return _get_eval_result(org_slug)
