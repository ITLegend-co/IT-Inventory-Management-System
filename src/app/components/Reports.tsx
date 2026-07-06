import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { Asset, Maintenance, Repair, StockItem } from '../lib/types';
import { formatDate, formatCurrency, daysUntil } from '../lib/utils';
import { Download, BarChart2, Package, Wrench, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Reports() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<'assets' | 'maintenance' | 'repairs' | 'warranty'>('assets');

  useEffect(() => {
    const u1 = onValue(ref(db, 'assets'), snap => { setAssets(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []); setLoading(false); });
    const u2 = onValue(ref(db, 'maintenance'), snap => { setMaintenance(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []); });
    const u3 = onValue(ref(db, 'repairs'), snap => { setRepairs(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []); });
    const u4 = onValue(ref(db, 'stock'), snap => { setStock(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []); });
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  assets.forEach(a => { categoryMap[a.category] = (categoryMap[a.category] || 0) + 1; });
  const categoryData = Object.entries(categoryMap).filter(([name]) => !!name).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  // Location breakdown
  const locationMap: Record<string, Record<string, number>> = {};
  assets.forEach(a => {
    if (!locationMap[a.location]) locationMap[a.location] = {};
    locationMap[a.location][a.status] = (locationMap[a.location][a.status] || 0) + 1;
  });

  // Department cost summary
  const deptCostMap: Record<string, number> = {};
  assets.forEach(a => {
    if (a.department) deptCostMap[a.department] = (deptCostMap[a.department] || 0) + (a.cost || 0);
  });
  const deptCostData = Object.entries(deptCostMap).filter(([name]) => !!name).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  // Warranty expiring within 90 days
  const warrantyAssets = assets.filter(a => { const d = daysUntil(a.warrantyExpiry); return d >= 0 && d <= 90; }).sort((a, b) => daysUntil(a.warrantyExpiry) - daysUntil(b.warrantyExpiry));

  // Total asset value
  const totalValue = assets.reduce((sum, a) => sum + (a.cost || 0), 0);

  function exportFullReport() {
    const wb = XLSX.utils.book_new();

    // Assets sheet
    const assetData = assets.map(a => ({
      'Asset ID': a.assetId, 'Category': a.category, 'Brand': a.brand, 'Model': a.model,
      'Serial No': a.serialNumber, 'Location': a.location, 'Department': a.department,
      'Assigned To': a.assignedUser, 'Status': a.status, 'Purchase Date': a.purchaseDate,
      'Warranty Expiry': a.warrantyExpiry, 'Supplier': a.supplier, 'Cost (RM)': a.cost,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assetData), 'Assets');

    // Maintenance sheet
    const maintData = maintenance.map(m => ({
      'Asset ID': m.assetId, 'Asset Name': m.assetName, 'Date': m.maintenanceDate,
      'Technician': m.technician, 'Status': m.status, 'Next PPM': m.nextMaintenance, 'Remarks': m.remarks,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(maintData), 'Maintenance');

    // Repairs sheet
    const repairData = repairs.map(r => ({
      'Asset Name': r.assetName, 'Date': r.date, 'Issue': r.issue,
      'Action': r.action, 'Status': r.status, 'Technician': r.technician, 'Cost (RM)': r.cost,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(repairData), 'Repairs');

    // Stock sheet
    const stockData = stock.map(s => ({
      'Item': s.itemName, 'Category': s.category, 'Qty': s.quantity,
      'Min Stock': s.minimumStock, 'Location': s.location, 'Supplier': s.supplier,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockData), 'Stock');

    XLSX.writeFile(wb, `MT_IT_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportWarrantyReport() {
    const data = warrantyAssets.map(a => ({
      'Asset ID': a.assetId, 'Brand': a.brand, 'Model': a.model, 'Category': a.category,
      'Location': a.location, 'Department': a.department, 'Assigned To': a.assignedUser,
      'Warranty Expiry': a.warrantyExpiry, 'Days Remaining': daysUntil(a.warrantyExpiry),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Warranty');
    XLSX.writeFile(wb, `MT_Warranty_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;

  const tabs = [
    { key: 'assets', label: 'Asset Summary', icon: <Package className="w-4 h-4" /> },
    { key: 'maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" /> },
    { key: 'repairs', label: 'Repairs', icon: <BarChart2 className="w-4 h-4" /> },
    { key: 'warranty', label: 'Warranty', icon: <AlertTriangle className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-slate-800 dark:text-white">Reports</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Export and analyze IT asset data</p>
        </div>
        <button onClick={exportFullReport} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm">
          <Download className="w-4 h-4" /> Full Report (Excel)
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Assets', value: assets.length, color: 'text-blue-600' },
          { label: 'Total Asset Value', value: formatCurrency(totalValue), color: 'text-emerald-600' },
          { label: 'Repairs This Year', value: repairs.filter(r => r.date?.startsWith('2026')).length, color: 'text-amber-600' },
          { label: 'PPM Records', value: maintenance.length, color: 'text-indigo-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveReport(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors ${activeReport === t.key ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeReport === 'assets' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Assets by Category</h3>
              {categoryData.length > 0 ? (
                <div className="space-y-2.5 mt-2">
                  {categoryData.map((item, i) => {
                    const max = categoryData[0].value;
                    const pct = Math.round((item.value / max) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 w-28 shrink-0 truncate text-right">{item.name}</span>
                        <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                          <div className="h-full bg-blue-500 rounded" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-300 w-6 text-right">{item.value}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data</div>
              )}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Asset Value by Department (RM)</h3>
              {deptCostData.length > 0 ? (
                <div className="flex items-end gap-3 h-48 mt-2">
                  {deptCostData.map((item, i) => {
                    const max = deptCostData[0].value;
                    const pct = Math.round((item.value / max) * 100);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{(item.value / 1000).toFixed(0)}K</span>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-t overflow-hidden flex flex-col justify-end" style={{ height: '140px' }}>
                          <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-full text-center">{item.name}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No data</div>
              )}
            </div>
          </div>

          {/* Location breakdown table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Asset Distribution by Location</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700">
                    <th className="text-left py-2 text-xs font-semibold text-slate-500">Location</th>
                    {['Available', 'Assigned', 'Under Repair', 'Missing', 'Disposed', 'Total'].map(h => (
                      <th key={h} className="text-right py-2 text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {['KK', 'KP', 'PH'].map(loc => {
                    const locAssets = assets.filter(a => a.location === loc);
                    return (
                      <tr key={loc} className="border-b border-slate-50 dark:border-slate-700/30">
                        <td className="py-2.5 font-medium text-slate-700 dark:text-slate-200">{loc === 'KK' ? 'Kota Kinabalu' : loc === 'KP' ? 'Kinabalu Park' : 'Pendant Hut'}</td>
                        {['Available', 'Assigned', 'Under Repair', 'Missing', 'Disposed'].map(status => (
                          <td key={status} className="py-2.5 text-right text-slate-600 dark:text-slate-300">{locAssets.filter(a => a.status === status).length}</td>
                        ))}
                        <td className="py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200">{locAssets.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeReport === 'maintenance' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                {['Asset', 'Category', 'Date', 'Technician', 'Status', 'Next PPM'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {maintenance.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No records</td></tr>
              ) : maintenance.sort((a, b) => b.maintenanceDate.localeCompare(a.maintenanceDate)).map(m => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{m.assetName}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{m.assetCategory}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDate(m.maintenanceDate)}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{m.technician}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{m.status}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDate(m.nextMaintenance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeReport === 'repairs' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                  {['Asset', 'Date', 'Issue', 'Action', 'Status', 'Technician', 'Cost (RM)'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {repairs.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No records</td></tr>
                ) : repairs.sort((a, b) => b.date.localeCompare(a.date)).map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{r.assetName}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{r.issue}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{r.action || '—'}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{r.status}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-500">{r.technician}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{r.cost > 0 ? formatCurrency(r.cost) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === 'warranty' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={exportWarrantyReport} className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
              <Download className="w-4 h-4" /> Export Warranty Report
            </button>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
                  {['Asset ID', 'Brand / Model', 'Location', 'Department', 'Warranty Expiry', 'Days Left'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {warrantyAssets.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No warranties expiring in the next 90 days</td></tr>
                ) : warrantyAssets.map(a => {
                  const days = daysUntil(a.warrantyExpiry);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-sm font-mono text-blue-600 dark:text-blue-400">{a.assetId}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{a.brand} {a.model}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{a.location}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{a.department}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDate(a.warrantyExpiry)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${days <= 30 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{days}d</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
