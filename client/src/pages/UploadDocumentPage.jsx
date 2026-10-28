import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UploadCloud, 
  FileText, 
  ShieldAlert, 
  Lock, 
  Globe, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  X
} from 'lucide-react';
import { documentApi } from '../api/documentApi.js';
import { useToast } from '../context/ToastContext.jsx';

export function UploadDocumentPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [file, setFile] = useState(null);
  const [sensitivity, setSensitivity] = useState('internal');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const allowedExtensions = ['.pdf', '.txt', '.docx', '.png', '.jpg', '.jpeg'];

  const validateAndSetFile = (selectedFile) => {
    if (!selectedFile) return;

    const ext = `.${selectedFile.name.split('.').pop().toLowerCase()}`;
    if (!allowedExtensions.includes(ext)) {
      setError(`File type '${ext}' is not permitted. Supported: PDF, TXT, DOCX, PNG, JPEG.`);
      setFile(null);
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setError('File size exceeds the 15MB system upload limit.');
      setFile(null);
      return;
    }

    setError('');
    setFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a valid document file to upload.');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sensitivityLevel', sensitivity);
      formData.append('description', description);

      await documentApi.uploadDocument(formData);
      addToast({
        title: 'Upload Complete',
        message: `'${file.name}' has been safely vaulted and registered in audit records.`,
        type: 'success'
      });
      navigate('/documents');
    } catch (err) {
      setError(err.message || 'File upload failed. Ensure server storage is accessible.');
      addToast({
        title: 'Upload Failed',
        message: err.message,
        type: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Ingest & Classify Document</h2>
          <p className="text-xs text-slate-400">
            Files are stored in private vault storage with cryptographic identifiers and RBAC policies.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/60 flex items-start space-x-3 text-red-200">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
            dragActive
              ? 'border-cyan-500 bg-cyan-950/20'
              : file
              ? 'border-emerald-500/50 bg-slate-900/80'
              : 'border-slate-800 hover:border-slate-700 bg-[#0f172a]'
          }`}
        >
          {file ? (
            <div className="flex items-center justify-between max-w-md mx-auto p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center space-x-3 min-w-0">
                <FileText className="w-6 h-6 text-cyan-400 flex-shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{file.name}</p>
                  <p className="text-[10px] font-mono text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB • {file.type || 'Document'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-cyan-950/40">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <label className="cursor-pointer font-semibold text-sm text-cyan-400 hover:text-cyan-300">
                  <span>Browse device filesystem</span>
                  <input
                    type="file"
                    onChange={(e) => validateAndSetFile(e.target.files?.[0])}
                    className="hidden"
                    accept=".pdf,.txt,.docx,.png,.jpg,.jpeg"
                  />
                </label>
                <span className="text-slate-400 text-xs"> or drag and drop files here</span>
              </div>
              <p className="text-[11px] font-mono text-slate-500">
                Allowed formats: PDF, TXT, DOCX, PNG, JPEG (Maximum 15MB)
              </p>
            </div>
          )}
        </div>

        {/* Sensitivity Classification Selector */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-white uppercase font-mono tracking-wider block">
              1. Document Classification & Sensitivity Level
            </label>
            <p className="text-xs text-slate-400 mt-0.5">
              Determines access authorization rules and triggers security alert thresholds on unauthorized access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Public Option */}
            <div
              onClick={() => setSensitivity('public')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                sensitivity === 'public'
                  ? 'bg-emerald-950/40 border-emerald-500/80 shadow-lg shadow-emerald-950/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center space-x-2 text-emerald-400 mb-1.5">
                <Globe className="w-4 h-4" />
                <span className="font-semibold text-xs font-mono uppercase">Public</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Accessible by all authenticated members across all institutional roles.
              </p>
            </div>

            {/* Internal Option */}
            <div
              onClick={() => setSensitivity('internal')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                sensitivity === 'internal'
                  ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-950/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center space-x-2 text-amber-400 mb-1.5">
                <ShieldAlert className="w-4 h-4" />
                <span className="font-semibold text-xs font-mono uppercase">Internal</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Restricted to document owner and users explicitly granted permissions.
              </p>
            </div>

            {/* Confidential Option */}
            <div
              onClick={() => setSensitivity('confidential')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                sensitivity === 'confidential'
                  ? 'bg-red-950/40 border-red-500/80 shadow-lg shadow-red-950/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center space-x-2 text-red-400 mb-1.5">
                <Lock className="w-4 h-4" />
                <span className="font-semibold text-xs font-mono uppercase">Confidential</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                High-security asset. Any unauthorized read attempt immediately triggers a high-severity security incident.
              </p>
            </div>
          </div>
        </div>

        {/* Description Field */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-3">
          <label className="text-xs font-bold text-white uppercase font-mono tracking-wider block">
            2. Description & Context (Optional)
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide context regarding this document's research scope or operational purpose..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/documents')}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUploading || !file}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-cyan-950/50 flex items-center space-x-2 disabled:opacity-50 transition-all"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                <span>Securing & Registering...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Upload Document</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
