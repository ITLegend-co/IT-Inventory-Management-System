import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { ref, get, set, onValue } from 'firebase/database';
import { auth, db, FIREBASE_API_KEY } from '../lib/firebase';
import { AppUser } from '../lib/types';

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  createUser: (username: string, name: string, password: string, role: string, department: string, location: string) => Promise<void>;
  updateUser: (uid: string, data: Partial<AppUser>) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function usernameToEmail(username: string): string {
  return `${username.toLowerCase().replace(/\s+/g, '.')}@mountaintorq.internal`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await get(ref(db, `users/${firebaseUser.uid}`));
        if (snap.exists()) {
          setCurrentUser({ uid: firebaseUser.uid, ...snap.val() });
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function login(username: string, password: string) {
    const email = usernameToEmail(username);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        // Bootstrap admin on first run
        if (username.toLowerCase() === 'admin' && password === 'Darkwood97!') {
          const resp = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, returnSecureToken: false }),
            }
          );
          if (resp.ok) {
            const { localId } = await resp.json();
            await set(ref(db, `users/${localId}`), {
              username: 'Admin',
              name: 'Administrator',
              email,
              role: 'admin',
              department: 'IT',
              location: 'KK',
              createdAt: new Date().toISOString(),
              active: true,
            });
            await set(ref(db, `usernames/admin`), localId);
            await signInWithEmailAndPassword(auth, email, password);
          } else {
            throw new Error('Failed to create admin account');
          }
        } else {
          throw new Error('Invalid username or password');
        }
      } else {
        throw err;
      }
    }
  }

  async function logout() {
    await signOut(auth);
  }

  async function changePassword(currentPass: string, newPass: string) {
    const user = auth.currentUser;
    if (!user?.email) throw new Error('No user');
    const cred = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPass);
  }

  async function createUser(username: string, name: string, password: string, role: string, department: string, location: string) {
    const email = usernameToEmail(username);
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: false }),
      }
    );
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || 'Failed to create user');
    }
    const { localId } = await resp.json();
    await set(ref(db, `users/${localId}`), {
      username,
      name,
      email,
      role,
      department,
      location,
      createdAt: new Date().toISOString(),
      active: true,
    });
    await set(ref(db, `usernames/${username.toLowerCase()}`), localId);
  }

  async function updateUser(uid: string, data: Partial<AppUser>) {
    const { set: dbSet, ref: dbRef } = await import('firebase/database');
    const snap = await get(ref(db, `users/${uid}`));
    if (snap.exists()) {
      await set(ref(db, `users/${uid}`), { ...snap.val(), ...data });
    }
  }

  async function deleteUser(uid: string) {
    const snap = await get(ref(db, `users/${uid}`));
    if (snap.exists()) {
      const userData = snap.val();
      await set(ref(db, `users/${uid}/active`), false);
      await set(ref(db, `usernames/${userData.username?.toLowerCase()}`), null);
    }
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout, changePassword, createUser, updateUser, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
}
