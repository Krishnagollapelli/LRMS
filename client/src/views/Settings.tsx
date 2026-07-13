import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api.js';
import { useAppStore } from '../store/useStore.js';
import type { Doctor, User, LabSettings, Parameter } from 'shared';
import { 
  Building, 
  ShieldCheck, 
  Users, 
  History, 
  Upload, 
  Trash2, 
  UserCheck, 
  Plus,
  Moon,
  Sun,
  Cpu,
  Sliders,
  Database,
  Download,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const queryClient = useQueryClient();
  const activeUser = useAppStore(state => state.user);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'doctors' | 'users' | 'analyzers' | 'audit' | 'print' | 'backup' | 'license'>('profile');

  // Profile Form States
  const [labName, setLabName] = useState('');
  const [labAddress, setLabAddress] = useState('');
  const [labPhone, setLabPhone] = useState('');
  const [labEmail, setLabEmail] = useState('');
  const [labLogo, setLabLogo] = useState('');
  const [labFooter, setLabFooter] = useState('');
  const [docSig, setDocSig] = useState('');
  const [themeColor, setThemeColor] = useState('#0d9488');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSender, setSmtpSender] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [testingGemini, setTestingGemini] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappKey, setWhatsappKey] = useState('');
  const [whatsappId, setWhatsappId] = useState('');

  // Preprinted Stationery Coordinates states
  const [usePreprinted, setUsePreprinted] = useState(false);
  const [topMargin, setTopMargin] = useState(135);
  const [leftMargin, setLeftMargin] = useState(40);
  const [xName, setXName] = useState(110);
  const [yName, setYName] = useState(30);
  const [xDoctor, setXDoctor] = useState(110);
  const [yDoctor, setYDoctor] = useState(45);
  const [xSampleId, setXSampleId] = useState(340);
  const [ySampleId, setYSampleId] = useState(15);
  const [xAgeGender, setXAgeGender] = useState(340);
  const [yAgeGender, setYAgeGender] = useState(30);
  const [xRegDate, setXRegDate] = useState(340);
  const [yRegDate, setYRegDate] = useState(45);
  const [tableTopY, setTableTopY] = useState(230);

  // Doctor CRUD States
  const [docName, setDocName] = useState('');
  const [docQual, setDocQual] = useState('');
  const [docHosp, setDocHosp] = useState('');
  const [docReg, setDocReg] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  // User CRUD States
  const [uUsername, setUUsername] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uName, setUName] = useState('');
  const [uRole, setURole] = useState<'ADMIN' | 'TECHNICIAN'>('TECHNICIAN');

  // Load lab settings
  const { data: settings } = useQuery<LabSettings & any>({
    queryKey: ['lab-settings'],
    queryFn: () => api.get('/settings'),
    onSuccess: (data) => {
      setLabName(data.labName);
      setLabAddress(data.labAddress);
      setLabPhone(data.labPhone);
      setLabEmail(data.labEmail);
      setLabLogo(data.labLogo || '');
      setLabFooter(data.labFooter || '');
      setDocSig(data.doctorSignature || '');
      setThemeColor(data.pdfThemeColor || '#0d9488');
      setEmailEnabled(data.emailEnabled);
      setSmtpHost(data.emailSmtpHost || '');
      setSmtpPort(data.emailSmtpPort || 587);
      setSmtpUser(data.emailSmtpUser || '');
      setSmtpPass(data.emailSmtpPass || '');
      setSmtpSender(data.emailSender || '');
      setWhatsappEnabled(data.whatsappEnabled);
      setWhatsappKey(data.whatsappApiKey || '');
      setWhatsappId(data.whatsappPhoneId || '');
      setGeminiKey(data.geminiApiKey || '');
      
      setUsePreprinted(data.usePreprinted || false);
      setTopMargin(data.topMargin || 135);
      setLeftMargin(data.leftMargin || 40);
      setXName(data.xName || 110);
      setYName(data.yName || 30);
      setXDoctor(data.xDoctor || 110);
      setYDoctor(data.yDoctor || 45);
      setXSampleId(data.xSampleId || 340);
      setYSampleId(data.ySampleId || 15);
      setXAgeGender(data.xAgeGender || 340);
      setYAgeGender(data.yAgeGender || 30);
      setXRegDate(data.xRegDate || 340);
      setYRegDate(data.yRegDate || 45);
      setTableTopY(data.tableTopY || 230);
    }
  });

  // Load doctors
  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ['doctors-settings'],
    queryFn: () => api.get('/doctors')
  });

  // Load users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-settings'],
    queryFn: () => api.get('/auth/users'),
    enabled: activeUser?.role === 'ADMIN'
  });

  // Load audit logs
  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/settings/logs'),
    enabled: activeUser?.role === 'ADMIN'
  });

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => api.put('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-settings'] });
      toast.success('Laboratory profile and configurations saved.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update settings.');
    }
  });

  const saveDoctorMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingDocId) {
        return api.put(`/doctors/${editingDocId}`, data);
      }
      return api.post('/doctors', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors-settings'] });
      toast.success(`Doctor ${editingDocId ? 'updated' : 'registered'} successfully.`);
      clearDoctorForm();
    }
  });

  const deleteDoctorMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/doctors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctors-settings'] });
      toast.info('Doctor profile deactivated.');
    }
  });

  const createUserMutation = useMutation({
    mutationFn: (data: any) => api.post('/auth/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-settings'] });
      toast.success('Technician account created.');
      setUUsername('');
      setUPassword('');
      setUName('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create user.');
    }
  });

  const toggleUserMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/auth/users/${id}/toggle`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-settings'] });
      toast.info('User status toggled.');
    }
  });

  // Base64 file converter helper
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
        toast.info(`${file.name} uploaded successfully.`);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearDoctorForm = () => {
    setDocName('');
    setDocQual('');
    setDocHosp('');
    setDocReg('');
    setDocPhone('');
    setEditingDocId(null);
  };

  const handleTestGemini = async () => {
    if (!geminiKey.trim()) {
      toast.error('Please enter a Gemini API Key to test.');
      return;
    }
    setTestingGemini(true);
    try {
      const res = await api.post('/settings/test-gemini', { apiKey: geminiKey });
      if (res.success) {
        toast.success('Connection Successful: Gemini is working properly.');
      } else {
        toast.error('Failed: ' + (res.error || 'Connection Failed'));
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || 'Failed to connect to Gemini API.');
    } finally {
      setTestingGemini(false);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const sanitizeNum = (val: any) => {
      if (val === '' || val === null || val === undefined) return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    updateSettingsMutation.mutate({
      labName,
      labAddress,
      labPhone,
      labEmail,
      labLogo,
      labFooter,
      doctorSignature: docSig,
      pdfThemeColor: themeColor,
      whatsappEnabled,
      whatsappApiKey: whatsappKey,
      whatsappPhoneId: whatsappId,
      emailEnabled,
      emailSmtpHost: smtpHost,
      emailSmtpPort: sanitizeNum(smtpPort),
      emailSmtpUser: smtpUser,
      emailSmtpPass: smtpPass,
      emailSender: smtpSender,
      geminiApiKey: geminiKey,
      usePreprinted,
      topMargin: sanitizeNum(topMargin),
      leftMargin: sanitizeNum(leftMargin),
      xName: sanitizeNum(xName),
      yName: sanitizeNum(yName),
      xDoctor: sanitizeNum(xDoctor),
      yDoctor: sanitizeNum(yDoctor),
      xSampleId: sanitizeNum(xSampleId),
      ySampleId: sanitizeNum(ySampleId),
      xAgeGender: sanitizeNum(xAgeGender),
      yAgeGender: sanitizeNum(yAgeGender),
      xRegDate: sanitizeNum(xRegDate),
      yRegDate: sanitizeNum(yRegDate),
      tableTopY: sanitizeNum(tableTopY)
    });
  };

  const handleDoctorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName || !docQual || !docHosp || !docReg || !docPhone) {
      toast.error('All doctor fields are required.');
      return;
    }
    saveDoctorMutation.mutate({
      name: docName,
      qualification: docQual,
      hospital: docHosp,
      registrationNumber: docReg,
      phone: docPhone
    });
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uUsername || !uPassword || !uName) {
      toast.error('All user registration fields are required.');
      return;
    }
    createUserMutation.mutate({
      username: uUsername,
      password: uPassword,
      name: uName,
      role: uRole
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 no-print">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Configuration Hub</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage laboratory credentials, refer clinics, technician logins, and audit trails.</p>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all
            ${activeSubTab === 'profile' 
              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 text-teal-600 dark:text-teal-400' 
              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-505'}
          `}
        >
          <Building size={15} />
          <span>Lab & API Config</span>
        </button>
        <button
          onClick={() => setActiveSubTab('doctors')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all
            ${activeSubTab === 'doctors' 
              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 text-teal-600 dark:text-teal-400' 
              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-505'}
          `}
        >
          <UserCheck size={15} />
          <span>Referring Doctors</span>
        </button>

        <button
          onClick={() => setActiveSubTab('analyzers')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all
            ${activeSubTab === 'analyzers' 
              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 text-teal-600 dark:text-teal-400' 
              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-505'}
          `}
        >
          <Cpu size={15} />
          <span>Analyzer Profiles</span>
        </button>

        <button
          onClick={() => setActiveSubTab('print')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all
            ${activeSubTab === 'print' 
              ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 text-teal-600 dark:text-teal-400' 
              : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-505'}
          `}
        >
          <Sliders size={15} />
          <span>Print Alignment</span>
        </button>

        {activeUser?.role === 'ADMIN' && (
          <>
            <button
              onClick={() => setActiveSubTab('users')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all
                ${activeSubTab === 'users' 
                  ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 text-teal-600 dark:text-teal-400' 
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-505'}
              `}
            >
              <Users size={15} />
              <span>User Accounts</span>
            </button>
            <button
              onClick={() => setActiveSubTab('backup')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all
                ${activeSubTab === 'backup' 
                  ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 text-teal-600 dark:text-teal-400' 
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-505'}
              `}
            >
              <Database size={15} />
              <span>Backup & Recovery</span>
            </button>
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border transition-all
                ${activeSubTab === 'audit' 
                  ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 text-teal-600 dark:text-teal-400' 
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-505'}
              `}
            >
              <History size={15} />
              <span>Audit Trail Logs</span>
            </button>
          </>
        )}
      </div>

      {/* --- TAB 1: LAB PROFILE --- */}
      {activeSubTab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-800 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">1. Laboratory Details</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Lab Name</label>
                <input
                  type="text"
                  value={labName}
                  onChange={e => setLabName(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  value={labEmail}
                  onChange={e => setLabEmail(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Address Line</label>
                <input
                  type="text"
                  value={labAddress}
                  onChange={e => setLabAddress(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone</label>
                <input
                  type="text"
                  value={labPhone}
                  onChange={e => setLabPhone(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">PDF Theme color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={e => setThemeColor(e.target.value)}
                    className="w-12 h-9 border border-slate-200 rounded p-1"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={e => setThemeColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border rounded-lg text-sm font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Asset loaders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lab Logo (Base64 PNG)</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-700 bg-white shadow-sm">
                    <Upload size={14} />
                    <span>Upload Logo</span>
                    <input type="file" accept="image/*" onChange={e => handleFileChange(e, setLabLogo)} className="hidden" />
                  </label>
                  {labLogo && <img src={labLogo} className="h-10 border rounded object-contain p-1" alt="Lab Logo" />}
                </div>
              </div>
              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Doctor Sign-off Signature (PNG)</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-700 bg-white shadow-sm">
                    <Upload size={14} />
                    <span>Upload Signature</span>
                    <input type="file" accept="image/*" onChange={e => handleFileChange(e, setDocSig)} className="hidden" />
                  </label>
                  {docSig && <img src={docSig} className="h-10 border rounded object-contain p-1" alt="Doctor Signature" />}
                </div>
              </div>
            </div>
          </div>

          {/* Email Settings */}
          {activeUser?.role === 'SUPER_ADMIN' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-800 dark:text-white">2. Email Delivery Setup (SMTP)</h2>
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={e => setEmailEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
                />
              </div>

              {emailEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm animate-[accordion-down_0.2s_ease-out]">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">SMTP Host</label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={e => setSmtpHost(e.target.value)}
                      className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">SMTP Port</label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={e => setSmtpPort(Number(e.target.value))}
                      className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">SMTP User</label>
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={e => setSmtpUser(e.target.value)}
                      className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">SMTP Password</label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={e => setSmtpPass(e.target.value)}
                      className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Sender Email</label>
                    <input
                      type="text"
                      placeholder="E.g., reports@lab.com"
                      value={smtpSender}
                      onChange={e => setSmtpSender(e.target.value)}
                      className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm text-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* WhatsApp & Gemini Keys */}
          {activeUser?.role === 'SUPER_ADMIN' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-850 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">3. API Credentials & Integrations</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Gemini AI API Key (for Medical Knowledge Resolver)</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Enter Gemini API Key..."
                      value={geminiKey}
                      onChange={e => setGeminiKey(e.target.value)}
                      className="flex-1 px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleTestGemini}
                      disabled={testingGemini}
                      className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-all"
                    >
                      {testingGemini ? 'Testing...' : 'Test Connection'}
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100/60 dark:border-slate-800/40">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Enable WhatsApp Cloud API Integration</span>
                    <input
                      type="checkbox"
                      checked={whatsappEnabled}
                      onChange={e => setWhatsappEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-505"
                    />
                  </div>

                  {whatsappEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm animate-[accordion-down_0.2s_ease-out]">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-550 mb-1 uppercase tracking-wider">Meta Graph API Key</label>
                        <input
                          type="password"
                          placeholder="Bearer token"
                          value={whatsappKey}
                          onChange={e => setWhatsappKey(e.target.value)}
                          className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-555 mb-1 uppercase tracking-wider">WhatsApp Phone ID</label>
                        <input
                          type="text"
                          placeholder="Meta Phone Number ID"
                          value={whatsappId}
                          onChange={e => setWhatsappId(e.target.value)}
                          className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={updateSettingsMutation.isPending}
            className="px-6 py-2.5 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white font-bold rounded-lg text-sm shadow-md"
          >
            {updateSettingsMutation.isPending ? 'Saving configurations...' : 'Save All Settings'}
          </button>
        </form>
      )}

      {/* --- TAB: PRINT COORDINATES CONFIG --- */}
      {activeSubTab === 'print' && (
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-800 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">Coordinate Based Alignment Settings</h2>
            
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-955 border border-slate-200/50 dark:border-slate-800/50 rounded-lg">
              <input
                type="checkbox"
                id="usePreprinted"
                checked={usePreprinted}
                onChange={e => setUsePreprinted(e.target.checked)}
                className="w-4 h-4 text-teal-600 border-slate-350 rounded focus:ring-teal-500"
              />
              <label htmlFor="usePreprinted" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                Enable Pre-printed Stationery Layout (Hides letterhead banner, background blocks, and dividers)
              </label>
            </div>

            {usePreprinted && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 animate-[accordion-down_0.2s_ease-out]">
                {/* Page Margins & Offsets */}
                <div className="space-y-4 border border-slate-100 dark:border-slate-800 p-4 rounded-xl">
                  <h3 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide">1. Margins & Offsets (Points)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Top Page Margin</label>
                      <input
                        type="number"
                        value={topMargin}
                        onChange={e => setTopMargin(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Left Page Margin</label>
                      <input
                        type="number"
                        value={leftMargin}
                        onChange={e => setLeftMargin(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Table Starting Top Offset (Y)</label>
                    <input
                      type="number"
                      value={tableTopY}
                      onChange={e => setTableTopY(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Patient Information Demographics Coordinates */}
                <div className="space-y-4 border border-slate-100 dark:border-slate-800 p-4 rounded-xl">
                  <h3 className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide">2. Demographics Alignment (Y-Offsets)</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Patient Name (Y-Offset)</label>
                      <input
                        type="number"
                        value={yName}
                        onChange={e => setYName(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Patient Name (X-Val)</label>
                      <input
                        type="number"
                        value={xName}
                        onChange={e => setXName(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Ref. Doctor (Y-Offset)</label>
                      <input
                        type="number"
                        value={yDoctor}
                        onChange={e => setYDoctor(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Ref. Doctor (X-Val)</label>
                      <input
                        type="number"
                        value={xDoctor}
                        onChange={e => setXDoctor(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 mb-1 uppercase">Sample ID (Y)</label>
                      <input
                        type="number"
                        value={ySampleId}
                        onChange={e => setYSampleId(Number(e.target.value))}
                        className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 mb-1 uppercase">Age/Sex (Y)</label>
                      <input
                        type="number"
                        value={yAgeGender}
                        onChange={e => setYAgeGender(Number(e.target.value))}
                        className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-500 mb-1 uppercase">Reg. Date (Y)</label>
                      <input
                        type="number"
                        value={yRegDate}
                        onChange={e => setYRegDate(Number(e.target.value))}
                        className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={updateSettingsMutation.isPending}
            className="px-6 py-2.5 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white font-bold rounded-lg text-sm shadow-md transition"
          >
            {updateSettingsMutation.isPending ? 'Saving layout configurations...' : 'Save Alignment Configurations'}
          </button>
        </form>
      )}

      {/* --- TAB 2: DOCTOR CRUD --- */}
      {activeSubTab === 'doctors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm h-fit">
            <h3 className="text-base font-bold text-slate-850 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              {editingDocId ? 'Edit Doctor Profile' : 'Register Referring Doctor'}
            </h3>
            
            <form onSubmit={handleDoctorSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  placeholder="Dr. John Doe"
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Qualification</label>
                  <input
                    type="text"
                    placeholder="M.B.B.S, MD"
                    value={docQual}
                    onChange={e => setDocQual(e.target.value)}
                    className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Hospital</label>
                  <input
                    type="text"
                    placeholder="General Clinic"
                    value={docHosp}
                    onChange={e => setDocHosp(e.target.value)}
                    className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Reg. Number</label>
                  <input
                    type="text"
                    placeholder="REG-888999"
                    value={docReg}
                    onChange={e => setDocReg(e.target.value)}
                    className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone</label>
                  <input
                    type="text"
                    placeholder="Phone"
                    value={docPhone}
                    onChange={e => setDocPhone(e.target.value)}
                    className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {editingDocId && (
                  <button
                    type="button"
                    onClick={clearDoctorForm}
                    className="w-1/2 py-2 border text-xs font-semibold rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 shadow-sm"
                >
                  {editingDocId ? 'Update Doctor' : 'Register Doctor'}
                </button>
              </div>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-850 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">Referring Doctors Library</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto pr-1">
              {doctors.map((doc) => (
                <div key={doc.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white">{doc.name}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{doc.qualification}  |  {doc.hospital}  |  Reg: {doc.registrationNumber}  |  {doc.phone}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingDocId(doc.id);
                        setDocName(doc.name);
                        setDocQual(doc.qualification);
                        setDocHosp(doc.hospital);
                        setDocReg(doc.registrationNumber);
                        setDocPhone(doc.phone);
                      }}
                      className="text-xs text-teal-600 hover:underline font-bold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteDoctorMutation.mutate(doc.id)}
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* --- TAB 3: USER ACCOUNTS --- */}
      {activeSubTab === 'users' && activeUser?.role === 'ADMIN' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-[accordion-down_0.2s_ease-out]">
          
          {/* Create User Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm h-fit">
            <h3 className="text-base font-bold text-slate-850 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">Create Technician Login</h3>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-505 mb-1 uppercase tracking-wider">Account Display Name</label>
                <input
                  type="text"
                  placeholder="Technician John"
                  value={uName}
                  onChange={e => setUName(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-850 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-505 mb-1 uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  placeholder="john_lrms"
                  value={uUsername}
                  onChange={e => setUUsername(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-850 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-505 mb-1 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={uPassword}
                  onChange={e => setUPassword(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-850 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-505 mb-1 uppercase tracking-wider">Access Role</label>
                <select
                  value={uRole}
                  onChange={e => setURole(e.target.value as any)}
                  className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                >
                  <option value="TECHNICIAN">Technician (Standard Access)</option>
                  <option value="ADMIN">Administrator (Full Controls)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={createUserMutation.isPending}
                className="w-full py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 shadow-sm"
              >
                {createUserMutation.isPending ? 'Saving user...' : 'Save Login Profile'}
              </button>
            </form>
          </div>

          {/* List Users */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-855 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">Technician Logins</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto pr-1">
              {users.map(u => (
                <div key={u.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold text-slate-850 dark:text-white">{u.name}</span>
                    <span className="text-[10px] font-bold text-teal-600 bg-teal-50/50 dark:bg-teal-950/20 px-2 py-0.5 rounded ml-2 uppercase tracking-wider">{u.role}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Username: {u.username}  |  Active: {u.isActive ? 'Yes' : 'No'}</p>
                  </div>

                  {u.id !== activeUser.id && (
                    <button
                      onClick={() => toggleUserMutation.mutate(u.id)}
                      className={`px-3 py-1 text-xs font-semibold rounded
                        ${u.isActive 
                          ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 hover:bg-amber-100' 
                          : 'bg-teal-50 dark:bg-teal-950/20 text-teal-600 hover:bg-teal-100'}
                      `}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* --- TAB 4: AUDIT TRAIL LOGS --- */}
      {activeSubTab === 'audit' && activeUser?.role === 'ADMIN' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm overflow-hidden animate-[accordion-down_0.2s_ease-out]">
          <h3 className="text-base font-bold text-slate-855 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">Security Audit Logs</h3>
          
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto pr-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase pb-2">
                  <th className="pb-2 w-32">Timestamp</th>
                  <th className="pb-2 w-28">User</th>
                  <th className="pb-2 w-44">Action Event</th>
                  <th className="pb-2">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/15">
                    <td className="py-2.5 text-slate-500 font-semibold">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="py-2.5 font-bold text-slate-700 dark:text-slate-300">{log.user?.username || 'SYSTEM'}</td>
                    <td className="py-2.5"><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-semibold text-slate-750">{log.action}</span></td>
                    <td className="py-2.5 text-slate-550 dark:text-slate-400">{log.details}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">No actions recorded in audit log database.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 5: ANALYZER PROFILES --- */}
      {activeSubTab === 'analyzers' && (
        <AnalyzerProfilesManager />
      )}

      {/* --- TAB 6: BACKUP & RECOVERY --- */}
      {activeSubTab === 'backup' && activeUser?.role === 'ADMIN' && (
        <BackupRestoreManager />
      )}

      {/* --- TAB 7: LICENSING MANAGER --- */}
      {activeSubTab === 'license' && activeUser?.role === 'ADMIN' && (
        <LicenseKeyManager />
      )}

    </div>
  );
}

function LicenseKeyManager() {
  const queryClient = useQueryClient();
  const [activeLicenseTab, setActiveLicenseTab] = useState<'list' | 'create' | 'createUser'>('list');

  // Form states - Create License
  const [labName, setLabName] = useState('');
  const [licenseType, setLicenseType] = useState('SINGLE');
  const [maxDevices, setMaxDevices] = useState('1');
  const [expiryDate, setExpiryDate] = useState('2030-01-01');

  // Form states - Create User
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('ADMIN');
  const [selectedLicenseId, setSelectedLicenseId] = useState('');

  // Fetch licenses
  const { data: licenses = [], refetch: refetchLicenses } = useQuery<any[]>({
    queryKey: ['licensing-licenses'],
    queryFn: () => api.get('/licensing/licenses')
  });

  // Create License mutation
  const createLicenseMutation = useMutation({
    mutationFn: (data: any) => api.post('/licensing/licenses', data),
    onSuccess: () => {
      refetchLicenses();
      setLabName('');
      setMaxDevices('1');
      setActiveLicenseTab('list');
      toast.success('Laboratory license created successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Creation failed.');
    }
  });

  // Reset License devices mutation
  const resetLicenseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/licensing/licenses/${id}/reset`, {}),
    onSuccess: () => {
      refetchLicenses();
      toast.success('All devices reset successfully for this license.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Reset failed.');
    }
  });

  // Delete specific device mutation
  const deleteDeviceMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/licensing/devices/${id}`),
    onSuccess: () => {
      refetchLicenses();
      toast.info('Device unregistered. A new device can now connect in its place.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Action failed.');
    }
  });

  // Create User mutation
  const createUserMutation = useMutation({
    mutationFn: (data: any) => api.post('/licensing/users', data),
    onSuccess: () => {
      refetchLicenses();
      setUsername('');
      setPassword('');
      setName('');
      setActiveLicenseTab('list');
      toast.success('First Laboratory User created and linked successfully!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'User creation failed.');
    }
  });

  const handleCreateLicenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!labName.trim()) {
      toast.error('Laboratory name is required');
      return;
    }
    createLicenseMutation.mutate({
      labName,
      licenseType,
      maxDevices: Number(maxDevices),
      expiryDate: expiryDate || undefined
    });
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !name.trim() || !selectedLicenseId) {
      toast.error('All fields and license selection are required');
      return;
    }
    createUserMutation.mutate({
      username,
      password,
      name,
      role,
      licenseId: selectedLicenseId
    });
  };

  const currentDeviceId = localStorage.getItem('lrms_device_id') || 'Not Generated';

  return (
    <div className="space-y-6">
      
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveLicenseTab('list')}
          className={`pb-3 text-xs font-bold transition-all ${
            activeLicenseTab === 'list'
              ? 'border-b-2 border-teal-500 text-teal-650 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Active Licenses ({licenses.length})
        </button>
        <button
          onClick={() => setActiveLicenseTab('create')}
          className={`pb-3 text-xs font-bold transition-all ${
            activeLicenseTab === 'create'
              ? 'border-b-2 border-teal-500 text-teal-650 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Create License
        </button>
        <button
          onClick={() => setActiveLicenseTab('createUser')}
          className={`pb-3 text-xs font-bold transition-all ${
            activeLicenseTab === 'createUser'
              ? 'border-b-2 border-teal-500 text-teal-650 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Register Lab User
        </button>
      </div>

      {/* Info Header */}
      <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs flex justify-between items-center">
        <div>
          <span className="font-bold text-slate-700 dark:text-slate-300 block">Current Browser Device ID:</span>
          <span className="font-mono text-slate-500 text-[10px] break-all">{currentDeviceId}</span>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(currentDeviceId);
            toast.success('Device ID copied.');
          }}
          className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-250 font-bold rounded text-[10px] flex items-center gap-1.5 transition"
        >
          <Copy size={11} />
          <span>Copy</span>
        </button>
      </div>

      {/* 1. LICENSES LIST VIEW */}
      {activeLicenseTab === 'list' && (
        <div className="space-y-6">
          {licenses.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm text-xs">
              No laboratory licenses configured yet. Click "Create License" to get started.
            </div>
          ) : (
            licenses.map((license: any) => (
              <div key={license.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap justify-between items-start gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Building size={16} className="text-teal-600 dark:text-teal-400" />
                      <span>{license.labName}</span>
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-bold font-mono uppercase tracking-wide">
                        {license.licenseType}
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 break-all select-all">
                      License ID: {license.id}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (window.confirm('Reset all devices on this license?')) {
                          resetLicenseMutation.mutate(license.id);
                        }
                      }}
                      className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 dark:border-amber-900 rounded text-xs font-semibold"
                    >
                      Reset All Devices
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Devices Limit:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {license.devices.length} / {license.maxDevices === 999999 ? 'Unlimited' : license.maxDevices}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">License Status:</span>
                    <span className={`font-semibold uppercase tracking-wide
                      ${license.status === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-500'}
                    `}>
                      {license.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Expiry Date:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {license.expiryDate ? new Date(license.expiryDate).toLocaleDateString() : 'Perpetual (No Expiry)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Associated Users:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {license._count?.users || 0} users linked
                    </span>
                  </div>
                </div>

                {/* Devices Sub-table */}
                <div className="pt-2">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Registered Devices</h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          <th className="px-4 py-2">Device ID</th>
                          <th className="px-4 py-2">Browser / OS</th>
                          <th className="px-4 py-2">Registered Date</th>
                          <th className="px-4 py-2">Last Active</th>
                          <th className="px-4 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {license.devices.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400 text-xs">
                              No devices currently registered to this license. First login will bind a device.
                            </td>
                          </tr>
                        ) : (
                          license.devices.map((device: any) => (
                            <tr key={device.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 text-[11px]">
                              <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500 break-all select-all max-w-[150px]">
                                {device.id}
                              </td>
                              <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                                {device.browserInfo} on {device.os}
                              </td>
                              <td className="px-4 py-2.5 text-slate-500">
                                {new Date(device.registrationDate).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2.5 text-slate-500">
                                {new Date(device.lastActive).toLocaleString()}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => {
                                    if (window.confirm('Delete/Unregister this device?')) {
                                      deleteDeviceMutation.mutate(device.id);
                                    }
                                  }}
                                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 rounded inline-flex items-center"
                                  title="Unregister Device"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. CREATE LICENSE FORM */}
      {activeLicenseTab === 'create' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            Create Laboratory License
          </h3>
          <form onSubmit={handleCreateLicenseSubmit} className="space-y-4 max-w-lg text-xs">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase">Laboratory Name</label>
              <input
                type="text"
                placeholder="e.g. Apollo Pathology Hub"
                value={labName}
                onChange={e => setLabName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase">License Type</label>
                <select
                  value={licenseType}
                  onChange={e => {
                    setLicenseType(e.target.value);
                    if (e.target.value === 'SINGLE') setMaxDevices('1');
                    else if (e.target.value === 'MULTI') setMaxDevices('5');
                    else if (e.target.value === 'UNLIMITED') setMaxDevices('999999');
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-xs text-slate-850 dark:text-slate-300 focus:outline-none focus:border-teal-500"
                >
                  <option value="SINGLE">Single Device (1)</option>
                  <option value="MULTI">Multi Device (5)</option>
                  <option value="UNLIMITED">Unlimited Devices</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase">Max Devices</label>
                <input
                  type="number"
                  disabled={licenseType === 'UNLIMITED'}
                  value={maxDevices}
                  onChange={e => setMaxDevices(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-xs text-slate-850 dark:text-slate-300 focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-xs text-slate-850 dark:text-slate-300 focus:outline-none focus:border-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={createLicenseMutation.isPending}
              className="px-4 py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white font-bold rounded-lg transition"
            >
              {createLicenseMutation.isPending ? 'Creating...' : 'Create License'}
            </button>
          </form>
        </div>
      )}

      {/* 3. REGISTER LAB USER FORM */}
      {activeLicenseTab === 'createUser' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
            Register Laboratory Super Admin User
          </h3>
          <form onSubmit={handleCreateUserSubmit} className="space-y-4 max-w-lg text-xs">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase">Select Target Laboratory License</label>
              <select
                value={selectedLicenseId}
                onChange={e => setSelectedLicenseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-850 dark:text-slate-300 focus:outline-none focus:border-teal-500"
              >
                <option value="">-- Choose License / Laboratory --</option>
                {licenses.map((lic: any) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.labName} (Max: {lic.maxDevices === 999999 ? 'Unlimited' : lic.maxDevices} dev)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase">Super Admin Full Name</label>
              <input
                type="text"
                placeholder="e.g. Dr. John Doe"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase">Username</label>
                <input
                  type="text"
                  placeholder="e.g. johndoe"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-555 dark:text-slate-400 uppercase">Password</label>
                <input
                  type="password"
                  placeholder="Enter initial password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-xs text-slate-850 dark:text-slate-300 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="px-4 py-2 bg-teal-650 hover:bg-teal-700 text-white font-bold rounded-lg transition"
            >
              {createUserMutation.isPending ? 'Registering...' : 'Register User & Link to License'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function AnalyzerProfilesManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [model, setModel] = useState('Mindray');
  const [connType, setConnType] = useState<'SERIAL' | 'TCP' | 'FILE'>('TCP');
  const [mappings, setMappings] = useState<Array<{ parameterId: string; parameterName: string; machineCode: string }>>([]);

  // Mapping entry inputs
  const [selectedParamId, setSelectedParamId] = useState('');
  const [machineCode, setMachineCode] = useState('');

  // Fetch profiles
  const { data: profiles = [], refetch } = useQuery<any[]>({
    queryKey: ['analyzers-list'],
    queryFn: () => api.get('/settings/analyzers')
  });

  // Fetch parameters
  const { data: parameters = [] } = useQuery<Parameter[]>({
    queryKey: ['parameters-settings-list'],
    queryFn: () => api.get('/mke/parameters')
  });

  // Add mapping helper
  const handleAddMapping = () => {
    if (!selectedParamId || !machineCode.trim()) {
      toast.error('Please choose a parameter and type the analyzer code.');
      return;
    }
    const paramObj = parameters.find(p => p.id === selectedParamId);
    if (!paramObj) return;

    if (mappings.some(m => m.parameterId === selectedParamId)) {
      toast.error('Parameter is already mapped.');
      return;
    }

    setMappings([...mappings, {
      parameterId: selectedParamId,
      parameterName: paramObj.name,
      machineCode: machineCode.trim().toUpperCase()
    }]);

    setSelectedParamId('');
    setMachineCode('');
  };

  const handleRemoveMapping = (pId: string) => {
    setMappings(mappings.filter(m => m.parameterId !== pId));
  };

  const clearForm = () => {
    setName('');
    setModel('Mindray');
    setConnType('TCP');
    setMappings([]);
    setEditingId(null);
  };

  // Save profile
  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingId) {
        return api.put(`/settings/analyzers/${editingId}`, data);
      }
      return api.post('/settings/analyzers', data);
    },
    onSuccess: () => {
      refetch();
      toast.success(`Analyzer profile ${editingId ? 'updated' : 'registered'} successfully.`);
      clearForm();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save analyzer profile.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/analyzers/${id}`),
    onSuccess: () => {
      refetch();
      toast.info('Analyzer profile deleted.');
    }
  });

  const handleSubmitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Analyzer Profile Name is required.');
      return;
    }
    saveMutation.mutate({
      name: name.trim(),
      model,
      connectionType: connType,
      config: JSON.stringify(mappings)
    });
  };

  const handleEditProfile = (profile: any) => {
    setEditingId(profile.id);
    setName(profile.name);
    setModel(profile.model);
    setConnType(profile.connectionType);
    try {
      setMappings(JSON.parse(profile.config || '[]'));
    } catch (e) {
      setMappings([]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-[accordion-down_0.2s_ease-out]">
      
      {/* Form panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm h-fit">
        <h3 className="text-base font-bold text-slate-855 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
          <Sliders size={16} className="text-teal-600" />
          <span>{editingId ? 'Edit Analyzer Profile' : 'Add Analyzer Profile'}</span>
        </h3>

        <form onSubmit={handleSubmitProfile} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Profile Name</label>
            <input
              type="text"
              placeholder="E.g., Mindray BS-240"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-505 mb-1 uppercase tracking-wider">Model/Brand</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
              >
                <option value="Mindray">Mindray</option>
                <option value="Sysmex">Sysmex</option>
                <option value="Horiba">Horiba</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-550 mb-1 uppercase tracking-wider">Feed Mode</label>
              <select
                value={connType}
                onChange={e => setConnType(e.target.value as any)}
                className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
              >
                <option value="TCP">TCP Socket</option>
                <option value="SERIAL">RS232 Serial</option>
                <option value="FILE">File Feed</option>
              </select>
            </div>
          </div>

          {/* Mapping builder */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-850 space-y-2">
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Analyzer Parameter Mappings</span>
            
            <div className="flex gap-2">
              <select
                value={selectedParamId}
                onChange={e => setSelectedParamId(e.target.value)}
                className="w-3/5 px-2 py-1.5 rounded-lg bg-slate-55 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 focus:outline-none"
              >
                <option value="">Select Parameter...</option>
                {parameters.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.shortCode})</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Code (e.g. HGB)"
                value={machineCode}
                onChange={e => setMachineCode(e.target.value)}
                className="w-2/5 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddMapping}
                className="px-3 bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 hover:text-white text-xs font-bold rounded-lg transition"
              >
                +
              </button>
            </div>

            {/* Mappings List */}
            <div className="border border-slate-100 dark:border-slate-850 rounded-lg p-2 max-h-36 overflow-y-auto space-y-1.5 bg-slate-50/50 dark:bg-slate-950/40">
              {mappings.map(m => (
                <div key={m.parameterId} className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-350 truncate w-24">{m.parameterName}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 font-bold border border-teal-200/30 rounded text-[10px]">{m.machineCode}</span>
                    <button type="button" onClick={() => handleRemoveMapping(m.parameterId)} className="text-red-500 hover:text-red-705 font-bold">×</button>
                  </div>
                </div>
              ))}
              {mappings.length === 0 && (
                <p className="text-center text-[10px] text-slate-400 py-3 font-medium">No mappings configured.</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-2 font-semibold">
            {editingId && (
              <button
                type="button"
                onClick={clearForm}
                className="w-1/2 py-2 border border-slate-200 dark:border-slate-800 text-xs rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-lg shadow-sm"
            >
              {saveMutation.isPending ? 'Saving...' : editingId ? 'Update Profile' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Profiles list */}
      <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-855 dark:text-white mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
          <Cpu size={16} className="text-teal-600" />
          <span>Configured Analyzer Channels</span>
        </h3>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[450px] overflow-y-auto pr-1">
          {profiles.map(p => {
            let mCount = 0;
            try {
              mCount = JSON.parse(p.config || '[]').length;
            } catch (e) {}

            return (
              <div key={p.id} className="py-3.5 flex items-center justify-between text-sm">
                <div>
                  <span className="font-bold text-slate-800 dark:text-white">{p.name}</span>
                  <span className="text-[10px] font-bold text-teal-650 bg-teal-50 dark:bg-teal-950/20 px-2 py-0.5 rounded ml-2 uppercase tracking-wider">{p.connectionType}</span>
                  <p className="text-[10px] text-slate-400 mt-1">Model: {p.model}  |  Mapped channels: {mCount} parameters</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditProfile(p)}
                    className="text-xs text-teal-600 hover:underline font-bold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(p.id)}
                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {profiles.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No analyzer profiles configured. Use form on the left to map serial or TCP feeds.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BackupRestoreManager() {
  const queryClient = useQueryClient();
  const [binaryProgress, setBinaryProgress] = useState(false);
  const [importPayload, setImportPayload] = useState<any | null>(null);
  const [importSummary, setImportSummary] = useState<string>('');

  // 1. Binary SQL copy
  const dbBackupMutation = useMutation({
    mutationFn: () => api.post('/settings/backup/db', {}),
    onSuccess: (res) => {
      setBinaryProgress(false);
      toast.success(`Binary SQL copy generated successfully: ${res.filename} (${(res.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
    },
    onError: (err: any) => {
      setBinaryProgress(false);
      toast.error(err.message || 'SQL binary backup copy failed.');
    }
  });

  const handleDbBackup = () => {
    setBinaryProgress(true);
    dbBackupMutation.mutate();
  };

  // 2. JSON schema export
  const handleExportJson = async () => {
    try {
      toast.info('Assembling JSON records... please wait.');
      const payload = await api.get('/settings/backup/export');
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lrms_schema_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('JSON schema backup file downloaded.');
    } catch (err: any) {
      toast.error(err.message || 'JSON schema export failed.');
    }
  };

  // 3. JSON schema import
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const payload = JSON.parse(event.target?.result as string);
        if (!payload.data) {
          toast.error('Invalid backup file. Missing data root.');
          return;
        }
        setImportPayload(payload);
        
        // Build summary string
        const { patients = [], doctors = [], tests = [], reports = [], settings = [] } = payload.data;
        setImportSummary(`Backup summary: Exported on ${new Date(payload.exportedAt).toLocaleDateString()}
- Patients: ${patients.length} records
- Referring Doctors: ${doctors.length} records
- Panel Templates: ${tests.length} templates
- Investigation Reports: ${reports.length} records
- Laboratory Settings: ${settings.length} values`);
        toast.info('JSON schema parsed. Ready to restore.');
      } catch (err) {
        toast.error('Failed to parse JSON schema backup file.');
      }
    };
    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings/backup/import', { data }),
    onSuccess: (res) => {
      queryClient.invalidateQueries();
      toast.success(res.message || 'JSON database schema restore completed successfully.');
      setImportPayload(null);
      setImportSummary('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'JSON schema restore failed.');
    }
  });

  const handleImportRestore = () => {
    if (!importPayload) return;
    const confirmRestore = window.confirm('WARNING: Restoring will overwrite existing records. Do you wish to proceed?');
    if (confirmRestore) {
      importMutation.mutate(importPayload.data);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-[accordion-down_0.2s_ease-out]">
      
      {/* SQL Binary Copy Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-855 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Database size={18} className="text-teal-600" />
          <span>SQLite Binary Backups</span>
        </h3>
        
        <p className="text-xs text-slate-500 leading-relaxed">
          Create an instant, raw binary copy of the active SQLite database file (`lrms.db`). Backups are saved securely in the backend server backups repository.
        </p>

        {binaryProgress && (
          <div className="space-y-2">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full animate-[shimmer_1.5s_infinite] w-2/3"></div>
            </div>
            <span className="text-[10px] font-bold text-slate-400 block text-center">Copying binary database file...</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleDbBackup}
          disabled={binaryProgress}
          className="w-full py-2.5 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 transition"
        >
          <Database size={14} />
          <span>Generate SQLite Binary Copy</span>
        </button>
      </div>

      {/* JSON Export/Import Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-855 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <Upload size={18} className="text-teal-600" />
          <span>JSON Schema Migration</span>
        </h3>

        <p className="text-xs text-slate-500 leading-relaxed">
          Export all parameters, ranges, templates, patient check-ins, and doctor directories into a platform-agnostic JSON schema backup file.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={handleExportJson}
            className="py-2.5 border border-slate-250 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 transition"
          >
            <Download size={14} />
            <span>Export JSON Schema</span>
          </button>
          
          <label className="py-2.5 border border-slate-250 hover:bg-slate-55 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition">
            <Upload size={14} />
            <span>Load JSON File</span>
            <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          </label>
        </div>

        {importSummary && (
          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-lg space-y-3">
            <pre className="text-[10px] text-slate-600 dark:text-slate-400 font-mono whitespace-pre-wrap leading-tight">{importSummary}</pre>
            <button
              type="button"
              onClick={handleImportRestore}
              disabled={importMutation.isPending}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition"
            >
              {importMutation.isPending ? 'Restoring Schema...' : 'Confirm Restore (Overwrite)'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
