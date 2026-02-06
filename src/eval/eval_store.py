from typing import Optional, Dict

_eval_result: Optional[Dict] = None


def save_eval_result(result: Dict):
    global _eval_result
    _eval_result = result


def get_eval_result() -> Optional[Dict]:
    return _eval_result
