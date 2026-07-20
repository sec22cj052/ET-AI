import { useState, useEffect } from 'react';

interface Document {
  id: string;
  filename: string;
  type: string;
  upload_date: string;
  storage_url: string;
  status: string;
}

interface Entity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  source_page: number | null;
  is_locked?: boolean;
}

interface Chunk {
  id: string;
  text: string;
  page_number: number | null;
  is_locked?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  processing: 'bg-blue-100 text-blue-800 border-blue-200',
  pending_review: 'bg-orange-100 text-orange-800 border-orange-200',
  approved: 'bg-lime-100 text-lime-800 border-lime-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
};

export default function Verification() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  
  const [docDetails, setDocDetails] = useState<Document | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'chunks' | 'entities'>('chunks');
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editChunkText, setEditChunkText] = useState('');
  
  const [feedback, setFeedback] = useState('');
  const [improving, setImproving] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (selectedDocId) {
      fetchDocumentDetails(selectedDocId);
    }
  }, [selectedDocId]);

  const fetchDocuments = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('http://localhost:8000/ingest/list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDocuments(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load document list');
    } finally {
      setLoadingList(false);
    }
  };

  const fetchDocumentDetails = async (id: string) => {
    setLoadingDetails(true);
    setError(null);
    setEditingChunkId(null);
    setFeedback('');
    try {
      const res = await fetch(`http://localhost:8000/ingest/${id}/review`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDocDetails(data.document);
      setEntities(data.entities || []);
      setChunks(data.chunks || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load document details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveChunk = async (chunkId: string) => {
    try {
      const res = await fetch(`http://localhost:8000/ingest/chunk/${chunkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editChunkText })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Update local state to reflect edit and lock
      setChunks(chunks.map(c => c.id === chunkId ? { ...c, text: editChunkText, is_locked: true } : c));
      setEditingChunkId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save chunk');
    }
  };

  const handleImprove = async () => {
    if (!docDetails || !feedback.trim()) return;
    setImproving(true);
    try {
      const res = await fetch(`http://localhost:8000/ingest/${docDetails.id}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // The backend puts it back into 'processing'
      // We should clear selection and refresh list
      setFeedback('');
      setSelectedDocId(null);
      setDocDetails(null);
      await fetchDocuments();
      alert("Document sent back to AI for re-processing. Locked edits were preserved.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to trigger AI improvement');
    } finally {
      setImproving(false);
    }
  };

  const handleApprove = async () => {
    if (!docDetails) return;
    setApproving(true);
    try {
      const res = await fetch(`http://localhost:8000/ingest/${docDetails.id}/approve`, {
        method: 'PUT'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      setDocDetails({ ...docDetails, status: 'approved' });
      // Update list silently
      setDocuments(documents.map(d => d.id === docDetails.id ? { ...d, status: 'approved' } : d));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to approve document');
    } finally {
      setApproving(false);
    }
  };

  const highlightEntities = (text: string) => {
    if (!entities.length) return text;
    const names = entities.map(e => e.name).filter(Boolean);
    if (!names.length) return text;

    const escapedNames = Array.from(new Set(names)).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'gi');

    const parts = text.split(regex);
    return parts.map((part, i) => {
      const match = entities.find(e => e.name.toLowerCase() === part.toLowerCase());
      if (match) {
        return (
          <mark key={i} className="bg-blue-100 text-blue-900 border border-blue-200 px-1 rounded cursor-help font-semibold" title={`Entity: ${match.type}`}>
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const navigateToPage = (page: number | null) => {
    if (!page || !docDetails?.storage_url) return;
    const viewer = document.getElementById('source-viewer') as HTMLIFrameElement;
    if (viewer) {
      const baseUrl = docDetails.storage_url.split('#')[0];
      viewer.src = `${baseUrl}#page=${page}&view=FitH`;
    }
  };

  const filteredDocs = documents.filter(d => statusFilter === 'all' || d.status === statusFilter);

  return (
    <div className="flex h-full overflow-hidden bg-surface-container-lowest">
      {/* Left Panel: Document Queue */}
      <div className="w-[380px] bg-white border-r border-outline-variant flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-outline-variant flex-shrink-0">
          <h2 className="text-headline-md font-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">fact_check</span>
            HITL Verification
          </h2>
          <p className="text-label-sm text-on-surface-variant mt-1">
            Review and approve AI extraction
          </p>
          
          <div className="mt-4 flex flex-wrap gap-2">
            {['pending_review', 'processing', 'approved', 'failed', 'all'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-label-sm capitalize transition-colors ${
                  statusFilter === status 
                    ? 'bg-primary text-on-primary' 
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {loadingList ? (
            <div className="text-center p-8 text-on-surface-variant flex flex-col items-center gap-2">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Loading queue...
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center p-8 text-on-surface-variant text-label-md">
              No documents in this status.
            </div>
          ) : (
            filteredDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => setSelectedDocId(doc.id)}
                className={`w-full text-left p-3 rounded-md transition-colors border ${
                  selectedDocId === doc.id 
                    ? 'bg-secondary-container border-primary text-on-secondary-container' 
                    : 'bg-white border-outline-variant hover:border-primary/50'
                }`}
              >
                <p className="font-semibold text-body-md truncate" title={doc.filename}>{doc.filename}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${STATUS_COLORS[doc.status] || 'bg-gray-100'}`}>
                    {doc.status.replace('_', ' ')}
                  </span>
                  <span className="text-label-sm text-on-surface-variant truncate">{doc.type}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Review Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {!selectedDocId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant gap-4">
            <span className="material-symbols-outlined text-6xl text-outline">rule</span>
            <p className="text-headline-md font-headline-md">Select a document to review</p>
          </div>
        ) : loadingDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
            <p className="text-body-md">Loading extraction details...</p>
          </div>
        ) : docDetails ? (
          <>
            {/* Toolbar Header */}
            <div className="bg-white border-b border-outline-variant p-4 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
              <div>
                <h1 className="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
                  {docDetails.filename}
                  <a href={docDetails.storage_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:bg-primary-container p-1 rounded-full transition-colors flex items-center" title="Open Original File">
                    <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  </a>
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-label-sm font-semibold px-2 py-0.5 rounded border ${STATUS_COLORS[docDetails.status] || 'bg-gray-100'}`}>
                    {docDetails.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-label-sm text-on-surface-variant">Type: {docDetails.type}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {docDetails.status === 'pending_review' && (
                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="bg-lime-600 hover:bg-lime-700 text-white px-5 py-2 rounded-sm font-label-lg font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {approving ? (
                      <><span className="material-symbols-outlined animate-spin text-[18px]">sync</span> Approving...</>
                    ) : (
                      <><span className="material-symbols-outlined text-[18px]">check_circle</span> Approve & Commit</>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Source Document Viewer (Innovation Sync) */}
              <div className="w-5/12 border-r border-outline-variant bg-surface-container-lowest flex flex-col relative hidden lg:flex">
                <div className="bg-surface-container-low border-b border-outline-variant p-2 flex items-center justify-between shadow-sm z-10">
                  <span className="text-label-sm font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                    Source Document Sync
                  </span>
                </div>
                {docDetails.storage_url && docDetails.storage_url !== '#' ? (
                  <iframe 
                    id="source-viewer"
                    src={`${docDetails.storage_url}#view=FitH`}
                    className="w-full h-full border-none"
                    title="Source Document"
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant p-6 text-center">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">link_off</span>
                    <p className="text-body-md font-semibold">No Real File URL</p>
                    <p className="text-body-sm mt-1">This is synthetic data. In production, the actual PDF/Image renders here and auto-scrolls to the exact page when you click chunks.</p>
                  </div>
                )}
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {/* Tabs */}
                <div className="flex border-b border-outline-variant">
                  <button 
                    onClick={() => setActiveTab('chunks')}
                    className={`flex-1 py-3 text-label-md font-bold text-center border-b-2 transition-colors ${activeTab === 'chunks' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:bg-surface-container-low'}`}
                  >
                    Text Chunks ({chunks.length})
                  </button>
                  <button 
                    onClick={() => setActiveTab('entities')}
                    className={`flex-1 py-3 text-label-md font-bold text-center border-b-2 transition-colors ${activeTab === 'entities' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:bg-surface-container-low'}`}
                  >
                    Structured Entities ({entities.length})
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {activeTab === 'chunks' && (
                    chunks.map(chunk => (
                      <div key={chunk.id} className="border border-outline-variant rounded-lg p-4 bg-surface-container-lowest hover:border-primary/30 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <button 
                            onClick={() => navigateToPage(chunk.page_number)}
                            className="text-label-sm font-mono text-outline hover:text-primary flex items-center gap-1 transition-colors"
                            title="Navigate source document to this page"
                          >
                            <span className="material-symbols-outlined text-[14px]">find_in_page</span>
                            Page {chunk.page_number ?? 'N/A'}
                          </button>
                          <div className="flex items-center gap-2">
                            {chunk.is_locked && (
                              <span className="text-orange-500 flex items-center gap-1 text-label-sm" title="Locked: Will not be overwritten by AI">
                                <span className="material-symbols-outlined text-[16px]">lock</span>
                                Protected
                              </span>
                            )}
                            {editingChunkId !== chunk.id && (
                              <button 
                                onClick={() => {
                                  setEditingChunkId(chunk.id);
                                  setEditChunkText(chunk.text);
                                }}
                                className="text-primary hover:bg-primary-container p-1 rounded-sm"
                                title="Edit Chunk"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {editingChunkId === chunk.id ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={editChunkText}
                              onChange={(e) => setEditChunkText(e.target.value)}
                              className="w-full h-32 p-3 border border-primary rounded-sm text-body-md focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingChunkId(null)} className="px-3 py-1.5 text-label-sm text-on-surface-variant hover:bg-surface-container rounded-sm">Cancel</button>
                              <button onClick={() => handleSaveChunk(chunk.id)} className="px-3 py-1.5 bg-primary text-on-primary text-label-sm rounded-sm font-semibold">Save & Lock</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
                            {highlightEntities(chunk.text)}
                          </p>
                        )}
                      </div>
                    ))
                  )}

                  {activeTab === 'entities' && (
                    <div className="grid grid-cols-1 gap-4">
                      {entities.map(ent => (
                        <div key={ent.id} className="border border-outline-variant rounded-lg p-4 bg-surface-container-lowest">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-label-sm font-bold border border-primary/20">{ent.type}</span>
                              <span className="text-body-lg font-semibold text-on-surface">{ent.name}</span>
                            </div>
                            <button 
                              onClick={() => navigateToPage(ent.source_page)}
                              className="text-label-sm text-outline hover:text-primary flex items-center gap-1 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">find_in_page</span>
                              Page {ent.source_page ?? 'N/A'}
                            </button>
                          </div>
                          
                          <div className="bg-surface-container-low rounded p-3 border border-outline-variant/50 font-mono text-sm overflow-x-auto text-on-surface-variant">
                            {Object.entries(ent.properties || {}).map(([k, v]) => (
                              <div key={k} className="flex py-1 border-b border-outline-variant/30 last:border-0">
                                <span className="w-1/3 text-on-surface font-semibold truncate pr-2" title={k}>{k}:</span>
                                <span className="w-2/3 break-words">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Sidebar: AI Improvement Panel */}
              <div className="w-[320px] bg-surface-container-lowest border-l border-outline-variant p-5 flex flex-col flex-shrink-0">
                <h3 className="text-title-md font-title-md text-on-surface flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary">auto_awesome</span>
                  Improve with AI
                </h3>
                
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-md mb-4 text-body-sm text-blue-900">
                  <p>Noticed missing or incorrect data? Provide feedback to the AI and re-run extraction.</p>
                  <p className="mt-2 font-semibold">Note: Locked (edited) rows will be preserved.</p>
                </div>
                
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="e.g., 'Extract the secondary valve parameters from page 12'"
                  className="w-full h-32 p-3 border border-outline-variant rounded-sm text-body-md mb-3 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none custom-scrollbar"
                />
                
                <button
                  onClick={handleImprove}
                  disabled={!feedback.trim() || improving || docDetails.status !== 'pending_review'}
                  className="w-full bg-secondary text-on-secondary py-2.5 rounded-sm font-label-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {improving ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                      Re-processing...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">psychology</span>
                      Re-Extract with AI
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
