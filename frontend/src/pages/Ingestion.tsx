import { useState, useRef, useEffect } from 'react';
import ProcessingTrace from '../components/ProcessingTrace';

const ACCEPTED_TYPES = '.pdf,.csv,.xlsx,.png,.jpg,.jpeg,.webp';
const DOC_TYPES = [
  { value: 'manual', label: 'Technical Manual' },
  { value: 'work_order', label: 'Work Order' },
  { value: 'pid', label: 'P&ID Drawing' },
  { value: 'standard', label: 'Industry Standard' },
  { value: 'safety_procedure', label: 'Safety Procedure' }
] as const;

interface Document {
  id: string;
  filename: string;
  type: string;
  upload_date: string;
  status: string;
  storage_url: string;
  current_step: string;
  step_status: 'pending' | 'active' | 'complete' | 'error';
  step_detail?: string;
  step_history?: any[];
}

export default function Ingestion() {
  const [docType, setDocType] = useState('work_order');
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/ingest/list');
      if (res.ok) setDocuments(await res.json());
    } catch {
      // backend not reachable
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    const hasActive = documents.some(d => d.status === 'processing' || d.status === 'processing_active');
    if (!hasActive) return;
    const interval = setInterval(fetchDocuments, 2000);
    return () => clearInterval(interval);
  }, [documents]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);

    try {
      const res = await fetch('/ingest/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setTimeout(fetchDocuments, 500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleUpload(dropped);
  };

  const STEP_LABELS: Record<string, string> = {
    queued: 'Queued for processing',
    parsing: 'Reading document',
    extracting: 'Extracting entities & relationships',
    chunking: 'Chunking & generating embeddings',
    linking: 'Building knowledge graph links',
    pending_review: 'Waiting for human review',
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 w-full">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-display-sm font-display-sm text-on-surface">Document Ingestion</h1>
          <p className="text-body-lg text-on-surface-variant mt-1 max-w-2xl">Upload technical manuals, P&IDs, or work orders to be parsed, chunked, and mapped into the knowledge graph.</p>
        </div>
        <div className="w-full md:w-64">
          <label className="text-label-sm font-bold text-on-surface-variant mb-1.5 block">Document Type</label>
          <select
            className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:border-transparent outline-none shadow-sm transition-all"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            {DOC_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Large Dropzone */}
      <div 
        className={`relative overflow-hidden flex flex-col items-center justify-center p-12 hub-card border-2 border-dashed transition-all duration-300 ${isDragOver ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-outline-variant hover:border-primary/50 hover:bg-surface-container-low'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleUpload(e.target.files[0]);
          }}
        />
        
        <div 
          className="flex flex-col items-center gap-4 cursor-pointer text-center relative z-10"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300 ${isDragOver ? 'bg-primary text-white shadow-lg' : 'bg-primary/10 text-primary'}`}>
            {uploading ? (
              <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-3xl">cloud_upload</span>
            )}
          </div>
          <div>
            <h3 className="text-headline-sm font-bold text-on-surface mb-1">
              {uploading ? 'Uploading Document...' : 'Drag & Drop Files Here'}
            </h3>
            <p className="text-body-md text-on-surface-variant">
              or <span className="text-primary hover:underline font-semibold">browse your computer</span>
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            <span className="px-2.5 py-1 rounded-md bg-surface-container text-label-sm text-on-surface-variant font-medium">.PDF</span>
            <span className="px-2.5 py-1 rounded-md bg-surface-container text-label-sm text-on-surface-variant font-medium">.CSV</span>
            <span className="px-2.5 py-1 rounded-md bg-surface-container text-label-sm text-on-surface-variant font-medium">Images</span>
          </div>
        </div>
        
        {/* Subtle background decoration */}
        <span className="material-symbols-outlined absolute -right-8 -bottom-8 text-9xl text-on-surface-variant opacity-[0.03] rotate-12 pointer-events-none" style={{ fontVariationSettings: "'FILL' 1" }}>
          upload_file
        </span>
      </div>

      {/* Document List */}
      <div className="space-y-3 pt-4">
        {loadingDocs ? (
          <div className="p-8 flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
            Loading...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant border border-dashed border-outline-variant rounded-xl">
            No documents uploaded yet.
          </div>
        ) : documents.map((doc) => {
          
          const isError = doc.status === 'failed';
          const isProcessing = doc.status === 'processing' || doc.status === 'processing_active';
          const isPendingReview = doc.status === 'pending_review';
          const isQueued = doc.current_step === 'queued' && isProcessing;
          
          const stepLabel = doc.step_detail ? STEP_LABELS[doc.current_step || ''] || 'Processing...' : STEP_LABELS[doc.current_step || ''] || 'Processing...';

          return (
            <div key={doc.id} className={`p-4 hub-card transition-all ${isQueued ? 'opacity-70' : ''}`}>
              <div className="flex items-start justify-between">
                
                <div className="flex gap-4 flex-1">
                  <div className="mt-1 flex-shrink-0">
                    {isError ? (
                      <span className="material-symbols-outlined text-red-500">close</span>
                    ) : isPendingReview || doc.status === 'approved' ? (
                      <span className="material-symbols-outlined text-on-surface">check</span>
                    ) : isQueued ? (
                      <span className="material-symbols-outlined text-on-surface-variant">schedule</span>
                    ) : (
                      <span className="material-symbols-outlined text-on-surface">description</span>
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <p className="text-body-lg font-medium text-on-surface flex items-center gap-2">
                      {doc.filename}
                      {doc.storage_url && doc.storage_url !== '#' && (
                        <a href={doc.storage_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline text-xs font-semibold ml-2">
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span> View
                        </a>
                      )}
                    </p>
                    
                    {/* Processing Trace Dropdown (Always shown unless queued) */}
                    {!isQueued && (
                      <div>
                        <details className="mt-0.5 group">
                          <summary className="text-label-sm text-on-surface-variant cursor-pointer select-none flex items-center hover:text-on-surface transition-colors">
                            {isProcessing ? STEP_LABELS[doc.current_step || ''] || 'Processing...' : 'Processing Steps'}
                            {isProcessing && doc.step_detail && ` · ${doc.step_detail}`}
                            <span className="material-symbols-outlined text-[16px] ml-1 transition-transform group-open:rotate-180">expand_more</span>
                            
                            {isProcessing && (
                                <span className="material-symbols-outlined text-primary text-[14px] animate-spin ml-auto">progress_activity</span>
                            )}
                          </summary>
                          
                          <div className="mt-2 pl-1 border-l-2 border-outline-variant/30 ml-1">
                            <ProcessingTrace 
                              currentStep={doc.current_step || (isPendingReview || doc.status === 'approved' ? 'linking' : 'queued')} 
                              stepStatus={doc.step_status || (isPendingReview || doc.status === 'approved' ? 'complete' : 'pending')} 
                              stepDetail={doc.step_detail} 
                            />
                          </div>
                        </details>
                        
                        {/* Progress Bar (Only when processing) */}
                        {isProcessing && (
                          <div className="h-1 bg-surface-container mt-3 rounded-full overflow-hidden flex">
                            <div className="h-full bg-lime-500 w-1/4"></div>
                            <div className="h-full bg-blue-500 w-1/4 animate-pulse"></div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isError && (
                      <p className="text-label-sm text-red-500 mt-2">
                        {doc.step_detail || 'Processing failed'}
                      </p>
                    )}
                    
                    {isPendingReview && (
                      <p className="text-label-sm text-on-surface-variant mt-2">Waiting for review</p>
                    )}
                    
                    {isQueued && (
                      <p className="text-label-sm text-on-surface-variant">Queued</p>
                    )}
                  </div>
                </div>

                <div className="ml-4 flex-shrink-0 flex items-center">
                   {isPendingReview && (
                     <span className="bg-yellow-900 text-yellow-300 text-label-sm px-3 py-1 rounded-full font-medium">Pending review</span>
                   )}
                   {isError && (
                     <button className="flex items-center gap-1 border border-outline-variant px-3 py-1.5 rounded-lg text-label-sm hover:bg-surface-container-low transition-colors text-on-surface">
                       <span className="material-symbols-outlined text-[16px]">refresh</span>
                       Retry
                     </button>
                   )}
                </div>
                
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
