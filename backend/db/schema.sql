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
    summary TEXT,
    current_step TEXT DEFAULT 'queued',
    step_status TEXT DEFAULT 'pending',
    step_history JSONB DEFAULT '[]',
    step_detail TEXT
);

CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    properties JSONB,
    source_document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    source_page INTEGER,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    confidence_composite FLOAT,
    confidence_breakdown JSONB,
    criticality TEXT,
    review_status TEXT,
    rule_violations JSONB,
    required_approval_level INT
);

CREATE TABLE entity_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    target_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL
);

CREATE TABLE tacit_knowledge_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    contributor_name TEXT NOT NULL,
    contributor_role TEXT NOT NULL,
    capture_method TEXT NOT NULL, -- 'text' | 'voice_transcript'
    content_text TEXT NOT NULL,
    audio_storage_url TEXT,
    capture_context TEXT NOT NULL, -- 'hitl_review_addon' | 'quick_capture' | 'exit_interview'
    trust_tier TEXT NOT NULL DEFAULT 'unverified', -- 'unverified' | 'peer_reviewed' | 'sme_verified'
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
    is_locked BOOLEAN NOT NULL DEFAULT false,
    source_type TEXT NOT NULL DEFAULT 'document', -- 'document' | 'tacit_knowledge'
    tacit_note_id UUID REFERENCES tacit_knowledge_notes(id) ON DELETE CASCADE,
    ocr_confidence FLOAT
);
