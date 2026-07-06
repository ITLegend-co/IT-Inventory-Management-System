import { useState, useEffect } from 'react';
import { ref, onValue, push, update, remove } from 'firebase/database';
import { db } from '../lib/firebase';
import { SoftwareLicense } from '../lib/types';
import { formatDate, formatCurrency, daysUntil } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Search, AlertTriangle, Pencil, Trash2, Key, RefreshCw, Ban } from 'lucide-react';
import * as XLSX from 'xlsx';

const LICENSE_TYPES = ['Subscription', 'Perpetual', 'OEM', 'Trial', 'Open Source'];
const BILLING_CYCLES = ['Monthly', 'Annually', 'One-time'];
const SOFTWARE_EXAMPLES = ['Microsoft 365 Business Standard', 'Odoo', 'SQL Payroll', 'ABSS / UBS', 'TeamViewer', 'Antivirus', 'Domain / Hosting', 'IPServerOne Email', 'Starlink Subscription', 'Adobe Creative Cloud'];

const INPUT = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
);
const SELECT = (p: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select {...p} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
);
const FIELD = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">{label}</label>{children}</div>
);

const emptyForm = {
  softwareName: '', vendor: '', licenseType: 'Subscription', billingCycle: 'Annually' as string,
  users: 1, expiryDate: '', cost: 0, supplier: '',
  renewalReminderDays: 30, licenseKey: '', assignedTo: '', remarks: '',
};

export default function Software() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<SoftwareLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showTerminated, setShowTerminated] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renewId, setRenewId] = useState<string | null>(null);
  const [renewDate, setRenewDate] = useState('');
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'it_staff';

  useEffect(() => {
    const unsub = onValue(ref(db, 'software'), snap => {
      setItems(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = items
    .filter(i => {
      const q = search.toLowerCase();
      const matchTerminated = showTerminated ? i.terminated : !i.terminated;
      return matchTerminated && (!q || i.softwareName?.toLowerCase().includes(q) || i.supplier?.toLowerCase().includes(q) || i.vendor?.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (a.terminated && !b.terminated) return 1;
      if (!a.terminated && b.terminated) return -1;
      const da = daysUntil(a.expiryDate);
      const db_ = daysUntil(b.expiryDate);
      return da - db_;
    });

  const expiringSoon = items.filter(i => !i.terminated && (() => { const d = daysUntil(i.expiryDate); return d >= 0 && d <= 30; })());
  const terminatedCount = items.filter(i => i.terminated).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...form, terminated: false, terminatedDate: '', createdAt: new Date().toISOString(), createdBy: currentUser?.name || '' };
      if (editId) await update(ref(db, `software/${editId}`), form);
      else await push(ref(db, 'software'), data);
      setShowModal(false);
      setEditId(null);
      setForm({ ...emptyForm });
    } finally {
      setSaving(false);
    }
  }

  async function handleRenew() {
    if (!renewId || !renewDate) return;
    setSaving(true);
    try {
      await update(ref(db, `software/${renewId}`), { expiryDate: renewDate, terminated: false, terminatedDate: '' });
      setRenewId(null);
      setRenewDate('');
    } finally {
      setSaving(false);
    }
  }

  async function handleTerminate(id: string) {
    await update(ref(db, `software/${id}`), { terminated: true, terminatedDate: new Date().toISOString().slice(0, 10) });
  }

  async function handleRestore(id: string) {
    await update(ref(db, `software/${id}`), { terminated: false, terminatedDate: '' });
  }

  function openEdit(item: SoftwareLicense) {
    setEditId(item.id);
    setForm({
      softwareName: item.softwareName, vendor: item.vendor || '', licenseType: item.licenseType || 'Subscription',
      billingCycle: item.billingCycle || 'Annually', users: item.users || 1, expiryDate: item.expiryDate || '',
      cost: item.cost || 0, supplier: item.supplier || '', renewalReminderDays: item.renewalReminderDays || 30,
      licenseKey: item.licenseKey || '', assignedTo: item.assignedTo || '', remarks: item.remarks || '',
    });
    setShowModal(true);
  }

  function cycleLabel(cycle?: string) {
  if (cycle === 'Monthly') return 'monthly';
  if (cycle === 'Annually') return 'annually';
  if (cycle === 'One-time') return 'one-time';
  return '';
  }

  function exportExcel() {
  const data = filtered.map(i => ({
    'Software': i.softwareName,
    'Vendor': i.vendor,
    'Type': i.licenseType,
    'Supplier': i.supplier,
    'Cost / Cycle': `${i.cost ? formatCurrency(i.cost) : '—'}${i.billingCycle ? ` / ${cycleLabel(i.billingCycle)}` : ''}`,
    'No. of Users': i.users,
    'Assigned To': i.assignedTo,
    'Expiry': i.expiryDate,
    'Terminated': i.terminated ? 'Yes' : 'No'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Software');
  XLSX.writeFile(wb, `MT_Software_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-slate-800 dark:text-white">Software & Licenses</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{items.filter(i => !i.terminated).length} active licenses{terminatedCount > 0 ? ` · ${terminatedCount} terminated` : ''}</p>
        </div>
        {canEdit && (
          <button onClick={() => { setShowModal(true); setEditId(null); setForm({ ...emptyForm }); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Add License
          </button>
        )}
      </div>

      {expiringSoon.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-400">{expiringSoon.length} license(s) expiring within 30 days: {expiringSoon.map(i => i.softwareName).join(', ')}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search software…"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
            <button onClick={() => setShowTerminated(false)} className={`px-4 py-2 text-sm ${!showTerminated ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Active</button>
            <button onClick={() => setShowTerminated(true)} className={`px-4 py-2 text-sm ${showTerminated ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Terminated{terminatedCount > 0 ? ` (${terminatedCount})` : ''}</button>
          </div>
          <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">Export</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 text-sm">
            {showTerminated ? 'No terminated licenses' : 'No software licenses yet'}
          </div>
        ) : filtered.map(item => {
          const days = daysUntil(item.expiryDate);
          const expired = !item.terminated && days < 0 && !!item.expiryDate;
          const critical = !item.terminated && days >= 0 && days <= 7;
          const warning = !item.terminated && days >= 0 && days <= 30;

          return (
            <div key={item.id} className={`bg-white dark:bg-slate-800 rounded-xl border p-5 ${item.terminated ? 'border-slate-200 dark:border-slate-700 opacity-60' : expired ? 'border-red-200 dark:border-red-800' : critical ? 'border-orange-200 dark:border-orange-800' : warning ? 'border-amber-200 dark:border-amber-700' : 'border-slate-200 dark:border-slate-700'}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.terminated ? 'bg-slate-100 dark:bg-slate-700' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                    {item.terminated ? <Ban className="w-4 h-4 text-slate-400" /> : <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight">{item.softwareName}</div>
                    <div className="text-xs text-slate-400">
                      {item.licenseType}{item.billingCycle ? ` · ${item.billingCycle}` : ''} · {item.users} user{item.users !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                {canEdit && !item.terminated && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setRenewId(item.id); setRenewDate(''); }} title="Mark as Renewed"
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    {currentUser?.role === 'admin' && (
                      <>
                        <button onClick={() => handleTerminate(item.id)} title="Mark as Terminated"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Ban className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteId(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                )}
                {item.terminated && canEdit && (
                  <button onClick={() => handleRestore(item.id)} className="text-xs px-2 py-1 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 rounded hover:bg-slate-50 dark:hover:bg-slate-700">Restore</button>
                )}
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Supplier</span>
                  <span className="text-slate-600 dark:text-slate-300">{item.supplier || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cost / Cycle</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {item.cost ? formatCurrency(item.cost) : '—'}
                    {item.billingCycle ? ` / ${cycleLabel(item.billingCycle)}` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">No. of Users</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {item.users || '—'} {item.users === 1 ? 'user' : 'users'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Assigned To</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {item.assignedTo || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{item.terminated ? 'Terminated' : 'Expiry'}</span>
                  <span className={`font-medium ${item.terminated ? 'text-slate-500' : expired ? 'text-red-600 dark:text-red-400' : critical ? 'text-orange-600' : warning ? 'text-amber-600' : 'text-slate-600 dark:text-slate-300'}`}>
                    {item.terminated ? (item.terminatedDate ? formatDate(item.terminatedDate) : 'Yes') : item.expiryDate ? formatDate(item.expiryDate) : '—'}
                  </span>
                </div>
              </div>

              {!item.terminated && (expired || warning) && (
                <div className={`mt-3 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ${expired ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : critical ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                  <AlertTriangle className="w-3 h-3" />
                  {expired ? 'EXPIRED — Renew or terminate' : `Expires in ${days} day${days !== 1 ? 's' : ''}`}
                </div>
              )}
              {item.terminated && (
                <div className="mt-3 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  <Ban className="w-3 h-3" /> Terminated
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-slate-800 dark:text-white font-semibold">{editId ? 'Edit License' : 'Add Software License'}</h3>
              <button onClick={() => { setShowModal(false); setEditId(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
              <FIELD label="Software Name *">
                <INPUT list="sw-list" required value={form.softwareName} onChange={e => setForm(f => ({ ...f, softwareName: e.target.value }))} placeholder="Microsoft 365 Business Standard" />
                <datalist id="sw-list">{SOFTWARE_EXAMPLES.map(s => <option key={s} value={s} />)}</datalist>
              </FIELD>
              <div className="grid grid-cols-2 gap-3">
                <FIELD label="Vendor"><INPUT value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Microsoft" /></FIELD>
                <FIELD label="License Type">
                  <SELECT value={form.licenseType} onChange={e => setForm(f => ({ ...f, licenseType: e.target.value }))}>
                    {LICENSE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </SELECT>
                </FIELD>
                <FIELD label="Billing Cycle">
                  <SELECT value={form.billingCycle} onChange={e => setForm(f => ({ ...f, billingCycle: e.target.value }))}>
                    <option value="">— Select —</option>
                    {BILLING_CYCLES.map(b => <option key={b}>{b}</option>)}
                  </SELECT>
                </FIELD>
                <FIELD label="No. of Users"><INPUT type="number" min="1" value={form.users} onChange={e => setForm(f => ({ ...f, users: parseInt(e.target.value) || 1 }))} /></FIELD>
                <FIELD label="Expiry Date"><INPUT type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} /></FIELD>
                <FIELD label="Cost (RM)"><INPUT type="number" min="0" step="0.01" value={form.cost || ''} onChange={e => setForm(f => ({ ...f, cost: parseFloat(e.target.value) || 0 }))} placeholder="0.00" /></FIELD>
                <FIELD label="Supplier"><INPUT value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="Evopoint" /></FIELD>
                <FIELD label="Renewal Reminder (days)"><INPUT type="number" min="1" max="365" value={form.renewalReminderDays} onChange={e => setForm(f => ({ ...f, renewalReminderDays: parseInt(e.target.value) || 30 }))} /></FIELD>
                <FIELD label="Assigned To"><INPUT value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Department or person" /></FIELD>
              </div>
              <FIELD label="License Key / Account"><INPUT value={form.licenseKey} onChange={e => setForm(f => ({ ...f, licenseKey: e.target.value }))} placeholder="XXXXX-XXXXX-XXXXX" /></FIELD>
              <FIELD label="Remarks"><textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" /></FIELD>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditId(null); }} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Renewed modal */}
      {renewId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
              <h3 className="text-slate-800 dark:text-white font-semibold">Mark as Renewed</h3>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Enter the new expiry date after renewal.</p>
            <FIELD label="New Expiry Date">
              <INPUT type="date" value={renewDate} onChange={e => setRenewDate(e.target.value)} required />
            </FIELD>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRenewId(null)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
              <button onClick={handleRenew} disabled={!renewDate || saving} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg text-sm">Confirm Renewal</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-slate-800 dark:text-white font-semibold mb-2">Delete License?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">This permanently removes the record. Consider using "Terminate" instead to keep history.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
              <button onClick={async () => { await remove(ref(db, `software/${deleteId}`)); setDeleteId(null); }} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
