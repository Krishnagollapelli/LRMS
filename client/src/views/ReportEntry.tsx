import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api.js';
import type { Report, Parameter } from 'shared';
import { useAppStore } from '../store/useStore.js';
import { 
  Save, 
  Printer, 
  Download, 
  Send, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  FileText,
  Mail,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function ReportEntry() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAppStore(state => state.user);
  const isAdmin = user?.role === 'ADMIN';

  const [results, setResults] = useState<any[]>([]);
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState<any>('PENDING');
  const [isDirty, setIsDirty] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState('');
  
  // Custom overlays
  const [showPreview, setShowPreview] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareChannel, setShareChannel] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL');
  const [shareRecipient, setShareRecipient] = useState('');
  const [sharingInProgress, setSharingInProgress] = useState(false);
  
  // Parameter library autocomplete states for template override
  const [showAddParam, setShowAddParam] = useState(false);
  const [paramQuery, setParamQuery] = useState('');
  const [paramSuggestions, setParamSuggestions] = useState<any[]>([]);

  // Focus ref tracker for keyboard navigation
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Query report details
  const { data: report, isLoading, error } = useQuery<Report>({
    queryKey: ['report', id],
    queryFn: () => api.get(`/reports/${id}`),
    enabled: !!id
  });



  // Sync DB state to React local state on load with auto-focus / session resume
  useEffect(() => {
    if (report) {
      setResults(report.results.map(r => ({
        parameterId: r.parameterId,
        name: r.parameter?.name || 'Unknown',
        shortCode: r.parameter?.shortCode || 'N/A',
        value: r.value,
        unitText: r.unitText,
        referenceRangeText: r.referenceRangeText,
        remarks: r.remarks || ''
      })));
      setRemarks(report.remarks || '');
      setStatus(report.status);

      // Restore session cursor index if exists
      const resumeIndex = localStorage.getItem('resumeIndex_' + id);
      if (resumeIndex) {
        const idx = parseInt(resumeIndex);
        setTimeout(() => {
          const inputEl = inputRefs.current[`val-${idx}`];
          if (inputEl) {
            inputEl.focus();
            inputEl.select();
          }
        }, 350);
      } else {
        // Auto-focus the first blank input on load
        setTimeout(() => {
          const firstBlankIndex = report.results.findIndex(r => !r.value || r.value.trim() === '');
          const targetIndex = firstBlankIndex !== -1 ? firstBlankIndex : 0;
          const inputEl = inputRefs.current[`val-${targetIndex}`];
          if (inputEl) {
            inputEl.focus();
            inputEl.select();
          }
        }, 350);
      }
    }
  }, [report, id]);

  // Handle parameter fuzzy search on query change
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (paramQuery.trim().length > 0) {
        try {
          const res = await api.get(`/mke/search?q=${paramQuery}`);
          setParamSuggestions(res);
        } catch (e) {}
      } else {
        setParamSuggestions([]);
      }
    }, 150);

    return () => clearTimeout(delayDebounce);
  }, [paramQuery]);

  // Save Results mutation
  const saveMutation = useMutation({
    mutationFn: (data: any) => api.put(`/reports/${id}/results`, data),
    onSuccess: (updatedReport) => {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Report saved successfully.');
      setIsDirty(false);
      setAutoSaveStatus('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save results.');
    }
  });

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+P, Ctrl+Enter, Escape)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: Save Draft
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave('DRAFT');
      }

      // Ctrl+P: Print Report
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        printMutation.mutate();
      }

      // Ctrl+Enter: Verify / Submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const targetStatus = isAdmin ? 'VERIFIED' : 'PENDING_VERIFICATION';
        handleSave(targetStatus);
      }

      // Escape: Close add parameter dropdown
      if (e.key === 'Escape') {
        setShowAddParam(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [results, isAdmin, status, remarks, showAddParam]);

  // Background Auto-Save Loop (runs every 25 seconds if changes are made)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDirty && (status === 'DRAFT' || status === 'PENDING')) {
        setAutoSaveStatus('Auto-saving Draft...');
        api.put(`/reports/${id}/results`, {
          status: status || 'DRAFT',
          remarks,
          results: results.map(r => ({
            parameterId: r.parameterId,
            value: r.value,
            unitText: r.unitText,
            referenceRangeText: r.referenceRangeText,
            remarks: r.remarks
          }))
        }).then(() => {
          setIsDirty(false);
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setAutoSaveStatus(`Draft auto-saved at ${nowStr}`);
          queryClient.invalidateQueries({ queryKey: ['report', id] });
        }).catch(() => {
          setAutoSaveStatus('Auto-save failed.');
        });
      }
    }, 25000);

    return () => clearInterval(interval);
  }, [isDirty, results, remarks, status, id, queryClient]);

  // Auto-Save on page blur, tab switch, or unload
  useEffect(() => {
    const handleAutoSaveOnExit = () => {
      if (isDirty) {
        api.put(`/reports/${id}/results`, {
          status: status || 'DRAFT',
          remarks,
          results: results.map(r => ({
            parameterId: r.parameterId,
            value: r.value,
            unitText: r.unitText,
            referenceRangeText: r.referenceRangeText,
            remarks: r.remarks
          }))
        });
      }
    };

    window.addEventListener('beforeunload', handleAutoSaveOnExit);
    window.addEventListener('blur', handleAutoSaveOnExit);
    return () => {
      window.removeEventListener('beforeunload', handleAutoSaveOnExit);
      window.removeEventListener('blur', handleAutoSaveOnExit);
      handleAutoSaveOnExit();
    };
  }, [isDirty, results, remarks, status, id]);

  // Share Report mutation
  const shareMutation = useMutation({
    mutationFn: (data: any) => api.post(`/reports/${id}/share`, data),
    onSuccess: (res) => {
      setSharingInProgress(false);
      setShowShareModal(false);
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      if (res.success) {
        toast.success(`Report shared successfully via ${shareChannel}!`);
      } else {
        toast.error(`Report share failed: ${res.log?.errorMessage || 'Delivery failed'}`);
      }
    },
    onError: (err: any) => {
      setSharingInProgress(false);
      toast.error(err.message || 'Error occurred while sharing PDF.');
    }
  });

  // Print mutation
  const printMutation = useMutation({
    mutationFn: () => api.post(`/reports/${id}/print`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      toast.success('Report status marked as PRINTED.');
      window.print(); // Native web print triggers print container
    }
  });

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Loading report workspace...</div>;
  }

  if (error || !report) {
    return <div className="p-8 text-center text-red-500 font-semibold">Failed to find report workspace.</div>;
  }

  // Parse Biological range helper for client-side highlighting
  const checkAbnormal = (value: string, rangeText: string) => {
    if (!value || !rangeText) return false;
    const num = parseFloat(value);
    if (isNaN(num)) return false;

    // Search for pattern e.g., "13.5 - 17.5" or "< 200" or "> 40"
    const rangeMatch = rangeText.match(/([0-9.]+)\s*-\s*([0-9.]+)/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      return num < min || num > max;
    }

    const lessMatch = rangeText.match(/<\s*([0-9.]+)/);
    if (lessMatch) {
      const max = parseFloat(lessMatch[1]);
      return num >= max;
    }

    const greaterMatch = rangeText.match(/>\s*([0-9.]+)/);
    if (greaterMatch) {
      const min = parseFloat(greaterMatch[1]);
      return num <= min;
    }

    return false;
  };

  // Keyboard navigation controller focusing on blank entries first
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'ArrowDown') {
      e.preventDefault();
      
      let nextBlankIndex = -1;
      // Search forward for the next empty input
      for (let i = index + 1; i < results.length; i++) {
        if (!results[i].value || results[i].value.trim() === '') {
          nextBlankIndex = i;
          break;
        }
      }
      
      // Wrap around: search from the beginning if none found forward
      if (nextBlankIndex === -1) {
        for (let i = 0; i < index; i++) {
          if (!results[i].value || results[i].value.trim() === '') {
            nextBlankIndex = i;
            break;
          }
        }
      }
      
      // Fallback: sequential next input if no empty fields exist
      const targetIndex = nextBlankIndex !== -1 ? nextBlankIndex : (index + 1);
      const targetInput = inputRefs.current[`val-${targetIndex}`];
      if (targetInput) {
        targetInput.focus();
        targetInput.select();
      }
    } else if ((e.key === 'Enter' && e.shiftKey) || e.key === 'ArrowUp') {
      e.preventDefault();
      
      let prevBlankIndex = -1;
      // Search backward for the previous empty input
      for (let i = index - 1; i >= 0; i--) {
        if (!results[i].value || results[i].value.trim() === '') {
          prevBlankIndex = i;
          break;
        }
      }
      
      // Wrap around: search from the end if none found backward
      if (prevBlankIndex === -1) {
        for (let i = results.length - 1; i > index; i--) {
          if (!results[i].value || results[i].value.trim() === '') {
            prevBlankIndex = i;
            break;
          }
        }
      }
      
      // Fallback: sequential previous input if no empty fields exist
      const targetIndex = prevBlankIndex !== -1 ? prevBlankIndex : (index - 1);
      const targetInput = inputRefs.current[`val-${targetIndex}`];
      if (targetInput) {
        targetInput.focus();
        targetInput.select();
      }
    }
  };

  const handleValueChange = (index: number, val: string) => {
    const updated = [...results];
    updated[index].value = val;
    setResults(updated);
    setIsDirty(true);
  };

  const handleUnitOverride = (index: number, unit: string) => {
    const updated = [...results];
    updated[index].unitText = unit;
    setResults(updated);
    setIsDirty(true);
  };

  const handleRangeOverride = (index: number, range: string) => {
    const updated = [...results];
    updated[index].referenceRangeText = range;
    setResults(updated);
    setIsDirty(true);
  };

  // Override template: Remove parameter for this report
  const handleRemoveParameter = (index: number) => {
    const updated = [...results];
    updated.splice(index, 1);
    setResults(updated);
    setIsDirty(true);
    toast.info('Parameter removed from current report.');
  };

  // Override template: Reorder parameters
  const handleMoveParameter = (index: number, direction: 'up' | 'down') => {
    const updated = [...results];
    if (direction === 'up' && index > 0) {
      const temp = updated[index];
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;
    } else if (direction === 'down' && index < updated.length - 1) {
      const temp = updated[index];
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;
    }
    setResults(updated);
    setIsDirty(true);
  };

  // Add parameter to template
  const handleAddParameter = (param: Parameter) => {
    // Check if parameter already exists in active results
    if (results.some(r => r.parameterId === param.id)) {
      toast.error('Parameter is already present in this investigation sheet.');
      return;
    }

    const defaultRange = param.referenceRanges?.[0]?.displayText || 'No range';
    setResults([...results, {
      parameterId: param.id,
      name: param.name,
      shortCode: param.shortCode,
      value: '',
      unitText: param.unit?.name || '',
      referenceRangeText: defaultRange,
      remarks: ''
    }]);

    setIsDirty(true);
    setShowAddParam(false);
    setParamQuery('');
    toast.success(`Added ${param.name} to template.`);
  };

  const handleSave = (finalStatus: string = 'PENDING') => {
    saveMutation.mutate({
      status: finalStatus,
      remarks,
      results: results.map(r => ({
        parameterId: r.parameterId,
        value: r.value,
        unitText: r.unitText,
        referenceRangeText: r.referenceRangeText,
        remarks: r.remarks
      }))
    });
  };

  const triggerShare = (channel: 'EMAIL' | 'WHATSAPP') => {
    setShareChannel(channel);
    setShareRecipient(channel === 'EMAIL' ? report.patient.phone : report.patient.phone);
    if (channel === 'EMAIL' && report.patient.phone) {
      // If we had email we populate, else placeholder
      setShareRecipient('');
    }
    setShowShareModal(true);
  };

  const handleShareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareRecipient) {
      toast.error('Recipient contact details are required.');
      return;
    }
    setSharingInProgress(true);
    shareMutation.mutate({
      channel: shareChannel,
      recipient: shareRecipient
    });
  };

  const isLocked = status === 'VERIFIED' || status === 'PRINTED';

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 flex flex-col lg:flex-row gap-8 relative font-sans">
      
      {/* Print-Only Container (Native rendering for browser print) */}
      <div className="hidden print:block print-container w-full">
        <iframe 
          src={`http://localhost:5000/api/reports/download/${id}`} 
          className="w-full h-screen border-none"
          title="Print Sheet"
        />
      </div>

      {/* Main Entry Sheet */}
      <div className="flex-1 space-y-6 no-print">
        
        {/* View Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Report Workspace</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Fill observations, customize templates, and generate pathology reports.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {autoSaveStatus && (
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-550 animate-pulse mr-2">
                {autoSaveStatus}
              </span>
            )}
            {isLocked ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg border border-rose-200 dark:border-rose-800/60 uppercase tracking-wider">
                Locked (Verified Record)
              </span>
            ) : (
              <>
                <button
                  onClick={() => handleSave('DRAFT')}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 text-sm font-semibold rounded-lg shadow-sm"
                >
                  <Save size={16} />
                  <span>Save Draft</span>
                </button>
                <button
                  onClick={() => handleSave('PENDING_VERIFICATION')}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600 text-white text-sm font-semibold rounded-lg shadow-sm"
                >
                  <Save size={16} />
                  <span>Submit Verification</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleSave('VERIFIED')}
                    disabled={saveMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-650 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-650 text-white text-sm font-semibold rounded-lg shadow-sm"
                  >
                    <Save size={16} />
                    <span>Verify & Lock</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Patient Demographic Card */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm grid grid-cols-2 md:grid-cols-4 gap-5">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Patient Name</span>
            <p className="font-bold text-slate-800 dark:text-white mt-0.5">{report.patient.name}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Age / Gender</span>
            <p className="font-bold text-slate-750 dark:text-slate-200 mt-0.5">
              {report.patient.age ? `${report.patient.age} ${(report.patient.ageUnit || 'YEARS').toLowerCase()}` : 'N/A'} / {report.patient.gender || 'N/A'}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Sample ID / Date</span>
            <p className="font-semibold text-slate-750 dark:text-slate-200 mt-0.5 text-xs">
              {report.sampleId} <br/> 
              <span className="text-[10px] text-slate-400">{new Date(report.registrationDate).toLocaleDateString()}</span>
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Report Status</span>
            <div className="mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase
                ${status === 'DRAFT' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' : ''}
                ${status === 'PENDING' ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400' : ''}
                ${status === 'PENDING_VERIFICATION' ? 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400' : ''}
                ${status === 'VERIFIED' ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400' : ''}
                ${status === 'PRINTED' ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400' : ''}
              `}>
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Results Matrix Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm overflow-hidden p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h2 className="text-base font-bold text-slate-850 dark:text-white">Observations Results Matrix</h2>
            {!isLocked && (
              <button
                onClick={() => setShowAddParam(true)}
                className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-500 rounded text-xs font-bold text-slate-750 dark:text-slate-350 transition-colors flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Add Parameter</span>
              </button>
            )}
          </div>

          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase">
                <th className="pb-3 w-8 text-center">Order</th>
                <th className="pb-3 pl-4">Parameter</th>
                <th className="pb-3 text-center w-36">Result Value</th>
                <th className="pb-3 w-24">Unit</th>
                <th className="pb-3 w-40">Biological Range</th>
                {!isLocked && <th className="pb-3 w-10 text-right">Delete</th>}
              </tr>
            </thead>
            <tbody>
              {results.map((res, index) => {
                const isAbnormal = checkAbnormal(res.value, res.referenceRangeText);
                return (
                  <tr key={res.parameterId} className="hover:bg-slate-50/40 dark:hover:bg-slate-850/15 border-b border-slate-100/60 dark:border-slate-800/40">
                    
                    {/* Move order buttons */}
                    <td className="py-2 text-center">
                      <div className="flex flex-col items-center">
                        <button type="button" disabled={isLocked} onClick={() => handleMoveParameter(index, 'up')} className={`text-slate-400 ${isLocked ? 'opacity-25 cursor-not-allowed' : 'hover:text-teal-600'}`}><ArrowUp size={11}/></button>
                        <button type="button" disabled={isLocked} onClick={() => handleMoveParameter(index, 'down')} className={`text-slate-400 ${isLocked ? 'opacity-25 cursor-not-allowed' : 'hover:text-teal-600'}`}><ArrowDown size={11}/></button>
                      </div>
                    </td>

                    {/* Parameter name */}
                    <td className="py-2 pl-4">
                      <p className="font-bold text-slate-800 dark:text-white leading-tight">{res.name}</p>
                      <span className="text-[10px] text-slate-450 uppercase font-semibold">{res.shortCode}</span>
                    </td>

                    {/* Value entry input */}
                    <td className="py-2 text-center">
                      <input
                        ref={el => inputRefs.current[`val-${index}`] = el}
                        type="text"
                        value={res.value}
                        onChange={e => handleValueChange(index, e.target.value)}
                        onKeyDown={e => handleKeyDown(e, index)}
                        disabled={isLocked}
                        readOnly={isLocked}
                        onFocus={() => localStorage.setItem('resumeIndex_' + id, String(index))}
                        className={`entry-input ${isAbnormal ? 'entry-input-abnormal' : 'text-slate-800 dark:text-white'} ${isLocked ? 'bg-slate-50 dark:bg-slate-900 cursor-not-allowed' : ''}`}
                        placeholder="--"
                      />
                    </td>

                    {/* Unit input override */}
                    <td className="py-2">
                      <input
                        type="text"
                        value={res.unitText}
                        onChange={e => handleUnitOverride(index, e.target.value)}
                        disabled={isLocked}
                        readOnly={isLocked}
                        className={`bg-transparent border-none text-slate-500 dark:text-slate-400 font-semibold focus:outline-none focus:ring-0 text-xs w-full ${isLocked ? 'cursor-not-allowed' : ''}`}
                      />
                    </td>

                    {/* Range override */}
                    <td className="py-2">
                      <input
                        type="text"
                        value={res.referenceRangeText}
                        onChange={e => handleRangeOverride(index, e.target.value)}
                        disabled={isLocked}
                        readOnly={isLocked}
                        className={`bg-transparent border-none text-slate-500 dark:text-slate-400 focus:outline-none focus:ring-0 text-xs w-full ${isLocked ? 'cursor-not-allowed' : ''}`}
                      />
                    </td>

                    {/* Remove button */}
                    {!isLocked && (
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveParameter(index)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 rounded transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}

                  </tr>
                );
              })}
              {results.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">All parameters cleared. Click "+ Add Parameter" to add investigations.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Clinical Remarks entry */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <label className="block text-xs font-bold text-slate-500">LAB INTERPRETATIVE REMARKS</label>
            <textarea
              value={remarks}
              onChange={e => { setRemarks(e.target.value); setIsDirty(true); }}
              placeholder="Enter pathology summary remarks, clinical correlations, or critical alerts..."
              disabled={isLocked}
              readOnly={isLocked}
              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 h-20 resize-none ${isLocked ? 'cursor-not-allowed bg-slate-100 dark:bg-slate-900' : ''}`}
            />
          </div>
        </div>

        {/* Dispatch Utilities bar */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => printMutation.mutate()}
              className="px-4 py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2"
            >
              <Printer size={15} />
              <span>Print Report</span>
            </button>
            <a
              href={`http://localhost:5000/api/reports/download/${id}`}
              download={`${id}.pdf`}
              className="px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2"
            >
              <Download size={15} />
              <span>Download PDF</span>
            </a>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => triggerShare('EMAIL')}
              className="px-3.5 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 rounded-lg font-semibold flex items-center gap-1.5"
            >
              <Mail size={14} className="text-teal-600" />
              <span>Share Email</span>
            </button>
            <button
              onClick={() => triggerShare('WHATSAPP')}
              className="px-3.5 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 rounded-lg font-semibold flex items-center gap-1.5"
            >
              <MessageSquare size={14} className="text-emerald-600" />
              <span>Share WhatsApp</span>
            </button>
          </div>
        </div>

      </div>

      {/* Right Column - PDF Live Preview Panel & Billing */}
      <div className="w-full lg:w-96 space-y-4 no-print">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm p-6 flex flex-col h-[400px]">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <Eye size={16} className="text-teal-600 dark:text-teal-400" />
            <span>Pathology Print Preview</span>
          </h3>
          
          <div className="flex-1 bg-slate-50 dark:bg-slate-950 rounded-lg overflow-hidden border border-slate-200/50 dark:border-slate-800/50 relative flex items-center justify-center">
            {/* Direct loading PDF file in standard browser viewer */}
            <iframe 
              src={`http://localhost:5000/api/reports/download/${id}#toolbar=0&navpanes=0&scrollbar=0`} 
              className="w-full h-full border-none"
              title="Report Preview"
            />
          </div>
        </div>
      </div>

      {/* Smart Parameter Overrides search modal */}
      {showAddParam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setShowAddParam(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="text-slate-400" size={18} />
            </button>

            <h3 className="text-lg font-bold text-slate-850 dark:text-white mb-4">Add Parameter to Report</h3>
            
            <div className="space-y-4">
              {/* Autocomplete Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type parameter name (e.g. Hb, Cholesterol)..."
                  value={paramQuery}
                  onChange={e => setParamQuery(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white focus:outline-none"
                />
              </div>

              {/* Suggestions */}
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {paramSuggestions.map((param) => (
                  <button
                    key={param.id}
                    onClick={() => handleAddParameter(param)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-sm text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    <p className="font-bold">{param.name} ({param.shortCode})</p>
                    <span className="text-[10px] text-slate-400">Unit: {param.unit?.name || 'N/A'}  |  Category: {param.category}</span>
                  </button>
                ))}
                {paramQuery && paramSuggestions.length === 0 && (
                  <div className="text-center py-4 text-xs text-slate-400">
                    No parameter found matching "{paramQuery}".
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share report modal with simulated progress bars */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 relative">
            <h3 className="text-lg font-bold text-slate-850 dark:text-white mb-2 flex items-center gap-2">
              {shareChannel === 'EMAIL' ? <Mail size={20} className="text-teal-600"/> : <MessageSquare size={20} className="text-emerald-600"/>}
              <span>Share Report PDF</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">Send PDF directly to recipient via {shareChannel.toLowerCase()}.</p>

            <form onSubmit={handleShareSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-550 mb-1 uppercase tracking-wider">
                  {shareChannel === 'EMAIL' ? 'Email Address' : 'WhatsApp Phone (with Country Code)'}
                </label>
                <input
                  type={shareChannel === 'EMAIL' ? 'email' : 'text'}
                  placeholder={shareChannel === 'EMAIL' ? 'patient@example.com' : 'e.g. 919988776655'}
                  value={shareRecipient}
                  onChange={e => setShareRecipient(e.target.value)}
                  disabled={sharingInProgress}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white focus:outline-none"
                />
              </div>

              {sharingInProgress && (
                <div className="space-y-2">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full animate-[shimmer_1.5s_infinite] w-2/3"></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 block text-center">Transmitting PDF securely...</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  disabled={sharingInProgress}
                  className="w-1/2 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 text-xs font-semibold rounded-lg hover:bg-slate-55 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sharingInProgress}
                  className="w-1/2 py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  Send Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Simple absolute close SVG
function X({ className, size, ...props }: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || "24"} 
      height={size || "24"} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
      {...props}
    >
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  );
}
