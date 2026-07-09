import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import { toast } from 'sonner';
import { ArrowLeft, Printer, Send, Save, CreditCard, Receipt, MessageSquare, Mail } from 'lucide-react';

interface BillingTest {
  testId: string;
  name: string;
  defaultPrice: number;
  chargedPrice: number;
}

export default function BillingView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local state for interactive editing
  const [testPrices, setTestPrices] = useState<BillingTest[]>([]);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');

  // Share form states
  const [shareChannel, setShareChannel] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [shareRecipient, setShareRecipient] = useState<string>('');

  // Fetch billing details
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['report-billing', id],
    queryFn: () => api.get(`/billing/${id}`),
    enabled: !!id
  });

  // Populate local states when data arrives
  useEffect(() => {
    if (data) {
      setTestPrices(data.tests || []);
      setPaidAmount(data.billing?.paidAmount || 0);
      setPaymentMethod(data.billing?.paymentMethod || 'CASH');
      // Pre-fill share recipient with patient contact details
      setShareRecipient(
        shareChannel === 'WHATSAPP' 
          ? data.patient?.phone || '' 
          : data.patient?.email || ''
      );
    }
  }, [data]);

  // Adjust pre-filled contact when sharing channel changes
  useEffect(() => {
    if (data) {
      setShareRecipient(
        shareChannel === 'WHATSAPP' 
          ? data.patient?.phone || '' 
          : data.patient?.email || ''
      );
    }
  }, [shareChannel, data]);

  // Mutation to save/update billing info
  const saveBillingMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/billing/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-billing', id] });
      toast.success('Billing receipt details updated successfully.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update billing details.');
    }
  });

  // Mutation to share receipt PDF
  const shareBillingMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/billing/${id}/share`, payload),
    onSuccess: (res: any) => {
      toast.success(res.message || 'Billing receipt shared successfully.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to share billing receipt.');
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center animate-pulse text-teal-600 dark:text-teal-400">
          <Receipt className="w-12 h-12 mx-auto mb-4 animate-spin" />
          <p className="font-semibold text-lg">Loading billing records...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 min-h-screen">
        <p className="text-red-500 font-semibold mb-4">Error loading billing record.</p>
        <button 
          onClick={() => navigate('/reports')}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
        >
          Back to Reports Log
        </button>
      </div>
    );
  }

  const { patient, doctor, billing } = data;

  // Handle individual test price edits
  const handlePriceChange = (testId: string, value: string) => {
    const numVal = value === '' ? 0 : Math.max(0, Number(value));
    setTestPrices(prev =>
      prev.map(t => (t.testId === testId ? { ...t, chargedPrice: numVal } : t))
    );
  };

  // Perform client-side math calculations for the summary block
  const totalOriginalPrice = testPrices.reduce((sum, t) => sum + t.defaultPrice, 0);
  const totalChargedPrice = testPrices.reduce((sum, t) => sum + t.chargedPrice, 0);
  const totalDiscount = totalOriginalPrice - totalChargedPrice;
  const discountPercent = totalOriginalPrice > 0 ? (totalDiscount / totalOriginalPrice) * 100 : 0;
  const balanceDue = Math.max(0, totalChargedPrice - paidAmount);

  // Save bill handler
  const handleSave = () => {
    saveBillingMutation.mutate({
      tests: testPrices.map(t => ({ testId: t.testId, chargedPrice: t.chargedPrice })),
      paidAmount,
      paymentMethod
    });
  };

  // Print invoice handler (A5 receipt)
  const handlePrint = () => {
    const backendUrl = api.defaults.baseURL || 'http://localhost:5000/api';
    // Remove trailing slashes if any
    const cleanBaseUrl = backendUrl.replace(/\/+$/, '');
    window.open(`${cleanBaseUrl}/billing/receipt/${id}`, '_blank');
  };

  // Dispatch receipt sharing
  const handleShare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareRecipient.trim()) {
      toast.error('Recipient contact details are required.');
      return;
    }
    shareBillingMutation.mutate({
      channel: shareChannel,
      recipient: shareRecipient
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/reports')}
            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Patient Billing Center</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage invoices, adjust test prices, print receipts & track payments</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <Printer className="w-4 h-4" />
            Print Receipt (A5)
          </button>
          <button
            onClick={handleSave}
            disabled={saveBillingMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-lg shadow-teal-500/20 disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4" />
            {saveBillingMutation.isPending ? 'Saving...' : 'Save Bill'}
          </button>
        </div>
      </div>

      {/* Patient info details */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Demographics & Referral Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500">Patient Name</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{patient?.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Age / Gender</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {patient?.age} {patient?.ageUnit?.toLowerCase()} / {patient?.gender}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Contact Number</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{patient?.phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Referring Consultant</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{doctor?.name}</p>
          </div>
        </div>
      </div>

      {/* Workspace Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Pricing list editor table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <h3 className="font-bold text-slate-800 dark:text-slate-200">Selected Investigations</h3>
            <p className="text-xs text-slate-500">Enter custom Charged Price for each test. Defaults are loaded from library.</p>
          </div>
          
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/30">
                  <th className="py-3 px-4">Test Name</th>
                  <th className="py-3 px-4 text-right">Default Price (₹)</th>
                  <th className="py-3 px-4 text-right w-44">Charged Price (₹)</th>
                  <th className="py-3 px-4 text-right">Discount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm text-slate-700 dark:text-slate-300">
                {testPrices.map((t) => {
                  const discount = Math.max(0, t.defaultPrice - t.chargedPrice);
                  return (
                    <tr key={t.testId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">{t.name}</td>
                      <td className="py-3.5 px-4 text-right text-slate-500">₹{t.defaultPrice.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="relative inline-block w-full">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={t.chargedPrice === 0 ? '' : t.chargedPrice}
                            placeholder="0.00"
                            onChange={e => handlePriceChange(t.testId, e.target.value)}
                            className="w-full pl-7 pr-3 py-1.5 border border-slate-200 dark:border-slate-800 focus:border-teal-500 dark:focus:border-teal-400 focus:ring-1 focus:ring-teal-500 rounded-lg text-right bg-slate-50/50 dark:bg-slate-950 font-semibold"
                          />
                        </div>
                      </td>
                      <td className={`py-3.5 px-4 text-right font-medium ${discount > 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}`}>
                        {discount > 0 ? `₹${discount.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals & Payments sidebar */}
        <div className="space-y-6">
          
          {/* Invoice Summary Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CreditCard className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              Bill Calculation Summary
            </h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Total Default Amount</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">₹{totalOriginalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Total Charged Amount</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">₹{totalChargedPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Discount Amount</span>
                <span className="font-medium text-green-600 dark:text-green-400">₹{totalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Discount Percentage</span>
                <span className="font-medium text-green-600 dark:text-green-400">{discountPercent.toFixed(2)}%</span>
              </div>
              
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-base font-bold text-slate-950 dark:text-slate-50">
                <span>Net Payable</span>
                <span className="text-teal-600 dark:text-teal-400">₹{totalChargedPrice.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Amount Paid (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    max={totalChargedPrice}
                    value={paidAmount === 0 ? '' : paidAmount}
                    onChange={e => setPaidAmount(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-slate-200 dark:border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl bg-slate-50/50 dark:bg-slate-950 font-bold text-lg text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl bg-slate-50/50 dark:bg-slate-950 font-semibold text-slate-700 dark:text-slate-300"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">CARD</option>
                  <option value="CREDIT">CREDIT</option>
                  <option value="MIXED">MIXED</option>
                </select>
              </div>

              <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/80 text-sm font-semibold">
                <span className="text-slate-500">Balance Due:</span>
                <span className={`font-bold ${balanceDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                  ₹{balanceDue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Share Invoice Card */}
          <form onSubmit={handleShare} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Send className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              Share Digital Invoice
            </h3>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-950/80">
              <button
                type="button"
                onClick={() => setShareChannel('WHATSAPP')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${shareChannel === 'WHATSAPP' ? 'bg-white dark:bg-slate-850 shadow-sm text-green-600 dark:text-green-400' : 'text-slate-500'}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setShareChannel('EMAIL')}
                className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${shareChannel === 'EMAIL' ? 'bg-white dark:bg-slate-850 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                {shareChannel === 'WHATSAPP' ? 'WhatsApp Phone Number' : 'Email Address'}
              </label>
              <input
                type={shareChannel === 'EMAIL' ? 'email' : 'text'}
                value={shareRecipient}
                onChange={e => setShareRecipient(e.target.value)}
                placeholder={shareChannel === 'EMAIL' ? 'patient@domain.com' : 'e.g. +91 99999 99999'}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 rounded-xl bg-slate-50/50 dark:bg-slate-950 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={shareBillingMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100 rounded-xl transition-all shadow-md shadow-slate-900/10"
            >
              <Send className="w-3.5 h-3.5" />
              {shareBillingMutation.isPending ? 'Sending...' : 'Send Invoice'}
            </button>
          </form>
        </div>

      </div>
      
    </div>
  );
}
