import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ref, onValue, remove, push, set } from 'firebase/database';
import { db } from '../../lib/firebase';
import { Asset } from '../../lib/types';
import { formatDate, statusColor, ASSET_CATEGORIES, ASSET_STATUSES, LOCATIONS, generateAssetId } from '../../lib/utils';
import { Search, Plus, Filter, Download, QrCode, Eye, Pencil, Trash2, ChevronUp, ChevronDown, Upload, FileSpreadsheet, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';

export default function AssetList() {
  const { currentUser } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterLocation, setFilterLocation] = useState('');
  const [sortKey, setSortKey] = useState<keyof Asset>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'it_staff';

  useEffect(() => {
    const unsub = onValue(ref(db, 'assets'), snap => {
      setAssets(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
      setLoading(false);
    });
    return unsub;
  }, []);

  function toggleSort(key: keyof Asset) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const filtered = assets
    .filter(a => {
      const q = search.toLowerCase();
      const matchSearch = !q || a.assetId?.toLowerCase().includes(q) || a.serialNumber?.toLowerCase().includes(q) ||
        a.assignedUser?.toLowerCase().includes(q) || a.department?.toLowerCase().includes(q) ||
        a.brand?.toLowerCase().includes(q) || a.model?.toLowerCase().includes(q);
      return matchSearch &&
        (!filterCategory || a.category === filterCategory) &&
        (!filterStatus || a.status === filterStatus) &&
        (!filterLocation || a.location === filterLocation);
    })
    .sort((a, b) => {
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  function exportExcel() {
    const data = filtered.map(a => ({
      'Asset ID': a.assetId, 'Category': a.category, 'Brand': a.brand, 'Model': a.model,
      'Serial No': a.serialNumber, 'Location': a.location, 'Department': a.department,
      'Assigned To': a.assignedUser, 'Status': a.status, 'Purchase Date': a.purchaseDate,
      'Warranty Expiry': a.warrantyExpiry, 'Supplier': a.supplier, 'Cost (RM)': a.cost, 'Remarks': a.remarks,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    XLSX.writeFile(wb, `MT_Assets_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function handleDelete(id: string) {
    await remove(ref(db, `assets/${id}`));
    setDeleteId(null);
  }

  function downloadTemplate() {
    const headers = [
      ['Category', 'Brand', 'Model', 'Serial No', 'Location', 'Department', 'Assigned To',
       'Status', 'Purchase Date (YYYY-MM-DD)', 'Warranty Expiry (YYYY-MM-DD)', 'Supplier', 'Cost (RM)', 'Condition', 'Remarks']
    ];
    const example = [
      ['Laptop', 'Dell', 'Latitude 5540', 'SN-12345', 'KK', 'IT', 'John Doe',
       'Assigned', '2024-01-15', '2027-01-15', 'Dell Malaysia', '4500', 'Good', '']
    ];
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
    ws['!cols'] = headers[0].map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asset Import Template');
    XLSX.writeFile(wb, 'MT_Asset_Import_Template.xlsx');
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const errors: string[] = [];
      const parsed = rows.map((row, i) => {
        const n = i + 2;
        const category = row['Category']?.trim();
        const location = row['Location']?.trim();
        const status = row['Status']?.trim() || 'Available';
        if (!category) errors.push(`Row ${n}: Category is required`);
        if (!location) errors.push(`Row ${n}: Location is required`);
        if (category && !ASSET_CATEGORIES.includes(category as any)) errors.push(`Row ${n}: Invalid category "${category}"`);
        if (location && !LOCATIONS.includes(location as any)) errors.push(`Row ${n}: Invalid location "${location}"`);
        if (status && !ASSET_STATUSES.includes(status as any)) errors.push(`Row ${n}: Invalid status "${status}"`);
        return {
          category, location, status,
          brand: row['Brand']?.trim() || '',
          model: row['Model']?.trim() || '',
          serialNumber: row['Serial No']?.trim() || '',
          department: row['Department']?.trim() || '',
          assignedUser: row['Assigned To']?.trim() || '',
          purchaseDate: row['Purchase Date (YYYY-MM-DD)']?.toString().trim() || '',
          warrantyExpiry: row['Warranty Expiry (YYYY-MM-DD)']?.toString().trim() || '',
          supplier: row['Supplier']?.trim() || '',
          cost: parseFloat(row['Cost (RM)']) || 0,
          condition: row['Condition']?.trim() || 'Good',
          remarks: row['Remarks']?.trim() || '',
        };
      });
      setImportErrors(errors);
      setImportRows(parsed);
      setImportDone(false);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  }

  async function handleImportSubmit() {
    if (importErrors.length > 0 || importRows.length === 0) return;
    setImporting(true);
    const currentIds = assets.map(a => a.assetId);
    const addedIds: string[] = [...currentIds];
    for (const row of importRows) {
      const assetId = generateAssetId(row.category, row.location, addedIds);
      addedIds.push(assetId);
      const newRef = push(ref(db, 'assets'));
      await set(newRef, {
        ...row,
        assetId,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.uid || '',
      });
    }
    setImporting(false);
    setImportDone(true);
    setImportRows([]);
  }

  const SortIcon = ({ k }: { k: keyof Asset }) => sortKey === k
    ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
    : <ChevronDown className="w-3 h-3 opacity-30" />;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-slate-800 dark:text-white">Asset Inventory</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{assets.length} total assets · {filtered.length} shown</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowImport(true); setImportRows([]); setImportErrors([]); setImportDone(false); }}
              className="flex items-center gap-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg text-sm transition-colors">
              <Upload className="w-4 h-4" /> Bulk Import
            </button>
            <Link to="/assets/add" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
              <Plus className="w-4 h-4" /> Add Asset
            </Link>
          </div>
        )}
      </div>

      {/* Search + filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID, serial, user, department…"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button onClick={() => setShowFilters(f => !f)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${showFilters ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <Filter className="w-4 h-4" /> Filters
          </button>
          <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">All Categories</option>
              {ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">All Statuses</option>
              {ASSET_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">All Locations</option>
              {LOCATIONS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                {[
                  { key: 'assetId', label: 'Asset ID' }, { key: 'category', label: 'Category' },
                  { key: 'brand', label: 'Brand / Model' }, { key: 'location', label: 'Location' },
                  { key: 'assignedUser', label: 'Assigned To' }, { key: 'status', label: 'Status' },
                  { key: 'warrantyExpiry', label: 'Warranty' },
                ].map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key as keyof Asset)}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none whitespace-nowrap">
                    <div className="flex items-center gap-1">{col.label} <SortIcon k={col.key as keyof Asset} /></div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">No assets found</td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/assets/${a.id}`} className="text-blue-600 dark:text-blue-400 text-sm font-mono font-medium hover:underline">{a.assetId}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{a.category}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-700 dark:text-slate-200">{a.brand}</div>
                    <div className="text-xs text-slate-400">{a.model}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{a.location}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-700 dark:text-slate-200">{a.assignedUser || '-'}</div>
                    <div className="text-xs text-slate-400">{a.department}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(a.status)}`}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatDate(a.warrantyExpiry)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/assets/${a.id}`} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></Link>
                      <Link to={`/assets/${a.id}`} state={{ tab: 'qr' }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors" title="QR"><QrCode className="w-3.5 h-3.5" /></Link>
                      {canEdit && <Link to={`/assets/${a.id}/edit`} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></Link>}
                      {currentUser?.role === 'admin' && <button onClick={() => setDeleteId(a.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <h3 className="text-slate-800 dark:text-white font-semibold">Bulk Import Assets</h3>
              </div>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {importDone ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <CheckCircle className="w-12 h-12 text-emerald-500" />
                  <p className="text-slate-700 dark:text-slate-200 font-medium">Import complete!</p>
                  <p className="text-slate-500 text-sm">Assets have been added to the inventory.</p>
                  <button onClick={() => setShowImport(false)} className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Close</button>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Step 1 — Download the template</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Fill in one row per asset. Do not change the column headers.</p>
                    <button onClick={downloadTemplate} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors">
                      <Download className="w-4 h-4 text-emerald-600" /> Download Template (.xlsx)
                    </button>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Step 2 — Upload filled template</p>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-dashed border-blue-400 rounded-lg text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors w-full justify-center">
                      <Upload className="w-4 h-4" /> Choose File (.xlsx / .csv)
                    </button>
                  </div>

                  {importRows.length > 0 && importErrors.length === 0 && (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-sm text-emerald-700 dark:text-emerald-400">{importRows.length} row{importRows.length !== 1 ? 's' : ''} ready to import</span>
                    </div>
                  )}

                  {importErrors.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 space-y-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span className="text-sm font-medium text-red-700 dark:text-red-400">Please fix these errors:</span>
                      </div>
                      {importErrors.map((e, i) => <p key={i} className="text-xs text-red-600 dark:text-red-400 pl-6">{e}</p>)}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setShowImport(false)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
                    <button onClick={handleImportSubmit} disabled={importRows.length === 0 || importErrors.length > 0 || importing}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm flex items-center justify-center gap-2">
                      {importing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {importing ? 'Importing…' : `Import${importRows.length > 0 ? ` ${importRows.length} Assets` : ''}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-slate-800 dark:text-white font-semibold mb-2">Delete Asset?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700">Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
