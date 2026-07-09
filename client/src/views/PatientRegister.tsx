import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import type { Doctor, Test } from 'shared';
import { Plus, UserPlus, ClipboardList, CheckSquare, Square, Search, X, Star, Check } from 'lucide-react';
import { toast } from 'sonner';

interface RegisterFormFields {
  name: string;
  age?: number;
  ageUnit: 'YEARS' | 'MONTHS' | 'DAYS';
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone?: string;
  doctorId: string;
}

export default function PatientRegister() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newDoctorModal, setNewDoctorModal] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorDropdownOpen, setDoctorDropdownOpen] = useState(false);

  // Doctor Form States
  const [newDocName, setNewDocName] = useState('');
  const [newDocQual, setNewDocQual] = useState('');
  const [newDocHosp, setNewDocHosp] = useState('');
  const [newDocReg, setNewDocReg] = useState('');
  const [newDocPhone, setNewDocPhone] = useState('');

  // Patient saved state & Test Selection Popup
  const [savedPatient, setSavedPatient] = useState<any | null>(null);
  const [showTestSearchModal, setShowTestSearchModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterFormFields>({
    defaultValues: {
      ageUnit: 'YEARS',
      gender: 'MALE',
      doctorId: 'self-doctor'
    }
  });

  const selectedDoctorId = watch('doctorId');

  const nameRef = useRef<HTMLInputElement | null>(null);
  const ageRef = useRef<HTMLInputElement | null>(null);
  const ageUnitRef = useRef<HTMLSelectElement | null>(null);
  const genderRef = useRef<HTMLSelectElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const doctorSearchRef = useRef<HTMLInputElement | null>(null);

  const fields = [
    nameRef,
    ageRef,
    ageUnitRef,
    genderRef,
    phoneRef,
    doctorSearchRef
  ];

  // Query active doctors
  const { data: doctors = [] } = useQuery<Doctor[]>({
    queryKey: ['doctors'],
    queryFn: () => api.get('/doctors')
  });

  // Query MKE test templates
  const { data: tests = [] } = useQuery<any[]>({
    queryKey: ['test-templates'],
    queryFn: () => api.get('/mke/tests')
  });

  // Default Referring Doctor to "Self" once loaded
  useEffect(() => {
    const selfDoc = doctors.find(d => d.id === 'self-doctor' || d.name.toLowerCase() === 'self');
    if (selfDoc) {
      setValue('doctorId', selfDoc.id);
      setDoctorSearch(selfDoc.name);
    }
    // Load last used doctor setting from persistent favorites if exists
    const lastDocId = localStorage.getItem('lastUsedDoctorId');
    if (lastDocId) {
      const docObj = doctors.find(d => d.id === lastDocId);
      if (docObj) {
        setValue('doctorId', docObj.id);
        setDoctorSearch(docObj.name);
      }
    }
  }, [doctors, setValue]);

  // Save new doctor inline
  const createDoctorMutation = useMutation({
    mutationFn: (data: any) => api.post('/doctors', data),
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
      setValue('doctorId', newDoc.id);
      setDoctorSearch(newDoc.name);
      setNewDoctorModal(false);
      setNewDocName('');
      setNewDocQual('');
      setNewDocHosp('');
      setNewDocReg('');
      setNewDocPhone('');
      toast.success(`Doctor ${newDoc.name} registered and selected.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to add doctor.');
    }
  });

  const onSubmit = async (data: RegisterFormFields) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (!data.name.trim()) {
        toast.error('Patient Name is mandatory.');
        return;
      }
      
      // Save patient details
      const patient = await api.post('/patients', {
        name: data.name.trim(),
        age: data.age ? Number(data.age) : null,
        ageUnit: data.age ? data.ageUnit : null,
        gender: data.age ? data.gender : null,
        phone: data.phone || null
      });

      // Save last used settings
      if (data.doctorId) {
        localStorage.setItem('lastUsedDoctorId', data.doctorId);
      }

      setSavedPatient(patient);
      setShowTestSearchModal(true);
      toast.success(`Patient "${patient.name}" saved. Choose investigation panels.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save patient.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [highlightedDocIndex, setHighlightedDocIndex] = useState(-1);

  const handleKeyDown = (e: React.KeyboardEvent, currentRef: React.RefObject<any>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (currentRef === doctorSearchRef) {
        const filtered = doctors.filter(d => d.name.toLowerCase().includes(doctorSearch.toLowerCase()));
        if (doctorDropdownOpen && highlightedDocIndex !== -1 && filtered[highlightedDocIndex]) {
          const doc = filtered[highlightedDocIndex];
          setValue('doctorId', doc.id);
          setDoctorSearch(doc.name);
          setDoctorDropdownOpen(false);
          setHighlightedDocIndex(-1);
          toast.info(`Doctor "${doc.name}" selected.`);
        } else {
          handleSubmit(onSubmit)();
        }
        return;
      }

      if (e.shiftKey) {
        // Shift+Enter: move backward
        const index = fields.indexOf(currentRef as any);
        if (index > 0) {
          fields[index - 1].current?.focus();
        }
      } else {
        // Enter: move forward
        const index = fields.indexOf(currentRef as any);
        if (index !== -1 && index < fields.length - 1) {
          fields[index + 1].current?.focus();
        }
      }
    }
  };

  const handleDoctorSearchKeyDown = (e: React.KeyboardEvent) => {
    const filtered = doctors.filter(d => d.name.toLowerCase().includes(doctorSearch.toLowerCase()));
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDoctorDropdownOpen(true);
      setHighlightedDocIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedDocIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Escape') {
      setDoctorDropdownOpen(false);
      setHighlightedDocIndex(-1);
    } else if (e.key === 'Enter') {
      handleKeyDown(e, doctorSearchRef);
    }
  };

  const handleAddDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName || !newDocQual || !newDocHosp || !newDocReg || !newDocPhone) {
      toast.error('Please fill in all doctor details.');
      return;
    }
    createDoctorMutation.mutate({
      name: newDocName,
      qualification: newDocQual,
      hospital: newDocHosp,
      registrationNumber: newDocReg,
      phone: newDocPhone
    });
  };

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

  const { ref: nameFormRef, ...nameRest } = register('name', { required: 'Name is required' });
  const { ref: ageFormRef, ...ageRest } = register('age', { min: { value: 1, message: 'Invalid age' } });
  const { ref: ageUnitFormRef, ...ageUnitRest } = register('ageUnit');
  const { ref: genderFormRef, ...genderRest } = register('gender');
  const { ref: phoneFormRef, ...phoneRest } = register('phone');

  return (
    <div className="p-8 max-w-xl mx-auto space-y-8 relative">
      
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
          <UserPlus className="text-teal-600 dark:text-teal-400" size={32} />
          <span>Patient Check-In</span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">High-volume rapid entry demographics form. Press ENTER to search investigations.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Patient Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Full Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">PATIENT NAME *</label>
              <input
                type="text"
                autoFocus
                placeholder="Enter patient full name (Required)"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-855 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium"
                {...nameRest}
                ref={(e) => {
                  nameFormRef(e);
                  nameRef.current = e;
                }}
                onKeyDown={(e) => handleKeyDown(e, nameRef)}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            {/* Age */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">AGE (OPTIONAL)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Age"
                  className="w-2/3 px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  {...ageRest}
                  ref={(e) => {
                    ageFormRef(e);
                    ageRef.current = e;
                  }}
                  onKeyDown={(e) => handleKeyDown(e, ageRef)}
                />
                <select
                  className="w-1/3 px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-855 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  {...ageUnitRest}
                  ref={(e) => {
                    ageUnitFormRef(e);
                    ageUnitRef.current = e;
                  }}
                  onKeyDown={(e) => handleKeyDown(e, ageUnitRef)}
                >
                  <option value="YEARS">Yrs</option>
                  <option value="MONTHS">Mths</option>
                  <option value="DAYS">Days</option>
                </select>
              </div>
              {errors.age && <p className="text-xs text-red-500 mt-1">{errors.age.message}</p>}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">GENDER (OPTIONAL)</label>
              <select
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                {...genderRest}
                ref={(e) => {
                  genderFormRef(e);
                  genderRef.current = e;
                }}
                onKeyDown={(e) => handleKeyDown(e, genderRef)}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Phone */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">PHONE NUMBER (COMMUNICATION ONLY)</label>
              <input
                type="text"
                placeholder="Enter phone number"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                {...phoneRest}
                ref={(e) => {
                  phoneFormRef(e);
                  phoneRef.current = e;
                }}
                onKeyDown={(e) => handleKeyDown(e, phoneRef)}
              />
            </div>
          </div>
        </div>

        {/* Doctor Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Referring Doctor</label>
            <button
              type="button"
              onClick={() => setNewDoctorModal(true)}
              className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline"
            >
              + Register Doctor
            </button>
          </div>

          <div className="relative">
            <div className="relative">
              <input
                type="text"
                placeholder="Type to search referring doctor..."
                value={doctorSearch || (selectedDoctor ? selectedDoctor.name : '')}
                onChange={(e) => {
                  setDoctorSearch(e.target.value);
                  setDoctorDropdownOpen(true);
                  setHighlightedDocIndex(-1);
                }}
                onFocus={() => setDoctorDropdownOpen(true)}
                ref={doctorSearchRef}
                onKeyDown={handleDoctorSearchKeyDown}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-850 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              />
              <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
            </div>

            {doctorDropdownOpen && (
              <div className="absolute z-20 w-full mt-1.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {doctors
                  .filter(d => d.name.toLowerCase().includes(doctorSearch.toLowerCase()))
                  .map((d, index) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setValue('doctorId', d.id);
                        setDoctorSearch(d.name);
                        setDoctorDropdownOpen(false);
                        setHighlightedDocIndex(-1);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex flex-col ${highlightedDocIndex === index ? 'bg-teal-550 dark:bg-teal-900/40 text-teal-650 dark:text-teal-300 font-semibold bg-slate-100 dark:bg-slate-850' : 'text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-850'}`}
                    >
                      <p className="font-semibold">{d.name}</p>
                      <span className="text-[10px] text-slate-450 uppercase">{d.qualification} - {d.hospital}</span>
                    </button>
                  ))}
                {doctors.filter(d => d.name.toLowerCase().includes(doctorSearch.toLowerCase())).length === 0 && (
                  <div className="p-3 text-center text-xs text-slate-400">
                    No doctor found. Press Enter to submit.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 bg-teal-600 dark:bg-teal-500 text-white font-bold rounded-lg text-sm hover:bg-teal-700 dark:hover:bg-teal-600 transition flex items-center justify-center gap-2 shadow-md shadow-teal-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>{isSubmitting ? 'Saving Patient details...' : 'Save Patient & Select Tests'}</span>
        </button>

      </form>

      {/* Test Selection Popup Modal */}
      {showTestSearchModal && savedPatient && (
        <TestSelectionModal
          patient={savedPatient}
          doctorId={selectedDoctorId}
          tests={tests}
          onClose={() => setShowTestSearchModal(false)}
          navigate={navigate}
        />
      )}

      {/* New Doctor Inline Modal */}
      {newDoctorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setNewDoctorModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-slate-850 dark:text-white mb-4">Register Referring Doctor</h3>
            
            <form onSubmit={handleAddDoctor} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Doctor Name</label>
                <input
                  type="text"
                  placeholder="E.g., Dr. Jane Smith"
                  value={newDocName}
                  onChange={e => setNewDocName(e.target.value)}
                  className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Qualification</label>
                  <input
                    type="text"
                    placeholder="E.g., MD, Pathology"
                    value={newDocQual}
                    onChange={e => setNewDocQual(e.target.value)}
                    className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Hospital</label>
                  <input
                    type="text"
                    placeholder="E.g., City Clinic"
                    value={newDocHosp}
                    onChange={e => setNewDocHosp(e.target.value)}
                    className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Reg. Number</label>
                  <input
                    type="text"
                    placeholder="E.g., REG-12345"
                    value={newDocReg}
                    onChange={e => setNewDocReg(e.target.value)}
                    className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Phone</label>
                  <input
                    type="text"
                    placeholder="E.g., +91 99999 99999"
                    value={newDocPhone}
                    onChange={e => setNewDocPhone(e.target.value)}
                    className="w-full px-3.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={createDoctorMutation.isPending}
                className="w-full mt-2 py-2.5 bg-teal-600 dark:bg-teal-500 text-white font-bold rounded-lg text-sm text-center hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createDoctorMutation.isPending ? 'Saving...' : 'Save Doctor'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

interface ModalProps {
  patient: any;
  doctorId: string;
  tests: any[];
  onClose: () => void;
  navigate: (url: string) => void;
}

function TestSelectionModal({ patient, doctorId, tests, onClose, navigate }: ModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Local states for Favorites & Recents
  const [favIds, setFavIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Load persistence configurations from localStorage
  useEffect(() => {
    try {
      const favs = JSON.parse(localStorage.getItem('favouriteTestIds') || '[]');
      const recents = JSON.parse(localStorage.getItem('recentTestIds') || '[]');
      setFavIds(favs);
      setRecentIds(recents);
    } catch (e) {}
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favIds.includes(id) ? favIds.filter(f => f !== id) : [...favIds, id];
    setFavIds(updated);
    localStorage.setItem('favouriteTestIds', JSON.stringify(updated));
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Filter and Sort tests: Query matches, then prioritize Favorites & Recents
  const filteredTests = tests.filter(test => {
    const term = query.toLowerCase();
    return (
      test.name.toLowerCase().includes(term) ||
      test.shortCode.toLowerCase().includes(term) ||
      test.category.toLowerCase().includes(term)
    );
  });

  // Sort: Favorited/Recent tests bubble up when query is empty
  const sortedTests = [...filteredTests].sort((a, b) => {
    if (!query) {
      const aFav = favIds.includes(a.id) ? 1 : 0;
      const bFav = favIds.includes(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;

      const aRec = recentIds.includes(a.id) ? 1 : 0;
      const bRec = recentIds.includes(b.id) ? 1 : 0;
      return bRec - aRec;
    }
    return 0;
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx(prev => (prev + 1) % sortedTests.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx(prev => (prev - 1 + sortedTests.length) % sortedTests.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (sortedTests[focusedIdx]) {
        handleToggleSelect(sortedTests[focusedIdx].id);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one test panel.');
      return;
    }
    try {
      // Save to recent list
      const updatedRecents = Array.from(new Set([...selectedIds, ...recentIds])).slice(0, 10);
      localStorage.setItem('recentTestIds', JSON.stringify(updatedRecents));

      // Register report & load templates
      const report = await api.post('/reports', {
        patientId: patient.id,
        doctorId: doctorId || 'self-doctor',
        testIds: selectedIds
      });

      toast.success('Investigation registered and templates loaded.');
      onClose();
      navigate(`/reports/${report.id}/entry`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete registration.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onKeyDown={handleKeyDown}
      >
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/60">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white text-base">Select Investigations</h3>
            <p className="text-xs text-slate-550 dark:text-slate-400 mt-0.5">Patient: <span className="font-bold">{patient.name}</span></p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400"><X size={18} /></button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-150/40 dark:border-slate-800">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by Code, Name, Aliases... (Arrow keys to navigate, Enter to toggle)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocusedIdx(0);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-sm text-slate-850 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-sans">
          {sortedTests.map((test, index) => {
            const isSelected = selectedIds.includes(test.id);
            const isFocused = index === focusedIdx;
            const isFav = favIds.includes(test.id);
            const isRec = recentIds.includes(test.id);

            return (
              <div
                key={test.id}
                onClick={() => handleToggleSelect(test.id)}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-100
                  ${isSelected 
                    ? 'border-teal-500 bg-teal-50/20 dark:bg-teal-950/10' 
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-850/40'}
                  ${isFocused ? 'ring-2 ring-teal-500/35 border-teal-500' : ''}
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div>
                    {isSelected ? (
                      <Check className="text-teal-600 dark:text-teal-400" size={18} />
                    ) : (
                      <div className="w-[18px] h-[18px] border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950" />
                    )}
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight flex items-center gap-1.5">
                      <span>{test.name}</span>
                      {isFav && <span className="text-[9px] px-1 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded border border-amber-250/30 font-semibold">FAV</span>}
                      {isRec && !isFav && <span className="text-[9px] px-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded border border-slate-200/30 font-semibold">REC</span>}
                    </p>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">{test.shortCode} • {test.category}</span>
                  </div>
                </div>

                {/* Favorite Star */}
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(test.id, e)}
                  className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${isFav ? 'text-amber-500' : 'text-slate-300 dark:text-slate-700'}`}
                >
                  <Star size={15} fill={isFav ? 'currentColor' : 'none'} />
                </button>
              </div>
            );
          })}
          {sortedTests.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching investigation templates found.
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Selected: <span className="font-bold text-teal-600 dark:text-teal-400">{selectedIds.length}</span> panels
          </span>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-bold text-slate-655 dark:text-slate-400"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleConfirm} 
              className="px-5 py-2 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600 rounded-lg text-xs font-bold text-white shadow-md shadow-teal-600/10 flex items-center gap-1.5"
            >
              <ClipboardList size={14} />
              <span>Confirm & Start Entry (ENTER)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
