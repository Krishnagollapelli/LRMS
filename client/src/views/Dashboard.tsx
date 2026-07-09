import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api.js';
import type { DashboardStats } from 'shared';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  Printer, 
  ArrowRight,
  TrendingUp,
  Activity,
  FileText,
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/reports/dashboard/stats'),
    refetchInterval: 10000 // Refetch every 10 seconds for real-time dashboard updates
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 font-semibold">Failed to load dashboard metrics. Ensure server is running.</p>
      </div>
    );
  }

  const cards = [
    { name: "Today's Patients", value: stats?.todayPatientsCount ?? 0, icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20' },
    { name: 'Pending Reports', value: stats?.pendingReportsCount ?? 0, icon: Clock, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20' },
    { name: 'Completed Reports', value: stats?.completedReportsCount ?? 0, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
    { name: 'Printed Reports', value: stats?.printedReportsCount ?? 0, icon: Printer, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/20' },
  ];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Welcome Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Diagnostics Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time status of patient registration, report entry, and sharing.</p>
        </div>
        <div className="p-2 bg-teal-50 dark:bg-teal-950/30 rounded-lg text-teal-700 dark:text-teal-400 border border-teal-100 dark:border-teal-900/50 flex items-center gap-2 text-xs font-semibold">
          <Activity size={15} />
          <span>Local Analyzer System Connected</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.name} className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{card.name}</span>
                <p className="text-3xl font-bold text-slate-800 dark:text-white">{card.value}</p>
              </div>
              <div className={`p-3.5 rounded-lg ${card.bg} ${card.color}`}>
                <Icon size={24} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Reports List */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText size={18} className="text-teal-600 dark:text-teal-400" />
              <span>Recently Registered Reports</span>
            </h2>
            <Link to="/reports" className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <th className="pb-3 font-semibold">Report ID</th>
                  <th className="pb-3 font-semibold">Patient</th>
                  <th className="pb-3 font-semibold">Tests Panel</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {stats?.recentReports && stats.recentReports.length > 0 ? (
                  stats.recentReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-3.5 font-bold text-slate-800 dark:text-white text-xs">{report.id}</td>
                      <td className="py-3.5 font-medium text-slate-700 dark:text-slate-300">
                        <div>
                          <p className="font-semibold">{report.patientName}</p>
                          <span className="text-[10px] text-slate-400">Ref: {report.doctorName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-slate-500 dark:text-slate-400 truncate max-w-[180px]" title={report.testsText}>
                        {report.testsText}
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium capitalize
                          ${report.status === 'PENDING' ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400' : ''}
                          ${report.status === 'COMPLETED' ? 'bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400' : ''}
                          ${report.status === 'PRINTED' ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400' : ''}
                        `}>
                          <span className={`w-1.5 h-1.5 rounded-full 
                            ${report.status === 'PENDING' ? 'bg-amber-500' : ''}
                            ${report.status === 'COMPLETED' ? 'bg-teal-500' : ''}
                            ${report.status === 'PRINTED' ? 'bg-purple-500' : ''}
                          `} />
                          {report.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="py-3.5 text-right flex items-center justify-end gap-1.5">
                        <Link 
                          to={`/reports/${report.id}/entry`} 
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-500 rounded text-slate-700 dark:text-slate-300 transition"
                          title="Open Report Entry"
                        >
                          <Eye size={14} />
                        </Link>
                        <Link 
                          to={`/reports/${report.id}/billing`} 
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-500 rounded text-slate-700 dark:text-slate-300 transition font-bold text-xs flex items-center justify-center w-7 h-7"
                          title="Open Billing"
                        >
                          ₹
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">No reports registered today.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Most Ordered Panels list */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm p-6 flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-5">
            <TrendingUp size={18} className="text-teal-600 dark:text-teal-400" />
            <span>Top Ordered Test Panels</span>
          </h2>

          <div className="flex-1 space-y-4">
            {stats?.mostUsedTests && stats.mostUsedTests.length > 0 ? (
              stats.mostUsedTests.map((test, index) => {
                const maxCount = Math.max(...(stats?.mostUsedTests.map(t => t.count) || [1]));
                const pct = maxCount > 0 ? (test.count / maxCount) * 100 : 0;
                
                return (
                  <div key={test.testName} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{test.testName}</span>
                      <span className="font-bold text-slate-500 dark:text-slate-400">{test.count} orders</span>
                    </div>
                    {/* Visual bar */}
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-teal-600 dark:bg-teal-500 rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm py-12">
                No investigations completed yet.
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Link 
              to="/register-patient"
              className="w-full py-2 bg-teal-600 dark:bg-teal-500 text-white text-xs font-bold rounded-lg text-center hover:bg-teal-700 dark:hover:bg-teal-600 transition flex items-center justify-center gap-2"
            >
              <span>+ Register New Investigation</span>
            </Link>
          </div>
        </div>

      </div>

    </div>
  );
}
