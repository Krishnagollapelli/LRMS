import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api.js';
import type { Parameter, Unit, Test, AIResolveResult } from 'shared';
import { 
  Plus, 
  Search, 
  Bot, 
  Trash2, 
  Check, 
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  Settings,
  GitBranch,
  ArrowUp,
  ArrowDown,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export default function KnowledgeEngine() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'parameters' | 'templates' | 'units'>('parameters');

  // Parameters Tab States
  const [paramSearch, setParamSearch] = useState('');
  const [showAddParam, setShowAddParam] = useState(false);
  const [newParamName, setNewParamName] = useState('');
  const [newParamCode, setNewParamCode] = useState('');
  const [newParamCategory, setNewParamCategory] = useState('Biochemistry');
  const [newParamUnitId, setNewParamUnitId] = useState('');
  const [newParamPrecision, setNewParamPrecision] = useState(2);
  const [newParamDesc, setNewParamDesc] = useState('');
  const [newParamAliases, setNewParamAliases] = useState('');
  const [newParamRanges, setNewParamRanges] = useState<any[]>([
    { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: '', maxVal: '', displayText: '', condition: 'ADULT' }
  ]);
  
  // Duplicate alert state
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  // AI Suggestion Wizard States
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIResolveResult | null>(null);

  // Custom unit states
  const [customUnit, setCustomUnit] = useState('');
  const [unitSuggestion, setUnitSuggestion] = useState<any | null>(null);

  const handleCustomUnitBlur = async () => {
    if (customUnit.trim()) {
      try {
        const res = await api.post('/mke/units/normalize', { unit: customUnit.trim() });
        if (res.isDifferent) {
          setUnitSuggestion(res);
        } else {
          setUnitSuggestion(null);
          const match = units.find(u => u.name.toLowerCase() === res.standardName.toLowerCase());
          if (match) {
            setNewParamUnitId(match.id);
            setCustomUnit('');
          }
        }
      } catch (e) {}
    }
  };

  // Units Tab States
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitDesc, setNewUnitDesc] = useState('');

  // Templates Tab States
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateCode, setNewTemplateCode] = useState('');
  const [newTemplateCat, setNewTemplateCat] = useState('Biochemistry');
  const [newTemplatePrice, setNewTemplatePrice] = useState('100');
  const [newTemplateShortcut, setNewTemplateShortcut] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newTemplateOrder, setNewTemplateOrder] = useState<number>(0);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newTemplateParams, setNewTemplateParams] = useState<any[]>([]); // Array of { id, sortOrder }
  const [tempParamSearch, setTempParamSearch] = useState('');
  const [tempParamSuggestions, setTempParamSuggestions] = useState<any[]>([]);

  // Selection & Edit States
  const [editingParamId, setEditingParamId] = useState<string | null>(null);
  const [selectedParamIds, setSelectedParamIds] = useState<string[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  // Fetch data
  const { data: parameters = [] } = useQuery<any[]>({
    queryKey: ['parameters'],
    queryFn: () => api.get('/mke/parameters')
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ['units'],
    queryFn: async () => {
      return parameters.map(p => p.unit).filter((u, i, self) => u && self.findIndex(x => x?.id === u?.id) === i) as Unit[];
    },
    enabled: parameters.length > 0
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ['templates-list'],
    queryFn: () => api.get('/mke/tests')
  });

  // Duplicate Check logic in background
  useEffect(() => {
    const checkDuplicate = async () => {
      if (newParamName.length > 2 || newParamCode.length > 1) {
        try {
          const res = await api.get(`/mke/check-duplicate?name=${newParamName}&code=${newParamCode}&aliases=${newParamAliases}`);
          if (res.duplicateFound) {
            setDuplicateWarning(res.matches[0]);
          } else {
            setDuplicateWarning(null);
          }
        } catch (e) {}
      } else {
        setDuplicateWarning(null);
      }
    };
    const timer = setTimeout(checkDuplicate, 300);
    return () => clearTimeout(timer);
  }, [newParamName, newParamCode, newParamAliases]);

  // Mutations
  const createParamMutation = useMutation({
    mutationFn: (data: any) => api.post('/mke/parameters', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] });
      toast.success('Parameter created permanently in Medical Library.');
      resetParamForm();
      setShowAddParam(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Duplicate warning or validation failure.');
    }
  });

  const updateParamMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/mke/parameters/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] });
      toast.success('Parameter details updated successfully.');
      resetParamForm();
      setShowAddParam(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update parameter.');
    }
  });

  const bulkDeleteParamsMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/mke/parameters/bulk-delete', { ids }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] });
      toast.success(res.message || 'Selected parameters deleted successfully.');
      setSelectedParamIds([]);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Bulk delete failed.');
    }
  });

  const bulkDeleteTemplatesMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/mke/tests/bulk-delete', { ids }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['templates-list'] });
      toast.success(res.message || 'Selected test templates deleted successfully.');
      setSelectedTemplateIds([]);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Bulk delete failed.');
    }
  });

  const saveTemplateMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingTemplateId) {
        return api.put(`/mke/tests/${editingTemplateId}`, data);
      }
      return api.post('/mke/tests', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-list'] });
      toast.success(`Test Panel Template ${editingTemplateId ? 'updated' : 'created'} successfully.`);
      setShowAddTemplate(false);
      setNewTemplateName('');
      setNewTemplateCode('');
      setNewTemplateCat('Biochemistry');
      setNewTemplatePrice('100');
      setNewTemplateShortcut('');
      setNewTemplateDesc('');
      setNewTemplateOrder(0);
      setNewTemplateParams([]);
      setEditingTemplateId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save template.');
    }
  });

  const deleteParamMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/mke/parameters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters'] });
      toast.info('Parameter deactivated from active database.');
    }
  });

  // AI query execution
  const executeAiResolveInModal = async () => {
    if (!aiQuery.trim()) {
      toast.error('Please enter a medical parameter search query.');
      return;
    }
    setAiLoading(true);
    try {
      const res = await api.get(`/mke/ai-resolve?q=${aiQuery}`);
      if (res) {
        setNewParamName(res.name || '');
        setNewParamCode(res.shortCode || '');
        setNewParamCategory(res.category || 'Biochemistry');
        setNewParamDesc(res.description || '');
        setNewParamAliases(res.aliases ? res.aliases.join(', ') : '');
        setNewParamPrecision(2);

        // Normalize unit
        try {
          const normUnit = await api.post('/mke/units/normalize', { unit: res.unit || '' });
          if (normUnit.unitId) {
            setNewParamUnitId(normUnit.unitId);
            setCustomUnit('');
            setUnitSuggestion(null);
          } else {
            setNewParamUnitId('');
            setCustomUnit(normUnit.standardName);
            if (normUnit.isDifferent) {
              setUnitSuggestion(normUnit);
            }
          }
        } catch (unitErr) {
          setCustomUnit(res.unit || '');
          setNewParamUnitId('');
        }

        // Map reference ranges
        if (res.referenceRanges && res.referenceRanges.length > 0) {
          setNewParamRanges(res.referenceRanges.map((r: any) => ({
            gender: r.gender || 'ALL',
            ageMin: r.ageMin !== undefined ? r.ageMin : 0,
            ageMax: r.ageMax !== undefined ? r.ageMax : 120,
            minVal: r.minVal !== undefined && r.minVal !== null ? String(r.minVal) : '',
            maxVal: r.maxVal !== undefined && r.maxVal !== null ? String(r.maxVal) : '',
            displayText: r.displayText || '',
            condition: r.condition || 'ADULT'
          })));
        } else {
          setNewParamRanges([{ gender: 'ALL', ageMin: 0, ageMax: 120, minVal: '', maxVal: '', displayText: '', condition: 'ADULT' }]);
        }
        toast.success('AI suggestion loaded! You can now review and edit the fields.');
      }
    } catch (e: any) {
      toast.error(e.message || 'AI resolution failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const resetParamForm = () => {
    setNewParamName('');
    setNewParamCode('');
    setNewParamAliases('');
    setNewParamDesc('');
    setNewParamUnitId('');
    setCustomUnit('');
    setUnitSuggestion(null);
    setNewParamRanges([{ gender: 'ALL', ageMin: 0, ageMax: 120, minVal: '', maxVal: '', displayText: '', condition: 'ADULT' }]);
    setDuplicateWarning(null);
    setEditingParamId(null);
  };

  const handleEditParamClick = (param: any) => {
    setEditingParamId(param.id);
    setNewParamName(param.name);
    setNewParamCode(param.shortCode);
    setNewParamCategory(param.category);
    setNewParamUnitId(param.unitId);
    setNewParamPrecision(param.decimalPrecision || 2);
    setNewParamDesc(param.description || '');
    setNewParamAliases(param.aliases ? (Array.isArray(param.aliases) ? param.aliases.join(', ') : String(param.aliases)) : '');
    setNewParamRanges(param.referenceRanges?.map((r: any) => ({
      gender: r.gender,
      ageMin: r.ageMin,
      ageMax: r.ageMax,
      minVal: r.minVal !== null ? String(r.minVal) : '',
      maxVal: r.maxVal !== null ? String(r.maxVal) : '',
      displayText: r.displayText,
      condition: r.condition
    })) || [{ gender: 'ALL', ageMin: 0, ageMax: 120, minVal: '', maxVal: '', displayText: '', condition: 'ADULT' }]);
    
    setCustomUnit('');
    setUnitSuggestion(null);
    setShowAddParam(true);
  };

  // Selection toggle handlers
  const toggleSelectParam = (id: string) => {
    setSelectedParamIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllParams = (filteredParams: any[]) => {
    if (selectedParamIds.length === filteredParams.length) {
      setSelectedParamIds([]);
    } else {
      setSelectedParamIds(filteredParams.map(p => p.id));
    }
  };

  const handleBulkDeleteParams = () => {
    if (selectedParamIds.length === 0) return;
    if (window.confirm(`Are you sure you want to deactivate ${selectedParamIds.length} selected parameters?`)) {
      bulkDeleteParamsMutation.mutate(selectedParamIds);
    }
  };

  const toggleSelectTemplate = (id: string) => {
    setSelectedTemplateIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllTemplates = (templatesList: any[]) => {
    if (selectedTemplateIds.length === templatesList.length) {
      setSelectedTemplateIds([]);
    } else {
      setSelectedTemplateIds(templatesList.map(t => t.id));
    }
  };

  const handleBulkDeleteTemplates = () => {
    if (selectedTemplateIds.length === 0) return;
    if (window.confirm(`Are you sure you want to deactivate ${selectedTemplateIds.length} selected test templates?`)) {
      bulkDeleteTemplatesMutation.mutate(selectedTemplateIds);
    }
  };

  const handleRangeChange = (idx: number, key: string, value: any) => {
    const updated = [...newParamRanges];
    updated[idx][key] = value;
    
    // Automatically generate display text
    const min = updated[idx].minVal;
    const max = updated[idx].maxVal;
    if (min !== '' && max !== '') {
      updated[idx].displayText = `${min} - ${max}`;
    }

    setNewParamRanges(updated);
  };

  const addRangeRow = () => {
    setNewParamRanges([...newParamRanges, { gender: 'ALL', ageMin: 0, ageMax: 120, minVal: '', maxVal: '', displayText: '', condition: 'ADULT' }]);
  };

  const removeRangeRow = (idx: number) => {
    const updated = [...newParamRanges];
    updated.splice(idx, 1);
    setNewParamRanges(updated);
  };

  // Search parameters for templates setup in background
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (tempParamSearch.trim().length > 0) {
        try {
          const res = await api.get(`/mke/search?q=${tempParamSearch}`);
          setTempParamSuggestions(res);
        } catch (e) {}
      } else {
        setTempParamSuggestions([]);
      }
    }, 150);
    return () => clearTimeout(delayDebounce);
  }, [tempParamSearch]);

  const addParamToTemplateList = (param: any) => {
    if (newTemplateParams.some(p => p.id === param.id)) {
      toast.error('Parameter already added to this test template.');
      return;
    }
    setNewTemplateParams([...newTemplateParams, {
      id: param.id,
      name: param.name,
      shortCode: param.shortCode,
      sortOrder: newTemplateParams.length + 1
    }]);
    setTempParamSearch('');
  };

  const removeParamFromTemplateList = (idx: number) => {
    const updated = [...newTemplateParams];
    updated.splice(idx, 1);
    // Adjust sort order sequential indexes
    const adjusted = updated.map((p, i) => ({ ...p, sortOrder: i + 1 }));
    setNewTemplateParams(adjusted);
  };

  const handleSaveTemplate = () => {
    if (!newTemplateName || !newTemplateCode) {
      toast.error('Please enter name and code.');
      return;
    }
    if (newTemplateParams.length === 0) {
      toast.error('Please select at least one parameter.');
      return;
    }

    let finalPrice = Number(newTemplatePrice || 0);

    if (finalPrice <= 0) {
      const confirmPrice = window.confirm("Default Price is not configured (or is 0). Do you want to set it now? Click OK to enter a price, or Cancel to save it with 0.");
      if (confirmPrice) {
        const val = window.prompt("Enter Default Price (₹):", "0");
        if (val !== null) {
          const num = Number(val);
          if (!isNaN(num) && num >= 0) {
            finalPrice = num;
            setNewTemplatePrice(num.toString());
          } else {
            toast.error('Invalid price entered. Saving template with 0.');
          }
        }
      }
    }

    saveTemplateMutation.mutate({
      name: newTemplateName,
      shortCode: newTemplateCode,
      category: newTemplateCat,
      defaultPrice: finalPrice,
      parameterIds: newTemplateParams.map(p => ({
        parameterId: p.id,
        sortOrder: p.sortOrder
      }))
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 no-print">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Medical Knowledge Library</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Central engine for pathology templates, reference ranges, unit catalogs, and AI resolvers.</p>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-2">
        <button
          onClick={() => setActiveTab('parameters')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all
            ${activeTab === 'parameters' 
              ? 'border-teal-600 dark:border-teal-500 text-teal-600 dark:text-teal-400' 
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:border-slate-300'}
          `}
        >
          Parameter Library
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all
            ${activeTab === 'templates' 
              ? 'border-teal-600 dark:border-teal-500 text-teal-600 dark:text-teal-400' 
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:border-slate-300'}
          `}
        >
          Test Templates (Panels)
        </button>
        <button
          onClick={() => setActiveTab('units')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all
            ${activeTab === 'units' 
              ? 'border-teal-600 dark:border-teal-500 text-teal-600 dark:text-teal-400' 
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:border-slate-300'}
          `}
        >
          Unit Dictionary
        </button>
      </div>

      {/* --- TAB 1: PARAMETER LIBRARY --- */}
      {activeTab === 'parameters' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Fuzzy search parameter library..."
                value={paramSearch}
                onChange={e => setParamSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white focus:outline-none"
              />
              <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            </div>
            <button
              onClick={() => setShowAddParam(true)}
              className="w-full sm:w-auto px-4 py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center justify-center gap-1.5"
            >
              <Plus size={16} />
              <span>Create Parameter</span>
            </button>
          </div>          {/* Bulk Actions Bar */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={parameters.length > 0 && selectedParamIds.length === parameters.filter(p => p.name.toLowerCase().includes(paramSearch.toLowerCase()) || p.shortCode.toLowerCase().includes(paramSearch.toLowerCase())).length}
                onChange={() => toggleSelectAllParams(parameters.filter(p => p.name.toLowerCase().includes(paramSearch.toLowerCase()) || p.shortCode.toLowerCase().includes(paramSearch.toLowerCase())))}
                className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 bg-white dark:bg-slate-900 dark:border-slate-800"
              />
              <span className="font-bold text-slate-600 dark:text-slate-400">Select All ({selectedParamIds.length} Selected)</span>
            </div>
            {selectedParamIds.length > 0 && (
              <button
                onClick={handleBulkDeleteParams}
                className="px-3 py-1.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-900/40 rounded-lg font-bold flex items-center gap-1.5 transition-all"
              >
                <Trash2 size={13} />
                <span>Deactivate Selected ({selectedParamIds.length})</span>
              </button>
            )}
          </div>

          {/* Stripes list display (No cards, flat stripes table) */}
          <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-xl overflow-hidden divide-y divide-slate-150 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
            {parameters
              .filter(p => p.name.toLowerCase().includes(paramSearch.toLowerCase()) || p.shortCode.toLowerCase().includes(paramSearch.toLowerCase()))
              .map((param) => (
                <div
                  key={param.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-855/30 transition-colors text-xs gap-3"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedParamIds.includes(param.id)}
                      onChange={() => toggleSelectParam(param.id)}
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 bg-white dark:bg-slate-900 dark:border-slate-800"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-white text-sm">{param.name}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {param.shortCode}
                        </span>
                        <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold px-2 py-0.5 bg-teal-50 dark:bg-teal-950/20 rounded">
                          {param.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">{param.description || 'No description provided.'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 text-[11px]">
                    <div className="text-right">
                      <span className="text-slate-400 text-[10px] uppercase block tracking-wider">Standard Unit</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{param.unit?.name || 'N/A'}</span>
                    </div>
                    <div className="text-right font-medium">
                      <span className="text-slate-400 text-[10px] uppercase block tracking-wider">Ref Intervals</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{param.referenceRanges?.length || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditParamClick(param)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg transition"
                        title="Edit Parameter"
                      >
                        <Settings size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to deactivate parameter "${param.name}"?`)) {
                            deleteParamMutation.mutate(param.id);
                          }
                        }}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-550 rounded-lg transition"
                        title="Deactivate Parameter"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Create Parameter form overlay */}
          {showAddParam && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
              <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 relative">
                <button 
                  onClick={() => setShowAddParam(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-650"
                >
                  <X className="text-slate-400" size={18} />
                </button>

                <h3 className="text-lg font-bold text-slate-850 dark:text-white mb-4">
                  {editingParamId ? 'Edit Parameter' : 'Create Master Parameter'}
                </h3>

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newParamName || !newParamCode) {
                    toast.error('Name and short code are required.');
                    return;
                  }

                  let unitId = newParamUnitId;
                  if (customUnit.trim()) {
                    try {
                      const res = await api.post('/mke/units/normalize', { unit: customUnit.trim() });
                      unitId = res.unitId;
                    } catch (err: any) {
                      toast.error('Failed to standardize custom unit: ' + err.message);
                      return;
                    }
                  }

                  if (!unitId) {
                    toast.error('Please specify or select a standard unit.');
                    return;
                  }

                  const payload = {
                    name: newParamName,
                    shortCode: newParamCode,
                    aliases: newParamAliases ? newParamAliases.split(',').map(a => a.trim()) : [],
                    category: newParamCategory,
                    unitId: unitId,
                    decimalPrecision: Number(newParamPrecision),
                    description: newParamDesc,
                    referenceRanges: newParamRanges.map(r => ({
                      ...r,
                      ageMin: Number(r.ageMin),
                      ageMax: Number(r.ageMax),
                      minVal: r.minVal !== '' ? Number(r.minVal) : null,
                      maxVal: r.maxVal !== '' ? Number(r.maxVal) : null
                    }))
                  };

                  if (editingParamId) {
                    updateParamMutation.mutate({ id: editingParamId, data: payload });
                  } else {
                    createParamMutation.mutate(payload);
                  }
                }} className="space-y-4">

                  {/* AI assisted populate tool infused directly */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200/60 dark:border-slate-800/60 rounded-xl space-y-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-white">AI Assisted Field Auto-Populate</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Type a test parameter query (e.g., Fasting Blood Sugar, HbA1c, SGPT) and click "Populate" to automatically draft details & biological reference ranges from AI. You can freely edit all fields before saving.</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="E.g., Fasting Blood Sugar..."
                        value={aiQuery}
                        onChange={e => setAiQuery(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-xs text-slate-850 dark:text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={executeAiResolveInModal}
                        disabled={aiLoading}
                        className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                      >
                        {aiLoading ? 'Populating...' : 'Populate with AI'}
                      </button>
                    </div>
                  </div>

                  {/* Duplicate warnings */}
                  {duplicateWarning && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                      <AlertCircle size={18} className="text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-bold">Possible Duplicate Detected!</p>
                        <p className="mt-0.5">Parameter with code/name matching "{duplicateWarning.name} ({duplicateWarning.shortCode})" already exists in the system database.</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider font-bold">Parameter Name</label>
                      <input
                        type="text"
                        placeholder="E.g., Hemoglobin"
                        value={newParamName}
                        onChange={e => setNewParamName(e.target.value)}
                        className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider font-bold">Short Code</label>
                      <input
                        type="text"
                        placeholder="E.g., Hb"
                        value={newParamCode}
                        onChange={e => setNewParamCode(e.target.value)}
                        className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Category</label>
                      <select
                        value={newParamCategory}
                        onChange={e => setNewParamCategory(e.target.value)}
                        className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                      >
                        <option value="Biochemistry">Biochemistry</option>
                        <option value="Hematology">Hematology</option>
                        <option value="Endocrinology">Endocrinology</option>
                        <option value="Immunology">Immunology</option>
                        <option value="Urine Analysis">Urine Analysis</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider font-bold">Standard Unit</label>
                      <div className="flex gap-2">
                        <select
                          value={newParamUnitId}
                          onChange={e => {
                            setNewParamUnitId(e.target.value);
                            setCustomUnit('');
                            setUnitSuggestion(null);
                          }}
                          className="w-1/2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-850 dark:text-white focus:outline-none"
                        >
                          <option value="">Select unit...</option>
                          {units.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Or type custom..."
                          value={customUnit}
                          onChange={e => {
                            setCustomUnit(e.target.value);
                            setNewParamUnitId('');
                          }}
                          onBlur={handleCustomUnitBlur}
                          className="w-1/2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-250 dark:border-slate-800 text-sm focus:outline-none"
                        />
                      </div>
                      {unitSuggestion && (
                        <div className="p-2.5 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 rounded-lg text-xs flex items-center justify-between mt-1.5">
                          <span className="text-teal-800 dark:text-teal-350">
                            Standardize <b>"{unitSuggestion.originalName}"</b> to <b>"{unitSuggestion.standardName}"</b>?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomUnit(unitSuggestion.standardName);
                              setUnitSuggestion(null);
                              toast.success('Unit standardized!');
                            }}
                            className="px-2 py-0.5 bg-teal-600 text-white rounded text-[10px] font-bold hover:bg-teal-700"
                          >
                            Yes, Standardize
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Decimal Precision</label>
                      <input
                        type="number"
                        min="0"
                        max="4"
                        value={newParamPrecision}
                        onChange={e => setNewParamPrecision(Number(e.target.value))}
                        className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Aliases (comma separated)</label>
                    <input
                      type="text"
                      placeholder="E.g., Hgb, Hemoglobin Total"
                      value={newParamAliases}
                      onChange={e => setNewParamAliases(e.target.value)}
                      className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>

                  {/* Reference Ranges list manager */}
                  <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-650">Biological Reference Ranges</label>
                      <button
                        type="button"
                        onClick={addRangeRow}
                        className="text-[10px] font-bold text-teal-600 hover:underline"
                      >
                        + Add Range Condition
                      </button>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {newParamRanges.map((range, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/50 rounded-lg text-xs">
                          <select
                            value={range.gender}
                            onChange={e => handleRangeChange(idx, 'gender', e.target.value)}
                            className="px-2 py-1 bg-white border border-slate-200 rounded"
                          >
                            <option value="ALL">All Genders</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                          </select>
                          <input
                            type="number"
                            placeholder="Age Min"
                            value={range.ageMin}
                            onChange={e => handleRangeChange(idx, 'ageMin', e.target.value)}
                            className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-center"
                          />
                          <input
                            type="number"
                            placeholder="Age Max"
                            value={range.ageMax}
                            onChange={e => handleRangeChange(idx, 'ageMax', e.target.value)}
                            className="w-16 px-2 py-1 bg-white border border-slate-200 rounded text-center"
                          />
                          <input
                            type="text"
                            placeholder="Min Val"
                            value={range.minVal}
                            onChange={e => handleRangeChange(idx, 'minVal', e.target.value)}
                            className="w-14 px-2 py-1 bg-white border border-slate-200 rounded text-center"
                          />
                          <input
                            type="text"
                            placeholder="Max Val"
                            value={range.maxVal}
                            onChange={e => handleRangeChange(idx, 'maxVal', e.target.value)}
                            className="w-14 px-2 py-1 bg-white border border-slate-200 rounded text-center"
                          />
                          <input
                            type="text"
                            placeholder="Display Text (e.g. 13-17)"
                            value={range.displayText}
                            onChange={e => handleRangeChange(idx, 'displayText', e.target.value)}
                            className="flex-1 min-w-[100px] px-2 py-1 bg-white border border-slate-200 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => removeRangeRow(idx)}
                            className="text-red-500 p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white font-bold rounded-lg text-sm text-center shadow-md shadow-teal-600/10"
                  >
                    Save Master Parameter
                  </button>

                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: TEST TEMPLATES PANEL --- */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm">
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Active Test Panel Templates</h2>
            <button
              onClick={() => setShowAddTemplate(true)}
              className="px-4 py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-1.5"
            >
              <Plus size={16} />
              <span>Create Template</span>
            </button>
          </div>          {/* Bulk Actions Bar for Test Templates */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={templates.length > 0 && selectedTemplateIds.length === templates.length}
                onChange={() => toggleSelectAllTemplates(templates)}
                className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 bg-white dark:bg-slate-900 dark:border-slate-800"
              />
              <span className="font-bold text-slate-600 dark:text-slate-400">Select All ({selectedTemplateIds.length} Selected)</span>
            </div>
            {selectedTemplateIds.length > 0 && (
              <button
                onClick={handleBulkDeleteTemplates}
                className="px-3 py-1.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-900/40 rounded-lg font-bold flex items-center gap-1.5 transition-all"
              >
                <Trash2 size={13} />
                <span>Deactivate Selected ({selectedTemplateIds.length})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.map((template) => (
              <div key={template.id} className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedTemplateIds.includes(template.id)}
                        onChange={() => toggleSelectTemplate(template.id)}
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 bg-white dark:bg-slate-900 dark:border-slate-800"
                      />
                      <div>
                        <h3 className="font-bold text-slate-850 dark:text-white text-lg">{template.name}</h3>
                        <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">{template.shortCode} - {template.category}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/20 px-2 py-0.5 rounded">Active Template</span>
                  </div>

                  {template.description && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 bg-slate-50 dark:bg-slate-950 p-2 border border-slate-200/30 rounded leading-relaxed">{template.description}</p>
                  )}

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {template.parameters.map((param: any, pIdx: number) => (
                      <div key={param.id} className="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-50 dark:bg-slate-955 border border-slate-200/30 rounded">
                        <span className="font-medium text-slate-700 dark:text-slate-350">{param.name}</span>
                        <span className="text-[10px] text-slate-450 uppercase font-semibold">{param.shortCode}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-450">Default Price: <b className="text-teal-600 dark:text-teal-400 font-bold">₹{template.defaultPrice || 100}</b></span>
                    {template.shortcut && (
                      <span className="text-[10px] text-slate-400">Shortcut: <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-semibold text-slate-500">{template.shortcut}</kbd></span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setEditingTemplateId(template.id);
                        setNewTemplateName(template.name);
                        setNewTemplateCode(template.shortCode);
                        setNewTemplateCat(template.category);
                        setNewTemplatePrice(String(template.defaultPrice || 100));
                        setNewTemplateShortcut(template.shortcut || '');
                        setNewTemplateDesc(template.description || '');
                        setNewTemplateOrder(template.displayOrder || 0);
                        setNewTemplateParams(template.parameters.map((p: any, idx: number) => ({
                          id: p.id,
                          name: p.name,
                          shortCode: p.shortCode,
                          sortOrder: idx + 1
                        })));
                        setShowAddTemplate(true);
                      }}
                      className="text-slate-600 dark:text-slate-400 hover:text-teal-650 dark:hover:text-teal-400 hover:underline font-bold"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => {
                        // Template Duplication
                        api.post(`/mke/tests/${template.id}/duplicate`, {}).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['templates-list'] });
                          toast.success('Template duplicated.');
                        });
                      }} 
                      className="text-teal-600 hover:underline font-bold"
                    >
                      Duplicate
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Create Template modal */}
          {showAddTemplate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 relative">
                <button onClick={() => setShowAddTemplate(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-650">
                  <X className="text-slate-400" size={18} />
                </button>

                <h3 className="text-lg font-bold text-slate-850 dark:text-white mb-4">
                  {editingTemplateId ? 'Edit Test Panel Template' : 'Create Test Panel Template'}
                </h3>
                             <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Test Name</label>
                      <input
                        type="text"
                        placeholder="E.g., Liver Function Test"
                        value={newTemplateName}
                        onChange={e => setNewTemplateName(e.target.value)}
                        className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Short Code (Unique)</label>
                      <input
                        type="text"
                        placeholder="E.g., LFT"
                        value={newTemplateCode}
                        onChange={e => setNewTemplateCode(e.target.value)}
                        className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Default Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="E.g., 300"
                        value={newTemplatePrice}
                        onChange={e => setNewTemplatePrice(e.target.value)}
                        className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm text-teal-650 dark:text-teal-400 font-bold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Category</label>
                      <select
                        value={newTemplateCat}
                        onChange={e => setNewTemplateCat(e.target.value)}
                        className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-850 dark:text-white focus:outline-none font-semibold"
                      >
                        <option value="Biochemistry">Biochemistry</option>
                        <option value="Hematology">Hematology</option>
                        <option value="Endocrinology">Endocrinology</option>
                        <option value="Immunology">Immunology</option>
                        <option value="Urine Analysis">Urine Analysis</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Keyboard Shortcut</label>
                      <input
                        type="text"
                        placeholder="E.g., ctrl+l"
                        value={newTemplateShortcut}
                        onChange={e => setNewTemplateShortcut(e.target.value)}
                        className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none text-slate-850 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Display Order</label>
                      <input
                        type="number"
                        placeholder="E.g., 1"
                        value={newTemplateOrder}
                        onChange={e => setNewTemplateOrder(Number(e.target.value))}
                        className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none text-slate-850 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Description</label>
                    <textarea
                      placeholder="Enter description of test panel..."
                      value={newTemplateDesc}
                      onChange={e => setNewTemplateDesc(e.target.value)}
                      className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none h-12 resize-none text-slate-850 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider font-bold">ADD PARAMETERS</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Type to search and add parameters..."
                        value={tempParamSearch}
                        onChange={e => setTempParamSearch(e.target.value)}
                        className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                      />
                      
                      {tempParamSuggestions.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-950 border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                          {tempParamSuggestions.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => addParamToTemplateList(p)}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 text-xs text-slate-700 dark:text-slate-355"
                            >
                              {p.name} ({p.shortCode})
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active List */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {newTemplateParams.map((p, idx) => (
                      <div key={p.id} className="flex items-center justify-between text-xs py-1 px-3 bg-slate-50 dark:bg-slate-950 border rounded">
                        <span className="font-semibold text-slate-800 dark:text-slate-250">{idx + 1}. {p.name} ({p.shortCode})</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (idx > 0) {
                                const updated = [...newTemplateParams];
                                const temp = updated[idx];
                                updated[idx] = updated[idx - 1];
                                updated[idx - 1] = temp;
                                setNewTemplateParams(updated.map((x, i) => ({ ...x, sortOrder: i + 1 })));
                              }
                            }}
                            className="text-slate-400 hover:text-teal-650 p-0.5"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (idx < newTemplateParams.length - 1) {
                                const updated = [...newTemplateParams];
                                const temp = updated[idx];
                                updated[idx] = updated[idx + 1];
                                updated[idx + 1] = temp;
                                setNewTemplateParams(updated.map((x, i) => ({ ...x, sortOrder: i + 1 })));
                              }
                            }}
                            className="text-slate-400 hover:text-teal-650 p-0.5"
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeParamFromTemplateList(idx)}
                            className="text-red-500 ml-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      if (!newTemplateName || !newTemplateCode) {
                        toast.error('Test name and code are required.');
                        return;
                      }
                      saveTemplateMutation.mutate({
                        name: newTemplateName,
                        shortCode: newTemplateCode,
                        category: newTemplateCat,
                        defaultPrice: Number(newTemplatePrice || 100),
                        shortcut: newTemplateShortcut || null,
                        description: newTemplateDesc || null,
                        displayOrder: Number(newTemplateOrder || 0),
                        parameterIds: newTemplateParams.map((p, idx) => ({
                          parameterId: p.id,
                          sortOrder: idx + 1
                        }))
                      });
                    }}
                    className="w-full py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white font-bold rounded-lg text-sm text-center"
                  >
                    {editingTemplateId ? 'Update Template Panel' : 'Create Template Panel'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 4: UNITS DICTIONARY --- */}
      {activeTab === 'units' && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm">
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Active Units Dictionary</h2>
            <button
              onClick={() => setShowAddUnit(true)}
              className="px-4 py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-sm flex items-center gap-1.5"
            >
              <Plus size={16} />
              <span>Add Unit</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm p-6">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {units.map((unit) => (
                <div key={unit.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-white text-sm">{unit.name}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{unit.description || 'Standard Medical measurement representation.'}</p>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-teal-650 bg-teal-50 px-2 py-0.5 rounded">Standardized</span>
                </div>
              ))}
            </div>
          </div>

          {/* Add unit inline modal */}
          {showAddUnit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 relative">
                <button onClick={() => setShowAddUnit(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-650">
                  <X className="text-slate-400" size={18} />
                </button>

                <h3 className="text-lg font-bold text-slate-850 dark:text-white mb-4">Add Custom Unit</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-505 mb-1 uppercase tracking-wider">Unit Name</label>
                    <input
                      type="text"
                      placeholder="E.g., mg/L, cells/cumm"
                      value={newUnitName}
                      onChange={e => setNewUnitName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-505 mb-1 uppercase tracking-wider">Description</label>
                    <input
                      type="text"
                      placeholder="Unit description"
                      value={newUnitDesc}
                      onChange={e => setNewUnitDesc(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!newUnitName) {
                        toast.error('Unit representation name is required.');
                        return;
                      }
                      api.post('/mke/units/normalize', { unit: newUnitName }).then(res => {
                        queryClient.invalidateQueries({ queryKey: ['parameters'] });
                        toast.success(`Unit standard set: ${res.standardName}`);
                        setShowAddUnit(false);
                        setNewUnitName('');
                        setNewUnitDesc('');
                      });
                    }}
                    className="w-full py-2.5 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 text-white font-bold rounded-lg text-sm text-center"
                  >
                    Normalize & Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// Inline modal X
function X({ className, size, ...props }: any) {
  return (
    <svg 
      xmlns="http://www.w3.org/2050/svg" 
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
