import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Server, Database, ShieldCheck } from 'lucide-react';
import { Button } from '../components/common/Button.jsx';
import { checkRoot, checkHealth, getMe } from '../services/auth.js';
import { getApiBaseUrl, getSupabaseCredentials } from '../lib/config.js';

export function HealthCheckPage() {
  const [rootStatus, setRootStatus] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [meStatus, setMeStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const creds = getSupabaseCredentials();
  const apiUrl = getApiBaseUrl();

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const [r, h, m] = await Promise.allSettled([
        checkRoot(),
        checkHealth(),
        getMe(),
      ]);

      setRootStatus(r.status === 'fulfilled' ? r.value : { error: r.reason?.message });
      setHealthStatus(h.status === 'fulfilled' ? h.value : { error: h.reason?.message });
      setMeStatus(m.status === 'fulfilled' ? m.value : { error: m.reason?.message });
    } catch (err) {
      console.warn('Diagnostics error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Diagnostics & API</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Test backend health endpoints and verify FastAPI + Supabase connectivity.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={runDiagnostics}
          loading={loading}
          icon={RefreshCw}
        >
          Run Diagnostics
        </Button>
      </div>

      {/* Endpoint Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* GET / */}
        <div className="p-4.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-slate-700">GET /</span>
            {rootStatus?.error ? (
              <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Error
              </span>
            ) : rootStatus ? (
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Online
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Testing...</span>
            )}
          </div>
          <div className="bg-slate-50 p-2 rounded text-[11px] font-mono text-slate-700 overflow-x-auto max-h-24">
            {JSON.stringify(rootStatus || {}, null, 2)}
          </div>
        </div>

        {/* GET /health */}
        <div className="p-4.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-slate-700">GET /health</span>
            {healthStatus?.error ? (
              <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Error
              </span>
            ) : healthStatus ? (
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Testing...</span>
            )}
          </div>
          <div className="bg-slate-50 p-2 rounded text-[11px] font-mono text-slate-700 overflow-x-auto max-h-24">
            {JSON.stringify(healthStatus || {}, null, 2)}
          </div>
        </div>

        {/* GET /me */}
        <div className="p-4.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold text-slate-700">GET /me</span>
            {meStatus?.error ? (
              <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Unauth / Error
              </span>
            ) : meStatus ? (
              <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Authenticated
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Testing...</span>
            )}
          </div>
          <div className="bg-slate-50 p-2 rounded text-[11px] font-mono text-slate-700 overflow-x-auto max-h-24">
            {JSON.stringify(meStatus || {}, null, 2)}
          </div>
        </div>
      </div>

      {/* Read-Only Environment Diagnostics */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
        <div className="pb-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-500" />
            <span>Environment Diagnostics</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Read-only configuration loaded from your local <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">.env</code> file.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <Server className="w-4 h-4 text-brand-gradient" />
              <span>FastAPI Backend URL</span>
            </div>
            <p className="font-mono text-[11px] text-slate-800 break-all">{apiUrl}</p>
            <p className="text-[10px] text-slate-500">Configured via VITE_API_BASE_URL</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <Database className="w-4 h-4 text-brand-gradient" />
              <span>Supabase Project</span>
            </div>
            <p className="font-mono text-[11px] text-slate-800 break-all">
              {creds.url || 'Not configured'}
            </p>
            <p className="text-[10px] text-slate-500">Configured via VITE_SUPABASE_URL</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 md:col-span-2">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Supabase Public Anon Key</span>
            </div>
            <p className="text-[11px] text-slate-700">
              {creds.key ? (
                <span className="text-emerald-700 font-medium">✓ Configured in local environment</span>
              ) : (
                <span className="text-amber-700 font-medium">Missing VITE_SUPABASE_ANON_KEY</span>
              )}
            </p>
            <p className="text-[10px] text-slate-500">
              Only the public/anon key is permitted in frontend client code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
