import { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

interface Node {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
}

interface Edge {
  source: string;
  target: string;
  relationship: string;
}

interface GraphData {
  nodes: Node[];
  links: { source: string; target: string; relationship: string }[];
}

const TYPE_COLORS: Record<string, string> = {
  Equipment: '#004ac6',
  Component: '#475c0f',
  WorkOrder: '#775a00',
  Standard: '#7c3aed',
  Procedure: '#be185d',
  Default: '#737686',
};

export default function KnowledgeGraph() {
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

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

  const fetchGraph = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/graph/explore');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNodeCount(data.nodes?.length || 0);
      setEdgeCount(data.edges?.length || 0);
      setGraphData({
        nodes: data.nodes || [],
        links: (data.edges || []).map((e: Edge) => ({
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

  useEffect(() => {
    fetchGraph();
  }, []);

  const handleNodeClick = useCallback((node: Node) => {
    setSelected(node);
  }, []);

  const paintNode = useCallback((node: Node, ctx: CanvasRenderingContext2D) => {
    const color = TYPE_COLORS[node.type] || TYPE_COLORS.Default;
    const isSelected = selected?.id === node.id;
    const r = isSelected ? 10 : 7;

    ctx.beginPath();
    ctx.arc(node.x || 0, node.y || 0, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = '#fdc416';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.font = '4px Inter, sans-serif';
    ctx.fillStyle = '#141b2b';
    ctx.textAlign = 'center';
    ctx.fillText(node.label || node.id, node.x || 0, (node.y || 0) + r + 6);
  }, [selected]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Graph Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-outline-variant flex-shrink-0">
          <div>
            <h1 className="text-headline-md font-headline-md text-on-surface">Knowledge Graph Explorer</h1>
            <p className="text-label-md text-on-surface-variant">
              {nodeCount} nodes · {edgeCount} relationships
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="hidden md:flex items-center gap-3">
              {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'Default').map(([type, color]) => (
                <div key={type} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                  <span className="text-label-sm text-on-surface-variant">{type}</span>
                </div>
              ))}
            </div>
            <button
              onClick={fetchGraph}
              className="flex items-center gap-1 px-3 py-1.5 bg-surface-container rounded-sm text-label-md text-on-surface-variant hover:text-primary transition-colors"
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
              <button onClick={fetchGraph} className="px-4 py-2 bg-primary text-on-primary rounded-sm text-label-md">
                Retry
              </button>
            </div>
          )}
          {!loading && !error && graphData.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
              <span className="material-symbols-outlined text-6xl text-outline">account_tree</span>
              <p className="text-headline-md text-on-surface-variant">No graph data yet</p>
              <p className="text-body-md text-on-surface-variant max-w-sm text-center">
                Upload and approve documents to generate the knowledge graph.
              </p>
            </div>
          )}
          {!loading && graphData.nodes.length > 0 && (
            <ForceGraph2D
              graphData={graphData}
              width={dimensions.width}
              height={dimensions.height}
              nodeCanvasObject={paintNode}
              nodeCanvasObjectMode={() => 'replace'}
              onNodeClick={handleNodeClick}
              linkLabel={(link: { relationship?: string }) => link.relationship || ''}
              linkColor={() => '#c3c6d7'}
              linkWidth={1}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              backgroundColor="#f9f9ff"
              cooldownTicks={100}
            />
          )}
        </div>
      </div>

      {/* Info Sidebar */}
      <aside className="w-[280px] bg-white border-l border-outline-variant flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-headline-md font-headline-md text-on-surface">Node Details</h3>
        </div>
        <div className="flex-1 p-4">
          {selected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: TYPE_COLORS[selected.type] || TYPE_COLORS.Default }}
                />
                <div>
                  <p className="text-body-md font-semibold text-on-surface">{selected.label}</p>
                  <p className="text-label-sm text-on-surface-variant">{selected.type}</p>
                </div>
              </div>
              <div className="border border-outline-variant rounded-lg p-3 space-y-2">
                <div>
                  <span className="text-label-md text-outline uppercase tracking-wider">Node ID</span>
                  <p className="text-body-md text-on-surface font-mono text-xs mt-0.5 break-all">{selected.id}</p>
                </div>
                <div>
                  <span className="text-label-md text-outline uppercase tracking-wider">Type</span>
                  <p className="text-body-md text-on-surface mt-0.5">{selected.type}</p>
                </div>
              </div>
              <p className="text-label-sm text-on-surface-variant">
                Click another node to explore, or drag to rearrange.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
              <span className="material-symbols-outlined text-4xl text-outline">touch_app</span>
              <p className="text-body-md text-on-surface-variant">Click a node to see its details</p>
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
        </div>
      </aside>
    </div>
  );
}
