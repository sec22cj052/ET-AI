import { useState, useRef, useEffect } from 'react';

const ACCEPTED_TYPES = '.pdf,.csv,.xlsx,.png,.jpg,.jpeg,.webp';
const DOC_TYPES = ['manual', 'work_order', 'pid', 'standard', 'safety_procedure'] as const;
type DocType = typeof DOC_TYPES[number];

interface UploadedDoc {
  document_id: string;
  filename: string;
  status: string;
  storage_url: string;
}

interface Document {
  id: string;
  filename: string;
  type: string;
  upload_date: string;
  status: string;
  storage_url: string;
}

export default function Ingestion() {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>('manual');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadedDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://localhost:8000/ingest/list');
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);

    try {
      const res = await fetch('http://localhost:8000/ingest/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.detail || 'Upload failed');
      }
      const data: UploadedDoc = await res.json();
      setResult(data);
      setFile(null);
      // Refresh document list
      setTimeout(fetchDocuments, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'pdf') return { icon: 'picture_as_pdf', color: 'text-red-600 bg-red-50' };
    if (ext === 'csv' || ext === 'xlsx') return { icon: 'table_chart', color: 'text-green-600 bg-green-50' };
    if (['png','jpg','jpeg','webp'].includes(ext || '')) return { icon: 'image', color: 'text-blue-600 bg-blue-50' };
    return { icon: 'description', color: 'text-gray-600 bg-gray-50' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-lime-100 text-lime-800 border border-lime-200';
      case 'pending_review': return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'failed': return 'bg-red-100 text-red-800 border border-red-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-headline-lg font-headline-lg text-on-surface">Document Ingestion & Review</h1>
          <p className="text-body-md text-on-surface-variant mt-1">Upload and process industrial documents for knowledge extraction.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container rounded-sm">
          <span className="w-2 h-2 bg-lime-500 rounded-full animate-pulse"></span>
          <span className="text-label-md text-on-surface-variant">Pipeline Active</span>
        </div>
      </div>

      {/* Upload Card */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-sm p-6 space-y-5">
        <h2 className="text-headline-md font-headline-md text-on-surface border-b border-surface-container-low pb-3">Upload New Document</h2>

        {/* Drag & Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${isDragOver ? 'border-primary bg-primary-fixed/30' : file ? 'border-lime-400 bg-lime-50' : 'border-outline-variant hover:border-primary hover:bg-surface-container-low'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <>
              <span className="material-symbols-outlined text-5xl text-lime-600 mb-3">check_circle</span>
              <p className="text-headline-md font-headline-md text-on-surface">{file.name}</p>
              <p className="text-body-md text-on-surface-variant mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              <button
                className="mt-3 text-label-md text-red-500 hover:underline"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                Remove
              </button>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-5xl text-outline mb-3">cloud_upload</span>
              <p className="text-headline-md font-headline-md text-on-surface">Drop your file here or click to browse</p>
              <p className="text-body-md text-on-surface-variant mt-2">Supports PDF, CSV, XLSX, PNG, JPG, WEBP</p>
            </>
          )}
        </div>

        {/* Document Type Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">Document Type</label>
          <select
            className="w-full px-4 py-3 bg-white border border-outline-variant rounded-sm text-body-md text-on-surface focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            value={docType}
            onChange={(e) => setDocType(e.target.value as DocType)}
          >
            <option value="manual">Technical Manual</option>
            <option value="work_order">Work Order</option>
            <option value="pid">P&ID Drawing</option>
            <option value="standard">Industry Standard</option>
            <option value="safety_procedure">Safety Procedure</option>
          </select>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full bg-primary-container hover:bg-primary text-on-primary py-4 rounded-sm font-headline-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Uploading & Processing...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">upload</span>
              Upload Document
            </>
          )}
        </button>

        {/* Success / Error notifications */}
        {result && (
          <div className="flex items-start gap-3 p-4 bg-lime-50 border border-lime-200 rounded-lg">
            <span className="material-symbols-outlined text-lime-600">check_circle</span>
            <div>
              <p className="text-body-md font-semibold text-lime-900">Upload Successful</p>
              <p className="text-label-md text-lime-700 mt-1">Document ID: {result.document_id}</p>
              <p className="text-label-md text-lime-700">Status: <span className="font-semibold">{result.status}</span> — processing in background.</p>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <span className="material-symbols-outlined text-red-600">error</span>
            <p className="text-body-md text-red-800">{error}</p>
          </div>
        )}
      </div>

      {/* Document Library */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-sm">
        <div className="p-5 border-b border-outline-variant flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md text-on-surface">Document Library</h2>
          <button onClick={fetchDocuments} className="text-label-md text-primary hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-base">refresh</span>Refresh
          </button>
        </div>
        <div className="divide-y divide-outline-variant">
          {loadingDocs ? (
            <div className="p-8 flex items-center justify-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Loading documents...
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8 flex flex-col items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-5xl mb-3">folder_open</span>
              <p className="text-body-md">No documents uploaded yet.</p>
            </div>
          ) : documents.map((doc) => {
            const fileIcon = getFileIcon(doc.filename);
            return (
              <div key={doc.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-container-low transition-colors">
                <div className={`p-2 rounded ${fileIcon.color}`}>
                  <span className="material-symbols-outlined">{fileIcon.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-on-surface font-medium truncate">{doc.filename}</p>
                  <p className="text-label-sm text-on-surface-variant">{doc.type} • {new Date(doc.upload_date).toLocaleDateString()}</p>
                </div>
                <span className={`px-2 py-0.5 text-label-sm rounded-sm ${getStatusBadge(doc.status)}`}>
                  {doc.status.replace('_', ' ')}
                </span>
                {doc.storage_url && (
                  <a
                    href={doc.storage_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-label-md flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-base">open_in_new</span>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
