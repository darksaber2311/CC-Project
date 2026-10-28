import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  ShieldAlert, 
  FileText, 
  UploadCloud, 
  Activity, 
  AlertOctagon, 
  Users, 
  TestTube2, 
  User, 
  LayoutDashboard,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export function Sidebar({ collapsed, onToggle }) {
  const { user, isAdmin } = useAuth();

  const navItems = [
    { to: '/', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: '/documents', label: 'Documents', icon: FileText },
    { to: '/upload', label: 'Upload Document', icon: UploadCloud },
    // Admin only links
    ...(isAdmin ? [
      { to: '/alerts', label: 'Security Alerts', icon: AlertOctagon, badge: 'threat' },
      { to: '/activity', label: 'Activity Logs', icon: Activity },
      { to: '/users', label: 'Users & Roles', icon: Users },
      { to: '/evaluation', label: 'Research Evaluation', icon: TestTube2 }
    ] : []),
    { to: '/profile', label: 'My Profile', icon: User }
  ];

  return (
    <aside 
      className={`fixed top-0 left-0 h-screen bg-[#0b0f19] border-r border-slate-800/80 z-30 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800/80 justify-between">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/30 flex-shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base text-white tracking-wide">Secure<span className="text-cyan-400">Docs</span></span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">Threat Detection</span>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        <div className={`px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-slate-400 ${collapsed ? 'hidden' : 'block'}`}>
          Navigation
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `
              flex items-center px-3 py-2.5 rounded-xl font-medium text-sm transition-all group relative
              ${isActive 
                ? 'bg-gradient-to-r from-cyan-950/60 to-blue-950/40 text-cyan-400 border border-cyan-800/40 shadow-sm shadow-cyan-950/50' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }
              ${collapsed ? 'justify-center' : 'space-x-3'}
            `}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User Status Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-3'}`}>
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-300">
            {user?.username?.substring(0, 2).toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.fullName || user?.username}</p>
              <div className="flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[10px] font-mono text-slate-400 uppercase">{user?.role}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
