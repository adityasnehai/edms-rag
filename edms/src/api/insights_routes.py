from fastapi import APIRouter, Depends, Query

from src.auth.dependencies import get_current_user
from src.api.index_manager import get_index_metadata
from src.services.query_flow import get_cached_workspace_insights
from src.traffic_control import enforce_rate_limit

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("")
def insights(
    q: str | None = Query(None),
    limit: int = Query(6, ge=1, le=12),
    user=Depends(get_current_user),
):
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "read")
    meta = get_index_metadata(user["org_slug"])
    return get_cached_workspace_insights(
        org_slug=user["org_slug"],
        org_id=user["org_id"],
        index_version=meta.get("index_version"),
        query=(q or "").strip() or None,
        related_limit=limit,
    )
