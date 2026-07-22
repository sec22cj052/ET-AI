import { useState, useEffect, useRef } from 'react';

interface EquipmentRisk {
  equipment_id: string;
  equipment_name: string;
  properties: Record<string, string>;
  incident_count: number;
  work_orders: string[];
  components: string[];
  risk_level: string;
}

interface RootCause {
  cause: string;
  evidence: string;
  severity: string;
  confidence: string;
}

interface TimelineEvent {
  event: string;
  date: string;
  source: string;
}

interface RecommendedAction {
  action: string;
  priority: string;
  rationale: string;
}

interface RcaReport {
  equipment_name: string;
  summary: string;
  probable_root_causes: RootCause[];
  maintenance_timeline: TimelineEvent[];
  recommended_actions: RecommendedAction[];
}

interface Citation {
  index: number;
  document_id: string;
  filename: string;
  page: number;
  storage_url: string;
}

const RISK_STYLES: Record<string, string> = {
  Critical: 'bg-red-100 text-red-800 border-red-200',
  High: 'bg-orange-100 text-orange-800 border-orange-200',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Low: 'bg-lime-100 text-lime-800 border-lime-200',
};

const SEVERITY_STYLES: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-lime-100 text-lime-700',
};

const PRIORITY_STYLES: Record<string, string> = {
  Critical: 'bg-red-600 text-white',
  High: 'bg-orange-500 text-white',
  Medium: 'bg-yellow-500 text-white',
  Low: 'bg-lime-600 text-white',
};

export default function RCA() {
  const [equipmentList, setEquipmentList] = useState<EquipmentRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [report, setReport] = useState<RcaReport | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportCache = useRef<Map<string, { report: RcaReport; citations: Citation[] }>>(new Map());

  useEffect(() => {
    fetchHighRisk();
  }, []);

  const fetchHighRisk = async () => {
    setLoading(true);
    try {
      const res = await fetch('/agents/rca/high-risk');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEquipmentList(data.equipment || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (equipmentName: string) => {
    setSelectedEquipment(equipmentName);
    setError(null);

    // Check cache first
    const cached = reportCache.current.get(equipmentName);
    if (cached) {
      setReport(cached.report);
      setCitations(cached.citations);
      return;
    }

    setGeneratingReport(true);
    setReport(null);
    setCitations([]);

    try {
      const res = await fetch('/agents/rca/${encodeURIComponent(equipmentName)}');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setReport(data.report);
      setCitations(data.citations || []);
      // Cache the result
      reportCache.current.set(equipmentName, { report: data.report, citations: data.citations || [] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel: High-Risk Equipment Dashboard */}
      <div className="w-[380px] bg-white border-r border-outline-variant flex flex-col flex-shrink-0 overflow-hidden">
        <div className="p-5 border-b border-outline-variant">
          <h2 className="text-headline-md font-headline-md text-on-surface">Equipment Risk Dashboard</h2>
          <p className="text-label-md text-on-surface-variant mt-1">Ranked by incident frequency</p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Loading equipment...
            </div>
          ) : equipmentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-on-surface-variant p-4 text-center">
              <span className="material-symbols-outlined text-4xl">engineering</span>
              <p className="text-body-md">No approved equipment data yet.</p>
              <p className="text-label-sm">Upload and approve documents first.</p>
            </div>
          ) : (
            equipmentList.map((eq) => (
              <button
                key={eq.equipment_id}
                onClick={() => generateReport(eq.equipment_name)}
                className={`w-full text-left px-5 py-4 border-b border-outline-variant hover:bg-surface-container-low transition-colors ${
                  selectedEquipment === eq.equipment_name ? 'bg-surface-container border-l-2 border-l-primary' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary text-lg">precision_manufacturing</span>
                      <span className="text-body-md font-semibold text-on-surface truncate">{eq.equipment_name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`px-2 py-0.5 text-label-sm rounded-sm border ${RISK_STYLES[eq.risk_level] || RISK_STYLES.Low}`}>
                        {eq.risk_level} Risk
                      </span>
                      <span className="text-label-sm text-on-surface-variant">
                        {eq.incident_count} incident{eq.incident_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {eq.work_orders.length > 0 && (
                      <p className="text-label-sm text-on-surface-variant mt-1.5 truncate">
                        WO: {eq.work_orders.join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-outline mt-1 flex-shrink-0">chevron_right</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: RCA Report */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedEquipment && !generatingReport ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-on-surface-variant">
            <span className="material-symbols-outlined text-6xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>troubleshoot</span>
            <h2 className="text-headline-lg font-headline-lg text-on-surface">Root Cause Analysis</h2>
            <p className="text-body-md max-w-md text-center">
              Select an equipment from the risk dashboard to generate a detailed RCA report.
            </p>
          </div>
        ) : generatingReport ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
            <p className="text-headline-md font-headline-md text-on-surface">Generating RCA Report...</p>
            <p className="text-body-md text-on-surface-variant">Analyzing maintenance history for {selectedEquipment}</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span className="material-symbols-outlined text-5xl text-red-500">error</span>
            <p className="text-body-md text-red-700">{error}</p>
            <button
              onClick={() => selectedEquipment && generateReport(selectedEquipment)}
              className="px-4 py-2 bg-primary text-on-primary rounded-sm text-label-md"
            >
              Retry
            </button>
          </div>
        ) : report ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-6 max-w-4xl mx-auto">
              {/* Report Header */}
              <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>troubleshoot</span>
                  <div>
                    <h1 className="text-headline-lg font-headline-lg text-on-surface">
                      RCA Report: {report.equipment_name}
                    </h1>
                    <p className="text-label-md text-on-surface-variant">Generated by AI • {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="bg-surface-container-low p-4 rounded-lg">
                  <h3 className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider mb-2">Executive Summary</h3>
                  <p className="text-body-md text-on-surface leading-relaxed">{report.summary}</p>
                </div>
              </div>

              {/* Probable Root Causes */}
              {report.probable_root_causes?.length > 0 && (
                <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                  <h2 className="text-headline-md font-headline-md text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500">warning</span>
                    Probable Root Causes
                  </h2>
                  <div className="space-y-4">
                    {report.probable_root_causes.map((rc, idx) => (
                      <div key={idx} className="border border-outline-variant rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="text-body-md font-semibold text-on-surface flex-1">{rc.cause}</h3>
                          <div className="flex gap-2 flex-shrink-0">
                            <span className={`px-2 py-0.5 text-label-sm rounded-sm ${SEVERITY_STYLES[rc.severity] || SEVERITY_STYLES.Low}`}>
                              {rc.severity}
                            </span>
                            <span className="px-2 py-0.5 text-label-sm rounded-sm bg-surface-container text-on-surface-variant">
                              {rc.confidence} Conf.
                            </span>
                          </div>
                        </div>
                        <p className="text-body-md text-on-surface-variant">{rc.evidence}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Maintenance Timeline */}
              {report.maintenance_timeline?.length > 0 && (
                <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                  <h2 className="text-headline-md font-headline-md text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">timeline</span>
                    Maintenance Timeline
                  </h2>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-outline-variant"></div>
                    <div className="space-y-4">
                      {report.maintenance_timeline.map((evt, idx) => (
                        <div key={idx} className="relative pl-10">
                          <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-white shadow-sm"></div>
                          <div className="bg-surface-container-low p-3 rounded-lg">
                            <p className="text-body-md text-on-surface">{evt.event}</p>
                            <div className="flex gap-4 mt-1">
                              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                {evt.date}
                              </span>
                              <span className="text-label-sm text-primary">{evt.source}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Recommended Actions */}
              {report.recommended_actions?.length > 0 && (
                <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                  <h2 className="text-headline-md font-headline-md text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lime-600">task_alt</span>
                    Recommended Actions
                  </h2>
                  <div className="space-y-3">
                    {report.recommended_actions.map((action, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-4 border border-outline-variant rounded-lg">
                        <span className={`px-2 py-0.5 text-label-sm rounded-sm flex-shrink-0 ${PRIORITY_STYLES[action.priority] || PRIORITY_STYLES.Low}`}>
                          {action.priority}
                        </span>
                        <div className="flex-1">
                          <p className="text-body-md font-semibold text-on-surface">{action.action}</p>
                          <p className="text-body-md text-on-surface-variant mt-1">{action.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Citations */}
              {citations.length > 0 && (
                <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                  <h2 className="text-headline-md font-headline-md text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-on-surface-variant">description</span>
                    Source Documents
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {citations.map((c) => (
                      <a
                        key={c.index}
                        href={`${c.storage_url}#page=${c.page}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3 border border-slate-100 rounded-lg hover:border-primary transition-all group"
                      >
                        <div className="bg-red-50 text-red-600 p-2 rounded flex-shrink-0">
                          <span className="material-symbols-outlined">picture_as_pdf</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-label-md text-on-surface truncate">[{c.index}] {c.filename}</p>
                          <p className="text-label-sm text-outline mt-0.5">Page {c.page}</p>
                        </div>
                        <span className="material-symbols-outlined text-sm text-outline group-hover:text-primary flex-shrink-0">open_in_new</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
