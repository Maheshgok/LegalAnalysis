import os
import asyncio

os.environ["OPENAI_API_KEY"] = "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"

from services import run_analysis_pipeline, client
from document_parser import extract_text_from_pdf

async def test():
    pdf_path = r"C:\Users\Dell 5330\OneDrive\Documents\WP\Markolines\Exb\WPMarkolinesExbA.pdf"
    
    print(f"Reading PDF: {pdf_path}")
    text = await extract_text_from_pdf(pdf_path, client)
                
    print(f"Extracted {len(text)} characters via PyMuPDF/Vision.")
    print("Running 7-step pipeline on extracted text...")
    
    try:
        result = await run_analysis_pipeline(text, "")
        print("\n--- PHASE 1: Raw Facts ---")
        print(result.phase_1)
        print("\n--- PHASE 2: Narrative ---")
        print(result.phase_2)
        print("\n--- PHASE 3: Objective Formalization ---")
        print(result.phase_3)
        print("\n--- PHASE 4: Regulatory Mapping ---")
        print(result.phase_4)
        print("\n--- PHASE 5: SWOT ---")
        print(result.phase_5)
        print("\n--- PHASE 6: Adversarial Strategy ---")
        print(result.phase_6)
        print("\n--- PHASE 7: Precedent Matching ---")
        print(result.phase_7)
    except Exception as e:
        print(f"Pipeline failed: {e}")

if __name__ == "__main__":
    asyncio.run(test())
