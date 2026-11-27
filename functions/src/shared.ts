import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

if (getApps().length === 0) initializeApp();

export const auth = getAuth();
export const db = getFirestore();

export type Role = 'admin' | 'auditor' | 'area';
export const ROLES: Role[] = ['admin', 'auditor', 'area'];

export interface Person {
  uid: string;
  empNo: string;
  name: string;
  roles: Role[];
  active: boolean;
}

export const EMAIL_DOMAIN = 'aop.internal';
export const PIN_RE = /^\d{6}$/;
export const EMP_RE = /^[A-Z0-9-]{2,20}$/;

export const normalizeEmpNo = (v: unknown): string => String(v ?? '').trim().toUpperCase().replace(/\s+/g, '');
export const empNoToEmail = (empNo: string): string => `${empNo.toLowerCase()}@${EMAIL_DOMAIN}`;

export function requireAdmin(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const roles = req.auth.token.roles;
  if (!Array.isArray(roles) || !roles.includes('admin')) {
    throw new HttpsError('permission-denied', 'Only the safety officer can do this.');
  }
  return req.auth.uid;
}

export function parseRoles(v: unknown): Role[] {
  if (!Array.isArray(v) || v.length === 0) throw new HttpsError('invalid-argument', 'Pick at least one role.');
  const roles = [...new Set(v)] as Role[];
  if (!roles.every((r) => ROLES.includes(r))) throw new HttpsError('invalid-argument', 'Unknown role.');
  return roles;
}

export function parseName(v: unknown): string {
  const name = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) throw new HttpsError('invalid-argument', 'Name must be 2–80 characters.');
  return name;
}

export function parsePin(v: unknown): string {
  const pin = String(v ?? '');
  if (!PIN_RE.test(pin)) throw new HttpsError('invalid-argument', 'PIN must be 6 digits.');
  return pin;
}

/** Replaces or inserts a person in the config/main directory inside a transaction. */
export async function upsertPerson(person: Person): Promise<void> {
  const ref = db.doc('config/main');
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const people: Person[] = snap.exists ? ((snap.get('people') as Person[]) ?? []) : [];
    const next = people.filter((p) => p.uid !== person.uid);
    next.push(person);
    next.sort((a, b) => a.name.localeCompare(b.name));
    tx.set(ref, { people: next }, { merge: true });
  });
}
