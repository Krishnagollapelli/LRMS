import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api.js';
import { 
  Building, 
  Plus, 
  Key, 
  Cpu, 
  RefreshCw, 
  Mail, 
  MessageSquare, 
  Check, 
  UserPlus,
  Copy,
  Trash2,
  AlertTriangle,
  Lock,
  Activity,
  Zap,
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface Lab {
  id: string;
  labName: string;
  licenseType: string;
  maxDevices: number;
  status: string;
  expiryDate: string | null;
  createdAt: string;
  geminiApiKey: string;
  geminiQuotaLimit: number;
  geminiQuotaCount: number;
  whatsappEnabled: boolean;
  whatsappApiKey: string;
  whatsappPhoneId: string;
  emailEnabled: boolean;
  emailSmtpHost: string;
  emailSmtpPort: number;
  emailSmtpUser: string;
  emailSmtpPass: string;
  emailSender: string;
  _count?: {
    users: number;
    devices: number;
  };
}

export default function SuperAdminDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Lab Form State
  const [newLabName, setNewLabName] = useState('');
  const [newLicenseType, setNewLicenseType] = useState('SINGLE');
  const [newMaxDevices, setNewMaxDevices] = useState(1);
  const [newExpiryDate, setNewExpiryDate] = useState('');

  // Fetch Labs
  const { data: labs = [], isLoading, refetch } = useQuery<Lab[]>({
    queryKey: ['super-admin-labs'],
    queryFn: () => api.get('/super-admin/labs')
  });

  // Create Lab Mutation
  const createLabMutation = useMutation({
    mutationFn: (data: any) => api.post('/super-admin/labs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-labs'] });
      toast.success('New laboratory license registered successfully!');
      setShowCreateModal(false);
      setNewLabName('');
      setNewExpiryDate('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to register lab');
    }
  });

  // Update Lab Mutation
  const updateLabMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/super-admin/labs/${id}`, data),
    onSuccess: (updated: Lab) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-labs'] });
      toast.success('Laboratory configuration updated!');
      setSelectedLab(updated);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update lab');
    }
  });

  // Reset Quota Mutation
  const resetQuotaMutation = useMutation({
    mutationFn: (id: string) => api.post(`/super-admin/labs/${id}/quota-reset`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-labs'] });
      toast.success('Gemini API quota counter reset successfully!');
      if (selectedLab && selectedLab.id === id) {
        setSelectedLab(prev => prev ? { ...prev, geminiQuotaCount: 0 } : null);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reset quota');
    }
  });

  // Reset Devices Mutation
  const resetDevicesMutation = useMutation({
    mutationFn: (id: string) => api.post(`/super-admin/labs/${id}/devices-reset`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-labs'] });
      toast.success('All registered devices cleared for this lab.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reset devices');
    }
  });

  const handleUpdateLab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLab) return;

    updateLabMutation.mutate({
      id: selectedLab.id,
      data: selectedLab
    });
  };

  const filteredLabs = labs.filter(lab => 
    lab.labName.toLowerCase().includes(search.toLowerCase()) || 
    lab.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-300 font-sans">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-600/10 text-rose-500 rounded-lg">
              <Lock size={20} />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
              Super Admin Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Register diagnostic labs, provision API keys, monitor validation quotas, and configure SMTP/WhatsApp channels.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition shadow-md shadow-teal-600/10"
        >
          <Plus size={16} />
          Register New Lab
        </button>
      </div>

      {/* Grid Stats Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-teal-600/10 text-teal-600 dark:text-teal-400 rounded-xl">
            <Building size={24} />
          </div>
          <div>
            <span className="block text-slate-500 dark:text-slate-400 text-xs font-semibold">Total Registered Labs</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-white">{labs.length}</span>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Cpu size={24} />
          </div>
          <div>
            <span className="block text-slate-500 dark:text-slate-400 text-xs font-semibold">Active Licensed Devices</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-white">
              {labs.reduce((acc, curr) => acc + (curr._count?.devices || 0), 0)}
            </span>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-600/10 text-rose-600 dark:text-rose-400 rounded-xl">
            <Activity size={24} />
          </div>
          <div>
            <span className="block text-slate-500 dark:text-slate-400 text-xs font-semibold">Quota Exceeded Warning Labs</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-white">
              {labs.filter(l => l.geminiQuotaCount >= l.geminiQuotaLimit).length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Labs List Panel (Left) */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col h-[650px]">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Diagnostic Laboratories</h2>
            <input
              type="text"
              placeholder="Search by Lab name or Activation Key..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-2">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-slate-400 font-semibold">Loading labs...</span>
              </div>
            ) : filteredLabs.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 font-bold">No registered labs found.</div>
            ) : (
              filteredLabs.map((lab) => {
                const isSelected = selectedLab?.id === lab.id;
                const isQuotaExceeded = lab.geminiQuotaCount >= lab.geminiQuotaLimit;
                return (
                  <div
                    key={lab.id}
                    onClick={() => setSelectedLab(lab)}
                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col space-y-2 ${
                      isSelected 
                        ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-500 dark:border-teal-500/40' 
                        : 'bg-white dark:bg-slate-900 border-slate-150/80 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-850/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-white text-xs">{lab.labName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        lab.status === 'ACTIVE' 
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {lab.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Type: {lab.licenseType}</span>
                      <span>Devices: {lab._count?.devices || 0} / {lab.maxDevices}</span>
                    </div>

                    {/* Gemini Quota Progress Indicator */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[9px] font-bold">
                        <span className="text-slate-400 uppercase tracking-wider">Gemini Quota</span>
                        <span className={isQuotaExceeded ? 'text-red-500 font-black animate-pulse' : 'text-slate-500 dark:text-slate-300'}>
                          {lab.geminiQuotaCount} / {lab.geminiQuotaLimit}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            isQuotaExceeded ? 'bg-red-500' : 'bg-teal-500'
                          }`}
                          style={{ width: `${Math.min((lab.geminiQuotaCount / lab.geminiQuotaLimit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Lab Settings Form Panel (Right) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm min-h-[650px] flex flex-col">
          {!selectedLab ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-4 bg-slate-100 dark:bg-slate-800/40 rounded-full text-slate-400">
                <Settings size={40} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Laboratory Selected</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Select a registered laboratory from the list on the left to view active configs, edit database settings, monitor Gemini API limits, or reset device slots.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpdateLab} className="flex-1 flex flex-col space-y-6">
              
              {/* Lab Metadata Info Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white">{selectedLab.labName}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Registered on {new Date(selectedLab.createdAt).toLocaleDateString()}</p>
                  </div>
                  
                  {/* Reset Actions */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Reset Gemini quota count for ${selectedLab.labName}?`)) {
                          resetQuotaMutation.mutate(selectedLab.id);
                        }
                      }}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1"
                    >
                      <RefreshCw size={12} />
                      Reset Quota
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Are you sure you want to clear device fingerprints for ${selectedLab.labName}? This releases all locked device slots.`)) {
                          resetDevicesMutation.mutate(selectedLab.id);
                        }
                      }}
                      className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1"
                    >
                      <Cpu size={12} />
                      Reset Devices ({selectedLab._count?.devices || 0})
                    </button>
                  </div>
                </div>

                {/* Activation Key Block */}
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider">License Key / Activation ID</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={selectedLab.id}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-mono text-teal-600 dark:text-teal-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedLab.id);
                        toast.success('License Key copied to clipboard!');
                      }}
                      className="px-3 bg-slate-800 dark:bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg text-white flex items-center justify-center"
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-1 max-h-[400px]">
                
                {/* 1. Basic License Settings */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider pb-1.5 border-b border-slate-100 dark:border-slate-850 flex items-center gap-1.5">
                    <Key size={14} className="text-rose-500" />
                    License Parameters
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Lab Name</label>
                      <input
                        type="text"
                        value={selectedLab.labName}
                        onChange={e => setSelectedLab({ ...selectedLab, labName: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                      <select
                        value={selectedLab.status}
                        onChange={e => setSelectedLab({ ...selectedLab, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="EXPIRED">EXPIRED</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Max Devices</label>
                      <input
                        type="number"
                        min={1}
                        value={selectedLab.maxDevices}
                        onChange={e => setSelectedLab({ ...selectedLab, maxDevices: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Expiration Date</label>
                      <input
                        type="date"
                        value={selectedLab.expiryDate ? selectedLab.expiryDate.split('T')[0] : ''}
                        onChange={e => setSelectedLab({ ...selectedLab, expiryDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Gemini AI Configuration */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider pb-1.5 border-b border-slate-100 dark:border-slate-850 flex items-center gap-1.5">
                    <Zap size={14} className="text-teal-500" />
                    Gemini AI Integration
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Gemini API Key</label>
                      <input
                        type="password"
                        value={selectedLab.geminiApiKey}
                        onChange={e => setSelectedLab({ ...selectedLab, geminiApiKey: e.target.value })}
                        placeholder="AI key for automated report interpretation"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Validation Limit</label>
                      <input
                        type="number"
                        min={1}
                        value={selectedLab.geminiQuotaLimit}
                        onChange={e => setSelectedLab({ ...selectedLab, geminiQuotaLimit: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. WhatsApp Cloud API Configuration */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider pb-1.5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-emerald-500" />
                      WhatsApp Integration
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-500">
                      <input
                        type="checkbox"
                        checked={selectedLab.whatsappEnabled}
                        onChange={e => setSelectedLab({ ...selectedLab, whatsappEnabled: e.target.checked })}
                        className="rounded border-slate-350 dark:border-slate-750 text-teal-600 focus:ring-teal-500/20"
                      />
                      ENABLE CHANNEL
                    </label>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">WhatsApp Phone ID</label>
                      <input
                        type="text"
                        value={selectedLab.whatsappPhoneId}
                        onChange={e => setSelectedLab({ ...selectedLab, whatsappPhoneId: e.target.value })}
                        disabled={!selectedLab.whatsappEnabled}
                        placeholder="Meta Phone Number ID"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">WhatsApp API Key (Access Token)</label>
                      <input
                        type="password"
                        value={selectedLab.whatsappApiKey}
                        onChange={e => setSelectedLab({ ...selectedLab, whatsappApiKey: e.target.value })}
                        disabled={!selectedLab.whatsappEnabled}
                        placeholder="Meta Graph Permanent Token"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. SMTP Email Configuration */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider pb-1.5 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Mail size={14} className="text-sky-500" />
                      SMTP Outbound Email
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-500">
                      <input
                        type="checkbox"
                        checked={selectedLab.emailEnabled}
                        onChange={e => setSelectedLab({ ...selectedLab, emailEnabled: e.target.checked })}
                        className="rounded border-slate-350 dark:border-slate-750 text-teal-600 focus:ring-teal-500/20"
                      />
                      ENABLE CHANNEL
                    </label>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={selectedLab.emailSmtpHost}
                        onChange={e => setSelectedLab({ ...selectedLab, emailSmtpHost: e.target.value })}
                        disabled={!selectedLab.emailEnabled}
                        placeholder="e.g. smtp.gmail.com"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">SMTP Port</label>
                      <input
                        type="number"
                        value={selectedLab.emailSmtpPort}
                        onChange={e => setSelectedLab({ ...selectedLab, emailSmtpPort: Number(e.target.value) })}
                        disabled={!selectedLab.emailEnabled}
                        placeholder="587"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">SMTP User</label>
                      <input
                        type="text"
                        value={selectedLab.emailSmtpUser}
                        onChange={e => setSelectedLab({ ...selectedLab, emailSmtpUser: e.target.value })}
                        disabled={!selectedLab.emailEnabled}
                        placeholder="user@example.com"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">SMTP Password</label>
                      <input
                        type="password"
                        value={selectedLab.emailSmtpPass}
                        onChange={e => setSelectedLab({ ...selectedLab, emailSmtpPass: e.target.value })}
                        disabled={!selectedLab.emailEnabled}
                        placeholder="SMTP secret password"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sender Email</label>
                      <input
                        type="text"
                        value={selectedLab.emailSender}
                        onChange={e => setSelectedLab({ ...selectedLab, emailSender: e.target.value })}
                        disabled={!selectedLab.emailEnabled}
                        placeholder="Diagnostic Lab <sender@domain.com>"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Footer Action */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={updateLabMutation.isPending}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 shadow-md shadow-teal-600/10"
                >
                  <Check size={16} />
                  {updateLabMutation.isPending ? 'Saving Settings...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Register New Lab Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-teal-600"></div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Register Laboratory License</h3>
              <p className="text-xs text-slate-400">Generate a unique activation key for a new laboratory client.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Laboratory Name</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Diagnostics"
                  value={newLabName}
                  onChange={e => setNewLabName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">License Type</label>
                  <select
                    value={newLicenseType}
                    onChange={e => setNewLicenseType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="SINGLE">SINGLE</option>
                    <option value="MULTI">MULTI</option>
                    <option value="UNLIMITED">UNLIMITED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Device Slots</label>
                  <input
                    type="number"
                    min={1}
                    value={newMaxDevices}
                    onChange={e => setNewMaxDevices(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={newExpiryDate}
                  onChange={e => setNewExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="flex justify-end items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newLabName.trim()) {
                    toast.error('Please enter a laboratory name.');
                    return;
                  }
                  createLabMutation.mutate({
                    labName: newLabName.trim(),
                    licenseType: newLicenseType,
                    maxDevices: newMaxDevices,
                    expiryDate: newExpiryDate || null
                  });
                }}
                disabled={createLabMutation.isPending}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition shadow-md shadow-teal-600/10"
              >
                {createLabMutation.isPending ? 'Registering...' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
