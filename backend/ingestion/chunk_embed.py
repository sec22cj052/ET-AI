import os
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_cohere import CohereEmbeddings

def get_embeddings_model():
    return CohereEmbeddings(
        cohere_api_key=os.getenv("COHERE_API_KEY"),
        model="embed-english-v3.0"
    )

def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[Dict[str, Any]]:
    """Splits text into smaller semantic chunks."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    
    chunks = splitter.split_text(text)
    
    # We also calculate char_start and char_end if needed, but for now we just return the text
    # A more advanced implementation would track exact character offsets.
    return [{"text": chunk} for chunk in chunks]

async def embed_chunks(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Generates embeddings for a list of text chunks using Voyage AI."""
    model = get_embeddings_model()
    texts = [c["text"] for c in chunks]
    
    if not texts:
        return chunks
        
    embeddings = await model.aembed_documents(texts)
    
    for chunk, emb in zip(chunks, embeddings):
        chunk["embedding"] = emb
        
    return chunks
