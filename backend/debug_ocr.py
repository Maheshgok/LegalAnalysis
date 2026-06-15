import os
import asyncio

os.environ["OPENAI_API_KEY"] = "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"

from document_parser import extract_text_from_pdf
from services import client

async def debug_ocr():
    pdf_path = r"C:\Users\Dell 5330\OneDrive\Documents\WP\Markolines\Exb\WPMarkolinesExbB.pdf"
    print(f"Extracting raw text from {pdf_path}...")
    try:
        text = await extract_text_from_pdf(pdf_path, client)
        with open("ocr_debug.txt", "w", encoding="utf-8") as f:
            f.write(text)
        print("Done. Saved to ocr_debug.txt")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    asyncio.run(debug_ocr())
