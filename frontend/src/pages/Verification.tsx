import { useState, useEffect, useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

interface Document {
  id: string;
  filename: string;
  type: string;
  upload_date: string;
  storage_url: string;
  status: string;
  summary?: string;
}

interface Entity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, any>;
  source_page: number | null;
  is_locked?: boolean;
  confidence_composite?: number;
  confidence_breakdown?: any;
  criticality?: string;
  review_status?: string;
  rule_violations?: any;
  required_approval_level?: number;
}

interface Chunk {
  id: string;
  text: string;
  page_number: number | null;
  is_locked?: boolean;
}

interface RuleResult {
  id: string;
  name: string;
  weight: number;
  passed: boolean;
  detail: string;
  description: string;
}

interface Confidence {
  score: number;
  rules: RuleResult[];
}

const STATUS_COLORS: Record<string, string> = {
  processing: 'bg-blue-100 text-blue-800 border-blue-200',
  pending_review: 'bg-orange-100 text-orange-800 border-orange-200',
  approved: 'bg-lime-100 text-lime-800 border-lime-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
};

const TYPE_COLORS: Record<string, string> = {
  Equipment: '#004ac6',
  Component: '#475c0f',
  WorkOrder: '#775a00',
  Standard: '#7c3aed',
  Procedure: '#be185d',
  Default: '#737686',
};

function ConfidenceGauge({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#65a30d' : score >= 50 ? '#d97706' : '#dc2626';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black" style={{ color }}>{score}</span>
        <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

export default function Verification() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('pending_review');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const [docDetails, setDocDetails] = useState<Document | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [confidence, setConfidence] = useState<Confidence | null>(null);

  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showRawData, setShowRawData] = useState(false);
  const [activeRawTab, setActiveRawTab] = useState<'chunks' | 'entities'>('chunks');
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);
  const [editChunkText, setEditChunkText] = useState('');
  const [showRules, setShowRules] = useState(true);

  // Agentic Feedback Loop State
  const [improvingEntityId, setImprovingEntityId] = useState<string | null>(null);
  const [entityFeedback, setEntityFeedback] = useState('');
  const [isImprovingEntity, setIsImprovingEntity] = useState(false);
  const [proposedEntityUpdate, setProposedEntityUpdate] = useState<{id: string, properties: any} | null>(null);

  // Global Feedback Loop State
  const [globalFeedback, setGlobalFeedback] = useState('');
  const [isProcessingGlobal, setIsProcessingGlobal] = useState(false);

  const [approving, setApproving] = useState(false);

  const miniGraphRef = useRef<HTMLDivElement>(null);
  const [miniGraphDims, setMiniGraphDims] = useState({ width: 300, height: 250 });

  useEffect(() => { fetchDocuments(); }, []);
  useEffect(() => { if (selectedDocId) fetchDocumentDetails(selectedDocId); }, [selectedDocId]);

  useEffect(() => {
    if (miniGraphRef.current) {
      const obs = new ResizeObserver(() => {
        if (miniGraphRef.current) {
          setMiniGraphDims({ width: miniGraphRef.current.clientWidth, height: 250 });
        }
      });
      obs.observe(miniGraphRef.current);
      return () => obs.disconnect();
    }
  }, [docDetails]);

  const fetchDocuments = async () => {
    setLoadingList(true);
    try {
      const res = await fetch('/ingest/list');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDocuments(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoadingList(false); }
  };

  const fetchDocumentDetails = async (id: string) => {
    setLoadingDetails(true);
    setError(null);
    setEditingChunkId(null);
    setShowRawData(false);
    
    // Reset agentic loop state
    setImprovingEntityId(null);
    setEntityFeedback('');
    setProposedEntityUpdate(null);
    
    try {
      const res = await fetch(`/ingest/${id}/review`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDocDetails(data.document);
      setEntities(data.entities || []);
      setChunks(data.chunks || []);
      setConfidence(data.confidence || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoadingDetails(false); }
  };

  const handleSaveChunk = async (chunkId: string) => {
    try {
      const res = await fetch(`/ingest/chunk/${chunkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editChunkText })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setChunks(chunks.map(c => c.id === chunkId ? { ...c, text: editChunkText, is_locked: true } : c));
      setEditingChunkId(null);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  // Agentic Loop: Request Proposal
  const handleRequestEntityImprovement = async (entityId: string) => {
    if (!entityFeedback.trim()) return;
    setIsImprovingEntity(true);
    try {
      const res = await fetch(`/ingest/entity/${entityId}/improve_proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: entityFeedback })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProposedEntityUpdate({ id: entityId, properties: data.proposed_properties });
    } catch (err: unknown) { 
      alert(err instanceof Error ? err.message : 'Failed to generate proposal'); 
    } finally { 
      setIsImprovingEntity(false); 
    }
  };

  // Agentic Loop: Accept Proposal
  const handleAcceptEntityUpdate = async () => {
    if (!proposedEntityUpdate) return;
    try {
      const res = await fetch(`/ingest/entity/${proposedEntityUpdate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: proposedEntityUpdate.properties })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Update local state
      setEntities(entities.map(e => 
        e.id === proposedEntityUpdate.id 
          ? { ...e, properties: proposedEntityUpdate.properties, is_locked: true, review_status: 'approved' } 
          : e
      ));
      
      // Close loops
      setProposedEntityUpdate(null);
      setImprovingEntityId(null);
      setEntityFeedback('');
      
    } catch (err: unknown) { 
      alert(err instanceof Error ? err.message : 'Failed to apply update'); 
    }
  };

  const handleGlobalImprovement = async () => {
    if (!docDetails || !globalFeedback.trim()) return;
    setIsProcessingGlobal(true);
    try {
      const res = await fetch(`/ingest/${docDetails.id}/improve_global`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: globalFeedback })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      setGlobalFeedback('');
      // Reload document details to fetch updated entities
      await fetchDocumentDetails(docDetails.id);
    } catch (err: unknown) { 
      alert(err instanceof Error ? err.message : 'Failed to process global improvement'); 
    } finally { 
      setIsProcessingGlobal(false); 
    }
  };

  const handleApprove = async () => {
    if (!docDetails) return;
    setApproving(true);
    try {
      const res = await fetch(`/ingest/${docDetails.id}/approve`, { method: 'PUT' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDocDetails({ ...docDetails, status: 'approved' });
      setDocuments(documents.map(d => d.id === docDetails.id ? { ...d, status: 'approved' } : d));
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setApproving(false); }
  };

  const handleReviewAction = async (entityId: string, action: string, reason_code: string) => {
    try {
      const res = await fetch(`/ingest/entity/${entityId}/review-action`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason_code })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntities(entities.map(e => e.id === entityId ? { ...e, review_status: data.review_status, is_locked: true } : e));
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  const miniGraphData = (() => {
    const nodes = entities.map(e => ({ id: e.id, label: e.name, type: e.type }));
    const links: { source: string; target: string; label: string }[] = [];
    const equipments = entities.filter(e => e.type === 'Equipment');
    const workOrders = entities.filter(e => e.type === 'WorkOrder');
    for (const eq of equipments) {
      for (const wo of workOrders) {
        links.push({ source: eq.id, target: wo.id, label: 'MAINTAINED_BY' });
      }
    }
    return { nodes, links };
  })();

  const timelineDates = entities.flatMap(e => {
    const dates = e.properties?.dates || [];
    return dates.filter((d: string) => d).map((d: string) => ({ date: d, entity: e.name, type: e.type }));
  });

  const paintMiniNode = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
    const color = TYPE_COLORS[node.type] || TYPE_COLORS.Default;
    const r = 6;
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.font = '4px Inter, sans-serif';
    ctx.fillStyle = '#141b2b';
    ctx.textAlign = 'center';
    ctx.fillText(node.label || '', node.x || 0, (node.y || 0) + r + 5);
  }, []);

  const filteredDocs = documents.filter(d => statusFilter === 'all' || d.status === statusFilter);

  return (
    <div className="flex h-full overflow-hidden bg-surface-container-lowest">
      {/* Left Panel: Document Queue */}
      <div className="w-[320px] bg-white border-r border-outline-variant flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-outline-variant flex-shrink-0">
          <h2 className="text-headline-md font-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">fact_check</span>
            HITL Verification
          </h2>
          <p className="text-label-sm text-on-surface-variant mt-1">Review AI extraction quality</p>

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
          ) : filteredDocs.map(doc => (
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
          ))}
        </div>
      </div>

      {/* Right Panel: Document Intelligence Report */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {!selectedDocId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant gap-4">
            <span className="material-symbols-outlined text-6xl text-outline">rule</span>
            <p className="text-headline-md font-headline-md">Select a document to review</p>
          </div>
        ) : loadingDetails ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
            <p className="text-body-md">Loading intelligence report...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-4xl text-red-500">error</span>
            <p className="text-body-md text-red-700">{error}</p>
          </div>
        ) : docDetails ? (
          <>
            {/* Toolbar Header with Confidence Gauge */}
            <div className="bg-white border-b border-outline-variant p-4 flex items-center justify-between flex-shrink-0 z-10 shadow-sm">
              <div className="flex items-center gap-5">
                {confidence && <ConfidenceGauge score={confidence.score} />}
                <div>
                  <h1 className="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
                    {docDetails.filename}
                    <a href={docDetails.storage_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:bg-primary-container p-1 rounded-full transition-colors flex items-center" title="Open Original Document">
                      <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                    </a>
                  </h1>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-label-sm font-semibold px-2 py-0.5 rounded border ${STATUS_COLORS[docDetails.status] || 'bg-gray-100'}`}>
                      {docDetails.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-label-sm text-on-surface-variant">Type: {docDetails.type}</span>
                    <span className="text-label-sm text-on-surface-variant">{chunks.length} chunks · {entities.length} entities</span>
                  </div>
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

            {/* Main Content: Intelligence Report */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

              {/* AI Summary Card */}
              {docDetails.summary && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-blue-600">auto_awesome</span>
                    <h3 className="text-title-md font-bold text-blue-900">AI Document Summary</h3>
                  </div>
                  <p className="text-body-md text-blue-900 leading-relaxed">{docDetails.summary}</p>
                </div>
              )}

              {/* Confidence Rules Breakdown */}
              {confidence && (
                <div className="hub-card overflow-hidden">
                  <button
                    onClick={() => setShowRules(!showRules)}
                    className="w-full flex items-center justify-between p-4 bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">checklist</span>
                      <span className="text-title-md font-bold text-on-surface">Quality Rules ({confidence.rules.filter(r => r.passed).length}/{confidence.rules.length} passed)</span>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant">{showRules ? 'expand_less' : 'expand_more'}</span>
                  </button>
                  {showRules && (
                    <div className="border-t border-outline-variant divide-y divide-outline-variant">
                      {confidence.rules.map(rule => (
                        <div key={rule.id} className="flex items-start gap-3 p-3 px-4">
                          <span className={`material-symbols-outlined text-[20px] mt-0.5 ${rule.passed ? 'text-lime-600' : 'text-red-500'}`}>
                            {rule.passed ? 'check_circle' : 'cancel'}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-body-md font-semibold text-on-surface">{rule.name}</span>
                              <span className="text-label-sm text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">{rule.weight}%</span>
                            </div>
                            <p className="text-body-sm text-on-surface-variant mt-0.5">{rule.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Insight Cards (Replaces old Key Facts table) */}
              {entities.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary">psychology</span>
                    <h3 className="text-title-md font-bold text-on-surface">Extracted Entities & Insights</h3>
                  </div>

                  {/* Global Instruction Box */}
                  <div className="bg-surface-container-lowest border border-primary/30 rounded-xl p-4 mb-6 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-primary mt-1">tips_and_updates</span>
                      <div className="flex-1">
                        <h4 className="text-label-lg font-bold text-on-surface mb-1">Global AI Instruction (Bulk Extract)</h4>
                        <p className="text-body-sm text-on-surface-variant mb-3">
                          Missing properties across multiple items? Give the AI a single instruction to re-scan the document and update all unlocked entities automatically.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g., 'Find the material and operating pressure for all components'"
                            className="flex-1 text-body-md p-2 border border-outline-variant rounded-md focus:outline-none focus:border-primary"
                            value={globalFeedback}
                            onChange={(e) => setGlobalFeedback(e.target.value)}
                            disabled={isProcessingGlobal}
                            onKeyDown={(e) => e.key === 'Enter' && handleGlobalImprovement()}
                          />
                          <button
                            onClick={handleGlobalImprovement}
                            disabled={isProcessingGlobal || !globalFeedback.trim()}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-md flex items-center gap-2 disabled:opacity-50 transition-colors"
                          >
                            {isProcessingGlobal ? (
                              <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> Scanning...</>
                            ) : (
                              <><span className="material-symbols-outlined text-[18px]">auto_awesome</span> Apply to All</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {entities.map((ent) => (
                      <div key={ent.id} className={`border rounded-xl bg-white shadow-sm overflow-hidden flex flex-col ${ent.is_locked ? 'border-lime-300 ring-1 ring-lime-300' : 'border-outline-variant'}`}>
                        {/* Card Header */}
                        <div className="p-4 border-b border-outline-variant bg-surface-container-lowest flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-label-sm font-bold border border-primary/20">
                                {ent.type}
                              </span>
                              {ent.criticality === 'critical' && (
                                <span className="text-red-600 material-symbols-outlined text-[16px]" title="Critical Asset">warning</span>
                              )}
                            </div>
                            <h4 className="text-title-lg font-bold text-on-surface">{ent.name}</h4>
                            <p className="text-label-sm text-on-surface-variant mt-0.5">Source: Page {ent.source_page ?? 'N/A'}</p>
                          </div>
                          
                          {/* Confidence Indicator */}
                          <div className="flex flex-col items-end">
                            <span className={`text-label-sm font-bold ${(ent.confidence_composite || 0) >= 0.8 ? 'text-lime-600' : (ent.confidence_composite || 0) >= 0.5 ? 'text-orange-500' : 'text-red-500'}`}>
                                {Math.round((ent.confidence_composite || 0) * 100)}% Conf
                            </span>
                            <div className="w-12 h-1.5 bg-surface-container rounded-full mt-1 overflow-hidden">
                                <div className={`h-full ${(ent.confidence_composite || 0) >= 0.8 ? 'bg-lime-500' : (ent.confidence_composite || 0) >= 0.5 ? 'bg-orange-500' : 'bg-red-500'}`} style={{width: `${(ent.confidence_composite || 0) * 100}%`}}></div>
                            </div>
                          </div>
                        </div>

                        {/* Card Body (Properties) */}
                        <div className="p-4 flex-1">
                          {ent.rule_violations && ent.rule_violations.length > 0 && (
                            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-2 flex items-start gap-2">
                               <span className="material-symbols-outlined text-[16px] text-red-600 mt-0.5">error</span>
                               <span className="text-label-sm text-red-800">Violation: {ent.rule_violations.join(', ')}</span>
                            </div>
                          )}

                          <div className="space-y-3">
                            {ent.properties && Object.keys(ent.properties).length > 0 ? (
                                Object.entries(ent.properties).map(([k, v]) => (
                                    <div key={k}>
                                        <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-0.5">{k.replace(/_/g, ' ')}</p>
                                        <p className="text-body-md text-on-surface font-medium">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-body-md text-on-surface-variant italic">No properties extracted.</p>
                            )}
                          </div>
                        </div>

                        {/* Card Footer (Agentic Loop & Review) */}
                        <div className="p-3 bg-surface-container-lowest border-t border-outline-variant mt-auto">
                          {/* If currently improving this specific entity, show the feedback loop UI */}
                          {improvingEntityId === ent.id ? (
                             <div className="space-y-3">
                               {!proposedEntityUpdate ? (
                                 <>
                                   <textarea
                                     autoFocus
                                     placeholder="Tell the AI what's wrong (e.g., 'The pressure should be 500 psi')..."
                                     className="w-full text-body-sm p-2 border border-primary rounded-md focus:outline-none focus:ring-1 focus:ring-primary min-h-[80px] resize-y"
                                     value={entityFeedback}
                                     onChange={(e) => setEntityFeedback(e.target.value)}
                                     disabled={isImprovingEntity}
                                   />
                                   <div className="flex justify-end gap-2">
                                     <button 
                                        onClick={() => { setImprovingEntityId(null); setEntityFeedback(''); }}
                                        className="px-3 py-1.5 text-label-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-sm"
                                        disabled={isImprovingEntity}
                                     >
                                        Cancel
                                     </button>
                                     <button 
                                        onClick={() => handleRequestEntityImprovement(ent.id)}
                                        className="px-3 py-1.5 text-label-sm font-bold bg-primary text-on-primary rounded-sm flex items-center gap-1 disabled:opacity-50"
                                        disabled={isImprovingEntity || !entityFeedback.trim()}
                                     >
                                        {isImprovingEntity ? (
                                           <><span className="material-symbols-outlined text-[16px] animate-spin">sync</span> Thinking...</>
                                        ) : 'Generate Fix'}
                                     </button>
                                   </div>
                                 </>
                               ) : (
                                 <div className="bg-primary/5 border border-primary/30 p-3 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="material-symbols-outlined text-[16px] text-primary">auto_awesome</span>
                                      <span className="text-label-sm font-bold text-primary">Proposed Fix:</span>
                                    </div>
                                    <div className="bg-white border border-outline-variant rounded p-2 text-xs font-mono mb-3 max-h-32 overflow-y-auto">
                                      {JSON.stringify(proposedEntityUpdate.properties, null, 2)}
                                    </div>
                                    <div className="flex justify-end gap-2">
                                     <button 
                                        onClick={() => { setProposedEntityUpdate(null); setEntityFeedback(''); }}
                                        className="px-3 py-1.5 text-label-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-sm"
                                     >
                                        Discard
                                     </button>
                                     <button 
                                        onClick={handleAcceptEntityUpdate}
                                        className="px-3 py-1.5 text-label-sm font-bold bg-lime-600 hover:bg-lime-700 text-white rounded-sm flex items-center gap-1"
                                     >
                                        <span className="material-symbols-outlined text-[16px]">check_circle</span> Accept & Apply
                                     </button>
                                   </div>
                                 </div>
                               )}
                             </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              {ent.is_locked ? (
                                <span className="text-lime-600 text-label-sm font-bold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">check_circle</span> Approved
                                </span>
                              ) : (
                                <div className="flex items-center gap-3">
                                  {ent.review_status === 'rejected' && (
                                    <span className="text-red-600 text-label-sm font-bold flex items-center gap-1 bg-red-50 px-2 py-1 rounded">
                                      <span className="material-symbols-outlined text-[16px]">assignment_return</span> Sent Back by Plant Manager
                                    </span>
                                  )}
                                  <div className="flex gap-2">
                                    <button onClick={() => handleReviewAction(ent.id, 'approve', 'looks_good')} className="px-3 py-1.5 bg-surface-container hover:bg-lime-100 hover:text-lime-800 rounded-sm text-label-sm font-bold transition-colors">Approve</button>
                                  </div>
                                </div>
                              )}
                              
                              <button 
                                onClick={() => setImprovingEntityId(ent.id)} 
                                className="px-3 py-1.5 text-primary hover:bg-primary-container rounded-sm text-label-sm font-bold transition-colors flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                Improve with AI
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advanced: Raw Data Drawer */}
              <div className="hub-card overflow-hidden mt-8">
                <button
                  onClick={() => setShowRawData(!showRawData)}
                  className="w-full flex items-center justify-between p-4 bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-on-surface-variant">data_object</span>
                    <span className="text-title-md font-bold text-on-surface">Raw Chunking Data</span>
                    <span className="text-label-sm text-on-surface-variant">(Advanced)</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant">{showRawData ? 'expand_less' : 'expand_more'}</span>
                </button>

                {showRawData && (
                  <div className="border-t border-outline-variant p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {chunks.map(chunk => (
                      <div key={chunk.id} className="border border-outline-variant rounded-lg p-3 bg-white text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-label-sm font-mono text-outline">Page {chunk.page_number ?? 'N/A'}</span>
                          <div className="flex items-center gap-2">
                            {chunk.is_locked && (
                              <span className="text-orange-500 flex items-center gap-1 text-label-sm">
                                <span className="material-symbols-outlined text-[14px]">lock</span>
                              </span>
                            )}
                            {editingChunkId !== chunk.id && (
                              <button onClick={() => { setEditingChunkId(chunk.id); setEditChunkText(chunk.text); }}
                                className="text-primary hover:bg-primary-container p-0.5 rounded-sm">
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                            )}
                          </div>
                        </div>
                        {editingChunkId === chunk.id ? (
                          <div className="mt-1 space-y-2">
                            <textarea value={editChunkText} onChange={e => setEditChunkText(e.target.value)}
                              className="w-full h-24 p-2 border border-primary rounded-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingChunkId(null)} className="px-2 py-1 text-label-sm text-on-surface-variant">Cancel</button>
                              <button onClick={() => handleSaveChunk(chunk.id)} className="px-2 py-1 bg-primary text-on-primary text-label-sm rounded-sm">Save & Lock</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-body-sm text-on-surface whitespace-pre-wrap leading-relaxed">{chunk.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
