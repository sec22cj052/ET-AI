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

// Radial gauge component
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
  const [showRules, setShowRules] = useState(false);

  const [feedback, setFeedback] = useState('');
  const [improving, setImproving] = useState(false);
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
    setFeedback('');
    setShowRawData(false);
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
      const res = await fetch('/ingest/chunk/${chunkId}', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editChunkText })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setChunks(chunks.map(c => c.id === chunkId ? { ...c, text: editChunkText, is_locked: true } : c));
      setEditingChunkId(null);
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleImprove = async () => {
    if (!docDetails || !feedback.trim()) return;
    setImproving(true);
    try {
      const res = await fetch('/ingest/${docDetails.id}/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFeedback('');
      setSelectedDocId(null);
      setDocDetails(null);
      await fetchDocuments();
      alert("Document sent back to AI for re-processing. Locked edits were preserved.");
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setImproving(false); }
  };

  const handleApprove = async () => {
    if (!docDetails) return;
    setApproving(true);
    try {
      const res = await fetch('/ingest/${docDetails.id}/approve', { method: 'PUT' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDocDetails({ ...docDetails, status: 'approved' });
      setDocuments(documents.map(d => d.id === docDetails.id ? { ...d, status: 'approved' } : d));
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setApproving(false); }
  };

  // Build key facts from entities
  const keyFacts = entities.map(e => ({
    id: e.id,
    field: e.type,
    value: e.name,
    source: e.source_page ? `Page ${e.source_page}` : 'N/A',
    props: e.properties,
    confidence_composite: e.confidence_composite,
    criticality: e.criticality,
    review_status: e.review_status,
    rule_violations: e.rule_violations
  }));

  const handleReviewAction = async (entityId: string, action: string, reason_code: string) => {
    try {
      const res = await fetch('/ingest/entity/${entityId}/review-action', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason_code })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntities(entities.map(e => e.id === entityId ? { ...e, review_status: data.review_status, is_locked: true } : e));
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Failed'); }
  };

  // Build mini-graph data from entities and relationships
  const miniGraphData = (() => {
    const nodes = entities.map(e => ({ id: e.id, label: e.name, type: e.type }));
    // We don't have relationships in the review response, so we infer from entities
    // Equipment <-> WorkOrder implicit links
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

  // Extract dates for timeline
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
                    <a href={docDetails.storage_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:bg-primary-container p-1 rounded-full transition-colors flex items-center" title="Open Original">
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
            <div className="flex-1 flex overflow-hidden">
              {/* Source Document Viewer */}
              <div className="w-5/12 border-r border-outline-variant bg-surface-container-lowest flex flex-col relative hidden lg:flex">
                <div className="bg-surface-container-low border-b border-outline-variant p-2 flex items-center gap-2 shadow-sm z-10">
                  <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                  <span className="text-label-sm font-bold text-on-surface">Source Document</span>
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
                    <p className="text-body-md font-semibold">Source Preview</p>
                    <p className="text-body-sm mt-1">In production, the actual PDF renders here with page-sync.</p>
                  </div>
                )}
              </div>

              {/* Intelligence Report Panel */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

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
                    <div className="border border-outline-variant rounded-xl overflow-hidden">
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

                  {/* Key Facts Table */}
                  {keyFacts.length > 0 && (
                    <div className="border border-outline-variant rounded-xl overflow-hidden">
                      <div className="p-4 bg-surface-container-lowest flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">table_chart</span>
                        <h3 className="text-title-md font-bold text-on-surface">Key Facts Extracted</h3>
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="bg-surface-container-low text-label-sm text-on-surface-variant uppercase tracking-wider">
                            <th className="text-left p-3 border-t border-outline-variant">Type</th>
                            <th className="text-left p-3 border-t border-outline-variant">Confidence</th>
                            <th className="text-left p-3 border-t border-outline-variant">Value</th>
                            <th className="text-left p-3 border-t border-outline-variant">Source</th>
                            <th className="text-left p-3 border-t border-outline-variant">Details</th>
                            <th className="text-left p-3 border-t border-outline-variant">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant">
                          {keyFacts.map((fact, i) => (
                            <tr key={i} className="hover:bg-surface-container-low transition-colors">
                              <td className="p-3">
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-label-sm font-bold border border-primary/20">
                                  {fact.field}
                                </span>
                                {fact.criticality === 'critical' && (
                                    <span className="ml-2 text-red-600 material-symbols-outlined text-[14px]" title="Critical Field">warning</span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="w-16 h-2 bg-surface-container rounded-full overflow-hidden">
                                    <div className={`h-full ${fact.confidence_composite! >= 0.8 ? 'bg-lime-500' : fact.confidence_composite! >= 0.5 ? 'bg-orange-500' : 'bg-red-500'}`} style={{width: `${(fact.confidence_composite || 0) * 100}%`}}></div>
                                </div>
                                <span className="text-[10px] text-on-surface-variant">{(fact.confidence_composite || 0).toFixed(2)}</span>
                              </td>
                              <td className="p-3 text-body-md font-semibold text-on-surface">{fact.value}</td>
                              <td className="p-3 text-body-sm text-on-surface-variant">{fact.source}</td>
                              <td className="p-3 text-body-sm text-on-surface-variant font-mono">
                                {fact.props && Object.keys(fact.props).length > 0
                                  ? Object.entries(fact.props).map(([k, v]) => (
                                      <span key={k} className="mr-2 block">{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                                    ))
                                  : '—'
                                }
                                {fact.rule_violations && fact.rule_violations.length > 0 && (
                                    <div className="mt-2 text-red-600 text-[11px] font-bold">
                                      Violations: {fact.rule_violations.join(', ')}
                                    </div>
                                )}
                              </td>
                              <td className="p-3">
                                {fact.review_status === 'sme_approved' ? (
                                    <span className="text-lime-600 font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span> Approved</span>
                                ) : fact.review_status === 'needs_review' ? (
                                    <div className="flex gap-2">
                                        <button onClick={() => handleReviewAction(fact.id, 'approve', 'looks_good')} className="px-2 py-1 bg-lime-100 text-lime-800 hover:bg-lime-200 rounded text-xs font-bold transition-colors">Approve</button>
                                        <button onClick={() => handleReviewAction(fact.id, 'escalate', 'not_sure')} className="px-2 py-1 bg-red-100 text-red-800 hover:bg-red-200 rounded text-xs font-bold transition-colors">Escalate</button>
                                    </div>
                                ) : fact.review_status === 'escalated' ? (
                                    <span className="text-orange-600 font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">flag</span> Escalated</span>
                                ) : (
                                    <span className="text-gray-600 font-bold capitalize">{fact.review_status?.replace('_', ' ')}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Timeline */}
                  {timelineDates.length > 0 && (
                    <div className="border border-outline-variant rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-primary">timeline</span>
                        <h3 className="text-title-md font-bold text-on-surface">Event Timeline</h3>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {timelineDates.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 flex-shrink-0">
                            {i > 0 && <div className="w-8 h-px bg-outline-variant" />}
                            <div className="flex flex-col items-center gap-1 px-3 py-2 bg-surface-container rounded-lg border border-outline-variant min-w-[120px]">
                              <span className="text-label-sm font-bold text-primary">{item.date}</span>
                              <span className="text-[11px] text-on-surface-variant">{item.entity}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mini Relationship Graph */}
                  {miniGraphData.nodes.length > 1 && (
                    <div className="border border-outline-variant rounded-xl overflow-hidden">
                      <div className="p-4 bg-surface-container-lowest flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">hub</span>
                        <h3 className="text-title-md font-bold text-on-surface">Entity Relationship Map</h3>
                      </div>
                      <div ref={miniGraphRef} className="bg-surface-dim/20" style={{ height: 250 }}>
                        <ForceGraph2D
                          graphData={miniGraphData}
                          width={miniGraphDims.width}
                          height={250}
                          nodeCanvasObject={paintMiniNode}
                          nodeCanvasObjectMode={() => 'replace'}
                          linkLabel={(link: any) => link.label || ''}
                          linkColor={() => '#c3c6d7'}
                          linkWidth={1.5}
                          linkDirectionalArrowLength={4}
                          linkDirectionalArrowRelPos={1}
                          backgroundColor="#f9f9ff"
                          cooldownTicks={50}
                        />
                      </div>
                    </div>
                  )}

                  {/* Collapsible Raw Data Drawer */}
                  <div className="border border-outline-variant rounded-xl overflow-hidden">
                    <button
                      onClick={() => setShowRawData(!showRawData)}
                      className="w-full flex items-center justify-between p-4 bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-on-surface-variant">data_object</span>
                        <span className="text-title-md font-bold text-on-surface">Raw Extraction Data</span>
                        <span className="text-label-sm text-on-surface-variant">(Advanced)</span>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant">{showRawData ? 'expand_less' : 'expand_more'}</span>
                    </button>

                    {showRawData && (
                      <div className="border-t border-outline-variant">
                        {/* Tabs */}
                        <div className="flex border-b border-outline-variant">
                          <button
                            onClick={() => setActiveRawTab('chunks')}
                            className={`flex-1 py-2.5 text-label-md font-bold text-center border-b-2 transition-colors ${activeRawTab === 'chunks' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}
                          >
                            Text Chunks ({chunks.length})
                          </button>
                          <button
                            onClick={() => setActiveRawTab('entities')}
                            className={`flex-1 py-2.5 text-label-md font-bold text-center border-b-2 transition-colors ${activeRawTab === 'entities' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}
                          >
                            Entities ({entities.length})
                          </button>
                        </div>

                        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                          {activeRawTab === 'chunks' && chunks.map(chunk => (
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

                          {activeRawTab === 'entities' && entities.map(ent => (
                            <div key={ent.id} className="border border-outline-variant rounded-lg p-3 bg-white text-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-label-sm font-bold border border-primary/20">{ent.type}</span>
                                <span className="font-semibold text-on-surface">{ent.name}</span>
                                <span className="text-label-sm text-outline ml-auto">Page {ent.source_page ?? 'N/A'}</span>
                              </div>
                              <div className="bg-surface-container-low rounded p-2 font-mono text-xs text-on-surface-variant">
                                {Object.entries(ent.properties || {}).map(([k, v]) => (
                                  <div key={k}><span className="font-semibold text-on-surface">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Improvement Footer */}
                {docDetails.status === 'pending_review' && (
                  <div className="border-t border-outline-variant bg-white p-4 flex items-center gap-3 flex-shrink-0">
                    <span className="material-symbols-outlined text-primary">auto_awesome</span>
                    <input
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                      placeholder="Provide feedback to re-extract with AI..."
                      className="flex-1 px-3 py-2 border border-outline-variant rounded-sm text-body-md focus:outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={e => { if (e.key === 'Enter') handleImprove(); }}
                    />
                    <button
                      onClick={handleImprove}
                      disabled={!feedback.trim() || improving}
                      className="bg-secondary text-on-secondary px-4 py-2 rounded-sm font-label-md flex items-center gap-2 disabled:opacity-50"
                    >
                      {improving ? (
                        <><span className="material-symbols-outlined animate-spin text-[18px]">sync</span> Processing...</>
                      ) : (
                        <><span className="material-symbols-outlined text-[18px]">psychology</span> Re-Extract</>
                      )}
                    </button>
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
