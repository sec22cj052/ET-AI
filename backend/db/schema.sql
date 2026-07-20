CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    type TEXT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    storage_path TEXT,
    storage_url TEXT,
    status TEXT DEFAULT 'pending_review',
    summary TEXT
);

CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    properties JSONB,
    source_document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    source_page INTEGER,
    is_locked BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE entity_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    target_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL
);

CREATE TABLE vector_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    embedding vector(1024), -- Voyage AI embedding size
    page_number INTEGER,
    section_heading TEXT,
    char_start INTEGER,
    char_end INTEGER,
    is_locked BOOLEAN NOT NULL DEFAULT false
);
