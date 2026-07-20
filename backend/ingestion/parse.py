import pdfplumber
import pandas as pd
from typing import List, Dict, Any

async def parse_pdf(file_path: str) -> List[Dict[str, Any]]:
    """Extracts text from PDF page by page."""
    pages_content = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            
            # Extract tables and format them as markdown-like structured text
            tables = page.extract_tables()
            for table in tables:
                # SANITY CHECK: A real table usually has >1 row and >1 column. 
                # If it's a 1x1 table, it's just a boxed paragraph (false positive).
                if len(table) > 1 and any(len(row) > 1 for row in table):
                    text += "\n\n[TABLE EXTRACTED FROM PDF]\n"
                    for row in table:
                        # Replace None with empty string and clean newlines in cells
                        cleaned_row = [str(cell).replace("\n", " ").strip() if cell is not None else "" for cell in row]
                        text += " | ".join(cleaned_row) + "\n"
                    text += "[/TABLE]\n"
                else:
                    # It was a false positive, ignore it to prevent duplicates
                    continue
                
            pages_content.append({
                "page_number": i + 1,
                "text": text
            })
    return pages_content

async def parse_csv_or_excel(file_path: str, is_excel: bool = False) -> List[Dict[str, Any]]:
    """Parses CSV or Excel row by row into string representations."""
    if is_excel:
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)
    
    # We treat each row as a 'page' or chunk for structural simplicity
    rows_content = []
    for i, row in df.iterrows():
        text = ", ".join([f"{col}: {val}" for col, val in row.items() if pd.notna(val)])
        rows_content.append({
            "page_number": i + 1,  # Using row index as page number for traceability
            "text": text
        })
    return rows_content

import base64
from langchain_core.messages import HumanMessage
from langchain_cohere import ChatCohere
import os

def _get_vision_llm():
    return ChatCohere(
        model="command-a-vision-07-2025",
        cohere_api_key=os.getenv("COHERE_API_KEY"),
        temperature=0
    )

async def parse_image(file_path: str) -> List[Dict[str, Any]]:
    """Extracts text and entities directly from an image (e.g., P&ID) using Cohere Vision."""
    llm = _get_vision_llm()
    
    with open(file_path, "rb") as image_file:
        image_data = base64.b64encode(image_file.read()).decode("utf-8")
        
    # Infer basic mime type from extension
    ext = file_path.lower().split(".")[-1]
    mime_type = f"image/{'jpeg' if ext in ['jpg', 'jpeg'] else ext if ext == 'webp' else 'png'}"
        
    message = HumanMessage(
        content=[
            {"type": "text", "text": "Extract all text, equipment tags, parameters, and relevant information from this P&ID or engineering drawing. Output a structured text representation of what you see."},
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime_type};base64,{image_data}"}
            },
        ]
    )
    
    try:
        result = await llm.ainvoke([message])
        return [{
            "page_number": 1,
            "text": result.content
        }]
    except Exception as e:
        print(f"Vision parsing error: {e}")
        return []
