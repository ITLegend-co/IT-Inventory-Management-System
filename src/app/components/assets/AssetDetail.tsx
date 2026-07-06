import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { ref, onValue } from 'firebase/database';
import { db } from '../../lib/firebase';
import { Asset, Assignment, Maintenance, Repair } from '../../lib/types';
import { formatDate, formatCurrency, statusColor, daysUntil } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import QRCode from 'react-qr-code';
import { ArrowLeft, Pencil, QrCode, Printer, Clock, Wrench, AlertTriangle, Users } from 'lucide-react';

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [tab, setTab] = useState<'info' | 'qr' | 'history' | 'maintenance'>('info');
  const [loading, setLoading] = useState(true);
  const qrRef = useRef<HTMLDivElement>(null);
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'it_staff';

  const assetUrl = `${window.location.origin}/assets/${id}`;

  useEffect(() => {
    const unsub = onValue(ref(db, `assets/${id}`), snap => {
      if (snap.exists()) setAsset({ id: id!, ...snap.val() });
      setLoading(false);
    });
    const unsubA = onValue(ref(db, 'assignments'), snap => {
      if (snap.exists()) {
        const all: Assignment[] = Object.entries(snap.val()).map(([aid, v]: any) => ({ id: aid, ...v }));
        setAssignments(all.filter(a => a.assetId === id).sort((a, b) => b.dateIssued.localeCompare(a.dateIssued)));
      }
    });
    const unsubM = onValue(ref(db, 'maintenance'), snap => {
      if (snap.exists()) {
        const all: Maintenance[] = Object.entries(snap.val()).map(([mid, v]: any) => ({ id: mid, ...v }));
        setMaintenance(all.filter(m => m.assetId === id).sort((a, b) => b.maintenanceDate.localeCompare(a.maintenanceDate)));
      }
    });
    const unsubR = onValue(ref(db, 'repairs'), snap => {
      if (snap.exists()) {
        const all: Repair[] = Object.entries(snap.val()).map(([rid, v]: any) => ({ id: rid, ...v }));
        setRepairs(all.filter(r => r.assetId === id).sort((a, b) => b.date.localeCompare(a.date)));
      }
    });
    return () => { unsub(); unsubA(); unsubM(); unsubR(); };
  }, [id]);

  function printQR() {
    const win = window.open('', '_blank');
    if (!win || !asset) return;
    const svgEl = qrRef.current?.querySelector('svg');
    const svgHtml = svgEl ? svgEl.outerHTML : '';
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>QR Label — ${asset.assetId}</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; }
        .label { border: 2px solid #000; padding: 16px; width: 240px; text-align: center; }
        .company { font-size: 11px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 4px; }
        .assetid { font-size: 13px; font-weight: bold; margin: 6px 0; font-family: monospace; }
        .item { font-size: 11px; margin: 2px 0; }
        .location { font-size: 10px; color: #555; margin-top: 4px; }
        svg { width: 160px; height: 160px; margin: 8px auto; display: block; }
        .scan { font-size: 9px; color: #777; margin-top: 6px; }
        @media print { body { background: white; } }
      </style></head><body>
      <div class="label">
        <div class="company">MOUNTAIN TORQ SDN BHD</div>
        <div class="assetid">Asset ID: ${asset.assetId}</div>
        <div class="item">Item: ${asset.brand} ${asset.model}</div>
        <div class="location">Location: ${asset.location === 'KK' ? 'Kota Kinabalu' : asset.location === 'KP' ? 'Kinabalu Park' : 'Pendant Hut'} Office</div>
        ${svgHtml}
        <div class="scan">Scan for details</div>
      </div>
      <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    win.document.close();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;
  if (!asset) return <div className="p-6 text-slate-500">Asset not found.</div>;

  const warrantyDays = daysUntil(asset.warrantyExpiry);

  const tabs = [
    { key: 'info', label: 'Details', icon: <Clock className="w-4 h-4" /> },
    { key: 'qr', label: 'QR Code', icon: <QrCode className="w-4 h-4" /> },
    { key: 'history', label: `Assignments (${assignments.length})`, icon: <Users className="w-4 h-4" /> },
    { key: 'maintenance', label: `Maintenance (${maintenance.length + repairs.length})`, icon: <Wrench className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-slate-800 dark:text-white font-mono">{asset.assetId}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(asset.status)}`}>{asset.status}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{asset.brand} {asset.model} · {asset.category}</p>
          </div>
        </div>
        {canEdit && (
          <Link to={`/assets/${id}/edit`} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
            <Pencil className="w-4 h-4" /> Edit
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Asset Information</h3>
            {[
              { label: 'Asset ID', value: asset.assetId, mono: true },
              { label: 'Category', value: asset.category },
              { label: 'Brand', value: asset.brand },
              { label: 'Model', value: asset.model },
              { label: 'Serial Number', value: asset.serialNumber || '-', mono: true },
              { label: 'Location', value: asset.location === 'KK' ? 'Kota Kinabalu (KK)' : asset.location === 'KP' ? 'Kinabalu Park (KP)' : 'Pendant Hut (PH)' },
              { label: 'Department', value: asset.department || '-' },
              { label: 'Assigned To', value: asset.assignedUser || '-' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-start gap-4">
                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{row.label}</span>
                <span className={`text-sm text-slate-700 dark:text-slate-200 text-right ${row.mono ? 'font-mono' : ''}`}>{row.value}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
              <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Purchase & Warranty</h3>
              {[
                { label: 'Purchase Date', value: formatDate(asset.purchaseDate) },
                { label: 'Warranty Expiry', value: asset.warrantyExpiry ? `${formatDate(asset.warrantyExpiry)} (${warrantyDays >= 0 ? `${warrantyDays}d left` : 'Expired'})` : '-' },
                { label: 'Supplier', value: asset.supplier || '-' },
                { label: 'Cost', value: asset.cost ? formatCurrency(asset.cost) : '-' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-start gap-4">
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{row.label}</span>
                  <span className="text-sm text-slate-700 dark:text-slate-200 text-right">{row.value}</span>
                </div>
              ))}
              {asset.warrantyExpiry && warrantyDays >= 0 && warrantyDays <= 90 && (
                <div className={`flex items-center gap-2 p-2 rounded-lg text-xs ${warrantyDays <= 30 ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Warranty expires in {warrantyDays} days
                </div>
              )}
            </div>

            {asset.remarks && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
                <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold mb-2">Remarks</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{asset.remarks}</p>
              </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-1">
              <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold mb-2">Record</h3>
              <div className="text-xs text-slate-400">Added by {asset.createdBy || '—'} on {formatDate(asset.createdAt)}</div>
              {asset.updatedBy && <div className="text-xs text-slate-400">Updated by {asset.updatedBy} on {formatDate(asset.updatedAt)}</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'qr' && (
        <div className="flex flex-col items-center gap-6">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center" ref={qrRef}>
            <div className="text-sm font-bold tracking-wide text-slate-800 mb-1">MOUNTAIN TORQ SDN BHD</div>
            <div className="font-mono text-sm font-bold text-slate-800 mb-0.5">Asset ID: {asset.assetId}</div>
            <div className="text-xs text-slate-600 mb-1">Item: {asset.brand} {asset.model}</div>
            <div className="text-xs text-slate-500 mb-4">Location: {asset.location === 'KK' ? 'KK Office' : asset.location === 'KP' ? 'Kinabalu Park' : 'Pendant Hut'}</div>
            <div className="flex justify-center mb-3">
              <QRCode value={assetUrl} size={180} />
            </div>
            <div className="text-xs text-slate-400">Scan for details</div>
          </div>
          <button onClick={printQR} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
            <Printer className="w-4 h-4" /> Print QR Label
          </button>
          <p className="text-xs text-slate-400 text-center max-w-xs">Scans this QR code to open the asset page at: <span className="font-mono break-all">{assetUrl}</span></p>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Assignment History</h3>
            {canEdit && (
              <Link to={`/assignments?assetId=${asset.assetId}`} className="text-blue-600 dark:text-blue-400 text-sm hover:underline">+ New Assignment</Link>
            )}
          </div>
          {assignments.length === 0 ? (
            <p className="text-slate-400 text-sm">No assignment history</p>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => (
                <div key={a.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.assignedTo}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{a.department} · {a.location}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{a.isActive ? 'Active' : 'Returned'}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <div>Issued: {formatDate(a.dateIssued)} ({a.conditionIssued})</div>
                    <div>Returned: {a.returnedDate ? `${formatDate(a.returnedDate)} (${a.conditionReturned})` : '—'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold mb-3">Maintenance / PPM</h3>
            {maintenance.length === 0 ? <p className="text-slate-400 text-sm">No maintenance records</p> : (
              <div className="space-y-3">
                {maintenance.map(m => (
                  <div key={m.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatDate(m.maintenanceDate)} — {m.technician}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(m.status)}`}>{m.status}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Next: {formatDate(m.nextMaintenance)}</div>
                    {m.remarks && <div className="text-xs text-slate-400 mt-1">{m.remarks}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold mb-3">Repair History</h3>
            {repairs.length === 0 ? <p className="text-slate-400 text-sm">No repair records</p> : (
              <div className="space-y-3">
                {repairs.map(r => (
                  <div key={r.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatDate(r.date)} — {r.issue}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>{r.status}</span>
                    </div>
                    {r.action && <div className="text-xs text-slate-500 mt-1">Action: {r.action}</div>}
                    {r.technician && <div className="text-xs text-slate-400">By: {r.technician}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
