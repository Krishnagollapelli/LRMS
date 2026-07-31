import React from 'react';
import { AlertCircle, FileText, Globe } from 'lucide-react';

interface SaveModeDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  tempLabel: string;
  permLabel: string;
  onSelect: (choice: 'temp' | 'perm') => void;
  onClose: () => void;
}

export default function SaveModeDialog({
  isOpen,
  title,
  message,
  tempLabel,
  permLabel,
  onSelect,
  onClose
}: SaveModeDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-teal-600"></div>

        <div className="flex gap-4">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 rounded-xl h-fit">
            <AlertCircle size={24} />
          </div>
          <div className="space-y-1 flex-1">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white leading-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
              {message}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Temporary Option */}
          <button
            type="button"
            onClick={() => onSelect('temp')}
            className="flex flex-col items-center justify-center p-4 border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 hover:bg-teal-50/20 dark:hover:bg-teal-950/10 rounded-xl text-center transition group"
          >
            <FileText size={20} className="text-slate-400 group-hover:text-teal-500 transition mb-2" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-teal-600 dark:group-hover:text-teal-400">
              {tempLabel}
            </span>
            <span className="text-[10px] text-slate-400 mt-1">
              Applies only to this specific report instance
            </span>
          </button>

          {/* Permanent Option */}
          <button
            type="button"
            onClick={() => onSelect('perm')}
            className="flex flex-col items-center justify-center p-4 border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 hover:bg-teal-50/20 dark:hover:bg-teal-950/10 rounded-xl text-center transition group"
          >
            <Globe size={20} className="text-slate-400 group-hover:text-teal-500 transition mb-2" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-teal-600 dark:group-hover:text-teal-400">
              {permLabel}
            </span>
            <span className="text-[10px] text-slate-400 mt-1">
              Writes changes to the laboratory master library
            </span>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
