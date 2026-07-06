import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ref, get, push, set, onValue, query, orderByChild, equalTo, update } from 'firebase/database';
import { db } from '../../lib/firebase';
import { Asset, AssetCategory, AssetLocation } from '../../lib/types';
import { generateAssetId, ASSET_CATEGORIES, ASSET_STATUSES, LOCATIONS, DEPARTMENTS, CONDITIONS } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

const FIELD = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
  <div>
    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const INPUT = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 ${props.className || ''}`} />
);

const SELECT = (props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select {...props} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
);

export default function AssetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [form, setForm] = useState<Partial<Asset>>({
    category: 'Laptop',
    location: 'KK',
    status: 'Available',
    cost: 0,
    purchaseDate: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    const unsub = onValue(ref(db, 'assets'), snap => {
      if (snap.exists()) {
        const all: Asset[] = Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v }));
        setExistingIds(all.map(a => a.assetId));
        if (isEdit) {
          const asset = all.find(a => a.id === id);
          if (asset) setForm(asset);
        }
      }
    });
    return unsub;
  }, [id]);

  function set_(key: keyof Asset, value: any) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      // Auto-generate asset ID when category or location changes for new assets
      if (!isEdit && (key === 'category' || key === 'location')) {
        const cat = (key === 'category' ? value : prev.category) as AssetCategory;
        const loc = (key === 'location' ? value : prev.location) as AssetLocation;
        if (cat && loc) {
          next.assetId = generateAssetId(cat, loc, existingIds);
        }
      }
      return next;
    });
  }

  useEffect(() => {
    if (!isEdit && form.category && form.location) {
      setForm(prev => ({ ...prev, assetId: generateAssetId(form.category as AssetCategory, form.location as AssetLocation, existingIds) }));
    }
  }, [existingIds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const data = {
        ...form,
        updatedAt: now,
        updatedBy: currentUser?.name || '',
        ...(isEdit ? {} : { createdAt: now, createdBy: currentUser?.name || '' }),
      };

      let assetDbId = id;
      if (isEdit) {
        await set(ref(db, `assets/${id}`), data);
      } else {
        const newRef = await push(ref(db, 'assets'), data);
        assetDbId = newRef.key!;
      }

      // Sync assignment record when status is Assigned
      if (form.status === 'Assigned' && form.assignedUser) {
        // Close any existing active assignment for this asset
        const existingSnap = await get(ref(db, 'assignments'));
        if (existingSnap.exists()) {
          const entries = Object.entries(existingSnap.val()) as [string, any][];
          for (const [aId, aVal] of entries) {
            if (aVal.assetId === assetDbId && aVal.isActive) {
              // Update name/department if they changed
              await update(ref(db, `assignments/${aId}`), {
                assignedTo: form.assignedUser,
                department: form.department || aVal.department || '',
              });
              break;
            }
          }
          // If no active assignment exists for this asset, create one
          const hasActive = entries.some(([, v]) => v.assetId === assetDbId && v.isActive);
          if (!hasActive) {
            await push(ref(db, 'assignments'), {
              assetId: assetDbId,
              assetName: `${form.brand || ''} ${form.model || ''}`.trim(),
              assetCategory: form.category || '',
              assignedTo: form.assignedUser,
              department: form.department || '',
              location: form.location || 'KK',
              dateIssued: form.purchaseDate || now.slice(0, 10),
              conditionIssued: 'Good',
              returnedDate: '',
              conditionReturned: '',
              handoverFormUrl: '',
              notes: form.remarks || '',
              isActive: true,
              createdAt: now,
              createdBy: currentUser?.name || '',
            });
          }
        } else {
          // No assignments at all — create fresh
          await push(ref(db, 'assignments'), {
            assetId: assetDbId,
            assetName: `${form.brand || ''} ${form.model || ''}`.trim(),
            assetCategory: form.category || '',
            assignedTo: form.assignedUser,
            department: form.department || '',
            location: form.location || 'KK',
            dateIssued: form.purchaseDate || now.slice(0, 10),
            conditionIssued: 'Good',
            returnedDate: '',
            conditionReturned: '',
            handoverFormUrl: '',
            notes: form.remarks || '',
            isActive: true,
            createdAt: now,
            createdBy: currentUser?.name || '',
          });
        }
      } else if (isEdit && form.status !== 'Assigned') {
        // If status changed away from Assigned, mark any active assignment as returned
        const existingSnap = await get(ref(db, 'assignments'));
        if (existingSnap.exists()) {
          const entries = Object.entries(existingSnap.val()) as [string, any][];
          for (const [aId, aVal] of entries) {
            if (aVal.assetId === assetDbId && aVal.isActive) {
              await update(ref(db, `assignments/${aId}`), {
                isActive: false,
                returnedDate: now.slice(0, 10),
                conditionReturned: 'Good',
              });
            }
          }
        }
      }

      navigate('/assets');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-slate-800 dark:text-white">{isEdit ? 'Edit Asset' : 'Add New Asset'}</h1>
          {form.assetId && <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{form.assetId}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identification */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-slate-700 dark:text-slate-300 mb-4">Identification</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FIELD label="Asset ID" required>
              <INPUT value={form.assetId || ''} onChange={e => set_('assetId', e.target.value)} placeholder="MT-KK-LTP-001" required />
            </FIELD>
            <FIELD label="Category" required>
              <SELECT value={form.category || ''} onChange={e => set_('category', e.target.value as AssetCategory)} required>
                {ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </SELECT>
            </FIELD>
            <FIELD label="Location" required>
              <SELECT value={form.location || ''} onChange={e => set_('location', e.target.value as AssetLocation)} required>
                {LOCATIONS.map(l => <option key={l} value={l}>{l} — {l === 'KK' ? 'Kota Kinabalu' : l === 'KP' ? 'Kinabalu Park' : 'Pendant Hut'}</option>)}
              </SELECT>
            </FIELD>
            <FIELD label="Brand" required>
              <INPUT value={form.brand || ''} onChange={e => set_('brand', e.target.value)} placeholder="Dell, HP, Canon…" required />
            </FIELD>
            <FIELD label="Model" required>
              <INPUT value={form.model || ''} onChange={e => set_('model', e.target.value)} placeholder="Latitude 5520" required />
            </FIELD>
            <FIELD label="Serial Number">
              <INPUT value={form.serialNumber || ''} onChange={e => set_('serialNumber', e.target.value)} placeholder="SN-XXXXXXXX" />
            </FIELD>
          </div>
        </div>

        {/* Assignment */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-slate-700 dark:text-slate-300 mb-4">Assignment & Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FIELD label="Status" required>
              <SELECT value={form.status || 'Available'} onChange={e => set_('status', e.target.value)} required>
                {ASSET_STATUSES.map(s => <option key={s}>{s}</option>)}
              </SELECT>
            </FIELD>
            <FIELD label="Department">
              <SELECT value={form.department || ''} onChange={e => set_('department', e.target.value)}>
                <option value="">— Select —</option>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </SELECT>
            </FIELD>
            <FIELD label="Assigned User">
              <INPUT value={form.assignedUser || ''} onChange={e => set_('assignedUser', e.target.value)} placeholder="Full name" />
            </FIELD>
          </div>
        </div>

        {/* Purchase info */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-slate-700 dark:text-slate-300 mb-4">Purchase & Warranty</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FIELD label="Purchase Date">
              <INPUT type="date" value={form.purchaseDate || ''} onChange={e => set_('purchaseDate', e.target.value)} />
            </FIELD>
            <FIELD label="Warranty Expiry">
              <INPUT type="date" value={form.warrantyExpiry || ''} onChange={e => set_('warrantyExpiry', e.target.value)} />
            </FIELD>
            <FIELD label="Supplier">
              <INPUT value={form.supplier || ''} onChange={e => set_('supplier', e.target.value)} placeholder="PC Image, Evopoint…" />
            </FIELD>
            <FIELD label="Cost (RM)">
              <INPUT type="number" min="0" step="0.01" value={form.cost || ''} onChange={e => set_('cost', parseFloat(e.target.value) || 0)} placeholder="0.00" />
            </FIELD>
          </div>
        </div>

        {/* Remarks */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <FIELD label="Remarks">
            <textarea
              value={form.remarks || ''} onChange={e => set_('remarks', e.target.value)}
              rows={3} placeholder="Additional notes…"
              className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </FIELD>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="px-5 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Asset')}
          </button>
        </div>
      </form>
    </div>
  );
}
