import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Users, 
  AlertTriangle, 
  ShieldCheck, 
  Activity, 
  ArrowUpRight, 
  ShieldAlert, 
  Clock, 
  FileUp,
  Flame,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuth } from '../context/AuthContext.jsx';
import { activityApi } from '../api/activityApi.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';

export function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchDashboard = async () => {
      try {
        const res = await activityApi.getStats();
        if (isMounted) setData(res);
      } catch (err) {
        console.error('Failed to load dashboard metrics', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboard();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return <LoadingSpinner message="Aggregating security metrics..." />;
  }

  const metrics = data?.metrics || { totalDocuments: 0, activeUsers: 0, openAlerts: { total: 0 } };
  const recentAlerts = data?.recentAlerts || [];
  const recentEvents = data?.recentEvents || [];
  const timeline = data?.activityTimeline || [];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0d1627] to-[#0c1f38] border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">Active Session</span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">
            Welcome, {user?.fullName || user?.username}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAdmin 
              ? 'Administrator Console: Real-time threat detection, audit logging & risk triage active.'
              : 'Secure Document Repository: Upload, classify, and share protected departmental assets.'
            }
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/upload"
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center space-x-2 shadow-lg shadow-cyan-950/50 transition-all"
          >
            <FileUp className="w-4 h-4" />
            <span>Upload Document</span>
          </Link>
          <Link
            to="/documents"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center space-x-2 border border-slate-700 transition-all"
          >
            <FileText className="w-4 h-4" />
            <span>Browse Documents</span>
          </Link>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Documents */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Repository Files</span>
            <div className="p-2 rounded-xl bg-blue-950/60 text-cyan-400 border border-blue-800/40">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white font-mono">{metrics.totalDocuments}</span>
            <span className="text-xs text-slate-400">active documents</span>
          </div>
        </div>

        {/* Card 2: Active Users */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Identities</span>
            <div className="p-2 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-800/40">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white font-mono">{metrics.activeUsers}</span>
            <span className="text-xs text-slate-400">authorized accounts</span>
          </div>
        </div>

        {/* Card 3: Open Security Alerts */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Security Alerts</span>
            <div className={`p-2 rounded-xl border ${
              metrics.openAlerts?.total > 0 
                ? 'bg-red-950/60 text-red-400 border-red-800/40 animate-pulse'
                : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className={`text-2xl font-bold font-mono ${metrics.openAlerts?.total > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {metrics.openAlerts?.total || 0}
            </span>
            <span className="text-xs text-slate-400">unresolved</span>
          </div>
        </div>

        {/* Card 4: Threat Engine Status */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Detection Engine</span>
            <div className="p-2 rounded-xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="text-sm font-semibold text-slate-200">Sliding Window Active</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Activity Timeline Chart (Admin only or system events) */}
      {isAdmin && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Audit & Security Velocity (7-Day Sliding Window)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time log aggregation from persistent SQLite audit database.</p>
            </div>
            <Link to="/activity" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1">
              <span>View Full Log</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="h-56 w-full pt-2">
            {timeline.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                No activity data in the current observation window.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalEvents" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="securityFlags" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area type="monotone" dataKey="total_events" name="Total Events" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#totalEvents)" />
                  <Area type="monotone" dataKey="security_flags" name="Security Flags" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#securityFlags)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Bottom Grid: Recent Alerts (Admin) & Recent Activity */}
      <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-2' : ''} gap-6`}>
        {/* Recent Alerts (Admin Only) */}
        {isAdmin && (
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span>Recent Security Incidents</span>
              </h3>
              <Link to="/alerts" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1">
                <span>View All Alerts</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentAlerts.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-300">No Security Incidents</p>
                <p className="text-[11px] text-slate-500 mt-1">Rule-based threat engine has detected zero anomalous events.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentAlerts.map((alert) => {
                  const severityBadge = {
                    critical: 'bg-red-950/60 text-red-300 border-red-800/60',
                    high: 'bg-orange-950/60 text-orange-300 border-orange-800/60',
                    medium: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
                    low: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  }[alert.severity] || 'bg-slate-800 text-slate-300 border-slate-700';

                  return (
                    <div key={alert.id} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${severityBadge}`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs font-semibold text-white truncate max-w-xs">{alert.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Trigger: <span className="text-cyan-300">{alert.trigger_username || 'Unknown'}</span> • Score: <span className="text-amber-400 font-bold">{alert.risk_score}/100</span>
                        </p>
                      </div>
                      <Link 
                        to={`/alerts/${alert.id}`}
                        className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 flex-shrink-0"
                      >
                        Triage
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Recent Activity Log */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Audit Trail (Recent Events)</span>
            </h3>
            {isAdmin && (
              <Link to="/activity" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1">
                <span>Explorer</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {recentEvents.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
              <HelpCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No recent events recorded.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((evt) => {
                const isDenied = evt.outcome === 'denied';
                const isFail = evt.outcome === 'failure';
                const isSuccess = evt.outcome === 'success';

                return (
                  <div key={evt.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isDenied ? 'bg-red-400' : isFail ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      <div className="min-w-0">
                        <div className="font-mono font-medium text-slate-200 truncate">{evt.action}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          Actor: <span className="text-cyan-300">{evt.actor_username || 'Anonymous'}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 flex-shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
