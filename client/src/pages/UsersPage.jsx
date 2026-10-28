import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  FileText, 
  Clock, 
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { userApi } from '../api/userApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [togglingId, setTogglingId] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userApi.getAllUsers();
      setUsers(data.users || []);
    } catch (err) {
      addToast({ title: 'Query Error', message: 'Failed to retrieve user directory', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = async (user) => {
    if (user.id === currentUser.id) {
      addToast({ title: 'Action Prohibited', message: 'You cannot suspend your own active administrator account.', type: 'warning' });
      return;
    }

    const nextStatus = user.is_active === 1 ? false : true;
    const actionLabel = nextStatus ? 'activate' : 'suspend';

    if (!window.confirm(`Are you sure you want to ${actionLabel} account '@${user.username}'?`)) {
      return;
    }

    try {
      setTogglingId(user.id);
      await userApi.toggleUserStatus(user.id, nextStatus);
      addToast({ 
        title: 'Status Updated', 
        message: `Account '@${user.username}' has been ${nextStatus ? 'activated' : 'suspended'}.`, 
        type: 'info' 
      });
      fetchUsers();
    } catch (err) {
      addToast({ title: 'Update Failed', message: err.message, type: 'error' });
    } finally {
      setTogglingId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Identity Directory & Role Management</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Administer institutional user accounts, access privileges, and suspension controls.
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, handle or department..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
          <span>Total: <strong className="text-white">{users.length}</strong> accounts</span>
          <span>•</span>
          <span className="text-emerald-400">Active: <strong>{users.filter(u => u.is_active === 1).length}</strong></span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner message="Scanning active user identities..." />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No Users Found</h3>
            <p className="text-xs text-slate-500 mt-1">No user records match your search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Identity / Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Documents Owned</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Access Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser.id;
                  const isActive = u.is_active === 1;

                  return (
                    <tr key={u.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-300">
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                              <span>{u.full_name}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-800/40">You</span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">@{u.username} • {u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                          u.role === 'admin'
                            ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                            : 'bg-blue-950/60 text-cyan-300 border-cyan-800/60'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {u.department || 'General Staff'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {u.documents_count || 0}
                      </td>
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-red-950/60 text-red-300 border border-red-800/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                            <span>Suspended</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isCurrent || togglingId === u.id}
                          className={`px-3 py-1 rounded-xl text-xs font-mono font-medium border transition-colors ${
                            isCurrent
                              ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                              : isActive
                              ? 'bg-red-950/40 hover:bg-red-900/60 border-red-800/40 text-red-300 hover:text-red-200'
                              : 'bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/40 text-emerald-300 hover:text-emerald-200'
                          }`}
                          title={isCurrent ? 'Self-deactivation disabled' : isActive ? 'Suspend Account' : 'Reactivate Account'}
                        >
                          {togglingId === u.id ? 'Updating...' : isActive ? 'Suspend' : 'Activate'}
                        </button>
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
