import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAppContext } from '../contexts/AppContext';
import { Eye, EyeOff, Moon, Sun, Shield, Database, Copy, Check } from 'lucide-react';

const DB_RULES = `{
  "rules": {
    "users": {
      ".read": "auth != null",
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    "usernames": {
      ".read": true,
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'"
    },
    "assets": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'it_staff')"
    },
    "assignments": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'it_staff')"
    },
    "maintenance": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'it_staff')"
    },
    "repairs": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'it_staff')"
    },
    "stock": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'it_staff')"
    },
    "software": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'it_staff')"
    },
    "activityLog": {
      ".read": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'it_staff')",
      ".write": "auth != null",
      ".indexOn": ["timestamp"]
    }
  }
}`;

export default function Settings() {
  const { currentUser, changePassword, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useAppContext();
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passMsg, setPassMsg] = useState('');
  const [copied, setCopied] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPass !== confirmPass) { setPassMsg('New passwords do not match'); return; }
    if (newPass.length < 6) { setPassMsg('Password must be at least 6 characters'); return; }
    setSaving(true);
    setPassMsg('');
    try {
      await changePassword(currentPass, newPass);
      setPassMsg('Password changed successfully!');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch (err: any) {
      setPassMsg(err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  function copyRules() {
    navigator.clipboard.writeText(DB_RULES);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-slate-800 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">System preferences and security</p>
      </div>

      {/* Profile */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="text-slate-700 dark:text-slate-300 text-sm font-semibold mb-4">Your Profile</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-lg font-semibold text-white">
            {currentUser?.name?.charAt(0) || 'U'}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-700 dark:text-white">{currentUser?.name}</div>
            <div className="text-xs text-slate-400">{currentUser?.email}</div>
            <div className="text-xs text-slate-400 capitalize">{currentUser?.role?.replace('_', ' ')} · {currentUser?.department} · {currentUser?.location}</div>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="text-slate-700 dark:text-slate-300 text-sm font-semibold mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-700 dark:text-slate-200">Dark Mode</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Switch between light and dark interface</div>
          </div>
          <button onClick={toggleDarkMode} className={`w-12 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'}`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${darkMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="text-slate-700 dark:text-slate-300 text-sm font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Change Password
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          {[
            { label: 'Current Password', value: currentPass, setter: setCurrentPass, show: showCurrent, toggle: () => setShowCurrent(s => !s) },
            { label: 'New Password', value: newPass, setter: setNewPass, show: showNew, toggle: () => setShowNew(s => !s) },
            { label: 'Confirm New Password', value: confirmPass, setter: setConfirmPass, show: showNew, toggle: () => setShowNew(s => !s) },
          ].map(f => (
            <div key={f.label}>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">{f.label}</label>
              <div className="relative">
                <input type={f.show ? 'text' : 'password'} value={f.value} onChange={e => f.setter(e.target.value)} required
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white pr-10 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <button type="button" onClick={f.toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {f.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          {passMsg && (
            <div className={`text-sm px-3 py-2 rounded-lg ${passMsg.includes('success') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
              {passMsg}
            </div>
          )}
          <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm">
            {saving ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Firebase rules */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-slate-700 dark:text-slate-300 text-sm font-semibold flex items-center gap-2">
            <Database className="w-4 h-4" /> Firebase Database Rules
          </h2>
          <button onClick={copyRules} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">
            {copied ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Rules</>}
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Copy these rules and paste them in your <strong>Firebase Console → Realtime Database → Rules</strong> tab.
        </p>
        <pre className="text-xs bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto font-mono leading-relaxed">{DB_RULES}</pre>
      </div>

      {/* System info */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="text-slate-700 dark:text-slate-300 text-sm font-semibold mb-3">System Information</h2>
        <div className="space-y-2 text-sm">
          {[
            { label: 'System', value: 'Mountain Torq IT Asset Management System' },
            { label: 'Database', value: 'Firebase Realtime Database (Asia SE1)' },
            { label: 'Project ID', value: 'inventory-5a95d' },
            { label: 'Version', value: '1.0.0 — June 2026' },
          ].map(row => (
            <div key={row.label} className="flex gap-4">
              <span className="text-slate-400 w-28 shrink-0">{row.label}</span>
              <span className="text-slate-600 dark:text-slate-300">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
