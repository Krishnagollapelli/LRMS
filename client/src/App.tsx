import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from './store/useStore.js';
import Login from './views/Login.js';
import Sidebar from './components/Sidebar.js';
import { Toaster } from 'sonner';
import { api } from './utils/api.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

// Lazy load heavy views for code-splitting and faster initial page paint
const Dashboard = React.lazy(() => import('./views/Dashboard.js'));
const PatientRegister = React.lazy(() => import('./views/PatientRegister.js'));
const ReportsLog = React.lazy(() => import('./views/ReportsLog.js'));
const ReportEntry = React.lazy(() => import('./views/ReportEntry.js'));
const KnowledgeEngine = React.lazy(() => import('./views/KnowledgeEngine.js'));
const Settings = React.lazy(() => import('./views/Settings.js'));
const BillingView = React.lazy(() => import('./views/BillingView.js'));
const SuperAdminDashboard = React.lazy(() => import('./views/SuperAdminDashboard.js'));

// Initialize React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent aggressive reloading in browser tabs
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
        <BrowserRouter>
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
                <React.Suspense fallback={
                  <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                    <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }>
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
                </React.Suspense>
              </main>
            </div>
          )}
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
