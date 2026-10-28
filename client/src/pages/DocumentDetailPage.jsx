import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FileText, 
  ArrowLeft, 
  Download, 
  Trash2, 
  Lock, 
  Globe, 
  ShieldAlert, 
  Share2, 
  UserCheck, 
  Clock, 
  Shield, 
  UserPlus, 
  AlertCircle,
  HardDrive,
  FileCode,
  Calendar,
  Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { documentApi } from '../api/documentApi.js';
import { userApi } from '../api/userApi.js';
import { useToast } from '../context/ToastContext.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';

export function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();

  const [docData, setDocData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sharing form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [permissionType, setPermissionType] = useState('view');
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const loadDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await documentApi.getDocumentDetails(id);
      setDocData(data);

      // Load document-specific audit trail
      const auditRes = await documentApi.getDocumentAudit(id).catch(() => ({ logs: [] }));
      setAuditLogs(auditRes.logs || []);

      // If owner or admin, load available users for sharing
      if (data.permissions.isOwner || isAdmin) {
        const usersRes = await userApi.getActiveUsers().catch(() => ({ users: [] }));
        setActiveUsers((usersRes.users || []).filter(u => u.id !== data.document.owner_id));
      }
    } catch (err) {
      setError(err.message || 'Unable to load document details');
    } finally {
      setLoading(false);
    }
  }, [id, isAdmin]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleDownload = async () => {
    if (!docData) return;
    try {
      setIsDownloading(true);
      await documentApi.downloadDocument(docData.document.id, docData.document.original_filename);
      addToast({
        title: 'Download Successful',
        message: `Saved '${docData.document.original_filename}'. Audit record created.`,
        type: 'success'
      });
      // Refresh audit logs
      const auditRes = await documentApi.getDocumentAudit(id).catch(() => ({ logs: [] }));
      setAuditLogs(auditRes.logs || []);
    } catch (err) {
      addToast({
        title: 'Access Denied',
        message: err.message,
        type: 'error'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleGrantPermission = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      addToast({ title: 'Select User', message: 'Please pick a recipient to grant access.', type: 'warning' });
      return;
    }

    try {
      setIsSharing(true);
      await documentApi.grantPermission(id, selectedUserId, permissionType);
      addToast({ title: 'Access Granted', message: `Granted '${permissionType}' permission.`, type: 'success' });
      setSelectedUserId('');
      loadDetails();
    } catch (err) {
      addToast({ title: 'Grant Failed', message: err.message, type: 'error' });
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokePermission = async (permissionId, granteeName) => {
    if (!window.confirm(`Revoke permission from '${granteeName}'?`)) return;

    try {
      await documentApi.revokePermission(id, permissionId);
      addToast({ title: 'Permission Revoked', message: `Access removed for ${granteeName}.`, type: 'info' });
      loadDetails();
    } catch (err) {
      addToast({ title: 'Revocation Failed', message: err.message, type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!docData) return;
    if (!window.confirm(`Are you certain you want to delete '${docData.document.original_filename}'?`)) return;

    try {
      await documentApi.deleteDocument(id);
      addToast({ title: 'Document Deleted', message: 'Asset removed from active repository.', type: 'info' });
      navigate('/documents');
    } catch (err) {
      addToast({ title: 'Delete Failed', message: err.message, type: 'error' });
    }
  };

  if (loading) {
    return <LoadingSpinner message="Evaluating document authorization & audit history..." />;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400 mx-auto mb-4 shadow-xl">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Access Authorization Denied</h2>
        <p className="text-xs text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
          {error}
        </p>
        <Link
          to="/documents"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Documents</span>
        </Link>
      </div>
    );
  }

  const doc = docData.document;
  const permissions = docData.permissions;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/documents')}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-cyan-400">ID: {doc.id}</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight truncate max-w-xl">
              {doc.original_filename}
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownload}
            disabled={isDownloading || !permissions.canDownload}
            className={`px-4 py-2.5 rounded-xl font-medium text-xs flex items-center space-x-2 transition-all ${
              permissions.canDownload
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-950/50'
                : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
            }`}
            title={permissions.canDownload ? 'Download authorized document' : 'Download not authorized for this role'}
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download Asset</span>
          </button>

          {(permissions.isOwner || isAdmin) && (
            <button
              onClick={handleDelete}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-800/40 text-slate-400 hover:text-red-400 transition-colors"
              title="Delete Document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metadata Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center space-x-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <span>Asset Metadata</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">Sensitivity Level</span>
                <span className={`inline-flex items-center space-x-1.5 mt-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase border ${
                  doc.sensitivity_level === 'confidential'
                    ? 'bg-red-950/60 text-red-300 border-red-800/60'
                    : doc.sensitivity_level === 'internal'
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                }`}>
                  {doc.sensitivity_level === 'confidential' ? <Lock className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                  <span>{doc.sensitivity_level}</span>
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">Owner</span>
                <p className="font-semibold text-slate-200 mt-0.5">{doc.owner_name} <span className="text-slate-400 font-mono text-[11px]">(@{doc.owner_username})</span></p>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">File Size & MIME</span>
                <p className="font-mono text-slate-200 mt-0.5">
                  {(doc.file_size / 1024).toFixed(1)} KB • {doc.mime_type}
                </p>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">Storage Reference</span>
                <p className="font-mono text-slate-400 text-[11px] truncate bg-slate-900 p-2 rounded-lg border border-slate-800 mt-1">
                  {doc.stored_filename}
                </p>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">Ingested Date</span>
                <p className="font-mono text-slate-300 mt-0.5">{new Date(doc.created_at).toLocaleString()}</p>
              </div>

              {doc.description && (
                <div>
                  <span className="text-slate-500 block text-[10px] font-mono uppercase">Description</span>
                  <p className="text-slate-300 mt-1 leading-relaxed text-xs">{doc.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Permission Delegation & Audit History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Permission Sharing Card (Owner or Admin) */}
          {(permissions.isOwner || isAdmin) && (
            <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                    <Share2 className="w-4 h-4 text-cyan-400" />
                    <span>Access Delegation (Explicit RBAC)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Grant specific users view or download permissions on this document.
                  </p>
                </div>
              </div>

              {/* Grant Form */}
              <form onSubmit={handleGrantPermission} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
                <div className="w-full sm:flex-1">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <option value="">Select Recipient User...</option>
                    {activeUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} (@{u.username}) — {u.department || u.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-full sm:w-40">
                  <select
                    value={permissionType}
                    onChange={(e) => setPermissionType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <option value="view">View Metadata</option>
                    <option value="download">View & Download</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSharing || !selectedUserId}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50 flex-shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Grant</span>
                </button>
              </form>

              {/* Current Permissions List */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-mono uppercase text-slate-400 block">
                  Active User Grants ({permissions.sharedPermissions?.length || 0})
                </span>

                {permissions.sharedPermissions?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No external permissions granted. Only owner can access.</p>
                ) : (
                  <div className="space-y-1.5">
                    {permissions.sharedPermissions.map((perm) => (
                      <div key={perm.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                        <div className="flex items-center space-x-2.5">
                          <UserCheck className="w-4 h-4 text-emerald-400" />
                          <span className="font-medium text-slate-200">{perm.full_name}</span>
                          <span className="text-[10px] font-mono text-slate-400">(@{perm.username})</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-950/60 text-cyan-300 border border-cyan-800/60">
                            {perm.permission_type}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRevokePermission(perm.id, perm.full_name)}
                          className="text-[11px] text-red-400 hover:text-red-300 transition-colors font-mono"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Document Audit Trail */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Document Activity & Security Log</span>
            </h3>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No audit events recorded for this document yet.</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => {
                  const isDenied = log.outcome === 'denied';
                  const isFail = log.outcome === 'failure';
                  return (
                    <div key={log.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <span className={`w-2 h-2 rounded-full ${isDenied ? 'bg-red-400' : isFail ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                        <div>
                          <p className="font-mono font-medium text-slate-200">{log.action}</p>
                          <p className="text-[11px] text-slate-400">Actor: <span className="text-cyan-300 font-mono">{log.actor_username || 'Anonymous'}</span></p>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
