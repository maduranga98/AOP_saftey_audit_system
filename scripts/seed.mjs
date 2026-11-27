#!/usr/bin/env node
/**
 * One-time setup: loads plant setup from seed/aop-seed.json and creates the first safety officer.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=scripts/service-account.json \
 *   node scripts/seed.mjs --project <project-id> [--admin-email so@plant.lk --admin-name "Safety Officer" --admin-password ********]
 *
 * Without --admin-email, create the first safety officer at /admin/setup with the setup code.
 *
 * Options:
 *   --force        overwrite config/main areas, sub-areas, contractors and config/checklists if they exist
 *   --skip-config  only create the admin user
 *   --emulator     write to local emulators instead of the live project
 *   --database     Firestore database ID (default: aop-safety-audit-system, or (default))
 */
import { readFile } from 'node:fs/promises';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (!a.startsWith('--')) return acc;
    const next = all[i + 1];
    acc.push([a.slice(2), next && !next.startsWith('--') ? next : true]);
    return acc;
  }, []),
);

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const projectId = args.project || process.env.GCLOUD_PROJECT;
if (!projectId) fail('Pass --project <firebase-project-id>.');
if (args.emulator) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
}

initializeApp({ projectId, ...(args.emulator ? {} : { credential: applicationDefault() }) });
const auth = getAuth();
const databaseId = args.database || process.env.FIRESTORE_DATABASE_ID || 'aop-safety-audit-system';
const db = databaseId === '(default)' ? getFirestore() : getFirestore(databaseId);
console.log(`• Project ${projectId}, database ${databaseId}`);

async function seedConfig() {
  const seed = JSON.parse(await readFile(new URL('../seed/aop-seed.json', import.meta.url), 'utf8'));
  const mainRef = db.doc('config/main');
  const listsRef = db.doc('config/checklists');
  const [main, lists] = await Promise.all([mainRef.get(), listsRef.get()]);

  if ((main.exists && main.get('subAreas')?.length) || lists.exists) {
    if (!args.force) {
      console.log('• Plant setup already exists. Skipping (use --force to overwrite).');
      return;
    }
    console.log('• --force: overwriting plant setup (people directory is kept).');
  }

  await mainRef.set(
    {
      areas: seed.areas,
      subAreas: seed.subAreas,
      contractors: seed.contractors,
      bands: seed.bands,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  if (!main.exists || !main.get('people')) await mainRef.set({ people: [] }, { merge: true });
  await listsRef.set({ lists: seed.checklists, updatedAt: FieldValue.serverTimestamp() });

  const obs = Object.values(seed.checklists).reduce((n, l) => n + l.length, 0);
  console.log(`✔ Plant setup: ${seed.areas.length} areas, ${seed.subAreas.length} sub-areas, ${seed.contractors.length} contractors, ${obs} observations.`);
}

async function seedAdmin() {
  if (!args['admin-email']) {
    console.log('• No --admin-email given. Create the first safety officer at /admin/setup instead.');
    return;
  }
  const email = String(args['admin-email']).trim().toLowerCase();
  const name = String(args['admin-name'] || 'Safety Officer').trim();
  const password = String(args['admin-password'] || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('--admin-email is not a valid email.');
  if (password.length < 8) fail('--admin-password must be at least 8 characters.');

  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, displayName: name, disabled: false });
    console.log(`• ${email} already exists. Password and name updated.`);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    user = await auth.createUser({ email, password, displayName: name });
    console.log(`✔ Created ${email}.`);
  }

  const existing = (await auth.getUser(user.uid)).customClaims?.roles ?? [];
  const roles = [...new Set([...existing, 'admin'])];
  await auth.setCustomUserClaims(user.uid, { roles });

  const person = { uid: user.uid, empNo: '', email, name, roles, active: true };
  await db.doc(`users/${user.uid}`).set(
    { ...person, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: 'seed' },
    { merge: true },
  );
  await db.runTransaction(async (tx) => {
    const ref = db.doc('config/main');
    const snap = await tx.get(ref);
    const people = (snap.exists ? snap.get('people') : null) ?? [];
    const next = [...people.filter((p) => p.uid !== user.uid), person].sort((a, b) => a.name.localeCompare(b.name));
    tx.set(ref, { people: next }, { merge: true });
  });
  await db.doc('public/status').set({ adminReady: true }, { merge: true });
  console.log(`✔ ${name} (${email}) is a safety officer. Sign in at /admin.`);
}

try {
  if (!args['skip-config']) await seedConfig();
  await seedAdmin();
  console.log('\nDone.\n');
  process.exit(0);
} catch (e) {
  fail(e.message || String(e));
}
