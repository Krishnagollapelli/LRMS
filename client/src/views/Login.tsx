import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAppStore } from '../store/useStore.js';
import { api } from '../utils/api.js';
import { Shield, Lock, User, RefreshCw, Sun, Moon } from 'lucide-react';
import { toast, Toaster } from 'sonner';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

type LoginFields = z.infer<typeof loginSchema>;

export default function Login() {
  const setAuth = useAppStore(state => state.setAuth);
  const theme = useAppStore(state => state.theme);
  const toggleTheme = useAppStore(state => state.toggleTheme);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFields>({
    resolver: async (data) => {
      try {
        loginSchema.parse(data);
        return { values: data, errors: {} };
      } catch (err: any) {
        const formErrors: any = {};
        err.errors?.forEach((e: any) => {
          formErrors[e.path[0]] = { message: e.message };
        });
        return { values: {}, errors: formErrors };
      }
    }
  });

  const onSubmit = async (data: LoginFields) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', data);
      setAuth(response.token, response.user);
      toast.success(`Welcome back, ${response.user.name}!`);
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative overflow-hidden">
      <Toaster position="top-right" richColors />
      
      {/* Background Decorative Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[120px] dark:bg-teal-500/5"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-sky-500/10 blur-[120px] dark:bg-sky-500/5"></div>

      {/* Floating Theme Switcher */}
      <button 
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:scale-110 transition-transform shadow-sm"
      >
        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      {/* Main card */}
      <div className="w-full max-w-md p-8 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-slate-800/40 rounded-2xl shadow-xl z-10">
        
        {/* Lab Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-teal-600 dark:bg-teal-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-600/20 mb-4">
            <Shield size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">LRMS Assistant</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Laboratory Report Management System</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Username Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <User size={18} />
              </span>
              <input
                type="text"
                placeholder="Enter username (e.g. admin)"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
                {...register('username')}
              />
            </div>
            {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>}
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Lock size={18} />
              </span>
              <input
                type="password"
                placeholder="Enter password (e.g. admin123)"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
                {...register('password')}
              />
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          Secure offline diagnostic database.
        </div>
      </div>
    </div>
  );
}
