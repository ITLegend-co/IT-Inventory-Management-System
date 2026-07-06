import { useState, useEffect } from 'react';
import { ref, onValue, push, update, remove } from 'firebase/database';
import { db } from '../lib/firebase';
import { StockItem } from '../lib/types';
import { formatDate, formatCurrency } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Search, AlertTriangle, Pencil, Trash2, PackagePlus } from 'lucide-react';
import * as XLSX from 'xlsx';

const STOCK_CATEGORIES = ['Toner', 'Ink', 'UPS Battery', 'LAN Cable', 'HDMI Cable', 'Mouse', 'Keyboard', 'Power Adapter', 'Printer Paper', 'Crimping Head', 'RJ45 Connector', 'USB Drive', 'Optical Drive', 'Fan', 'RAM', 'SSD', 'Other'];
const LOCATIONS_STORE = ['KK Store', 'KP Store', 'PH Store', 'KK Office', 'KP Office', 'PH Office'];

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
  itemName: '', category: 'Toner', quantity: 1, minimumStock: 2,
  location: 'KK Store', supplier: '', lastRestockDate: new Date().toISOString().slice(0, 10),
  cost: 0, remarks: '',
};

export default function Stock() {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLow, setFilterLow] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showRestockId, setShowRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(1);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'it_staff';

  useEffect(() => {
    const unsub = onValue(ref(db, 'stock'), snap => {
      setItems(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = items
    .filter(i => {
      const q = search.toLowerCase();
      return (!q || i.itemName?.toLowerCase().includes(q) || i.category?.toLowerCase().includes(q) || i.supplier?.toLowerCase().includes(q)) &&
        (!filterLow || i.quantity <= i.minimumStock);
    })
    .sort((a, b) => a.itemName.localeCompare(b.itemName));

  const lowCount = items.filter(i => i.quantity <= i.minimumStock).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...form, createdAt: new Date().toISOString(), createdBy: currentUser?.name || '' };
      if (editId) {
        await update(ref(db, `stock/${editId}`), form);
      } else {
        await push(ref(db, 'stock'), data);
      }
      setShowModal(false);
      setEditId(null);
      setForm({ ...emptyForm });
    } finally {
      setSaving(false);
    }
  }

  function openEdit(item: StockItem) {
    setEditId(item.id);
    setForm({ itemName: item.itemName, category: item.category, quantity: item.quantity, minimumStock: item.minimumStock, location: item.location, supplier: item.supplier || '', lastRestockDate: item.lastRestockDate || '', cost: item.cost || 0, remarks: item.remarks || '' });
    setShowModal(true);
  }

  async function handleRestock() {
    if (!showRestockId) return;
    const item = items.find(i => i.id === showRestockId);
    if (!item) return;
    await update(ref(db, `stock/${showRestockId}`), {
      quantity: item.quantity + restockQty,
      lastRestockDate: new Date().toISOString().slice(0, 10),
    });
    setShowRestockId(null);
    setRestockQty(1);
  }

  function exportExcel() {
    const data = filtered.map(i => ({ 'Item': i.itemName, 'Category': i.category, 'Qty': i.quantity, 'Min Stock': i.minimumStock, 'Location': i.location, 'Supplier': i.supplier, 'Last Restock': i.lastRestockDate, 'Cost (RM)': i.cost }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, `MT_Stock_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-slate-800 dark:text-white">Stock / Consumables</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{items.length} items · {lowCount > 0 ? <span className="text-red-500">{lowCount} low stock</span> : 'all stocked'}</p>
        </div>
        {canEdit && (
          <button onClick={() => { setShowModal(true); setEditId(null); setForm({ ...emptyForm }); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        )}
      </div>

      {lowCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-400">{lowCount} item(s) are at or below minimum stock level</span>
          <button onClick={() => setFilterLow(true)} className="ml-auto text-xs text-red-600 hover:underline">View low items</button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <button onClick={() => setFilterLow(f => !f)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${filterLow ? 'bg-red-600 border-red-600 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <AlertTriangle className="w-4 h-4" /> Low Stock Only
          </button>
          <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
            Export
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                {['Item', 'Category', 'Stock', 'Location', 'Supplier', 'Last Restock', 'Cost', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">No stock items found</td></tr>
              ) : filtered.map(item => {
                const isLow = item.quantity <= item.minimumStock;
                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.itemName}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.category}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${isLow ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{item.quantity}</span>
                        <span className="text-xs text-slate-400">/ min {item.minimumStock}</span>
                        {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                      <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-1">
                        <div className={`h-full rounded-full ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((item.quantity / Math.max(item.minimumStock * 2, 1)) * 100, 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.location}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.supplier || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDate(item.lastRestockDate)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.cost ? formatCurrency(item.cost) : '—'}</td>
                    <td className="px-4 py-3">
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setShowRestockId(item.id); setRestockQty(1); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded" title="Restock"><PackagePlus className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                          {currentUser?.role === 'admin' && <button onClick={() => setDeleteId(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-slate-800 dark:text-white font-semibold">{editId ? 'Edit Item' : 'Add Stock Item'}</h3>
              <button onClick={() => { setShowModal(false); setEditId(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
              <FIELD label="Item Name *"><INPUT required value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} placeholder="Canon 071H Toner" /></FIELD>
              <div className="grid grid-cols-2 gap-3">
                <FIELD label="Category"><SELECT value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{STOCK_CATEGORIES.map(c => <option key={c}>{c}</option>)}</SELECT></FIELD>
                <FIELD label="Location"><SELECT value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>{LOCATIONS_STORE.map(l => <option key={l}>{l}</option>)}</SELECT></FIELD>
                <FIELD label="Quantity"><INPUT type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} /></FIELD>
                <FIELD label="Minimum Stock"><INPUT type="number" min="0" value={form.minimumStock} onChange={e => setForm(f => ({ ...f, minimumStock: parseInt(e.target.value) || 0 }))} /></FIELD>
                <FIELD label="Supplier"><INPUT value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="PC Image" /></FIELD>
                <FIELD label="Last Restock"><INPUT type="date" value={form.lastRestockDate} onChange={e => setForm(f => ({ ...f, lastRestockDate: e.target.value }))} /></FIELD>
                <FIELD label="Unit Cost (RM)"><INPUT type="number" min="0" step="0.01" value={form.cost || ''} onChange={e => setForm(f => ({ ...f, cost: parseFloat(e.target.value) || 0 }))} placeholder="0.00" /></FIELD>
              </div>
              <FIELD label="Remarks"><textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500" /></FIELD>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditId(null); }} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock modal */}
      {showRestockId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="text-slate-800 dark:text-white font-semibold mb-4">Restock Item</h3>
            <p className="text-sm text-slate-500 mb-4">{items.find(i => i.id === showRestockId)?.itemName}</p>
            <FIELD label="Add Quantity"><INPUT type="number" min="1" value={restockQty} onChange={e => setRestockQty(parseInt(e.target.value) || 1)} /></FIELD>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowRestockId(null)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
              <button onClick={handleRestock} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm">Restock</button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-slate-800 dark:text-white font-semibold mb-2">Delete Item?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
              <button onClick={async () => { await remove(ref(db, `stock/${deleteId}`)); setDeleteId(null); }} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
