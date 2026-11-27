import { FieldValue } from 'firebase-admin/firestore';
import { defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  assertEmailFree,
  auth,
  db,
  EMP_RE,
  empNoToEmail,
  isPinEmail,
  normalizeEmpNo,
  parseEmail,
  parseName,
  parsePassword,
  parsePin,
  parseRoles,
  requireAdmin,
  upsertPerson,
  type Person,
} from './shared';

const opts = { cors: true } as const;

/**
 * One-time code needed to create the first safety officer from /admin/setup.
 * The CLI asks for it on first deploy and keeps it in functions/.env.<projectId> (git-ignored).
 */
const ADMIN_SETUP_CODE = defineString('ADMIN_SETUP_CODE', {
  description: 'One-time code for creating the first safety officer at /admin/setup',
});

const STATUS_DOC = 'public/status';

async function writeUser(person: Person, createdBy: string): Promise<void> {
  await db.doc(`users/${person.uid}`).set({
    ...person,
    createdAt: FieldValue.serverTimestamp(),
    createdBy,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await upsertPerson(person);
}

/**
 * First-run setup: creates the first safety officer with email + password.
 * Works only while no safety officer exists, and only with the setup code.
 */
export const setupFirstAdmin = onCall(opts, async (req) => {
  const name = parseName(req.data?.name);
  const email = parseEmail(req.data?.email);
  const password = parsePassword(req.data?.password);
  const code = String(req.data?.setupCode ?? '').trim();
  const expected = ADMIN_SETUP_CODE.value().trim();
  if (!expected || code !== expected) throw new HttpsError('permission-denied', 'Setup code is wrong.');

  const statusRef = db.doc(STATUS_DOC);
  // Claim the setup slot first so two people cannot both become the first safety officer.
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(statusRef);
    if (snap.exists && (snap.get('adminReady') || snap.get('setupLock'))) {
      throw new HttpsError('failed-precondition', 'Setup is already complete. Sign in instead.');
    }
    tx.set(statusRef, { setupLock: true }, { merge: true });
  });

  try {
    await assertEmailFree(email, email);
    const user = await auth.createUser({ email, password, displayName: name, emailVerified: false });
    await auth.setCustomUserClaims(user.uid, { roles: ['admin'] });
    await writeUser({ uid: user.uid, empNo: '', email, name, roles: ['admin'], active: true }, 'setup');
    await statusRef.set({ adminReady: true, setupLock: FieldValue.delete(), setupAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true };
  } catch (err) {
    await statusRef.set({ setupLock: FieldValue.delete() }, { merge: true });
    throw err;
  }
});

/**
 * Safety officer adds a user.
 * - Safety officers (admin role) get an email + password account.
 * - Auditors and area owners/managers get an employee number + 6-digit PIN account.
 */
export const createUser = onCall(opts, async (req) => {
  const adminUid = requireAdmin(req);
  const name = parseName(req.data?.name);
  const roles = parseRoles(req.data?.roles);

  let person: Person;
  let password: string;
  if (roles.includes('admin')) {
    const email = parseEmail(req.data?.email);
    password = parsePassword(req.data?.password);
    await assertEmailFree(email, email);
    person = { uid: '', empNo: '', email, name, roles, active: true };
  } else {
    const empNo = normalizeEmpNo(req.data?.empNo);
    if (!EMP_RE.test(empNo)) throw new HttpsError('invalid-argument', 'Employee number: 2–20 letters, digits or dashes.');
    password = parsePin(req.data?.pin);
    await assertEmailFree(empNoToEmail(empNo), `Employee number ${empNo}`);
    person = { uid: '', empNo, name, roles, active: true };
  }

  const user = await auth.createUser({
    email: person.email ?? empNoToEmail(person.empNo),
    password,
    displayName: name,
    emailVerified: !person.email,
  });
  await auth.setCustomUserClaims(user.uid, { roles });
  person.uid = user.uid;
  if (!person.email) delete person.email;
  await writeUser(person, adminUid);
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
  if (req.data?.roles !== undefined) next.roles = parseRoles(req.data.roles);
  if (req.data?.active !== undefined) next.active = Boolean(req.data.active);

  if (next.roles.includes('admin') && !current.email) {
    throw new HttpsError('failed-precondition', 'Safety officers sign in with email. Add them as a new safety officer with their email.');
  }
  if (uid === adminUid) {
    if (!next.roles.includes('admin')) throw new HttpsError('failed-precondition', 'You cannot remove your own safety officer role.');
    if (!next.active) throw new HttpsError('failed-precondition', 'You cannot switch off your own account.');
  }

  await auth.updateUser(uid, { displayName: next.name, disabled: !next.active });
  if (next.roles.join() !== current.roles.join()) await auth.setCustomUserClaims(uid, { roles: next.roles });
  if (!next.active && current.active) await auth.revokeRefreshTokens(uid);

  await ref.update({ name: next.name, roles: next.roles, active: next.active, updatedAt: FieldValue.serverTimestamp() });
  const person: Person = { uid, empNo: current.empNo ?? '', name: next.name, roles: next.roles, active: next.active };
  if (current.email) person.email = current.email;
  await upsertPerson(person);
  return { ok: true };
});

/** Sets a new PIN (staff) or password (safety officer) and signs the user out everywhere. */
export const resetCredential = onCall(opts, async (req) => {
  requireAdmin(req);
  const uid = String(req.data?.uid ?? '');
  if (!uid) throw new HttpsError('invalid-argument', 'Missing user.');
  const user = await auth.getUser(uid);
  const secret = isPinEmail(user.email) ? parsePin(req.data?.secret) : parsePassword(req.data?.secret);
  await auth.updateUser(uid, { password: secret });
  await auth.revokeRefreshTokens(uid);
  await db.doc(`users/${uid}`).update({ credentialResetAt: FieldValue.serverTimestamp() });
  return { ok: true };
});
