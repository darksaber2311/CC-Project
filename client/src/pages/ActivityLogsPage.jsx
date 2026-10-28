import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Eye,
  X
} from 'lucide-react';
import { activityApi } from '../api/activityApi.js';
import { useToast } from '../context/ToastContext.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';

export function ActivityLogsPage() {
  const { addToast } = useToast();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [actorSearch, setActorSearch] = useState('');

  // Details Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await activityApi.getLogs({
        page,
        limit: 25,
        action: actionFilter,
        outcome: outcomeFilter,
        actor: actorSearch
      });

      setLogs(data.logs || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      addToast({ title: 'Query Error', message: 'Failed to retrieve audit log data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, outcomeFilter, actorSearch, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getOutcomeBadge = (outcome) => {
    if (outcome === 'denied') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-red-950/60 text-red-300 border border-red-800/60">
          <XCircle className="w-3 h-3 text-red-400" />
          <span>Denied</span>
        </span>
      );
    }
    if (outcome === 'failure') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-950/60 text-amber-300 border border-amber-800/60">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span>Failure</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        <span>Success</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">System Security Audit Trail</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Append-only event log tracking all authentication, document operations, access denials, and threat alerts.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search by Actor */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={actorSearch}
            onChange={(e) => {
              setActorSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by actor handle..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        {/* Action & Outcome Filters */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="">All Action Types</option>
            <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
            <option value="LOGOUT">LOGOUT</option>
            <option value="DOCUMENT_UPLOAD">DOCUMENT_UPLOAD</option>
            <option value="DOCUMENT_VIEW">DOCUMENT_VIEW</option>
            <option value="DOCUMENT_DOWNLOAD">DOCUMENT_DOWNLOAD</option>
            <option value="DOCUMENT_DELETE">DOCUMENT_DELETE</option>
            <option value="PERMISSION_GRANT">PERMISSION_GRANT</option>
            <option value="PERMISSION_REVOKE">PERMISSION_REVOKE</option>
            <option value="ACCESS_DENIED">ACCESS_DENIED</option>
            <option value="ALERT_CREATED">ALERT_CREATED</option>
            <option value="ALERT_RESOLVED">ALERT_RESOLVED</option>
          </select>

          <select
            value={outcomeFilter}
            onChange={(e) => {
              setOutcomeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="">All Outcomes</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="denied">Denied</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner message="Scanning audit log records..." />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No Audit Events</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No entries found matching the given parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Target Type</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-200">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-cyan-300">
                      {log.actor_username || 'Anonymous'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {log.target_type || '—'}
                    </td>
                    <td className="py-3 px-4">
                      {getOutcomeBadge(log.outcome)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="View Full JSON Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing <span className="font-mono text-white">{logs.length}</span> of <span className="font-mono text-white">{total}</span> events
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-xs text-slate-300">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* JSON Payload Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2 font-mono">
                <span>Event {selectedLog.action}</span>
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-400 font-mono text-[11px] bg-slate-900 p-3 rounded-xl border border-slate-800">
                <div>Event ID: <span className="text-white">{selectedLog.id}</span></div>
                <div>Actor: <span className="text-cyan-300">{selectedLog.actor_username || 'Anonymous'}</span></div>
                <div>Outcome: <span className="text-white">{selectedLog.outcome}</span></div>
                <div>Timestamp: <span className="text-white">{new Date(selectedLog.timestamp).toLocaleString()}</span></div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] font-mono uppercase mb-1">Raw Event Metadata JSON</span>
                <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto max-h-60">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
