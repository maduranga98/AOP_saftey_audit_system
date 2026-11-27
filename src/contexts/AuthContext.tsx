import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { emailToEmpNo, empNoToEmail, isPinAccountEmail } from '@/lib/identity';
import type { Role } from '@/types';

interface Session {
  user: User | null;
  uid: string | null;
  empNo: string;
  email: string;
  /** Employee number for staff accounts, email for safety officers. */
  login: string;
  name: string;
  roles: Role[];
  loading: boolean;
  signIn: (empNo: string, pin: string) => Promise<Role[]>;
  signInWithEmail: (email: string, password: string) => Promise<Role[]>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<Session | null>(null);
const rolesKey = (uid: string) => `aop.roles.${uid}`;

/**
 * Reads roles from the token's custom claims. Online, the token is refreshed so role changes
 * by the safety officer apply on the next app open. Offline, the last known roles are used.
 */
async function loadRoles(user: User, forceRefresh: boolean): Promise<Role[]> {
  try {
    const token = await user.getIdTokenResult(forceRefresh && navigator.onLine);
    const roles = Array.isArray(token.claims.roles) ? (token.claims.roles as Role[]) : [];
    localStorage.setItem(rolesKey(user.uid), JSON.stringify(roles));
    return roles;
  } catch {
    try {
      return JSON.parse(localStorage.getItem(rolesKey(user.uid)) || '[]') as Role[];
    } catch {
      return [];
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        setRoles(u ? await loadRoles(u, true) : []);
        setLoading(false);
      }),
    [],
  );

  const value = useMemo<Session>(
    () => ({
      user,
      uid: user?.uid ?? null,
      empNo: emailToEmpNo(user?.email),
      email: user?.email && !isPinAccountEmail(user.email) ? user.email : '',
      login: isPinAccountEmail(user?.email) ? emailToEmpNo(user?.email) : user?.email ?? '',
      name: user?.displayName || emailToEmpNo(user?.email) || user?.email || '',
      roles,
      loading,
      async signIn(empNo, pin) {
        const cred = await signInWithEmailAndPassword(auth, empNoToEmail(empNo), pin);
        const r = await loadRoles(cred.user, true);
        setRoles(r);
        return r;
      },
      async signInWithEmail(email, password) {
        const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        const r = await loadRoles(cred.user, true);
        setRoles(r);
        return r;
      },
      async sendPasswordReset(email) {
        await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      },
      async signOut() {
        if (user) localStorage.removeItem(rolesKey(user.uid));
        await fbSignOut(auth);
      },
      async refreshRoles() {
        if (user) setRoles(await loadRoles(user, true));
      },
    }),
    [user, roles, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Session {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
