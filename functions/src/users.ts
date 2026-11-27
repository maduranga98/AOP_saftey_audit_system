import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  auth,
  db,
  EMP_RE,
  empNoToEmail,
  normalizeEmpNo,
  parseName,
  parsePin,
  parseRoles,
  requireAdmin,
  upsertPerson,
  type Person,
  type Role,
} from './shared';

const opts = { cors: true, enforceAppCheck: false } as const;

/** Safety officer adds a user: Auth account + role claims + users doc + directory entry. */
export const createUser = onCall(opts, async (req) => {
  const adminUid = requireAdmin(req);
  const empNo = normalizeEmpNo(req.data?.empNo);
  if (!EMP_RE.test(empNo)) throw new HttpsError('invalid-argument', 'Employee number: 2–20 letters, digits or dashes.');
  const name = parseName(req.data?.name);
  const roles = parseRoles(req.data?.roles);
  const pin = parsePin(req.data?.pin);
  const email = empNoToEmail(empNo);

  try {
    await auth.getUserByEmail(email);
    throw new HttpsError('already-exists', `Employee number ${empNo} already has an account.`);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
  }

  const user = await auth.createUser({ email, password: pin, displayName: name, emailVerified: true });
  await auth.setCustomUserClaims(user.uid, { roles });
  const person: Person = { uid: user.uid, empNo, name, roles, active: true };
  await db.doc(`users/${user.uid}`).set({
    ...person,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: adminUid,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await upsertPerson(person);
  return { ok: true, uid: user.uid };
});

/** Change name, roles or active state. Role changes apply on the user's next app open. */
export const updateUser = onCall(opts, async (req) => {
  const adminUid = requireAdmin(req);
  const uid = String(req.data?.uid ?? '');
  if (!uid) throw new HttpsError('invalid-argument', 'Missing user.');

  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'User not found.');
  const current = snap.data() as Person;

  const next: Person = { ...current };
  if (req.data?.name !== undefined) next.name = parseName(req.data.name);
  if (req.data?.roles !== undefined) next.roles = parseRoles(req.data.roles) as Role[];
  if (req.data?.active !== undefined) next.active = Boolean(req.data.active);

  if (uid === adminUid) {
    if (!next.roles.includes('admin')) throw new HttpsError('failed-precondition', 'You cannot remove your own safety officer role.');
    if (!next.active) throw new HttpsError('failed-precondition', 'You cannot switch off your own account.');
  }

  await auth.updateUser(uid, { displayName: next.name, disabled: !next.active });
  if (next.roles.join() !== current.roles.join()) await auth.setCustomUserClaims(uid, { roles: next.roles });
  if (!next.active && current.active) await auth.revokeRefreshTokens(uid);

  await ref.update({ name: next.name, roles: next.roles, active: next.active, updatedAt: FieldValue.serverTimestamp() });
  await upsertPerson({ uid, empNo: current.empNo, name: next.name, roles: next.roles, active: next.active });
  return { ok: true };
});

/** Sets a new PIN and signs the user out everywhere. */
export const resetPin = onCall(opts, async (req) => {
  requireAdmin(req);
  const uid = String(req.data?.uid ?? '');
  if (!uid) throw new HttpsError('invalid-argument', 'Missing user.');
  const pin = parsePin(req.data?.pin);
  await auth.updateUser(uid, { password: pin });
  await auth.revokeRefreshTokens(uid);
  await db.doc(`users/${uid}`).update({ pinResetAt: FieldValue.serverTimestamp() });
  return { ok: true };
});
