import { useState, useEffect } from 'react';
import { ref, onValue, push, set, update } from 'firebase/database';
import { db } from '../lib/firebase';
import { Asset, Assignment } from '../lib/types';
import { formatDate, LOCATIONS, DEPARTMENTS, CONDITIONS } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Search, ArrowLeft, ArrowRight } from 'lucide-react';

const INPUT = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
);
const SELECT = (p: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select {...p} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
);
const FIELD = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">{label}</label>{children}</div>
);

interface AssignForm {
  assetId: string; assignedTo: string; department: string; location: string;
  dateIssued: string; conditionIssued: string; notes: string;
}

interface ReturnForm {
  returnedDate: string; conditionReturned: string; notes: string;
}

export default function Assignments() {
  const { currentUser } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showActive, setShowActive] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [returnId, setReturnId] = useState<string | null>(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assignForm, setAssignForm] = useState<AssignForm>({
    assetId: '', assignedTo: '', department: '', location: 'KK',
    dateIssued: new Date().toISOString().slice(0, 10), conditionIssued: 'Good', notes: '',
  });
  const [returnForm, setReturnForm] = useState<ReturnForm>({
    returnedDate: new Date().toISOString().slice(0, 10), conditionReturned: 'Good', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'it_staff';

  useEffect(() => {
    const u1 = onValue(ref(db, 'assignments'), snap => {
      setAssignments(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
      setLoading(false);
    });
    const u2 = onValue(ref(db, 'assets'), snap => {
      setAssets(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    return () => { u1(); u2(); };
  }, []);

  const availableAssets = assets.filter(a => a.status === 'Available' || a.status === 'Borrowed');
  const filteredAssets = availableAssets.filter(a => {
    const q = assetSearch.toLowerCase();
    return !q || a.assetId?.toLowerCase().includes(q) || a.brand?.toLowerCase().includes(q) || a.model?.toLowerCase().includes(q);
  });

  const filtered = assignments.filter(a => {
    const q = search.toLowerCase();
    return (a.isActive === showActive) &&
      (!q || a.assignedTo?.toLowerCase().includes(q) || a.assetId?.toLowerCase().includes(q) ||
        a.department?.toLowerCase().includes(q) || a.assetName?.toLowerCase().includes(q));
  });

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAsset) return;
    setSaving(true);
    try {
      await push(ref(db, 'assignments'), {
        ...assignForm,
        assetId: selectedAsset.id,
        assetName: `${selectedAsset.brand} ${selectedAsset.model}`,
        assetCategory: selectedAsset.category,
        isActive: true,
        returnedDate: '',
        conditionReturned: '',
        handoverFormUrl: '',
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || '',
      });
      // Update asset status
      await update(ref(db, `assets/${selectedAsset.id}`), { status: 'Assigned', assignedUser: assignForm.assignedTo, department: assignForm.department });
      setShowAssignModal(false);
      setSelectedAsset(null);
      setAssetSearch('');
      setAssignForm({ assetId: '', assignedTo: '', department: '', location: 'KK', dateIssued: new Date().toISOString().slice(0, 10), conditionIssued: 'Good', notes: '' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReturn(assignmentId: string) {
    setSaving(true);
    try {
      const assignment = assignments.find(a => a.id === assignmentId);
      if (!assignment) return;
      await update(ref(db, `assignments/${assignmentId}`), { ...returnForm, isActive: false });
      // Find the original asset by assetId (which is the Firebase key)
      await update(ref(db, `assets/${assignment.assetId}`), { status: 'Available', assignedUser: '' });
      setReturnId(null);
      setReturnForm({ returnedDate: new Date().toISOString().slice(0, 10), conditionReturned: 'Good', notes: '' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-slate-800 dark:text-white">Asset Assignments</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{assignments.filter(a => a.isActive).length} active assignments</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowAssignModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
            <Plus className="w-4 h-4" /> New Assignment
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, asset, department…"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
            <button onClick={() => setShowActive(true)} className={`px-4 py-2 text-sm ${showActive ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Active</button>
            <button onClick={() => setShowActive(false)} className={`px-4 py-2 text-sm ${!showActive ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Returned</button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                {['Asset', 'Assigned To', 'Department', 'Location', 'Date Issued', 'Condition', showActive ? 'Actions' : 'Returned'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">No records found</td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.assetName}</div>
                    <div className="text-xs text-slate-400 font-mono">{a.assetId}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{a.assignedTo}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{a.department}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{a.location}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDate(a.dateIssued)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{a.conditionIssued}</td>
                  <td className="px-4 py-3">
                    {showActive && canEdit ? (
                      <button onClick={() => setReturnId(a.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 rounded-lg transition-colors">
                        <ArrowLeft className="w-3 h-3" /> Return
                      </button>
                    ) : (
                      <div>
                        <div className="text-sm text-slate-600 dark:text-slate-300">{formatDate(a.returnedDate)}</div>
                        <div className="text-xs text-slate-400">{a.conditionReturned}</div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-slate-800 dark:text-white font-semibold">New Assignment</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAssign} className="overflow-y-auto p-5 space-y-4">
              <FIELD label="Select Asset">
                <input value={assetSearch} onChange={e => { setAssetSearch(e.target.value); setSelectedAsset(null); }}
                  placeholder="Search available assets…"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                {assetSearch && !selectedAsset && (
                  <div className="mt-1 border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    {filteredAssets.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-400">No available assets found</div>
                    ) : filteredAssets.map(a => (
                      <button key={a.id} type="button" onClick={() => { setSelectedAsset(a); setAssetSearch(`${a.assetId} — ${a.brand} ${a.model}`); }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                        <div className="text-sm font-mono text-slate-700 dark:text-slate-200">{a.assetId}</div>
                        <div className="text-xs text-slate-400">{a.brand} {a.model}</div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedAsset && <div className="mt-1 text-xs text-green-600 dark:text-green-400">✓ {selectedAsset.assetId} selected</div>}
              </FIELD>
              <div className="grid grid-cols-2 gap-3">
                <FIELD label="Assign To *">
                  <INPUT required value={assignForm.assignedTo} onChange={e => setAssignForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Full name" />
                </FIELD>
                <FIELD label="Department">
                  <SELECT value={assignForm.department} onChange={e => setAssignForm(f => ({ ...f, department: e.target.value }))}>
                    <option value="">—</option>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </SELECT>
                </FIELD>
                <FIELD label="Location">
                  <SELECT value={assignForm.location} onChange={e => setAssignForm(f => ({ ...f, location: e.target.value }))}>
                    {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                  </SELECT>
                </FIELD>
                <FIELD label="Date Issued">
                  <INPUT type="date" value={assignForm.dateIssued} onChange={e => setAssignForm(f => ({ ...f, dateIssued: e.target.value }))} />
                </FIELD>
                <FIELD label="Condition">
                  <SELECT value={assignForm.conditionIssued} onChange={e => setAssignForm(f => ({ ...f, conditionIssued: e.target.value }))}>
                    {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                  </SELECT>
                </FIELD>
              </div>
              <FIELD label="Notes">
                <textarea value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </FIELD>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAssignModal(false)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving || !selectedAsset} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm flex items-center justify-center gap-2">
                  <ArrowRight className="w-4 h-4" /> Assign Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return modal */}
      {returnId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 dark:text-white font-semibold">Return Asset</h3>
              <button onClick={() => setReturnId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <FIELD label="Return Date">
                <INPUT type="date" value={returnForm.returnedDate} onChange={e => setReturnForm(f => ({ ...f, returnedDate: e.target.value }))} />
              </FIELD>
              <FIELD label="Condition on Return">
                <SELECT value={returnForm.conditionReturned} onChange={e => setReturnForm(f => ({ ...f, conditionReturned: e.target.value }))}>
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </SELECT>
              </FIELD>
              <FIELD label="Notes">
                <textarea value={returnForm.notes} onChange={e => setReturnForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </FIELD>
              <div className="flex gap-3">
                <button onClick={() => setReturnId(null)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                <button onClick={() => handleReturn(returnId)} disabled={saving} className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm">Confirm Return</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
