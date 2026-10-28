import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';

export function ForbiddenPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400 mb-6 shadow-xl shadow-red-950/40">
        <ShieldX className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">403 — Access Denied</h1>
      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
        Your current account role does not have administrative privileges to access this security resource. This attempt has been recorded in the security audit trail.
      </p>
      <Link
        to="/"
        className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Overview</span>
      </Link>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-6xl font-mono font-bold text-slate-700 mb-2">404</h1>
      <h2 className="text-xl font-bold text-white mb-2">Document or Route Not Found</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        The requested resource path does not exist in the SecureDocs repository.
      </p>
      <Link
        to="/"
        className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Overview</span>
      </Link>
    </div>
  );
}
