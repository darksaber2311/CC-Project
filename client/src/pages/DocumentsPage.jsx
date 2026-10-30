import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Lock, 
  Globe, 
  ShieldAlert, 
  FileUp, 
  ExternalLink,
  HardDrive,
  FileCode,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { documentApi } from '../api/documentApi.js';
import { useToast } from '../context/ToastContext.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { formatDate } from '../utils/dateFormatter.js';

export function DocumentsPage() {
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sensitivity, setSensitivity] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await documentApi.listDocuments({ sensitivity, search });
      setDocuments(data.documents || []);
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to retrieve documents list', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [sensitivity, search, addToast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDownload = async (doc) => {
    try {
      setDownloadingId(doc.id);
      await documentApi.downloadDocument(doc.id, doc.original_filename);
      addToast({
        title: 'Download Started',
        message: `Saved '${doc.original_filename}' to your downloads folder.`,
        type: 'success'
      });
    } catch (err) {
      addToast({
        title: 'Access Denied',
        message: err.message || 'You lack authorization to download this document.',
        type: 'error'
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete '${name}'? This action is irreversible.`)) {
      return;
    }

    try {
      setDeletingId(id);
      await documentApi.deleteDocument(id);
      addToast({ title: 'Document Deleted', message: `'${name}' has been removed.`, type: 'info' });
      fetchDocuments();
    } catch (err) {
      addToast({ title: 'Deletion Failed', message: err.message, type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const getFileIcon = (ext) => {
    const e = (ext || '').toLowerCase();
    if (e === '.pdf') return <FileText className="w-5 h-5 text-red-400" />;
    if (e === '.png' || e === '.jpg' || e === '.jpeg') return <ImageIcon className="w-5 h-5 text-cyan-400" />;
    if (e === '.docx') return <FileText className="w-5 h-5 text-blue-400" />;
    return <FileCode className="w-5 h-5 text-amber-400" />;
  };

  const getSensitivityBadge = (level) => {
    const l = (level || '').toLowerCase();
    if (l === 'confidential') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-red-950/60 text-red-300 border border-red-800/60">
          <Lock className="w-3 h-3 text-red-400" />
          <span>Confidential</span>
        </span>
      );
    }
    if (l === 'internal') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium uppercase tracking-wider bg-amber-950/60 text-amber-300 border border-amber-800/60">
          <ShieldAlert className="w-3 h-3 text-amber-400" />
          <span>Internal</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium uppercase tracking-wider bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
        <Globe className="w-3 h-3 text-emerald-400" />
        <span>Public</span>
      </span>
    );
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Upload CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Protected Document Repository</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically stored assets governed by strict role-based sensitivity controls.
          </p>
        </div>
        <Link
          to="/upload"
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center space-x-2 shadow-lg shadow-cyan-950/50 transition-all self-start sm:self-auto"
        >
          <FileUp className="w-4 h-4" />
          <span>Upload Document</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or description..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Sensitivity Pills */}
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-mono text-slate-500 mr-1 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Sensitivity:</span>
          </span>
          {[
            { id: '', label: 'All' },
            { id: 'public', label: 'Public' },
            { id: 'internal', label: 'Internal' },
            { id: 'confidential', label: 'Confidential' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSensitivity(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0 ${
                sensitivity === item.id
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner message="Querying document permissions..." />
          </div>
        ) : documents.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No Documents Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No files match your query or you lack authorization to view items in this classification.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Document Asset</th>
                  <th className="py-3 px-4">Sensitivity</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Date Uploaded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {documents.map((doc) => {
                  const isOwner = doc.is_owner === 1 || doc.owner_id === user?.id;
                  const canDownload = doc.has_download_grant === 1;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-900/50 transition-colors group">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex-shrink-0">
                            {getFileIcon(doc.file_extension)}
                          </div>
                          <div className="min-w-0">
                            <Link 
                              to={`/documents/${doc.id}`}
                              className="font-semibold text-slate-200 hover:text-cyan-400 transition-colors truncate block"
                            >
                              {doc.original_filename}
                            </Link>
                            {doc.description && (
                              <p className="text-[11px] text-slate-500 truncate max-w-xs">{doc.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getSensitivityBadge(doc.sensitivity_level)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-200">{doc.owner_name || doc.owner_username}</span>
                          <span className="text-[10px] font-mono text-slate-500">@{doc.owner_username}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {formatFileSize(doc.file_size)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to={`/documents/${doc.id}`}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                            title="View Metadata & Access Control"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          {/* Download Button */}
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              canDownload
                                ? 'bg-cyan-950/60 hover:bg-cyan-900/80 border-cyan-800/60 text-cyan-300'
                                : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                            title={canDownload ? 'Download Document' : 'Unauthorized - Attempting triggers security alert'}
                          >
                            {downloadingId === doc.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Delete Button (Owner or Admin) */}
                          {(isOwner || isAdmin) && (
                            <button
                              onClick={() => handleDelete(doc.id, doc.original_filename)}
                              disabled={deletingId === doc.id}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-800/40 text-slate-400 hover:text-red-400 transition-colors"
                              title="Delete Document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
