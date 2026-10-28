import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, LogOut, Shield, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiRequest } from '../../api/client.js';

export function TopNavbar({ collapsed }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openAlertsCount, setOpenAlertsCount] = useState(0);

  // Poll for open alerts count for Admins every 15 seconds
  useEffect(() => {
    if (!isAdmin) return;

    let isMounted = true;
    const fetchAlertsCount = async () => {
      try {
        const data = await apiRequest('/alerts?status=open&limit=1');
        if (isMounted) {
          setOpenAlertsCount(data.total || 0);
        }
      } catch {
        // Silently tolerate if alerts endpoint not reachable or initial load
      }
    };

    fetchAlertsCount();
    const interval = setInterval(fetchAlertsCount, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdmin]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Determine breadcrumb / page title from pathname
  const getPageTitle = (path) => {
    if (path === '/') return 'Security & Document Overview';
    if (path.startsWith('/documents/')) return 'Document Details & Access Control';
    if (path === '/documents') return 'Document Repository';
    if (path === '/upload') return 'Secure Document Ingestion';
    if (path.startsWith('/alerts/')) return 'Threat Analysis & Incident Detail';
    if (path === '/alerts') return 'Security Alerts & Incident Triage';
    if (path === '/activity') return 'System Audit Trail Explorer';
    if (path === '/users') return 'User Directory & Access Control';
    if (path === '/evaluation') return 'Threat Detection Research Benchmark';
    if (path === '/profile') return 'Security Profile & Identity';
    return 'SecureDocs System';
  };

  return (
    <header 
      className={`fixed top-0 right-0 h-16 bg-[#080c14]/90 backdrop-blur-md border-b border-slate-800/80 z-20 transition-all duration-300 flex items-center justify-between px-6 ${
        collapsed ? 'left-20' : 'left-64'
      }`}
    >
      {/* Title / Breadcrumb */}
      <div className="flex items-center space-x-3">
        <h1 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
          <span>{getPageTitle(location.pathname)}</span>
        </h1>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-4">
        {/* Admin Alerts Indicator */}
        {isAdmin && (
          <button
            onClick={() => navigate('/alerts')}
            className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all flex items-center space-x-2"
            title="Open Security Alerts"
          >
            <Bell className="w-4 h-4 text-slate-300" />
            {openAlertsCount > 0 ? (
              <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-red-950/80 text-red-400 border border-red-800/50">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                <span>{openAlertsCount} Alert{openAlertsCount > 1 ? 's' : ''}</span>
              </span>
            ) : (
              <span className="text-xs font-mono text-emerald-400">All Clear</span>
            )}
          </button>
        )}

        {/* User Pill */}
        <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-slate-200">{user?.fullName || user?.username}</p>
            <p className="text-[11px] font-mono text-slate-400">{user?.department || 'Member'}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold uppercase tracking-wider border ${
            isAdmin 
              ? 'bg-purple-950/40 text-purple-300 border-purple-800/40' 
              : 'bg-blue-950/40 text-cyan-300 border-cyan-800/40'
          }`}>
            {user?.role}
          </span>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/40 transition-all"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
