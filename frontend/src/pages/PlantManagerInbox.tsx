import { useState, useEffect } from 'react';

interface InboxItem {
  entity_id: string;
  equipment_tag: string;
  document_filename: string;
  plain_language_summary: string;
  flagged_reason: string;
}

interface InboxData {
  items: InboxItem[];
  corrected_this_week: number;
  passed_clean_this_week: number;
}

export default function PlantManagerInbox() {
  const [data, setData] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchInbox = async () => {
    setLoading(true);
    try {
      const res = await fetch('/ingest/plant-manager/inbox');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchInbox();
  }, []);
  
  const handleDecision = async (entityId: string, decision: 'confirm' | 'send_back') => {
    try {
      const res = await fetch('/ingest/plant-manager/inbox/${entityId}/decide', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Remove from list
      if (data) {
        setData({ ...data, items: data.items.filter(i => i.entity_id !== entityId) });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to process decision');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-display-sm font-display-sm text-on-surface">Compliance Inbox</h1>
          <p className="text-body-lg text-on-surface-variant mt-1">Review critical escalated extractions</p>
        </div>
        
        {data && (
          <div className="flex gap-4">
            <div className="bg-surface-container rounded-xl p-4 text-center">
              <span className="text-title-lg font-bold text-lime-700">{data.passed_clean_this_week}</span>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Passed Clean</p>
            </div>
            <div className="bg-surface-container rounded-xl p-4 text-center">
              <span className="text-title-lg font-bold text-orange-700">{data.corrected_this_week}</span>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Corrected</p>
            </div>
          </div>
        )}
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-800 p-4 rounded-lg">{error}</div>
      ) : data?.items.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <span className="material-symbols-outlined text-6xl text-lime-600 mb-4">task_alt</span>
          <h3 className="text-headline-sm font-bold text-on-surface">All caught up!</h3>
          <p className="text-body-md text-on-surface-variant mt-2">No items require Level 3 sign-off.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.items.map(item => (
            <div key={item.entity_id} className="bg-white border border-outline-variant rounded-xl p-6 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-title-lg font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-orange-600">warning</span>
                    {item.equipment_tag}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[16px]">description</span>
                    Source: {item.document_filename}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleDecision(item.entity_id, 'send_back')} className="px-4 py-2 border border-outline rounded-full text-label-md font-bold text-on-surface hover:bg-surface-container transition-colors">
                    Send Back
                  </button>
                  <button onClick={() => handleDecision(item.entity_id, 'confirm')} className="px-4 py-2 bg-primary text-on-primary rounded-full text-label-md font-bold hover:bg-primary/90 transition-colors shadow-md">
                    Confirm & Publish
                  </button>
                </div>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
                <p className="text-body-md text-orange-900 font-semibold">{item.plain_language_summary}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
