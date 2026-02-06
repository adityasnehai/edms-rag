from fastapi import APIRouter, Depends, HTTPException
from src.auth.dependencies import require_admin
from src.eval.eval_store import get_eval_result

router = APIRouter(
    prefix="/eval",
    tags=["evaluation"],
    redirect_slashes=True,  # ✅ IMPORTANT
)

@router.get("")
@router.get("/")
def get_evaluation_metrics(admin=Depends(require_admin)):
    result = get_eval_result()

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="No evaluation has been run yet",
        )

    return result
