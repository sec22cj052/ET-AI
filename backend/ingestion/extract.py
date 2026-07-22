import os
import json
from typing import List, Dict, Any
from langchain_cohere import ChatCohere
from pydantic import BaseModel, Field

class ExtractedEntity(BaseModel):
    type: str = Field(description="Equipment, WorkOrder, Procedure, Component, or Standard")
    name: str = Field(description="The unique name or ID of the entity, e.g., Pump-101")
    properties: Dict[str, Any] = Field(description="Key-value pairs of properties like dates, status, parameters", default={})
    criticality: str = Field(description="Must be 'critical' if it contains safety-relevant data, equipment tags, pressures, isolation steps, compliance clauses, or safety dates. Otherwise 'operational'.")
    field_confidence: float = Field(description="LLM's self-reported confidence score for this extraction (0.0 to 1.0)")

class DocumentExtraction(BaseModel):
    document_type_confidence: float = Field(description="LLM's self-reported confidence score for identifying the correct document type (0.0 to 1.0)")
    entities: list[ExtractedEntity] = Field(default=[])

def get_llm():
    return ChatCohere(
        model="command-r-08-2024",
        cohere_api_key=os.getenv("COHERE_API_KEY"),
        temperature=0
    )

async def extract_entities_from_text(text: str, page_number: int) -> Dict[str, Any]:
    """Extracts entities and their relationships from a text chunk."""
    llm = get_llm().with_structured_output(DocumentExtraction)
    
    prompt = f"""
    You are a Principal Reliability Engineer and Industrial Data Architect building the core extraction engine for our hackathon solution.
    
    THE PROBLEM: In heavy industry, critical asset knowledge is trapped in disconnected PDFs (OEM Manuals, P&IDs, Work Orders). When an asset fails, technicians struggle because the maintenance history, operating parameters, and safety standards are siloed in different documents.
    OUR SOLUTION: We are building an intelligent Knowledge Graph. We extract physical assets (Equipment, Components) and logical records (Standards, Work Orders, Procedures) as core ENTITIES. We then connect them to break down silos.

    YOUR TASK:
    Analyze the following industrial document text and comprehensively extract key entities (Equipment, Component, WorkOrder, Procedure, Standard).
    For EVERY entity you extract, you MUST aggressively extract ALL associated properties, specifications, safety rules, operating limits, and dates found in the text.
    
    CRITICAL RULES:
    1. Do NOT extract raw parameters, measurements, or values (e.g., "12 bar", "Rated operating pressure", "-10 C") as standalone entities. 
    2. You MUST nest all parameters, specs, rules, dates, and measurements as key-value pairs inside the `properties` JSON object of the specific Equipment, Component, or Procedure entity they describe. Example: if a pump has a max pressure, add {{"max_pressure": "14 bar"}} to the pump's properties.
    3. If a safety rule or compliance step applies to a component, add it to that component's properties (e.g., {{"safety_rule": "Torque to 50Nm"}}).
    4. Ensure you provide accurate confidence scores and assess criticality correctly.
    
    Text:
    {text}
    """
    
    try:
        result = await llm.ainvoke(prompt)
        entities = []
        for e in result.entities:
            entities.append({
                "type": e.type,
                "name": e.name,
                "properties": e.properties,
                "source_page": page_number,
                "criticality": e.criticality,
                "field_confidence": e.field_confidence
            })
            
        # We infer relationships implicitly (equipment <-> work_order)
        relationships = []
        equipment = [e for e in result.entities if e.type == "Equipment"]
        work_orders = [e for e in result.entities if e.type == "WorkOrder"]
        for eq in equipment:
            for wo in work_orders:
                relationships.append({
                    "source_name": eq.name,
                    "target_name": wo.name,
                    "relationship_type": "MAINTAINED_BY"
                })
                
        return {
            "document_type_confidence": result.document_type_confidence,
            "entities": entities, 
            "relationships": relationships
        }
    except Exception as e:
        print(f"Extraction Error on chunk: {e}")
        return {"document_type_confidence": 0.0, "entities": [], "relationships": []}

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
