import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { Asset, StockItem, SoftwareLicense } from '../lib/types';
import { formatDate, daysUntil } from '../lib/utils';
import { Link } from 'react-router';
import {
  Package, Users, Wrench, AlertTriangle, Trash2, Clock, Layers,
  TrendingUp, ArrowRight
} from 'lucide-react';

interface DashStat { label: string; value: number; icon: React.ReactNode; color: string; bg: string; to: string }

// Simple horizontal bar chart using divs — no recharts, no key issues
function HBarChart({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map(d => (
        <div key={d.name} className="flex items-center gap-3">
          <div className="w-28 text-xs text-slate-500 dark:text-slate-400 truncate text-right shrink-0">{d.name}</div>
          <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded flex items-center justify-end pr-2 transition-all duration-500"
              style={{ width: `${(d.value / max) * 100}%` }}
            >
              {d.value > 0 && <span className="text-xs text-white font-medium">{d.value}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Simple donut chart using SVG — no recharts, no key issues
function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="h-36 flex items-center justify-center text-slate-400 text-sm">No data</div>;

  const r = 54;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * r;
  const gap = 3;

  let cumulative = 0;
  const slices = data.map(d => {
    const fraction = d.value / total;
    const offset = cumulative;
    cumulative += fraction;
    return { ...d, fraction, offset };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
        {slices.map(s => {
          const dashLen = Math.max(s.fraction * circumference - gap, 0);
          const spaceLen = circumference - dashLen;
          const rotation = s.offset * 360 - 90;
          return (
            <circle
              key={s.name}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="22"
              strokeDasharray={`${dashLen} ${spaceLen}`}
              strokeDashoffset={0}
              transform={`rotate(${rotation} ${cx} ${cy})`}
            />
          );
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-slate-700" style={{ fontSize: 22, fontWeight: 600, fill: 'currentColor' }}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" style={{ fontSize: 11, fill: '#94a3b8' }}>assets</text>
      </svg>
      <div className="space-y-2 flex-1">
        {slices.map(s => (
          <div key={s.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-slate-600 dark:text-slate-400">{s.name}</span>
            </div>
            <span className="text-slate-700 dark:text-slate-300 font-medium">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [software, setSoftware] = useState<SoftwareLicense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAssets = onValue(ref(db, 'assets'), snap => {
      setAssets(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
      setLoading(false);
    });
    const unsubStock = onValue(ref(db, 'stock'), snap => {
      setStock(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    const unsubSoftware = onValue(ref(db, 'software'), snap => {
      setSoftware(snap.exists() ? Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v })) : []);
    });
    return () => { unsubAssets(); unsubStock(); unsubSoftware(); };
  }, []);

  const total = assets.length;
  const available = assets.filter(a => a.status === 'Available').length;
  const assigned = assets.filter(a => a.status === 'Assigned').length;
  const underRepair = assets.filter(a => a.status === 'Under Repair').length;
  const missing = assets.filter(a => a.status === 'Missing').length;
  const disposed = assets.filter(a => a.status === 'Disposed').length;
  const forReplacement = assets.filter(a => a.status === 'For Replacement').length;
  const borrowed = assets.filter(a => a.status === 'Borrowed').length;
  const missingDisposed = missing + disposed;
  const warrantyExpiring = assets.filter(a => { const d = daysUntil(a.warrantyExpiry); return d >= 0 && d <= 90; }).length;
  const lowStock = stock.filter(s => s.quantity <= s.minimumStock).length;

  const stats: DashStat[] = [
    { label: 'Total Assets', value: total, icon: <Package />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', to: '/assets' },
    { label: 'Available', value: available, icon: <TrendingUp />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', to: '/assets?status=Available' },
    { label: 'Assigned', value: assigned, icon: <Users />, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', to: '/assignments' },
    { label: 'Under Repair', value: underRepair, icon: <Wrench />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', to: '/repairs' },
    { label: 'Missing', value: missing, icon: <AlertTriangle />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', to: '/assets?status=Missing' },
    { label: 'Disposed', value: disposed, icon: <Trash2 />, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700/40', to: '/assets?status=Disposed' },
    { label: 'Warranty Expiring (90d)', value: warrantyExpiring, icon: <Clock />, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', to: '/assets' },
    { label: 'Low Stock Items', value: lowStock, icon: <Layers />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', to: '/stock' },
  ];

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  assets.forEach(a => { if (a.category) categoryMap[a.category] = (categoryMap[a.category] || 0) + 1; });
  const categoryData = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  // Status donut data — all statuses explicitly listed
  const statusData = [
    { name: 'Available', value: available, color: '#10b981' },
    { name: 'Assigned', value: assigned, color: '#6366f1' },
    { name: 'Borrowed', value: borrowed, color: '#8b5cf6' },
    { name: 'Under Repair', value: underRepair, color: '#f59e0b' },
    { name: 'For Replacement', value: forReplacement, color: '#f97316' },
    { name: 'Missing', value: missing, color: '#ef4444' },
    { name: 'Disposed', value: disposed, color: '#94a3b8' },
  ].filter(s => s.value > 0);

  // Location breakdown
  const locationMap: Record<string, number> = {};
  assets.forEach(a => { if (a.location) locationMap[a.location] = (locationMap[a.location] || 0) + 1; });
  const locationData = Object.entries(locationMap).map(([name, value]) => ({ name, value }));

  // Recent assets
  const recentAssets = [...assets]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  // Expiring warranties
  const expiringWarranty = assets
    .filter(a => { const d = daysUntil(a.warrantyExpiry); return d >= 0 && d <= 90; })
    .sort((a, b) => daysUntil(a.warrantyExpiry) - daysUntil(b.warrantyExpiry))
    .slice(0, 5);

  // Expiring licenses
  const expiringLicenses = software
    .filter(s => { const d = daysUntil(s.expiryDate); return d >= 0 && d <= 60; })
    .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate))
    .slice(0, 4);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-slate-800 dark:text-white">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Mountain Torq Sdn Bhd — IT Asset Overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {stats.map(s => (
          <Link key={s.label} to={s.to}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow"
          >
            <div className={`${s.bg} ${s.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3`}>
              <span className="w-5 h-5">{s.icon}</span>
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 dark:text-slate-400 text-xs mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold mb-4">Assets by Category</h3>
          {categoryData.length === 0
            ? <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
            : <HBarChart data={categoryData} />
          }
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold mb-4">Asset Status</h3>
          <DonutChart data={statusData} />
        </div>
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent assets */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Recently Added</h3>
            <Link to="/assets" className="text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1 hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentAssets.length === 0 ? (
            <p className="text-slate-400 text-sm">No assets yet</p>
          ) : (
            <div className="space-y-3">
              {recentAssets.map(a => (
                <Link key={a.id} to={`/assets/${a.id}`} className="flex items-start justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-2 px-2 py-1 rounded-lg transition-colors">
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.assetId}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{a.brand} {a.model}</div>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(a.createdAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Expiring warranty */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold">Warranty Expiring Soon</h3>
          </div>
          {expiringWarranty.length === 0 ? (
            <p className="text-slate-400 text-sm">No warranties expiring soon</p>
          ) : (
            <div className="space-y-3">
              {expiringWarranty.map(a => {
                const days = daysUntil(a.warrantyExpiry);
                return (
                  <Link key={a.id} to={`/assets/${a.id}`} className="flex items-start justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-2 px-2 py-1 rounded-lg transition-colors">
                    <div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.assetId}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(a.warrantyExpiry)}</div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${days <= 30 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                      {days}d
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Expiring licenses + location */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-700 dark:text-slate-300 text-sm font-semibold">License Renewals</h3>
            <Link to="/software" className="text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1 hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {expiringLicenses.length === 0 ? (
            <p className="text-slate-400 text-sm">No upcoming renewals</p>
          ) : (
            <div className="space-y-3">
              {expiringLicenses.map(s => {
                const days = daysUntil(s.expiryDate);
                return (
                  <div key={s.id} className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{s.softwareName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(s.expiryDate)}</div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${days <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {days}d
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">By Location</h4>
            <div className="space-y-1.5">
              {locationData.map(l => (
                <div key={l.name} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400 w-8">{l.name}</span>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${total > 0 ? (l.value / total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-400 w-4 text-right">{l.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
