import { useState, useEffect } from 'react';
import { ref, onValue, push } from 'firebase/database';
import { db } from '../lib/firebase';
import { Asset, Repair } from '../lib/types';
import { formatDate, formatCurrency, statusColor } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Search } from 'lucide-react';

const REPAIR_STATUSES = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
const TECHNICIANS = ['Adly', 'Eizzat', 'External Vendor'];

const INPUT = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
);
const SELECT = (p: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select {...p} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
);
const FIELD = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">{label}</label>{children}</div>
);

export default function Repairs() {
  const { currentUser } = useAuth();
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    issue: '', action: '', status: 'Pending',
    technician: 'Adly', cost: '', remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'it_staff';

  useEffect(() => {
    const u1 = onValue(ref(db, 'repairs'), snap => {
      setRepairs(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
      setLoading(false);
    });
    const u2 = onValue(ref(db, 'assets'), snap => {
      setAssets(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    return () => { u1(); u2(); };
  }, []);

  const filtered = repairs
    .filter(r => {
      const q = search.toLowerCase();
      return (!q || r.assetId?.toLowerCase().includes(q) || r.assetName?.toLowerCase().includes(q) || r.issue?.toLowerCase().includes(q) || r.technician?.toLowerCase().includes(q)) &&
        (!filterStatus || r.status === filterStatus);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const filteredAssets = assets.filter(a => {
    const q = assetSearch.toLowerCase();
    return !q || a.assetId?.toLowerCase().includes(q) || a.brand?.toLowerCase().includes(q) || a.model?.toLowerCase().includes(q);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    setSaving(true);
    try {
      await push(ref(db, 'repairs'), {
        assetId: selectedAsset.id,
        assetName: `${selectedAsset.brand} ${selectedAsset.model}`,
        ...form,
        cost: parseFloat(form.cost) || 0,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || '',
      });
      setShowModal(false);
      resetModal();
    } finally {
      setSaving(false);
    }
  }

  function resetModal() {
    setSelectedAsset(null);
    setAssetSearch('');
    setForm({ date: new Date().toISOString().slice(0, 10), issue: '', action: '', status: 'Pending', technician: 'Adly', cost: '', remarks: '' });
  }

  const pending = repairs.filter(r => r.status === 'Pending' || r.status === 'In Progress').length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-slate-800 dark:text-white">Repair / Issue History</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{pending > 0 ? `${pending} open • ` : ''}{repairs.length} total records</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Log Repair
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by asset, issue, technician…"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <SELECT value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All Statuses</option>
            {REPAIR_STATUSES.map(s => <option key={s}>{s}</option>)}
          </SELECT>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 text-sm">No repair records found</div>
        ) : filtered.map(r => (
          <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{formatDate(r.date)}</span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{r.assetName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(r.status)}`}>{r.status}</span>
                </div>
                <div className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium">Issue:</span> {r.issue}
                </div>
                {r.action && (
                  <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-medium">Action:</span> {r.action}
                  </div>
                )}
                {r.remarks && <div className="mt-0.5 text-xs text-slate-400">{r.remarks}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-slate-400">{r.technician}</div>
                {r.cost > 0 && <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-0.5">{formatCurrency(r.cost)}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-slate-800 dark:text-white font-semibold">Log Repair</h3>
              <button onClick={() => { setShowModal(false); resetModal(); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
              <FIELD label="Asset">
                <input value={assetSearch} onChange={e => { setAssetSearch(e.target.value); setSelectedAsset(null); }}
                  placeholder="Search assets…"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {assetSearch && !selectedAsset && (
                  <div className="mt-1 border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                    {filteredAssets.map(a => (
                      <button key={a.id} type="button" onClick={() => { setSelectedAsset(a); setAssetSearch(`${a.assetId} — ${a.brand} ${a.model}`); }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                        <div className="text-sm font-mono text-slate-700 dark:text-slate-200">{a.assetId}</div>
                        <div className="text-xs text-slate-400">{a.brand} {a.model}</div>
                      </button>
                    ))}
                  </div>
                )}
              </FIELD>
              <FIELD label="Issue *">
                <INPUT required value={form.issue} onChange={e => setForm(f => ({ ...f, issue: e.target.value }))} placeholder="Describe the issue…" />
              </FIELD>
              <FIELD label="Action Taken">
                <textarea value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))} rows={2} placeholder="What was done…"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </FIELD>
              <div className="grid grid-cols-2 gap-3">
                <FIELD label="Date">
                  <INPUT type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </FIELD>
                <FIELD label="Status">
                  <SELECT value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {REPAIR_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </SELECT>
                </FIELD>
                <FIELD label="Technician">
                  <SELECT value={form.technician} onChange={e => setForm(f => ({ ...f, technician: e.target.value }))}>
                    {TECHNICIANS.map(t => <option key={t}>{t}</option>)}
                  </SELECT>
                </FIELD>
                <FIELD label="Cost (RM)">
                  <INPUT type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" />
                </FIELD>
              </div>
              <FIELD label="Remarks">
                <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </FIELD>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetModal(); }} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving || !selectedAsset} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
