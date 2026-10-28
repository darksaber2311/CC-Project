import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ShieldAlert, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Flame, 
  User, 
  FileText, 
  Check, 
  FileCheck2, 
  AlertCircle,
  Activity,
  Layers,
  Terminal,
  Calendar
} from 'lucide-react';
import { alertApi } from '../api/alertApi.js';
import { useToast } from '../context/ToastContext.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';

export function AlertDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [alertData, setAlertData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Resolution modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAlert = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await alertApi.getAlertDetails(id);
      setAlertData(data.alert);
    } catch (err) {
      setError(err.message || 'Failed to load security incident detail');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAlert();
  }, [loadAlert]);

  const handleAcknowledge = async () => {
    try {
      await alertApi.acknowledgeAlert(id);
      addToast({ title: 'Alert Acknowledged', message: 'Incident marked as acknowledged.', type: 'info' });
      loadAlert();
    } catch (err) {
      addToast({ title: 'Action Failed', message: err.message, type: 'error' });
    }
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!resolutionNote.trim()) {
      addToast({ title: 'Note Required', message: 'Please provide a mitigation note.', type: 'warning' });
      return;
    }

    try {
      setIsSubmitting(true);
      await alertApi.resolveAlert(id, resolutionNote);
      addToast({ title: 'Incident Resolved', message: 'Resolution recorded into audit trail.', type: 'success' });
      setShowResolveModal(false);
      loadAlert();
    } catch (err) {
      addToast({ title: 'Resolution Failed', message: err.message, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Correlating threat audit events and risk breakdown..." />;
  }

  if (error || !alertData) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400 mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Incident Record Not Found</h2>
        <p className="text-xs text-slate-400 mb-6">{error || 'This alert could not be located.'}</p>
        <Link
          to="/alerts"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Alert Queue</span>
        </Link>
      </div>
    );
  }

  const alert = alertData;
  const events = alert.contributingEvents || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/alerts')}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-cyan-400 font-semibold">{alert.rule_id}</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-400">Incident #{alert.id.substring(0, 8)}</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight truncate max-w-xl">
              {alert.title}
            </h2>
          </div>
        </div>

        {/* Triage Controls */}
        <div className="flex items-center space-x-3">
          {alert.status === 'open' && (
            <button
              onClick={handleAcknowledge}
              className="px-4 py-2 rounded-xl bg-blue-950/60 hover:bg-blue-900/80 border border-blue-800/60 text-cyan-300 font-medium text-xs flex items-center space-x-1.5 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Acknowledge</span>
            </button>
          )}

          {alert.status !== 'resolved' ? (
            <button
              onClick={() => {
                setShowResolveModal(true);
                setResolutionNote('');
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-950/50 transition-all"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Resolve Incident</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 font-mono text-xs font-bold uppercase flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Resolved</span>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Risk & Rule Parameters */}
        <div className="lg:col-span-1 space-y-6">
          {/* Risk Score Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center space-x-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span>Calculated Risk Assessment</span>
            </h3>

            <div className="text-center py-4 bg-slate-900/60 rounded-xl border border-slate-800/80">
              <div className="text-4xl font-bold font-mono text-white mb-1">
                {alert.risk_score}<span className="text-xs text-slate-500 font-normal">/100</span>
              </div>
              <span className={`inline-flex items-center space-x-1 px-3 py-0.5 rounded-full text-xs font-mono font-bold uppercase border ${
                alert.severity === 'critical' ? 'bg-red-950/60 text-red-300 border-red-800/60' :
                alert.severity === 'high' ? 'bg-orange-950/60 text-orange-300 border-orange-800/60' :
                alert.severity === 'medium' ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' :
                'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
              }`}>
                <span>{alert.severity} Severity</span>
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">Target / Offender</span>
                <p className="font-semibold text-slate-200 mt-0.5 font-mono">{alert.trigger_username || 'System'}</p>
              </div>

              {alert.related_document_id && (
                <div>
                  <span className="text-slate-500 block text-[10px] font-mono uppercase">Related Document</span>
                  <p className="font-semibold text-cyan-300 mt-0.5">{alert.document_name || alert.related_document_id}</p>
                </div>
              )}

              <div>
                <span className="text-slate-500 block text-[10px] font-mono uppercase">Detection Time</span>
                <p className="font-mono text-slate-300 mt-0.5">{new Date(alert.detected_at).toLocaleString()}</p>
              </div>

              {alert.status === 'resolved' && (
                <div className="pt-3 border-t border-slate-800">
                  <span className="text-emerald-400 block text-[10px] font-mono uppercase font-bold">Resolution Note</span>
                  <p className="text-slate-300 mt-1 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
                    "{alert.resolution_note}"
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1.5 font-mono">
                    Resolved by @{alert.resolved_by_username || 'Admin'} on {new Date(alert.resolved_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Contributing Audit Events Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Contributing Audit Evidence ({events.length} Events)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  The sliding-window threat detector triggered this alert based on the exact audit log entries below.
                </p>
              </div>
            </div>

            {events.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No individual audit logs linked to this alert.</p>
            ) : (
              <div className="space-y-3">
                {events.map((evt, idx) => (
                  <div key={evt.id} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full ${
                          evt.outcome === 'denied' ? 'bg-red-400' :
                          evt.outcome === 'failure' ? 'bg-amber-400' : 'bg-emerald-400'
                        }`} />
                        <span className="font-mono font-bold text-slate-200">{evt.action}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-950 text-slate-400 border border-slate-800">
                          {evt.outcome}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                      <div>Actor: <span className="text-slate-200">{evt.actor_username || 'Unknown'}</span></div>
                      <div>IP: <span className="text-slate-200">{evt.ip_address || '127.0.0.1'}</span></div>
                      {evt.details && Object.keys(evt.details).length > 0 && (
                        <div className="col-span-2 text-slate-300">
                          Details: {JSON.stringify(evt.details)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resolution Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <span>Mitigate & Resolve Incident</span>
            </h3>

            <form onSubmit={handleResolve} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">
                  Resolution Note (Will be recorded in application audit trail)
                </label>
                <textarea
                  rows={4}
                  required
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="e.g. Reviewed user logs, confirmed credential typo. No unauthorized data exfiltration occurred."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !resolutionNote.trim()}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Close Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
