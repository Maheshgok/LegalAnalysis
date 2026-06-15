from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List
import os
import tempfile
import logging
from app.services.ocr_service import extract_text_from_pdf
from app.services.llm_service import summarize_precedent_document

router = APIRouter()

@router.post("/extract")
async def extract_documents(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided for extraction.")
        
    try:
        combined_text = ""
        for file in files:
            suffix = os.path.splitext(file.filename)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_file.write(await file.read())
                temp_path = temp_file.name
                
            try:
                document_text = await extract_text_from_pdf(temp_path)
                combined_text += f"\n\n--- START OF DOCUMENT: {file.filename} ---\n\n"
                combined_text += document_text
                combined_text += f"\n\n--- END OF DOCUMENT: {file.filename} ---\n\n"
            except HTTPException:
                raise
            except Exception as e:
                logging.error(f"Failed to extract text from {file.filename}: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to process {file.filename}: {str(e)}")
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    
        return {"status": "success", "data": {"extracted_text": combined_text}}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Document extraction failed completely: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred during document extraction.")

@router.post("/summarize-precedents")
async def summarize_precedents(
    provider: str = Form("openai"),
    files: List[UploadFile] = File(...)
):
    if not files:
        raise HTTPException(status_code=400, detail="No precedent files provided.")
        
    try:
        combined_text = ""
        for file in files:
            suffix = os.path.splitext(file.filename)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_file.write(await file.read())
                temp_path = temp_file.name
                
            try:
                document_text = await extract_text_from_pdf(temp_path)
                combined_text += f"\n\n--- START OF PRECEDENT: {file.filename} ---\n\n"
                combined_text += document_text
                combined_text += f"\n\n--- END OF PRECEDENT: {file.filename} ---\n\n"
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    
        # Summarize the combined precedents
        summarized_text = await summarize_precedent_document(combined_text, provider)
        return {"status": "success", "data": {"summarized_text": summarized_text}}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Precedent summarization failed: {str(e)}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred during precedent summarization.")
