# AOP Safety Audit

Area Ownership Program safety audits for one cement plant. Auditors score each sub-area monthly on a
0–1 scale with remarks and photos. Area owners and managers close findings with photo proof. The safety
officer manages setup, users, the dashboard and Excel exports.

Web app (installable PWA, works offline) · React + TypeScript + Tailwind · Firebase (Auth, Firestore,
Storage, Functions, Hosting).

## Entry links

| Link | Who | Role claim |
| --- | --- | --- |
| `/audit` | Auditors | `auditor` |
| `/area` | Area owners and managers | `area` |
| `/admin` | Safety officer | `admin` |

- **Safety officers** sign in at `/admin` with **email + password** (Forgot password sends a reset email).
- **Auditors and area owners/managers** sign in at their own link with **employee number + 6-digit PIN**.
  Behind the scenes `EMP1024` is the Firebase Auth user `emp1024@aop.internal`.
- There is no public sign-up. The **first safety officer** is created once at `/admin/setup` with a setup
  code; after that, safety officers add every other user (including other safety officers) on the Users
  page, which also has copyable sign-in links to send to staff.

## Project layout

```
src/
  contexts/     AuthContext (session + role claims), ConfigContext (setup data, 2 docs)
  lib/          firebase init, identity, scoring, callables, local IndexedDB (drafts/outbox)
  components/   AppShell, SyncBar, RequireRole, pickers, UI kit
  pages/        audit/, area/, admin/, auth/
functions/src/  Cloud Functions: setupFirstAdmin, createUser, updateUser, resetCredential, onConfigMainUpdated
scripts/seed.mjs  one-time import of plant setup + first safety officer
seed/aop-seed.json  areas, sub-areas, contractors, observations from the current workbook
firestore.rules, storage.rules, firestore.indexes.json
```

## Data model

| Path | Holds |
| --- | --- |
| `config/main` | Areas, sub-areas (owner/manager ids, contractors), contractor list, people directory, colour bands |
| `config/checklists` | `lists: { [subAreaId]: Observation[] }` |
| `users/{uid}` | Employee no, name, roles, active (written by functions only) |
| `audits/{auditId}` | One audit with a copy of every observation text, score, remark, photos *(phase 2)* |
| `actions/{auditId_obsId}` | One corrective action per score below 1 *(phase 3)* |
| `summaries/{YYYY-MM}` | Monthly roll-up for the dashboard *(phase 5)* |

All setup data is two documents, so every app open costs about 2 reads and the full checklist set is on
the device for offline audits.

## Setup

### 1. Firebase project

1. Create a project in the [Firebase console](https://console.firebase.google.com).
2. Upgrade to the **Blaze** plan and add a **US$1 budget alert** (Google Cloud console → Billing →
   Budgets). Storage and Functions need Blaze; normal use stays inside the free quotas.
3. **Authentication** → Sign-in method → enable **Email/Password**.
4. **Firestore** → create database in **asia-south1** (Mumbai), production mode.
5. **Storage** → create the default bucket in **us-central1** (free quota region).
6. Project settings → add a **Web app**, copy its config.

### 2. Local setup

```bash
npm install
npm --prefix functions install
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc     # set your project id
cp .env.example .env                   # paste the web app config
```

The app uses the named Firestore database **`aop-safety-audit-system`** (see `firebase.json`). The same ID is
set in `.env` (`VITE_FIRESTORE_DATABASE_ID`), `functions/.env` (`FIRESTORE_DATABASE_ID`) and the GitHub
workflows. Change all four together if the database changes.

### GitHub Actions secrets

The hosting workflows build the app, so add these repository secrets (Settings → Secrets and variables →
Actions) with the values from `.env`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
`VITE_FIREBASE_APP_ID`. Merges to `main` deploy hosting; rules and functions are deployed with the CLI.

### 3. Deploy rules, indexes and functions

```bash
firebase deploy --only firestore,storage,functions
```

On the first functions deploy the CLI asks for **`ADMIN_SETUP_CODE`**: choose a one-time code (e.g. 12
random characters). It is saved in `functions/.env.<project-id>` (git-ignored) and is needed once, at
`/admin/setup`.

### 4. Import the plant setup

Project settings → Service accounts → **Generate new private key**, save it as
`scripts/service-account.json` (git-ignored). Then:

```bash
GOOGLE_APPLICATION_CREDENTIALS=scripts/service-account.json \
npm run seed -- --project <project-id> --database aop-safety-audit-system
```

Re-running is safe: existing setup is skipped unless you pass `--force`.

### 5. Create the first safety officer

Open `https://<your-site>/admin/setup`, enter name, email, password and the setup code. The page closes
for good once the first safety officer exists. (Alternatively pass `--admin-email`, `--admin-name` and
`--admin-password` to the seed script.)

### 6. Run and deploy the app

```bash
npm run dev          # local, http://localhost:5173/admin
npm run deploy       # build + firebase deploy (hosting, rules, functions)
```

### Emulators (optional)

```bash
firebase emulators:start
npm run seed -- --project demo-aop --emulator --admin-email so@example.com --admin-password password123
VITE_USE_EMULATORS=true npm run dev
```

## Build phases

- [x] **1. Foundation** — auth, roles, links, rules, user functions, PWA shell, workbook import, owner/manager assignment
- [x] **2. Auditor app** — scoring form, device drafts, photo compression, outbox sync
- [x] **3. Area owner / manager** — open actions, photo proof, audit view
- [ ] **4. Safety officer admin** — observation and contractor editor, audit list, view and share
- [ ] **5. Dashboard and export** — summary functions, charts, Excel export in the current layout
- [ ] **6. Site test and handover**

## Notes on the imported workbook

- 34 areas, 43 sub-areas, 29 contractors, 829 observations.
- *General administrative area*, observation 13 was blank in the workbook and was skipped.
- *Palletizer warehouse*, observation 20 was marked NA as its full score; it is imported as a normal
  observation (NA is chosen per audit).
- Sub-areas with no contractor listed: Shift room, Maintenance Stores, Old electrical room, Main Electrical Sub.
- Contractor names were normalised (e.g. "Tasma man power" → Tasma Man Power, "Aponse" → Aponsu).
  "RE" in Contractor yard is kept as written.
