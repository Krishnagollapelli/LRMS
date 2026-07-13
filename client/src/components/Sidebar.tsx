import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAppStore } from '../store/useStore.js';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api.js';
import { 
  LayoutDashboard, 
  Users, 
  FilePlus, 
  FileText,
  Settings, 
  HeartHandshake, 
  LogOut, 
  Sun, 
  Moon,
  Library,
  Layers
} from 'lucide-react';

export default function Sidebar() {
  const user = useAppStore(state => state.user);
  const clearAuth = useAppStore(state => state.clearAuth);
  const theme = useAppStore(state => state.theme);
  const toggleTheme = useAppStore(state => state.toggleTheme);

  const { data: settings } = useQuery<any>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings'),
    staleTime: 600000
  });

  const { data: licenseStatus } = useQuery<any>({
    queryKey: ['license-status'],
    queryFn: () => api.get('/licensing/status'),
    staleTime: 600000
  });

  const labName = settings?.labName || 'LRMS Lab';

  const navigation = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    ...(user?.role === 'SUPER_ADMIN' ? [
      { name: 'Super Admin Panel', to: '/super-admin', icon: Layers }
    ] : []),
    { name: 'Patients', to: '/patients', icon: Users },
    { name: 'Register Patient', to: '/register-patient', icon: FilePlus },
    { name: 'Reports Log', to: '/reports', icon: FileText },
    { name: 'Medical Library', to: '/knowledge-engine', icon: Library },
    { name: 'Settings & Users', to: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen no-print transition-colors duration-300">
      
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
        {settings?.labLogo ? (
          <img src={settings.labLogo} className="w-8 h-8 rounded-lg object-contain bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-0.5" alt="Logo" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-teal-600 dark:bg-teal-500 flex items-center justify-center text-white font-bold shadow-md shadow-teal-600/10">
            {labName.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-800 dark:text-white leading-tight truncate" title={labName}>
            {labName}
          </h1>
          {licenseStatus?.details?.demo ? (
            <span className="text-[9px] bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 font-bold px-1.5 py-0.5 rounded tracking-wider uppercase inline-block mt-0.5">Demo Mode</span>
          ) : licenseStatus?.details?.developer ? (
            <span className="text-[9px] bg-teal-55/60 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 font-bold px-1.5 py-0.5 rounded tracking-wider uppercase inline-block mt-0.5">Dev Mode</span>
          ) : (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-wider uppercase truncate block">Diagnostic Hub</span>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) => `
                flex items-center gap-3.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive 
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white'}
              `}
            >
              <Icon size={18} />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Footer (User details & actions) */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3.5 bg-slate-50/50 dark:bg-slate-900/50">
        
        {/* User Card */}
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-sm">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate leading-tight">
              {user?.name || 'Lab User'}
            </p>
            <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 tracking-wider uppercase">
              {user?.role || 'TECHNICIAN'}
            </span>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-slate-800/60 pt-3">
          
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>

          {/* Logout Button */}
          <button
            onClick={clearAuth}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>

      </div>

    </aside>
  );
}
