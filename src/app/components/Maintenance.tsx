import { useState, useEffect } from 'react';
import { ref, onValue, push, set } from 'firebase/database';
import { db } from '../lib/firebase';
import { Asset, Maintenance as MaintenanceType } from '../lib/types';
import { formatDate, statusColor, getChecklistForCategory, daysUntil } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Search, AlertTriangle } from 'lucide-react';

const MAINTENANCE_STATUSES = ['Good', 'Need Monitoring', 'Need Repair', 'Completed', 'Pending'];
const TECHNICIANS = ['Adly', 'Eizzat'];

const INPUT = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
);
const SELECT = (p: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select {...p} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
);
const FIELD = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">{label}</label>{children}</div>
);

export default function Maintenance() {
  const { currentUser } = useAuth();
  const [records, setRecords] = useState<MaintenanceType[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    maintenanceDate: new Date().toISOString().slice(0, 10),
    technician: 'Adly',
    status: 'Good',
    nextMaintenance: '',
    remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'it_staff';

  useEffect(() => {
    const u1 = onValue(ref(db, 'maintenance'), snap => {
      setRecords(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
      setLoading(false);
    });
    const u2 = onValue(ref(db, 'assets'), snap => {
      setAssets(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    if (selectedAsset) {
      const items = getChecklistForCategory(selectedAsset.category);
      setChecklist(Object.fromEntries(items.map(i => [i, false])));
    }
  }, [selectedAsset]);

  const filtered = records
    .filter(r => {
      const q = search.toLowerCase();
      return !q || r.assetId?.toLowerCase().includes(q) || r.assetName?.toLowerCase().includes(q) ||
        r.technician?.toLowerCase().includes(q) || r.assetCategory?.toLowerCase().includes(q);
    })
    .sort((a, b) => b.maintenanceDate.localeCompare(a.maintenanceDate));

  const filteredAssets = assets.filter(a => {
    const q = assetSearch.toLowerCase();
    return !q || a.assetId?.toLowerCase().includes(q) || a.brand?.toLowerCase().includes(q) || a.model?.toLowerCase().includes(q);
  });

  const dueSoon = records.filter(r => { const d = daysUntil(r.nextMaintenance); return d >= 0 && d <= 30; });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    setSaving(true);
    try {
      await push(ref(db, 'maintenance'), {
        assetId: selectedAsset.id,
        assetName: `${selectedAsset.brand} ${selectedAsset.model}`,
        assetCategory: selectedAsset.category,
        ...form,
        checklist,
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
    setChecklist({});
    setForm({ maintenanceDate: new Date().toISOString().slice(0, 10), technician: 'Adly', status: 'Good', nextMaintenance: '', remarks: '' });
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-slate-800 dark:text-white">Maintenance / PPM</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{records.length} maintenance records</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Log Maintenance
          </button>
        )}
      </div>

      {dueSoon.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">{dueSoon.length} asset(s) due for maintenance within 30 days</div>
            <div className="text-xs text-amber-600 dark:text-amber-500 mt-1">{dueSoon.map(r => r.assetName).join(', ')}</div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by asset, technician, category…"
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                {['Asset', 'Category', 'Date', 'Technician', 'Status', 'Next PPM', 'Remarks'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">No maintenance records yet</td></tr>
              ) : filtered.map(r => {
                const nextDays = daysUntil(r.nextMaintenance);
                return (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{r.assetName}</div>
                      <div className="text-xs text-slate-400 font-mono">{r.assetId}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{r.assetCategory}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDate(r.maintenanceDate)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{r.technician}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDate(r.nextMaintenance)}</div>
                      {r.nextMaintenance && nextDays >= 0 && nextDays <= 30 && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">{nextDays}d remaining</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">{r.remarks || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-slate-800 dark:text-white font-semibold">Log Maintenance</h3>
              <button onClick={() => { setShowModal(false); resetModal(); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
              <FIELD label="Select Asset">
                <input value={assetSearch} onChange={e => { setAssetSearch(e.target.value); setSelectedAsset(null); setChecklist({}); }}
                  placeholder="Search assets…"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {assetSearch && !selectedAsset && (
                  <div className="mt-1 border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                    {filteredAssets.map(a => (
                      <button key={a.id} type="button" onClick={() => { setSelectedAsset(a); setAssetSearch(`${a.assetId} — ${a.brand} ${a.model}`); }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                        <div className="text-sm font-mono text-slate-700 dark:text-slate-200">{a.assetId}</div>
                        <div className="text-xs text-slate-400">{a.brand} {a.model} · {a.category}</div>
                      </button>
                    ))}
                  </div>
                )}
              </FIELD>

              {selectedAsset && Object.keys(checklist).length > 0 && (
                <FIELD label="PPM Checklist">
                  <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    {Object.entries(checklist).map(([item, done]) => (
                      <label key={item} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={done} onChange={e => setChecklist(c => ({ ...c, [item]: e.target.checked }))}
                          className="rounded text-blue-600" />
                        <span className={`text-sm ${done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{item}</span>
                      </label>
                    ))}
                  </div>
                </FIELD>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FIELD label="Maintenance Date">
                  <INPUT type="date" value={form.maintenanceDate} onChange={e => setForm(f => ({ ...f, maintenanceDate: e.target.value }))} />
                </FIELD>
                <FIELD label="Next Maintenance">
                  <INPUT type="date" value={form.nextMaintenance} onChange={e => setForm(f => ({ ...f, nextMaintenance: e.target.value }))} />
                </FIELD>
                <FIELD label="Technician">
                  <SELECT value={form.technician} onChange={e => setForm(f => ({ ...f, technician: e.target.value }))}>
                    {TECHNICIANS.map(t => <option key={t}>{t}</option>)}
                    <option value="Other">Other</option>
                  </SELECT>
                </FIELD>
                <FIELD label="Status">
                  <SELECT value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {MAINTENANCE_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </SELECT>
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
