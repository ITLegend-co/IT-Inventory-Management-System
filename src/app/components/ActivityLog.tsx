import { useState, useEffect } from 'react';
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { db } from '../lib/firebase';
import { ActivityLog as ActivityLogType } from '../lib/types';
import { Activity } from 'lucide-react';
import { formatDate } from '../lib/utils';

export default function ActivityLog() {
  const [logs, setLogs] = useState<ActivityLogType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(ref(db, 'activityLog'), limitToLast(200));
    const unsub = onValue(q, snap => {
      if (snap.exists()) {
        const all: ActivityLogType[] = Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v }));
        setLogs(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
      } else {
        setLogs([]);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const moduleColors: Record<string, string> = {
    'Assets': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Assignments': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    'Maintenance': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Repairs': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'Stock': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'Software': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    'Users': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        <div>
          <h1 className="text-slate-800 dark:text-white">Activity Log</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Last {logs.length} actions</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400">
          No activity logged yet. Actions will appear here as the system is used.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
          {logs.map(log => (
            <div key={log.id} className="px-4 py-3 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                {log.userName?.charAt(0) || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{log.userName}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${moduleColors[log.module] || 'bg-slate-100 text-slate-500'}`}>{log.module}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{log.action}</span>
                  {log.target && <span className="text-xs text-slate-400 font-mono">{log.target}</span>}
                </div>
              </div>
              <div className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                {log.timestamp ? new Date(log.timestamp).toLocaleString('en-MY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
