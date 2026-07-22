import { useState, useRef } from 'react';

interface Gap {
  title: string;
  description: string;
  severity: string;
  standard_reference: string;
  recommendation: string;
}

interface CompliantArea {
  area: string;
  standard_reference: string;
}

interface ComplianceResult {
  overall_status: string;
  compliance_score: number;
  summary: string;
  gaps: Gap[];
  compliant_areas: CompliantArea[];
}

interface Citation {
  index: number;
  document_id: string;
  filename: string;
  page: number;
  storage_url: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; icon: string }> = {
  Critical: { bg: 'bg-red-100 text-red-800 border-red-200', icon: 'error' },
  Major: { bg: 'bg-orange-100 text-orange-800 border-orange-200', icon: 'warning' },
  Minor: { bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: 'info' },
};

const STATUS_STYLES: Record<string, string> = {
  Compliant: 'bg-lime-100 text-lime-800 border-lime-300',
  'Gaps Found': 'bg-orange-100 text-orange-800 border-orange-300',
  'Non-Compliant': 'bg-red-100 text-red-800 border-red-300',
};

export default function Compliance() {
  const [procedureText, setProcedureText] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runCheck = async () => {
    if (!procedureText.trim() && !file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCitations([]);

    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (procedureText.trim()) {
      formData.append('procedure_text', procedureText);
    }
    if (equipmentName.trim()) {
      formData.append('equipment_name', equipmentName);
    }

    try {
      const res = await fetch('/agents/compliance/check', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.result);
      setCitations(data.citations || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Compliance check failed');
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-lime-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Input Panel */}
      <div className="w-[420px] bg-white border-r border-outline-variant flex flex-col flex-shrink-0 overflow-hidden">
        <div className="p-5 border-b border-outline-variant">
          <h2 className="text-headline-md font-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">verified</span>
            Compliance Check
          </h2>
          <p className="text-label-md text-on-surface-variant mt-1">
            Compare a procedure against regulatory standards
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {/* Equipment Name (optional) */}
          <div className="flex flex-col gap-2">
            <label className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">
              Equipment Name (optional)
            </label>
            <input
              className="w-full px-4 py-3 bg-white border border-outline-variant rounded-sm text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              placeholder="e.g. Pump-101"
              value={equipmentName}
              onChange={(e) => setEquipmentName(e.target.value)}
            />
          </div>

          {/* Procedure Text */}
          <div className="flex flex-col gap-2">
            <label className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">
              Procedure Text
            </label>
            <textarea
              className="w-full px-4 py-3 bg-white border border-outline-variant rounded-sm text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none custom-scrollbar"
              rows={10}
              placeholder="Paste the maintenance procedure, safety protocol, or checklist here..."
              value={procedureText}
              onChange={(e) => setProcedureText(e.target.value)}
            />
          </div>

          {/* Or upload a file */}
          <div className="flex flex-col gap-2">
            <label className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">
              Or Upload a File
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center cursor-pointer transition-all ${
                file ? 'border-lime-400 bg-lime-50' : 'border-outline-variant hover:border-primary'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <>
                  <span className="material-symbols-outlined text-3xl text-lime-600 mb-1">check_circle</span>
                  <p className="text-body-md text-on-surface font-medium">{file.name}</p>
                  <button
                    className="text-label-sm text-red-500 hover:underline mt-1"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-3xl text-outline mb-1">upload_file</span>
                  <p className="text-body-md text-on-surface-variant">Click to upload (.txt, .csv, .pdf)</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="p-5 border-t border-outline-variant">
          <button
            onClick={runCheck}
            disabled={(!procedureText.trim() && !file) || loading}
            className="w-full bg-primary-container hover:bg-primary text-on-primary py-4 rounded-sm font-headline-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                Analyzing Compliance...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">policy</span>
                Run Compliance Check
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right: Results Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!result && !loading && !error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-on-surface-variant">
            <span className="material-symbols-outlined text-6xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            <h2 className="text-headline-lg font-headline-lg text-on-surface">Compliance Intelligence</h2>
            <p className="text-body-md max-w-md text-center">
              Paste a procedure or upload a document, then run the compliance check to compare it against your ingested regulatory standards.
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
            <p className="text-headline-md font-headline-md text-on-surface">Running Gap Analysis...</p>
            <p className="text-body-md text-on-surface-variant">Comparing against regulatory standards</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span className="material-symbols-outlined text-5xl text-red-500">error</span>
            <p className="text-body-md text-red-700">{error}</p>
            <button onClick={runCheck} className="px-4 py-2 bg-primary text-on-primary rounded-sm text-label-md">Retry</button>
          </div>
        ) : result ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-6 max-w-4xl mx-auto">
              {/* Score Header */}
              <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    <div>
                      <h1 className="text-headline-lg font-headline-lg text-on-surface">Compliance Report</h1>
                      <p className="text-label-md text-on-surface-variant">Generated {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className={`text-4xl font-bold ${scoreColor(result.compliance_score)}`}>
                      {result.compliance_score}%
                    </p>
                    <span className={`px-3 py-1 text-label-md rounded-sm border ${STATUS_STYLES[result.overall_status] || 'bg-gray-100 text-gray-800'}`}>
                      {result.overall_status}
                    </span>
                  </div>
                </div>
                <div className="bg-surface-container-low p-4 rounded-lg">
                  <p className="text-body-md text-on-surface leading-relaxed">{result.summary}</p>
                </div>
              </div>

              {/* Gaps */}
              {result.gaps?.length > 0 && (
                <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                  <h2 className="text-headline-md font-headline-md text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-red-500">report_problem</span>
                    Identified Gaps ({result.gaps.length})
                  </h2>
                  <div className="space-y-4">
                    {result.gaps.map((gap, idx) => {
                      const sev = SEVERITY_STYLES[gap.severity] || SEVERITY_STYLES.Minor;
                      return (
                        <div key={idx} className="border border-outline-variant rounded-lg overflow-hidden">
                          <div className="flex items-center gap-3 px-4 py-3 bg-surface-container-low">
                            <span className="material-symbols-outlined text-red-500">{sev.icon}</span>
                            <h3 className="text-body-md font-semibold text-on-surface flex-1">{gap.title}</h3>
                            <span className={`px-2 py-0.5 text-label-sm rounded-sm border ${sev.bg}`}>
                              {gap.severity}
                            </span>
                          </div>
                          <div className="px-4 py-3 space-y-2">
                            <p className="text-body-md text-on-surface">{gap.description}</p>
                            <div className="flex flex-col gap-1 mt-2">
                              <span className="text-label-sm text-primary">{gap.standard_reference}</span>
                              <div className="flex items-start gap-2 bg-lime-50 p-2 rounded border border-lime-100">
                                <span className="material-symbols-outlined text-lime-600 text-base mt-0.5">lightbulb</span>
                                <p className="text-body-md text-lime-900">{gap.recommendation}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Compliant Areas */}
              {result.compliant_areas?.length > 0 && (
                <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm">
                  <h2 className="text-headline-md font-headline-md text-on-surface mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lime-600">check_circle</span>
                    Compliant Areas ({result.compliant_areas.length})
                  </h2>
                  <div className="space-y-2">
                    {result.compliant_areas.map((area, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-lime-50/50 border border-lime-100 rounded-lg">
                        <span className="material-symbols-outlined text-lime-600 text-base mt-0.5">check</span>
                        <div>
                          <p className="text-body-md text-on-surface">{area.area}</p>
                          <p className="text-label-sm text-primary mt-0.5">{area.standard_reference}</p>
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
                    Source Standards
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
