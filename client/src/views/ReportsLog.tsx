import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api } from '../utils/api.js';
import { FileText, Search, Calendar, Filter, Eye, Printer, Trash2, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function ReportsLog() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  // Debounce search input by 300ms
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Support immediate search on Enter key press
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setDebouncedSearch(search);
    }
  };

  // Load reports
  const { data, isLoading, isFetching } = useQuery<any>({
    queryKey: ['reports-log', debouncedSearch, statusFilter, startDate, endDate, page],
    queryFn: ({ signal }) => {
      let query = `/reports?page=${page}&limit=15`;
      if (debouncedSearch) query += `&q=${debouncedSearch}`;
      if (statusFilter) query += `&status=${statusFilter}`;
      if (startDate) query += `&startDate=${startDate}`;
      if (endDate) query += `&endDate=${endDate}`;
      return api.get(query, { signal });
    },
    placeholderData: keepPreviousData
  });

  const deleteReportMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports-log'] });
      toast.success('Patient entry deleted successfully.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete patient entry.');
    }
  });

  const reports = data?.reports || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 no-print">
      
      {/* View Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Investigation Logs</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Review investigation histories, re-print reports, download PDFs, or check sharing logs.</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm p-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Search Input */}
        <div className="relative">
          <label className="block text-[10px] font-bold text-slate-550 mb-1 uppercase tracking-wider">Search Keyword</label>
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Name, Phone, ID..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 focus:outline-none"
            />
            <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            {isFetching && (
              <div className="absolute right-3 w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Report Status</label>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="PRINTED">Printed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); setPage(1); }}
            className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-850 dark:text-white focus:outline-none"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); setPage(1); }}
            className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-850 dark:text-white focus:outline-none"
          />
        </div>

      </div>

      {/* Reports Table List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm overflow-hidden p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                <th className="pb-3 w-32">Report ID</th>
                <th className="pb-3 w-48">Patient Demographics</th>
                <th className="pb-3 w-40">Referring Doctor</th>
                <th className="pb-3 w-28">Reg Date</th>
                <th className="pb-3 w-28">Status</th>
                <th className="pb-3 w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
                    <td className="py-3.5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32"></div></td>
                    <td className="py-3.5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20"></div></td>
                    <td className="py-3.5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16"></div></td>
                    <td className="py-3.5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24"></div></td>
                    <td className="py-3.5 text-right"><div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-16 ml-auto"></div></td>
                  </tr>
                ))
              ) : (
                reports.map((report: any) => (
                  <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/15 transition-colors">
                    <td className="py-3.5 font-bold text-slate-800 dark:text-white text-xs">{report.id}</td>
                    <td className="py-3.5">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-white">{report.patient.name}</p>
                        <span className="text-[10px] text-slate-450">
                          {report.patient.age ? `${report.patient.age} ${(report.patient.ageUnit || 'YEARS').toLowerCase()}` : 'N/A'}
                          {'  |  '}
                          {report.patient.gender || 'N/A'}
                          {'  |  '}
                          {report.patient.phone || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 text-slate-600 dark:text-slate-400 font-semibold">{report.doctor.name}</td>
                    <td className="py-3.5 text-xs text-slate-500 dark:text-slate-450">{new Date(report.registrationDate).toLocaleDateString()}</td>
                    <td className="py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold
                        ${report.status === 'PENDING' ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400' : ''}
                        ${report.status === 'COMPLETED' ? 'bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400' : ''}
                        ${report.status === 'PRINTED' ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400' : ''}
                        ${report.status === 'CANCELLED' ? 'bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400' : ''}
                      `}>
                        <span className={`w-1.5 h-1.5 rounded-full
                          ${report.status === 'PENDING' ? 'bg-amber-500' : ''}
                          ${report.status === 'COMPLETED' ? 'bg-teal-500' : ''}
                          ${report.status === 'PRINTED' ? 'bg-purple-500' : ''}
                          ${report.status === 'CANCELLED' ? 'bg-red-500' : ''}
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
                      <button
                        onClick={() => {
                          if (window.confirm("Are you sure you want to permanently delete this patient entry?")) {
                            deleteReportMutation.mutate(report.id);
                          }
                        }}
                        className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-500 hover:text-white rounded text-red-500 transition"
                        title="Delete Patient Entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {!isLoading && reports.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">No reports matched the filter parameters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination links */}
        {totalPages > 1 && (
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded text-xs disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-slate-450 font-medium">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
