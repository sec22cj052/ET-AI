import os
import json
from typing import List, Dict, Any
from langchain_cohere import ChatCohere
from pydantic import BaseModel, Field

class DocumentEntities(BaseModel):
    equipment_ids: list[str] = Field(description="Equipment tags like Pump-101", default=[])
    work_order_ids: list[str] = Field(description="Work order IDs like WO-489", default=[])
    dates: list[str] = Field(description="Any dates mentioned", default=[])
    status: str = Field(description="Status of the work order, if applicable", default="")

def get_llm():
    return ChatCohere(
        model="command-r-08-2024",
        cohere_api_key=os.getenv("COHERE_API_KEY"),
        temperature=0
    )

async def extract_entities_from_text(text: str, page_number: int) -> Dict[str, List[Any]]:
    """Extracts entities and their relationships from a text chunk."""
    llm = get_llm().with_structured_output(DocumentEntities)
    
    prompt = f"""
    Analyze the following industrial document text and extract key entities. 
    Focus on Centrifugal Pumps, their components, maintenance work orders, operating procedures, and safety standards.
    
    Text:
    {text}
    """
    
    try:
        result = await llm.ainvoke(prompt)
        entities = []
        for eq in result.equipment_ids:
            entities.append({"type": "Equipment", "name": eq, "properties": {}, "source_page": page_number})
        for wo in result.work_order_ids:
            entities.append({
                "type": "WorkOrder", 
                "name": wo, 
                "properties": {"dates": result.dates, "status": result.status}, 
                "source_page": page_number
            })
            
        # We infer relationships implicitly (equipment <-> work_order)
        relationships = []
        for eq in result.equipment_ids:
            for wo in result.work_order_ids:
                relationships.append({
                    "source_name": eq,
                    "target_name": wo,
                    "relationship_type": "MAINTAINED_BY"
                })
                
        return {"entities": entities, "relationships": relationships}
    except Exception as e:
        print(f"Extraction Error on chunk: {e}")
        return {"entities": [], "relationships": []}

async def extract_from_image(image_bytes: bytes, page_number: int) -> List[Dict[str, Any]]:
    """Extracts entities directly from an image (e.g., P&ID) using Gemini Vision capabilities."""
    # Note: In a full implementation, you'd pass the image to the multimodal model.
    # For this hackathon scope, we assume text extraction handles the bulk, 
    # but this stub demonstrates where vision extraction plugs in.
    return []


async def generate_document_summary(full_text: str) -> str:
    """Generates a 2-3 sentence plain-English summary of the document for HITL review."""
    llm = get_llm()
    prompt = f"""You are an industrial document analyst. Summarize the following document in 2-3 concise sentences.
Focus on: what type of document it is, which equipment/assets it covers, and the key action or finding.
Do NOT use bullet points. Write in professional prose.

Document Text (truncated to first 3000 chars):
{full_text[:3000]}"""

    try:
        from langchain_core.messages import HumanMessage
        result = await llm.ainvoke([HumanMessage(content=prompt)])
        return result.content.strip()
    except Exception as e:
        print(f"Summary generation error: {e}")
        return ""
