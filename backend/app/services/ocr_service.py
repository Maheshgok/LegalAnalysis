import fitz  # PyMuPDF
from google.cloud import vision
import logging
from fastapi import HTTPException
import gc

# Initialize GCP Vision client lazily to avoid startup crash if creds are missing
_vision_client = None

def get_vision_client():
    global _vision_client
    if not _vision_client:
        try:
            _vision_client = vision.ImageAnnotatorClient()
        except Exception as e:
            logging.error(f"Failed to initialize Google Cloud Vision client: {e}")
            raise HTTPException(status_code=500, detail="OCR Service Unavailable. Check Google Cloud credentials.")
    return _vision_client

async def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Reads a PDF. If it contains text, extracts it.
    If it's a scanned image, it renders the pages as images 
    and uses Google Cloud Vision API to perform robust OCR.
    """
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        logging.error(f"PyMuPDF failed to open document at {pdf_path}: {e}")
        raise HTTPException(status_code=400, detail="Invalid or corrupt PDF document.")

    full_text = ""
    
    # First pass: try standard text extraction
    for page in doc:
        full_text += page.get_text() + "\n"
        
    if len(full_text.strip()) > 50:
        return full_text
        
    # Second pass: OCR via GCP Vision if no text was found
    logging.info(f"No text layer found in {pdf_path}. Switching to Google Cloud Vision OCR...")
    ocr_text = ""
    
    vision_client = get_vision_client()
    
    for page_num in range(len(doc)):
        try:
            page = doc.load_page(page_num)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
            img_bytes = pix.tobytes("png")
            
            image = vision.Image(content=img_bytes)
            response = vision_client.document_text_detection(image=image)
            
            if response.error.message:
                raise Exception(response.error.message)
                
            page_text = response.full_text_annotation.text
            if page_text:
                ocr_text += page_text + "\n\n"
        except Exception as e:
            logging.error(f"Google Cloud Vision failed on page {page_num + 1}: {e}")
            raise HTTPException(status_code=502, detail=f"OCR processing failed on page {page_num + 1}: {e}")
        finally:
            # Aggressive C-level memory destruction
            try:
                del page
                del pix
                del img_bytes
                del image
                del response
            except NameError:
                pass
            gc.collect()
            
    doc.close()
    del doc
    gc.collect()
    
    return ocr_text
