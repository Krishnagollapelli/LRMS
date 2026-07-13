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
import SuperAdminDashboard from './views/SuperAdminDashboard.js';
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

export default function App() {
  const token = useAppStore(state => state.token);
  const user = useAppStore(state => state.user);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors />
      <ErrorBoundary>
        <HashRouter>
          {!token ? (
            <Routes>
              <Route path="*" element={<Login />} />
            </Routes>
          ) : (
            <div className="flex h-screen bg-slate-50 dark:bg-slate-955 transition-colors duration-300 text-slate-800 dark:text-slate-100 overflow-hidden">
              
              {/* Left Navigation Sidebar */}
              <Sidebar />

              {/* Right Main Content Panel */}
              <main className="flex-1 h-screen overflow-y-auto relative bg-slate-50 dark:bg-slate-955 transition-colors duration-300">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/patients" element={<ReportsLog />} />
                  <Route path="/register-patient" element={<PatientRegister />} />
                  <Route path="/reports" element={<ReportsLog />} />
                  <Route path="/reports/:id/entry" element={<ReportEntry />} />
                  <Route path="/reports/:id/billing" element={<BillingView />} />
                  <Route path="/knowledge-engine" element={<KnowledgeEngine />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/super-admin" element={user?.role === 'SUPER_ADMIN' ? <SuperAdminDashboard /> : <Navigate to="/" />} />
                  {/* Fallback to Dashboard */}
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </main>
            </div>
          )}
        </HashRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
