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
  FileText,
  Settings,
  Users,
  Globe,
  Database,
  LockKeyhole
} from 'lucide-react';
import { toast } from 'sonner';

interface Lab {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  logo: string | null;
  licenseExpiry: string | null;
  subscription: string;
  status: string;
  createdAt: string;
  geminiApiKey: string | null;
  openaiApiKey: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  whatsappApiKey: string | null;
  whatsappPhoneId: string | null;
  _count?: {
    users: number;
  };
}

interface Stats {
  totalLabs: number;
  activeLabs: number;
  inactiveLabs: number;
  licenseExpiring: number;
  totalReports: number;
  totalTechnicians: number;
  totalStorage: string;
  aiRequests: number;
}

interface Technician {
  id: string;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  laboratoryId: string;
}

interface ActivityLog {
  id: string;
  userId: string | null;
  action: string;
  details: string;
  timestamp: string;
  ipAddress: string | null;
  user?: {
    name: string;
    username: string;
  };
}

export default function SuperAdminDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'keys' | 'smtp' | 'users' | 'logs'>('info');

  // Technician Management Form State
  const [techName, setTechName] = useState('');
  const [techUsername, setTechUsername] = useState('');
  const [techPassword, setTechPassword] = useState('');
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [targetTech, setTargetTech] = useState<Technician | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // New Lab Form State
  const [newLabName, setNewLabName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newExpiryDate, setNewExpiryDate] = useState('');

  // Fetch Dashboard Stats
  const { data: stats } = useQuery<Stats>({
    queryKey: ['super-admin-stats'],
    queryFn: () => api.get('/super-admin/stats'),
    refetchInterval: 15000 // Refresh stats every 15s
  });

  // Fetch Labs
  const { data: labs = [], isLoading } = useQuery<Lab[]>({
    queryKey: ['super-admin-labs'],
    queryFn: () => api.get('/super-admin/labs')
  });

  // Fetch Lab Technicians (only when tab is selected)
  const { data: technicians = [], refetch: refetchTechs } = useQuery<Technician[]>({
    queryKey: ['super-admin-lab-techs', selectedLab?.id],
    queryFn: () => api.get(`/super-admin/labs/${selectedLab?.id}/users`),
    enabled: !!selectedLab && activeTab === 'users'
  });

  // Fetch Lab Activity Logs (only when tab is selected)
  const { data: activityLogs = [] } = useQuery<ActivityLog[]>({
    queryKey: ['super-admin-lab-logs', selectedLab?.id],
    queryFn: () => api.get(`/super-admin/labs/${selectedLab?.id}/activity-logs`),
    enabled: !!selectedLab && activeTab === 'logs'
  });

  // Create Lab Mutation
  const createLabMutation = useMutation({
    mutationFn: (data: any) => api.post('/super-admin/labs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-labs'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-stats'] });
      toast.success('New laboratory created successfully!');
      setShowCreateModal(false);
      setNewLabName('');
      setNewOwnerName('');
      setNewPhone('');
      setNewEmail('');
      setNewAddress('');
      setNewExpiryDate('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create laboratory');
    }
  });

  // Update Lab Mutation
  const updateLabMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/super-admin/labs/${id}`, data),
    onSuccess: (updated: Lab) => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-labs'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-stats'] });
      toast.success('Laboratory configuration updated!');
      setSelectedLab(updated);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update laboratory');
    }
  });

  // Delete Lab Mutation
  const deleteLabMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/super-admin/labs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-labs'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-stats'] });
      toast.success('Laboratory deleted successfully!');
      setSelectedLab(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete laboratory');
    }
  });

  // Create Technician Mutation
  const createTechMutation = useMutation({
    mutationFn: (data: any) => api.post(`/super-admin/labs/${selectedLab?.id}/users`, data),
    onSuccess: () => {
      refetchTechs();
      toast.success('Technician account created successfully!');
      setTechName('');
      setTechUsername('');
      setTechPassword('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create technician');
    }
  });

  // Toggle Technician Status Mutation
  const toggleTechMutation = useMutation({
    mutationFn: (techId: string) => api.patch(`/super-admin/labs/${selectedLab?.id}/users/${techId}/toggle`),
    onSuccess: () => {
      refetchTechs();
      toast.success('Technician status updated!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to toggle technician status');
    }
  });

  // Reset Technician Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: ({ techId, data }: { techId: string; data: any }) => 
      api.post(`/super-admin/labs/${selectedLab?.id}/users/${techId}/reset-password`, data),
    onSuccess: () => {
      toast.success('Technician password reset successfully!');
      setShowResetPasswordModal(false);
      setNewResetPassword('');
      setTargetTech(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to reset password');
    }
  });

  // Delete Technician Mutation
  const deleteTechMutation = useMutation({
    mutationFn: (techId: string) => api.delete(`/super-admin/labs/${selectedLab?.id}/users/${techId}`),
    onSuccess: () => {
      refetchTechs();
      toast.success('Technician account deleted successfully.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete technician');
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

  const handleCreateLab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabName.trim()) {
      toast.error('Laboratory name is required.');
      return;
    }
    createLabMutation.mutate({
      name: newLabName.trim(),
      ownerName: newOwnerName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim(),
      address: newAddress.trim(),
      licenseExpiry: newExpiryDate || null
    });
  };

  const handleCreateTechnician = (e: React.FormEvent) => {
    e.preventDefault();
    if (!techName.trim() || !techUsername.trim() || !techPassword.trim()) {
      toast.error('Please enter name, username, and password.');
      return;
    }
    createTechMutation.mutate({
      name: techName,
      username: techUsername,
      password: techPassword
    });
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTech || !newResetPassword.trim()) return;
    resetPasswordMutation.mutate({
      techId: targetTech.id,
      data: { newPassword: newResetPassword }
    });
  };

  const filteredLabs = labs.filter(lab => 
    lab.name.toLowerCase().includes(search.toLowerCase()) || 
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
              Super Admin Management Console
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Global monitoring of diagnostic labs, technician accounts, system settings, validation keys, and outbox logs.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition shadow-md shadow-teal-600/10"
        >
          <Plus size={16} />
          Create Laboratory
        </button>
      </div>

      {/* Grid Stats Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-teal-600/10 text-teal-600 dark:text-teal-400 rounded-xl">
            <Building size={24} />
          </div>
          <div>
            <span className="block text-slate-500 dark:text-slate-400 text-xs font-semibold">Total Laboratories</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-white">{stats?.totalLabs ?? 0}</span>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <span className="block text-slate-500 dark:text-slate-400 text-xs font-semibold">Technician Accounts</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-white">{stats?.totalTechnicians ?? 0}</span>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-violet-600/10 text-violet-600 dark:text-violet-400 rounded-xl">
            <Database size={24} />
          </div>
          <div>
            <span className="block text-slate-500 dark:text-slate-400 text-xs font-semibold">Database Storage</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-white">{stats?.totalStorage ?? 'N/A'}</span>
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-teal-600/10 text-teal-600 dark:text-teal-400 rounded-xl">
            <Zap size={24} />
          </div>
          <div>
            <span className="block text-slate-500 dark:text-slate-400 text-xs font-semibold">Gemini AI Request Counter</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-white">{stats?.aiRequests ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Labs List Panel (Left) */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col h-[700px]">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-2 font-sans">Laboratory Tenant List</h2>
            <input
              type="text"
              placeholder="Search by Lab Name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-2">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-slate-400 font-semibold">Loading laboratories...</span>
              </div>
            ) : filteredLabs.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 font-bold">No laboratories registered yet.</div>
            ) : (
              filteredLabs.map((lab) => {
                const isSelected = selectedLab?.id === lab.id;
                const isExpired = lab.licenseExpiry ? new Date(lab.licenseExpiry) < new Date() : false;
                return (
                  <div
                    key={lab.id}
                    onClick={() => {
                      setSelectedLab(lab);
                      setActiveTab('info');
                    }}
                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col space-y-2 ${
                      isSelected 
                        ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-500 dark:border-teal-500/40' 
                        : 'bg-white dark:bg-slate-900 border-slate-150/80 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-850/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-white text-xs">{lab.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        lab.status === 'ACTIVE' && !isExpired
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {isExpired ? 'EXPIRED' : lab.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Owner: {lab.ownerName}</span>
                      <span>Expiry: {lab.licenseExpiry ? new Date(lab.licenseExpiry).toLocaleDateString() : 'Lifetime'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Lab Settings Tabbed Panel (Right) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm min-h-[700px] flex flex-col">
          {!selectedLab ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-4 bg-slate-100 dark:bg-slate-800/40 rounded-full text-slate-400">
                <Settings size={40} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Laboratory Selected</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Select a laboratory from the list on the left to manage technician accounts, SMTP credentials, API key endpoints, and audit trails.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-6">
              
              {/* Lab Metadata Header details */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">{selectedLab.name}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">ID: {selectedLab.id}</p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete ${selectedLab.name}? All laboratory data will be preserved but access will be suspended.`)) {
                        deleteLabMutation.mutate(selectedLab.id);
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1.5"
                  >
                    <Trash2 size={12} />
                    Delete Lab
                  </button>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="flex border-b border-slate-150 dark:border-slate-800 gap-1 overflow-x-auto pb-px">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'info' 
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400 font-bold' 
                      : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  General Info
                </button>
                <button
                  onClick={() => setActiveTab('keys')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'keys' 
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400 font-bold' 
                      : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Integration Keys
                </button>
                <button
                  onClick={() => setActiveTab('smtp')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'smtp' 
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400 font-bold' 
                      : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  SMTP Outbound
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'users' 
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400 font-bold' 
                      : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Technicians
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'logs' 
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400 font-bold' 
                      : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Activity Logs
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto max-h-[420px] pr-1 space-y-4">
                
                {/* Info Tab */}
                {activeTab === 'info' && (
                  <form onSubmit={handleUpdateLab} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Laboratory Name</label>
                        <input
                          type="text"
                          value={selectedLab.name}
                          onChange={e => setSelectedLab({ ...selectedLab, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Owner Name</label>
                        <input
                          type="text"
                          value={selectedLab.ownerName}
                          onChange={e => setSelectedLab({ ...selectedLab, ownerName: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Phone</label>
                        <input
                          type="text"
                          value={selectedLab.phone}
                          onChange={e => setSelectedLab({ ...selectedLab, phone: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Email</label>
                        <input
                          type="email"
                          value={selectedLab.email}
                          onChange={e => setSelectedLab({ ...selectedLab, email: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Physical Address</label>
                        <textarea
                          rows={2}
                          value={selectedLab.address}
                          onChange={e => setSelectedLab({ ...selectedLab, address: e.target.value })}
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
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">License Expiry Date</label>
                        <input
                          type="date"
                          value={selectedLab.licenseExpiry ? selectedLab.licenseExpiry.split('T')[0] : ''}
                          onChange={e => setSelectedLab({ ...selectedLab, licenseExpiry: e.target.value ? new Date(e.target.value).toISOString() : null })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={updateLabMutation.isPending}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                    >
                      {updateLabMutation.isPending ? 'Saving...' : 'Save General Details'}
                    </button>
                  </form>
                )}

                {/* Keys Tab */}
                {activeTab === 'keys' && (
                  <form onSubmit={handleUpdateLab} className="space-y-4">
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-slate-850">AI Providers</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Gemini API Key</label>
                          <input
                            type="password"
                            value={selectedLab.geminiApiKey || ''}
                            onChange={e => setSelectedLab({ ...selectedLab, geminiApiKey: e.target.value || null })}
                            placeholder="AI Key for smart analysis reports"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">OpenAI API Key</label>
                          <input
                            type="password"
                            value={selectedLab.openaiApiKey || ''}
                            onChange={e => setSelectedLab({ ...selectedLab, openaiApiKey: e.target.value || null })}
                            placeholder="OpenAI GPT backup engine key"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-slate-850">WhatsApp Cloud Integration</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">WhatsApp Phone ID</label>
                          <input
                            type="text"
                            value={selectedLab.whatsappPhoneId || ''}
                            onChange={e => setSelectedLab({ ...selectedLab, whatsappPhoneId: e.target.value || null })}
                            placeholder="Meta Phone Number ID"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">WhatsApp Access Token (API Key)</label>
                          <input
                            type="password"
                            value={selectedLab.whatsappApiKey || ''}
                            onChange={e => setSelectedLab({ ...selectedLab, whatsappApiKey: e.target.value || null })}
                            placeholder="Meta Permanent Access Token"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={updateLabMutation.isPending}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                    >
                      {updateLabMutation.isPending ? 'Saving...' : 'Save Keys'}
                    </button>
                  </form>
                )}

                {/* SMTP Tab */}
                {activeTab === 'smtp' && (
                  <form onSubmit={handleUpdateLab} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">SMTP Host</label>
                        <input
                          type="text"
                          value={selectedLab.smtpHost || ''}
                          onChange={e => setSelectedLab({ ...selectedLab, smtpHost: e.target.value || null })}
                          placeholder="e.g. smtp.gmail.com"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">SMTP Port</label>
                        <input
                          type="number"
                          value={selectedLab.smtpPort || ''}
                          onChange={e => setSelectedLab({ ...selectedLab, smtpPort: e.target.value ? Number(e.target.value) : null })}
                          placeholder="587"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">SMTP Username</label>
                        <input
                          type="text"
                          value={selectedLab.smtpUser || ''}
                          onChange={e => setSelectedLab({ ...selectedLab, smtpUser: e.target.value || null })}
                          placeholder="sender@domain.com"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">SMTP Password</label>
                        <input
                          type="password"
                          value={selectedLab.smtpPass || ''}
                          onChange={e => setSelectedLab({ ...selectedLab, smtpPass: e.target.value || null })}
                          placeholder="SMTP Password / App Secret"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sender Email</label>
                        <input
                          type="email"
                          value={selectedLab.smtpFromEmail || ''}
                          onChange={e => setSelectedLab({ ...selectedLab, smtpFromEmail: e.target.value || null })}
                          placeholder="no-reply@domain.com"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sender Display Name</label>
                        <input
                          type="text"
                          value={selectedLab.smtpFromName || ''}
                          onChange={e => setSelectedLab({ ...selectedLab, smtpFromName: e.target.value || null })}
                          placeholder="Apex Diagnostics Outbox"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={updateLabMutation.isPending}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                    >
                      {updateLabMutation.isPending ? 'Saving...' : 'Save Outbound Channels'}
                    </button>
                  </form>
                )}

                {/* Technicians (Users) Tab */}
                {activeTab === 'users' && (
                  <div className="space-y-6">
                    
                    {/* Add Technician Form */}
                    <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 space-y-4">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                        <UserPlus size={16} className="text-teal-600" />
                        Create Technician Account
                      </h4>
                      
                      <form onSubmit={handleCreateTechnician} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Display Name</label>
                          <input
                            type="text"
                            placeholder="e.g. John Doe"
                            value={techName}
                            onChange={e => setTechName(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Username</label>
                          <input
                            type="text"
                            placeholder="e.g. john_tech"
                            value={techUsername}
                            onChange={e => setTechUsername(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Password</label>
                            <input
                              type="password"
                              placeholder="••••••"
                              value={techPassword}
                              onChange={e => setTechPassword(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white focus:outline-none"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={createTechMutation.isPending}
                            className="px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition text-xs font-bold h-[32px] flex items-center justify-center"
                          >
                            Add
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Technicians List Table */}
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-2.5">Name</th>
                            <th className="px-4 py-2.5">Username</th>
                            <th className="px-4 py-2.5">Created</th>
                            <th className="px-4 py-2.5">Status</th>
                            <th className="px-4 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-slate-800 dark:text-slate-250">
                          {technicians.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-8 text-slate-400 font-bold">No technicians added to this laboratory yet.</td>
                            </tr>
                          ) : (
                            technicians.map(tech => (
                              <tr key={tech.id}>
                                <td className="px-4 py-3 font-semibold">{tech.name}</td>
                                <td className="px-4 py-3 font-mono">{tech.username}</td>
                                <td className="px-4 py-3 text-slate-400">{new Date(tech.createdAt).toLocaleDateString()}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    tech.isActive 
                                      ? 'bg-emerald-500/10 text-emerald-500' 
                                      : 'bg-amber-500/10 text-amber-500'
                                  }`}>
                                    {tech.isActive ? 'ACTIVE' : 'SUSPENDED'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right space-x-2">
                                  <button
                                    onClick={() => toggleTechMutation.mutate(tech.id)}
                                    className="px-2 py-1 text-[10px] font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 rounded transition"
                                  >
                                    Toggle
                                  </button>
                                  <button
                                    onClick={() => {
                                      setTargetTech(tech);
                                      setShowResetPasswordModal(true);
                                    }}
                                    className="px-2 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded transition"
                                  >
                                    Reset Pass
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Remove technician account for ${tech.name}?`)) {
                                        deleteTechMutation.mutate(tech.id);
                                      }
                                    }}
                                    className="px-2 py-1 text-[10px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded transition"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Logs Tab */}
                {activeTab === 'logs' && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Activity size={16} className="text-rose-500" />
                      Laboratory Activity Audit Log
                    </h4>

                    <div className="space-y-2.5">
                      {activityLogs.length === 0 ? (
                        <div className="text-center py-12 text-xs text-slate-400 font-bold">No activity logs recorded for this laboratory.</div>
                      ) : (
                        activityLogs.map((log) => (
                          <div 
                            key={log.id} 
                            className="p-3 border border-slate-150 dark:border-slate-850 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 flex flex-col space-y-1.5"
                          >
                            <div className="flex justify-between items-start gap-4">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                {log.action.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{log.details}</p>
                            <div className="flex justify-between items-center text-[9px] text-slate-400 uppercase tracking-wider font-bold">
                              <span>User: {log.user?.name || 'System'} ({log.user?.username || 'system'})</span>
                              {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}
        </div>
      </div>

      {/* Register New Lab Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateLab} className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-teal-600"></div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Create Laboratory Profile</h3>
              <p className="text-xs text-slate-400">Initialize a new multi-tenant diagnostic laboratory instance.</p>
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
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Owner Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Krishna"
                  value={newOwnerName}
                  onChange={e => setNewOwnerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 XXXXX XXXXX"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="contact@apex.com"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Physical Address</label>
                <input
                  type="text"
                  placeholder="Medical Center Lane, Ground floor"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">License Expiration Date</label>
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
                type="submit"
                disabled={createLabMutation.isPending}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition shadow-md shadow-teal-600/10"
              >
                {createLabMutation.isPending ? 'Registering...' : 'Register Laboratory'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Technician Password Reset Modal */}
      {showResetPasswordModal && targetTech && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleResetPasswordSubmit} className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <LockKeyhole size={18} className="text-amber-500" />
                Reset Password
              </h3>
              <p className="text-xs text-slate-400">Resetting access credential for technician: <strong className="text-slate-700 dark:text-slate-350">{targetTech.name}</strong></p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">New Password</label>
              <input
                type="password"
                placeholder="Enter new technician password"
                value={newResetPassword}
                onChange={e => setNewResetPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                required
              />
            </div>

            <div className="flex justify-end items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setNewResetPassword('');
                  setTargetTech(null);
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetPasswordMutation.isPending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition"
              >
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
