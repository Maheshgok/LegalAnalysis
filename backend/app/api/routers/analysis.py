from fastapi import APIRouter, HTTPException
import logging
from app.models.schemas import InitialAnalysisRequest, PrecedentRequest, StrategyAnalysisRequest
from app.services.llm_service import run_initial_analysis, run_precedent_analysis, run_strategy_analysis

router = APIRouter()

@router.post("/initial")
async def analyze_initial(request: InitialAnalysisRequest):
    if not request.document_text.strip():
        raise HTTPException(status_code=400, detail="Document text cannot be empty.")
    if request.provider not in ["openai", "google"]:
        raise HTTPException(status_code=400, detail="Invalid provider. Must be 'openai' or 'google'.")
        
    try:
        result = await run_initial_analysis(request.document_text, request.provider)
        return {"status": "success", "data": result.model_dump()}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Initial Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Initial Analysis encountered an error: {str(e)}")

@router.post("/strategy")
async def analyze_strategy(request: StrategyAnalysisRequest):
    if not request.phase_3.strip() or not request.phase_4.strip():
        raise HTTPException(status_code=400, detail="Previous phases context cannot be empty.")
    if not request.party_a.strip() or not request.party_b.strip():
        raise HTTPException(status_code=400, detail="Both Party A and Party B must be provided.")
        
    try:
        result = await run_strategy_analysis(
            request.phase_3, request.phase_4, 
            request.party_a, request.party_b, 
            request.provider
        )
        return {"status": "success", "data": result.model_dump()}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Strategy Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Strategy Analysis encountered an error: {str(e)}")

@router.post("/precedent")
async def analyze_precedent(request: PrecedentRequest):
    if not request.phase_6.strip():
        raise HTTPException(status_code=400, detail="Phase 6 context cannot be empty.")
        
    try:
        result = await run_precedent_analysis(request.phase_6, request.case_law_context, request.provider)
        return {"status": "success", "data": result.model_dump()}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Precedent Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Precedent Analysis encountered an error: {str(e)}")

