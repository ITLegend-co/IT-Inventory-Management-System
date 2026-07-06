import { AssetCategory, AssetLocation } from './types';

const CATEGORY_CODES: Record<AssetCategory, string> = {
  'Laptop': 'LTP',
  'Desktop': 'DTP',
  'Monitor': 'MON',
  'Printer': 'PRN',
  'Scanner': 'SCN',
  'UPS': 'UPS',
  'Router': 'RTR',
  'Switch': 'SWT',
  'Access Point': 'AP',
  'Walkie-Talkie': 'WKT',
  'MOTOTRBO': 'MTR',
  'Company Phone': 'PHN',
  'Toner/Ink': 'TNR',
  'Cable/Adapter': 'CBL',
  'Software License': 'SFT',
  'Starlink': 'STL',
  'Network Equipment': 'NET',
  'Server/NAS': 'SRV',
  'Other': 'OTH',
};

export function generateAssetId(category: AssetCategory, location: AssetLocation, existingIds: string[]): string {
  const catCode = CATEGORY_CODES[category] || 'OTH';
  const prefix = `MT-${location}-${catCode}-`;
  const existing = existingIds
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export function formatCurrency(amount: number): string {
  return `RM ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function isExpiringSoon(dateStr: string, days = 90): boolean {
  const d = daysUntil(dateStr);
  return d >= 0 && d <= days;
}

export function isExpired(dateStr: string): boolean {
  return daysUntil(dateStr) < 0;
}

export function getCategoryCode(category: AssetCategory): string {
  return CATEGORY_CODES[category] || 'OTH';
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  'Laptop', 'Desktop', 'Monitor', 'Printer', 'Scanner', 'UPS',
  'Router', 'Switch', 'Access Point', 'Walkie-Talkie', 'MOTOTRBO',
  'Company Phone', 'Toner/Ink', 'Cable/Adapter', 'Software License',
  'Starlink', 'Network Equipment', 'Server/NAS', 'Other'
];

export const ASSET_STATUSES = ['Available', 'Assigned', 'Under Repair', 'For Replacement', 'Disposed', 'Missing', 'Borrowed'] as const;
export const LOCATIONS = ['KK', 'KP', 'PH'] as const;
export const LOCATION_NAMES: Record<string, string> = { KK: 'Kota Kinabalu', KP: 'Kinabalu Park', PH: 'Pendant Hut' };
export const DEPARTMENTS = ['Directory', 'Manager', 'HR', 'Operations', 'Accounts', 'Admin', 'IT', 'Technical', 'RSVN', 'Customer Service', 'Housekeeping', 'Kitchen', 'Trainer', 'OIC'];
export const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged'];

export const PPM_CHECKLISTS: Record<string, string[]> = {
  'Laptop': ['Check Windows update', 'Check antivirus', 'Clean temporary files', 'Check disk health', 'Check physical condition', 'Clean keyboard/screen'],
  'Desktop': ['Check Windows update', 'Check antivirus', 'Clean temporary files', 'Check disk health', 'Check physical condition', 'Clean interior dust'],
  'Printer': ['Test print', 'Check toner level', 'Clean scanner glass', 'Check paper jam issue', 'Check network connection', 'Clean rollers'],
  'Scanner': ['Test scan', 'Clean scanner glass', 'Check driver/software', 'Check physical condition'],
  'UPS': ['Check battery condition', 'Test backup power', 'Check alarm sound', 'Record battery replacement date', 'Check load capacity'],
  'Router': ['Check router status', 'Check cable labeling', 'Check internet speed', 'Check firmware update', 'Verify configuration backup'],
  'Switch': ['Check port status', 'Check cable labeling', 'Check firmware update', 'Test connectivity', 'Clean dust'],
  'Access Point': ['Check Wi-Fi coverage', 'Check client connections', 'Check firmware update', 'Test speeds'],
  'Monitor': ['Test display quality', 'Check for dead pixels', 'Clean screen', 'Check cable connections', 'Test brightness/contrast'],
};

export function getChecklistForCategory(category: string): string[] {
  return PPM_CHECKLISTS[category] || ['Check physical condition', 'Test functionality', 'Clean device', 'Check connections'];
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    'Available': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Assigned': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'Under Repair': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    'For Replacement': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    'Disposed': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'Missing': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    'Borrowed': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    'Good': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Need Monitoring': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    'Need Repair': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    'Completed': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'Pending': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    'In Progress': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    'Cancelled': 'bg-slate-100 text-slate-500',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
}

export async function logActivity(database: any, userId: string, userName: string, action: string, module: string, target: string) {
  const { ref, push } = await import('firebase/database');
  push(ref(database, 'activityLog'), {
    userId, userName, action, module, target,
    timestamp: new Date().toISOString(),
  });
}
