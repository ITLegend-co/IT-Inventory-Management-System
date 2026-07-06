import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { AppUser, UserRole } from '../lib/types';
import { LOCATIONS, DEPARTMENTS } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, Pencil, Shield, UserCheck, Eye } from 'lucide-react';

const ROLES: { value: UserRole; label: string; desc: string; color: string }[] = [
  { value: 'admin', label: 'Admin', desc: 'Full access + user management', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'it_staff', label: 'IT Staff', desc: 'Add/edit assets, maintenance, repair', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'management', label: 'Management', desc: 'View reports only', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'department_user', label: 'Dept. User', desc: 'View assigned assets only', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' },
];

const INPUT = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
);
const SELECT = (p: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select {...p} className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
);
const FIELD = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">{label}</label>{children}</div>
);

export default function Users() {
  const { currentUser, createUser, updateUser, deleteUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', name: '', password: '', confirmPassword: '', role: 'it_staff' as UserRole, department: 'IT', location: 'KK' });

  useEffect(() => {
    const unsub = onValue(ref(db, 'users'), snap => {
      setUsers(snap.exists() ? Object.entries(snap.val()).map(([uid, v]: any) => ({ uid, ...v })).filter(u => u.active !== false) : []);
      setLoading(false);
    });
    return unsub;
  }, []);

  function openAdd() {
    setEditUser(null);
    setForm({ username: '', name: '', password: '', confirmPassword: '', role: 'it_staff', department: 'IT', location: 'KK' });
    setError('');
    setShowModal(true);
  }

  function openEdit(user: AppUser) {
    setEditUser(user);
    setForm({ username: user.username, name: user.name, password: '', confirmPassword: '', role: user.role, department: user.department, location: user.location });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!editUser && form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    if (!editUser && form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      if (editUser) {
        await updateUser(editUser.uid, { name: form.name, role: form.role, department: form.department, location: form.location });
      } else {
        await createUser(form.username, form.name, form.password, form.role, form.department, form.location);
      }
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(uid: string) {
    if (!confirm('Deactivate this user?')) return;
    await deleteUser(uid);
  }

  const roleInfo = (role: UserRole) => ROLES.find(r => r.value === role)!;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-slate-800 dark:text-white">User Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{users.length} active users</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {ROLES.map(r => (
          <div key={r.value} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.color}`}>{r.label}</span>
              <span className="text-xs text-slate-400">{users.filter(u => u.role === r.value).length} user{users.filter(u => u.role === r.value).length !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
              {['User', 'Username', 'Role', 'Department', 'Location', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">No users found</td></tr>
            ) : users.map(u => {
              const role = roleInfo(u.role);
              return (
                <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                        {u.name?.charAt(0) || u.username?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-600 dark:text-slate-300">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${role?.color}`}>{role?.label}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{u.department}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{u.location}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {u.uid !== currentUser?.uid && (
                        <button onClick={() => handleDeactivate(u.uid)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Deactivate">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-slate-800 dark:text-white font-semibold">{editUser ? 'Edit User' : 'Add New User'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {!editUser && (
                <FIELD label="Username *"><INPUT required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="john.doe" /></FIELD>
              )}
              <FIELD label="Full Name *"><INPUT required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" /></FIELD>
              <FIELD label="Role">
                <SELECT value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                </SELECT>
              </FIELD>
              <div className="grid grid-cols-2 gap-3">
                <FIELD label="Department">
                  <SELECT value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </SELECT>
                </FIELD>
                <FIELD label="Location">
                  <SELECT value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
                    {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                  </SELECT>
                </FIELD>
              </div>
              {!editUser && (
                <>
                  <FIELD label="Password *"><INPUT type="password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" /></FIELD>
                  <FIELD label="Confirm Password *"><INPUT type="password" required value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Repeat password" /></FIELD>
                </>
              )}
              {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm">
                  {saving ? 'Saving…' : (editUser ? 'Save Changes' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
