import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { useAppStore } from './store/useStore.js';
import Login from './views/Login.js';
import Sidebar from './components/Sidebar.js';
import Dashboard from './views/Dashboard.js';
import PatientRegister from './views/PatientRegister.js';
import ReportsLog from './views/ReportsLog.js';
import ReportEntry from './views/ReportEntry.js';
import KnowledgeEngine from './views/KnowledgeEngine.js';
import Settings from './views/Settings.js';
import BillingView from './views/BillingView.js';
import { Toaster, toast } from 'sonner';
import { ShieldCheck, Copy } from 'lucide-react';
import { api } from './utils/api.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

// Initialize React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent aggressive reloading in desktop app
      retry: 1,
      staleTime: 300000, // 5 minutes cache stale time
      gcTime: 600000, // 10 minutes cache gc time
    }
  }
});

function LicenseGuard({ children }: { children: React.ReactNode }) {
  const [activationKey, setActivationKey] = useState('');

  // Check license status
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['license-status'],
    queryFn: () => api.get('/licensing/status'),
    retry: 10,
    retryDelay: 1000
  });

  // Fetch local fingerprint
  const { data: fpData } = useQuery({
    queryKey: ['license-fingerprint'],
    queryFn: () => api.get('/licensing/fingerprint'),
    enabled: status?.isValid === false
  });

  const activateMutation = useMutation({
    mutationFn: (key: string) => api.post('/licensing/activate', { key }),
    onSuccess: (res: any) => {
      refetch();
      toast.success(res.message || 'License activated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Activation failed.');
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-bold">Verifying Laboratory License...</p>
        </div>
      </div>
    );
  }

  if (!status?.isValid) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 p-6 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl relative overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-rose-600"></div>

          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-rose-950/40 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-900/50">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-lg font-bold text-white">License Activation Required</h2>
            <p className="text-xs text-slate-400">Your laboratory software requires an active machine activation key.</p>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-850 rounded-lg text-[10px] space-y-1">
            <span className="block text-slate-500 font-bold uppercase tracking-wider">Error Details</span>
            <span className="text-rose-400 font-semibold">{status?.message || 'Verification failed.'}</span>
          </div>

          {fpData?.fingerprint && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Hardware Fingerprint</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={fpData.fingerprint}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(fpData.fingerprint);
                    toast.success('Fingerprint copied to clipboard.');
                  }}
                  className="px-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg text-white flex items-center justify-center"
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enter Activation Key</label>
            <textarea
              placeholder="Paste Base64 activation key payload here..."
              rows={3}
              value={activationKey}
              onChange={e => setActivationKey(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500 h-16 resize-none"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (!activationKey.trim()) {
                toast.error('Please enter an activation key.');
                return;
              }
              activateMutation.mutate(activationKey.trim());
            }}
            disabled={activateMutation.isPending}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
          >
            {activateMutation.isPending ? 'Activating License...' : 'Activate Laboratory'}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  const token = useAppStore(state => state.token);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors />
      <LicenseGuard>
        <ErrorBoundary>
          <HashRouter>
            {!token ? (
              <Routes>
                <Route path="*" element={<Login />} />
              </Routes>
            ) : (
              <div className="flex h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 text-slate-800 dark:text-slate-100 overflow-hidden">
                
                {/* Left Navigation Sidebar */}
                <Sidebar />

                {/* Right Main Content Panel */}
                <main className="flex-1 h-screen overflow-y-auto relative bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/patients" element={<ReportsLog />} />
                    <Route path="/register-patient" element={<PatientRegister />} />
                    <Route path="/reports" element={<ReportsLog />} />
                    <Route path="/reports/:id/entry" element={<ReportEntry />} />
                    <Route path="/reports/:id/billing" element={<BillingView />} />
                    <Route path="/knowledge-engine" element={<KnowledgeEngine />} />
                    <Route path="/settings" element={<Settings />} />
                    {/* Fallback to Dashboard */}
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </main>
              </div>
            )}
          </HashRouter>
        </ErrorBoundary>
      </LicenseGuard>
    </QueryClientProvider>
  );
}
