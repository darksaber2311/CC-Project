import React, { useState, useEffect } from 'react';
import { User, Shield, HardDrive, FileText, Clock, Save, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi } from '../api/authApi.js';
import { useToast } from '../context/ToastContext.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { formatDateTime } from '../utils/dateFormatter.js';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        const data = await authApi.getProfile();
        if (isMounted) {
          setFullName(data.user.fullName || '');
          setDepartment(data.user.department || '');
          setStats(data.stats);
          setRecentActivity(data.recentActivity || []);
        }
      } catch (err) {
        addToast({ title: 'Error', message: 'Could not load profile details', type: 'error' });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProfile();
    return () => { isMounted = false; };
  }, [addToast]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authApi.updateProfile({ fullName, department });
      await refreshUser();
      addToast({ title: 'Profile Updated', message: 'Your identity details have been saved.', type: 'success' });
    } catch (err) {
      addToast({ title: 'Update Failed', message: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading user security profile..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Security Identity & Profile</h2>
        <p className="text-xs text-slate-400">Manage your identity credentials and view personal repository activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-2xl font-bold text-white shadow-xl shadow-cyan-950/60 mb-4 border border-cyan-400/30">
            {user?.username?.substring(0, 2).toUpperCase()}
          </div>
          <h3 className="text-base font-bold text-white">{user?.fullName || user?.username}</h3>
          <p className="text-xs font-mono text-cyan-400 mt-0.5">{user?.email}</p>
          <div className="mt-3 flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono uppercase tracking-wider font-semibold bg-purple-950/40 text-purple-300 border border-purple-800/40">
              Role: {user?.role}
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40">
              Active
            </span>
          </div>

          <div className="w-full mt-6 pt-6 border-t border-slate-800 space-y-3 text-left">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Documents Owned:</span>
              </span>
              <span className="font-mono font-bold text-white">{stats?.documentsOwned || 0}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Storage Consumed:</span>
              </span>
              <span className="font-mono font-bold text-white">
                {((stats?.totalStorageBytes || 0) / 1024).toFixed(1)} KB
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Form & Recent Activity */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-100 mb-4 flex items-center space-x-2">
              <User className="w-4 h-4 text-cyan-400" />
              <span>Personal Information</span>
            </h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Account Handle (Read-only)</label>
                <input
                  type="text"
                  disabled
                  value={user?.username || ''}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-400 font-mono cursor-not-allowed"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center space-x-2 transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Recent Personal Activity */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Recent Personal Audit History</span>
            </h3>
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No recent personal activity logged.</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
                    <div className="flex items-center space-x-2.5">
                      <span className={`w-2 h-2 rounded-full ${log.outcome === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                      <span className="font-mono text-slate-200">{log.action}</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">{formatDateTime(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
