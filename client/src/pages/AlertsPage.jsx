import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Check, 
  FileCheck2, 
  Filter, 
  Flame, 
  Search,
  X,
  User,
  ShieldCheck
} from 'lucide-react';
import { alertApi } from '../api/alertApi.js';
import { useToast } from '../context/ToastContext.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { formatDateTime } from '../utils/dateFormatter.js';

export function AlertsPage() {
  const { addToast } = useToast();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Resolve modal state
  const [resolvingAlert, setResolvingAlert] = useState(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await alertApi.listAlerts({
        severity: severityFilter,
        status: statusFilter
      });
      setAlerts(data.alerts || []);
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to retrieve security alerts', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter, addToast]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAcknowledge = async (id, title) => {
    try {
      await alertApi.acknowledgeAlert(id);
      addToast({ title: 'Alert Acknowledged', message: `'${title}' marked as acknowledged.`, type: 'info' });
      fetchAlerts();
    } catch (err) {
      addToast({ title: 'Action Failed', message: err.message, type: 'error' });
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolvingAlert) return;
    if (!resolutionNote.trim()) {
      addToast({ title: 'Note Required', message: 'Please provide a mitigation or investigation note.', type: 'warning' });
      return;
    }

    try {
      setIsSubmittingResolve(true);
      await alertApi.resolveAlert(resolvingAlert.id, resolutionNote);
      addToast({ title: 'Alert Resolved', message: 'Incident closed with recorded resolution note.', type: 'success' });
      setResolvingAlert(null);
      setResolutionNote('');
      fetchAlerts();
    } catch (err) {
      addToast({ title: 'Resolution Failed', message: err.message, type: 'error' });
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  const getSeverityBadge = (severity) => {
    const s = (severity || '').toLowerCase();
    const styles = {
      critical: 'bg-red-950/60 text-red-300 border-red-800/60',
      high: 'bg-orange-950/60 text-orange-300 border-orange-800/60',
      medium: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
      low: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
    }[s] || 'bg-slate-800 text-slate-300 border-slate-700';

    return (
      <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase border ${styles}`}>
        <Flame className="w-3 h-3" />
        <span>{severity}</span>
      </span>
    );
  };

  const getStatusBadge = (status) => {
    if (status === 'resolved') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
          <CheckCircle2 className="w-3 h-3" />
          <span>Resolved</span>
        </span>
      );
    }
    if (status === 'acknowledged') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-blue-950/60 text-cyan-300 border border-cyan-800/40">
          <Clock className="w-3 h-3" />
          <span>Acknowledged</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-red-950/60 text-red-300 border border-red-800/40 animate-pulse">
        <AlertTriangle className="w-3 h-3" />
        <span>Open</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Security Incident & Threat Triage</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Deterministic sliding-window threat detections prioritized by explainable risk scores.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Severity Filters */}
        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-mono text-slate-500 mr-1 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Severity:</span>
          </span>
          {[
            { id: '', label: 'All' },
            { id: 'critical', label: 'Critical' },
            { id: 'high', label: 'High' },
            { id: 'medium', label: 'Medium' },
            { id: 'low', label: 'Low' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSeverityFilter(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0 ${
                severityFilter === item.id
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs font-mono text-slate-500 mr-1">Status:</span>
          {[
            { id: '', label: 'All' },
            { id: 'open', label: 'Open' },
            { id: 'acknowledged', label: 'Acknowledged' },
            { id: 'resolved', label: 'Resolved' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex-shrink-0 ${
                statusFilter === item.id
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner message="Scanning detection engine outputs..." />
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">Queue Clear</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No threat detections match the selected filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Severity & Title</th>
                  <th className="py-3 px-4">Risk Score</th>
                  <th className="py-3 px-4">Rule Engine ID</th>
                  <th className="py-3 px-4">Offender / Target</th>
                  <th className="py-3 px-4">Detected At (IST)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Triage Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          {getSeverityBadge(alert.severity)}
                          <Link
                            to={`/alerts/${alert.id}`}
                            className="font-semibold text-slate-200 hover:text-cyan-400 transition-colors truncate max-w-sm block"
                          >
                            {alert.title}
                          </Link>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{alert.description}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white text-xs">{alert.risk_score}</span>
                        <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div 
                            className={`h-full ${
                              alert.risk_score >= 75 ? 'bg-red-500' :
                              alert.risk_score >= 50 ? 'bg-orange-500' :
                              alert.risk_score >= 25 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${alert.risk_score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {alert.rule_id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5 font-mono text-slate-300">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{alert.trigger_username || 'System Event'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {formatDateTime(alert.detected_at)}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(alert.status)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          to={`/alerts/${alert.id}`}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
                          title="Incident Drilldown"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>

                        {alert.status === 'open' && (
                          <button
                            onClick={() => handleAcknowledge(alert.id, alert.title)}
                            className="p-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/60 border border-blue-800/40 text-cyan-300 hover:text-cyan-200 transition-colors"
                            title="Acknowledge Alert"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {alert.status !== 'resolved' && (
                          <button
                            onClick={() => {
                              setResolvingAlert(alert);
                              setResolutionNote('');
                            }}
                            className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/40 text-emerald-300 hover:text-emerald-200 transition-colors"
                            title="Resolve Alert with Note"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span>Resolve Security Incident</span>
              </h3>
              <button
                onClick={() => setResolvingAlert(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <p className="font-semibold text-slate-200">{resolvingAlert.title}</p>
              <p className="text-slate-400 leading-relaxed font-mono text-[11px] bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                {resolvingAlert.description}
              </p>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                  Resolution & Mitigation Note (Required for Audit Trail)
                </label>
                <textarea
                  rows={3}
                  required
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="State the outcome of the investigation, mitigation applied, or justification for closing this alert..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingAlert(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolve || !resolutionNote.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  {isSubmittingResolve ? 'Recording...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
