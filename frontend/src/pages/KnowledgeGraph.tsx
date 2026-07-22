import { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useNavigate } from 'react-router-dom';
import TacitCaptureWidget from '../components/TacitCaptureWidget';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  data: Record<string, any>;
  degree: number;
  source_document: string;
  source_document_id: string;
  x?: number;
  y?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: { source: string; target: string; relationship: string }[];
}

const TYPE_COLORS: Record<string, string> = {
  Equipment: '#004ac6',
  Component: '#475c0f',
  WorkOrder: '#d97706',
  Standard: '#7c3aed',
  Procedure: '#be185d',
  Default: '#737686',
};

const TYPE_ICONS: Record<string, string> = {
  Equipment: '⚙️',
  Component: '🔩',
  WorkOrder: '📋',
  Standard: '📜',
  Procedure: '📝',
};

export default function KnowledgeGraph() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedRelationships, setSelectedRelationships] = useState<{ source: string; target: string; relationship: string }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const navigate = useNavigate();

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const fetchGraph = async (entityId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = entityId
        ? `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/graph/explore/${entityId}`
        : `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/graph/explore`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNodeCount(data.nodes?.length || 0);
      setEdgeCount(data.edges?.length || 0);
      setGraphData({
        nodes: data.nodes || [],
        links: (data.edges || []).map((e: GraphEdge) => ({
          source: e.source,
          target: e.target,
          relationship: e.relationship,
        })),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGraph(); }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelected(node);
    // Find relationships for this node
    const rels = graphData.links.filter(
      (l: any) => (typeof l.source === 'object' ? l.source.id : l.source) === node.id || 
                   (typeof l.target === 'object' ? l.target.id : l.target) === node.id
    ).map((l: any) => ({
      source: typeof l.source === 'object' ? l.source.label || l.source.id : l.source,
      target: typeof l.target === 'object' ? l.target.label || l.target.id : l.target,
      relationship: l.relationship,
    }));
    setSelectedRelationships(rels);
  }, [graphData]);

  // Search highlighting
  const matchesSearch = useCallback((node: GraphNode) => {
    if (!searchQuery.trim()) return true;
    return node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
           node.type.toLowerCase().includes(searchQuery.toLowerCase());
  }, [searchQuery]);

  // Type filtering
  const matchesFilter = useCallback((node: GraphNode) => {
    if (filterType === 'all') return true;
    return node.type === filterType;
  }, [filterType]);

  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D) => {
    const color = TYPE_COLORS[node.type] || TYPE_COLORS.Default;
    const isSelected = selected?.id === node.id;
    const isSearchMatch = matchesSearch(node);
    const isFilterMatch = matchesFilter(node);
    const isActive = isSearchMatch && isFilterMatch;

    // Size by degree (min 5, max 16)
    const baseRadius = Math.min(5 + (node.degree || 0) * 2, 16);
    const r = isSelected ? baseRadius + 3 : baseRadius;

    // Dim non-matching nodes
    ctx.globalAlpha = isActive ? 1 : 0.15;

    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = '#fdc416';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Label
    const fontSize = isSelected ? 5 : 4;
    ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = isActive ? '#141b2b' : '#999';
    ctx.textAlign = 'center';
    ctx.fillText(node.label || node.id, node.x || 0, (node.y || 0) + r + 6);

    ctx.globalAlpha = 1;
  }, [selected, matchesSearch, matchesFilter]);

  // Custom link rendering with labels
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    const sx = link.source.x;
    const sy = link.source.y;
    const tx = link.target.x;
    const ty = link.target.y;

    // Draw the line
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = '#c3c6d7';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw arrow
    const angle = Math.atan2(ty - sy, tx - sx);
    const arrowLen = 4;
    const mx = tx - Math.cos(angle) * 8;
    const my = ty - Math.sin(angle) * 8;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx - arrowLen * Math.cos(angle - Math.PI / 6), my - arrowLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(mx - arrowLen * Math.cos(angle + Math.PI / 6), my - arrowLen * Math.sin(angle + Math.PI / 6));
    ctx.fillStyle = '#a3a6b7';
    ctx.fill();

    // Draw label at midpoint
    const midX = (sx + tx) / 2;
    const midY = (sy + ty) / 2;
    ctx.font = '3px Inter, sans-serif';
    ctx.fillStyle = '#8888aa';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(link.relationship || '', midX, midY - 3);
  }, []);

  // Get unique types for filter
  const allTypes = Array.from(new Set(graphData.nodes.map(n => n.type)));

  // Get unique equipment for drill-down
  const equipmentNodes = graphData.nodes.filter(n => n.type === 'Equipment');

  return (
    <div className="flex h-full overflow-hidden">
      {/* Graph Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-outline-variant flex-shrink-0 gap-4">
          <div>
            <h1 className="text-headline-md font-headline-md text-on-surface">Knowledge Graph Explorer</h1>
            <p className="text-label-md text-on-surface-variant">
              {nodeCount} nodes · {edgeCount} relationships
            </p>
          </div>
          <div className="flex items-center gap-3 flex-1 max-w-2xl">
            {/* Search */}
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[18px]">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search entities..."
                className="w-full pl-9 pr-3 py-1.5 border border-outline-variant rounded-sm text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              />
            </div>

            {/* Type filter */}
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="px-3 py-1.5 border border-outline-variant rounded-sm text-body-md bg-white focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Types</option>
              {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Equipment drill-down */}
            {equipmentNodes.length > 0 && (
              <select
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'all') fetchGraph();
                  else fetchGraph(val);
                }}
                className="px-3 py-1.5 border border-outline-variant rounded-sm text-body-md bg-white focus:ring-1 focus:ring-primary"
                defaultValue="all"
              >
                <option value="all">Full Graph</option>
                {equipmentNodes.map(eq => (
                  <option key={eq.id} value={eq.id}>🔍 {eq.label}</option>
                ))}
              </select>
            )}

            {/* Legend */}
            <div className="hidden xl:flex items-center gap-2 flex-shrink-0">
              {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'Default').map(([type, color]) => (
                <div key={type} className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-label-sm text-on-surface-variant">{type}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => fetchGraph()}
              className="flex items-center gap-1 px-3 py-1.5 bg-surface-container rounded-sm text-label-md text-on-surface-variant hover:text-primary transition-colors flex-shrink-0"
            >
              <span className="material-symbols-outlined text-base">refresh</span>Refresh
            </button>
          </div>
        </div>

        {/* Graph Area */}
        <div ref={containerRef} className="flex-1 relative bg-surface-dim/30">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 z-10">
              <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
              <p className="text-body-md text-on-surface-variant">Loading knowledge graph...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <span className="material-symbols-outlined text-5xl text-red-500">error</span>
              <p className="text-body-md text-red-700">{error}</p>
              <button onClick={() => fetchGraph()} className="px-4 py-2 bg-primary text-on-primary rounded-sm text-label-md">Retry</button>
            </div>
          )}
          {!loading && !error && graphData.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <span className="material-symbols-outlined text-6xl text-outline">account_tree</span>
              <p className="text-headline-md text-on-surface-variant">No graph data yet</p>
              <p className="text-body-md text-on-surface-variant max-w-sm text-center">Upload and approve documents to generate the knowledge graph.</p>
            </div>
          )}
          {!loading && graphData.nodes.length > 0 && (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeCanvasObject={paintNode}
              nodeCanvasObjectMode={() => 'replace'}
              linkCanvasObject={paintLink}
              linkCanvasObjectMode={() => 'replace'}
              onNodeClick={handleNodeClick}
              backgroundColor="#f9f9ff"
              cooldownTicks={100}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />
          )}
        </div>
      </div>

      {/* Info Sidebar — Enriched */}
      <aside className="w-[320px] bg-white border-l border-outline-variant flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-headline-md font-headline-md text-on-surface">Node Inspector</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {selected ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: (TYPE_COLORS[selected.type] || TYPE_COLORS.Default) + '20' }}>
                  {TYPE_ICONS[selected.type] || '📦'}
                </div>
                <div>
                  <p className="text-body-lg font-bold text-on-surface">{selected.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-label-sm px-1.5 py-0.5 rounded font-bold border" style={{ color: TYPE_COLORS[selected.type], borderColor: TYPE_COLORS[selected.type] + '40', backgroundColor: TYPE_COLORS[selected.type] + '10' }}>{selected.type}</span>
                    <span className="text-label-sm text-on-surface-variant">{selected.degree} connections</span>
                  </div>
                </div>
              </div>

              {/* Source Document */}
              <div className="bg-surface-container-low rounded-lg p-3 border border-outline-variant/50">
                <span className="text-label-sm text-outline uppercase tracking-wider">Source Document</span>
                <p className="text-body-md text-on-surface font-semibold mt-1">{selected.source_document}</p>
              </div>

              {/* Properties */}
              {selected.data && Object.keys(selected.data).length > 0 && (
                <div>
                  <h4 className="text-label-md text-outline uppercase tracking-wider mb-2">Properties</h4>
                  <div className="bg-surface-container-low rounded-lg border border-outline-variant/50 divide-y divide-outline-variant/30">
                    {Object.entries(selected.data).map(([k, v]) => (
                      <div key={k} className="flex justify-between p-2.5">
                        <span className="text-body-sm font-semibold text-on-surface">{k}</span>
                        <span className="text-body-sm text-on-surface-variant text-right max-w-[150px] break-words">
                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Relationships */}
              {selectedRelationships.length > 0 && (
                <div>
                  <h4 className="text-label-md text-outline uppercase tracking-wider mb-2">Relationships ({selectedRelationships.length})</h4>
                  <div className="space-y-2">
                    {selectedRelationships.map((rel, i) => (
                      <div key={i} className="flex items-center gap-2 text-body-sm bg-surface-container-low rounded-lg p-2.5 border border-outline-variant/50">
                        <span className="font-semibold text-on-surface truncate">{rel.source}</span>
                        <span className="text-primary font-bold text-label-sm px-1.5 py-0.5 bg-primary/10 rounded flex-shrink-0">{rel.relationship}</span>
                        <span className="font-semibold text-on-surface truncate">{rel.target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ask Copilot Button */}
              <button
                onClick={() => navigate(`/copilot`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-sm font-label-md transition-all hover:shadow-md active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                Ask Copilot about "{selected.label}"
              </button>

              {/* Tacit Knowledge Capture Widget */}
              {selected.type === 'Equipment' && (
                <TacitCaptureWidget equipmentId={selected.id} onSuccess={() => console.log('Tacit note captured')} />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
              <span className="material-symbols-outlined text-4xl text-outline">touch_app</span>
              <p className="text-body-md text-on-surface-variant">Click a node to inspect its properties, relationships, and source documents</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="p-4 border-t border-outline-variant space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-label-md text-on-surface-variant">Total Nodes</span>
            <span className="text-label-md font-semibold text-on-surface">{nodeCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-label-md text-on-surface-variant">Relationships</span>
            <span className="text-label-md font-semibold text-on-surface">{edgeCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-label-md text-on-surface-variant">Entity Types</span>
            <span className="text-label-md font-semibold text-on-surface">{allTypes.length}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
