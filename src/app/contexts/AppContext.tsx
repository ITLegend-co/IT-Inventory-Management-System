import React, { createContext, useContext, useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { Notification, Asset, StockItem, SoftwareLicense, Maintenance } from '../lib/types';
import { daysUntil } from '../lib/utils';

interface AppContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  notifications: Notification[];
  notificationCount: number;
  markAllRead: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('readNotifs') || '[]')); }
    catch { return new Set(); }
  });

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const notifs: Notification[] = [];

    const assetRef = ref(db, 'assets');
    const stockRef = ref(db, 'stock');
    const softwareRef = ref(db, 'software');
    const maintenanceRef = ref(db, 'maintenance');

    const unsubAssets = onValue(assetRef, (snap) => {
      if (!snap.exists()) return;
      const assets: Asset[] = Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v }));
      const warrantyNotifs: Notification[] = [];
      assets.forEach(a => {
        if (!a.warrantyExpiry) return;
        const days = daysUntil(a.warrantyExpiry);
        if (days >= 0 && days <= 90) {
          warrantyNotifs.push({
            id: `warranty-${a.id}`,
            type: 'warranty',
            title: 'Warranty Expiring Soon',
            message: `${a.assetId} (${a.brand} ${a.model}) warranty expires in ${days} day${days !== 1 ? 's' : ''}`,
            severity: days <= 30 ? 'critical' : 'warning',
            relatedId: a.id,
            createdAt: new Date().toISOString(),
          });
        }
      });
      setNotifications(prev => {
        const filtered = prev.filter(n => n.type !== 'warranty');
        return [...filtered, ...warrantyNotifs];
      });
    });

    const unsubStock = onValue(stockRef, (snap) => {
      if (!snap.exists()) return;
      const items: StockItem[] = Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v }));
      const stockNotifs: Notification[] = [];
      items.forEach(s => {
        if (s.quantity <= s.minimumStock) {
          stockNotifs.push({
            id: `stock-${s.id}`,
            type: 'stock',
            title: 'Low Stock Alert',
            message: `${s.itemName} is low (${s.quantity} remaining, min: ${s.minimumStock})`,
            severity: s.quantity === 0 ? 'critical' : 'warning',
            relatedId: s.id,
            createdAt: new Date().toISOString(),
          });
        }
      });
      setNotifications(prev => {
        const filtered = prev.filter(n => n.type !== 'stock');
        return [...filtered, ...stockNotifs];
      });
    });

    const unsubSoftware = onValue(softwareRef, (snap) => {
      if (!snap.exists()) return;
      const items: SoftwareLicense[] = Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v }));
      const licenseNotifs: Notification[] = [];
      items.forEach(s => {
        if (!s.expiryDate) return;
        const days = daysUntil(s.expiryDate);
        const reminder = s.renewalReminderDays || 30;
        if (days >= 0 && days <= reminder) {
          licenseNotifs.push({
            id: `license-${s.id}`,
            type: 'license',
            title: 'License Expiring Soon',
            message: `${s.softwareName} license expires in ${days} day${days !== 1 ? 's' : ''}`,
            severity: days <= 7 ? 'critical' : 'warning',
            relatedId: s.id,
            createdAt: new Date().toISOString(),
          });
        }
      });
      setNotifications(prev => {
        const filtered = prev.filter(n => n.type !== 'license');
        return [...filtered, ...licenseNotifs];
      });
    });

    const unsubMaint = onValue(maintenanceRef, (snap) => {
      if (!snap.exists()) return;
      const items: Maintenance[] = Object.entries(snap.val()).map(([id, v]: any) => ({ id, ...v }));
      const maintNotifs: Notification[] = [];
      const seen = new Set<string>();
      items.forEach(m => {
        if (!m.nextMaintenance || seen.has(m.assetId)) return;
        const days = daysUntil(m.nextMaintenance);
        if (days >= 0 && days <= 30) {
          seen.add(m.assetId);
          maintNotifs.push({
            id: `maint-${m.assetId}`,
            type: 'maintenance',
            title: 'PPM Due Soon',
            message: `${m.assetName} is due for maintenance in ${days} day${days !== 1 ? 's' : ''}`,
            severity: days <= 7 ? 'critical' : 'warning',
            relatedId: m.assetId,
            createdAt: new Date().toISOString(),
          });
        }
      });
      setNotifications(prev => {
        const filtered = prev.filter(n => n.type !== 'maintenance');
        return [...filtered, ...maintNotifs];
      });
    });

    return () => {
      unsubAssets();
      unsubStock();
      unsubSoftware();
      unsubMaint();
    };
  }, []);

  function markAllRead() {
    const newRead = new Set([...readIds, ...notifications.map(n => n.id)]);
    setReadIds(newRead);
    localStorage.setItem('readNotifs', JSON.stringify([...newRead]));
  }

  const notificationCount = notifications.filter(n => !readIds.has(n.id)).length;

  return (
    <AppContext.Provider value={{ darkMode, toggleDarkMode: () => setDarkMode(d => !d), notifications, notificationCount, markAllRead }}>
      {children}
    </AppContext.Provider>
  );
}
