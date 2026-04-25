from fastapi import APIRouter, Depends, HTTPException
from src.auth.dependencies import require_admin
from src.eval.eval_store import get_eval_result
from src.eval.run_eval import run_evaluation

router = APIRouter(
    prefix="/eval",
    tags=["evaluation"],
    redirect_slashes=True,  # ✅ IMPORTANT
)

@router.get("")
@router.get("/")
def get_evaluation_metrics(admin=Depends(require_admin)):
    result = get_eval_result(admin["org_slug"])

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="No evaluation has been run yet",
        )

    return result


@router.post("/run")
@router.post("/run/")
def run_evaluation_metrics(admin=Depends(require_admin)):
    try:
        return run_evaluation(admin["org_slug"])
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
