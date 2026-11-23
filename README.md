# 🎄 Secret Santa — Wheel of Names

A mobile-first Kris Kringle app built with **Next.js (App Router) + Tailwind CSS + Cloud Firestore**.
Participants enter their name, spin the wheel, see who they drew, and lock the result with a 4-digit PIN.
The admin manages the roster and sees every draw at `/admin`.

## 1. Run locally

```bash
npm install
cp .env.local.example .env.local   # then fill in your Firebase values
npm run dev
```

Open http://localhost:3000 (participants) and http://localhost:3000/admin (admin).

## 2. Connect a Firebase project

1. Go to the [Firebase Console](https://console.firebase.google.com) and click **Add project**.
2. In **Build → Firestore Database**, click **Create database** (production mode, pick a region close to you).
3. In **Project settings → General → Your apps**, click the **Web** (`</>`) icon, register an app, and copy the `firebaseConfig` values.
4. Paste them into `.env.local`:

   | Variable | Firebase config key |
   | --- | --- |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

5. Set `NEXT_PUBLIC_ADMIN_PIN` to your own admin passcode.
6. Deploy the security rules (see below), or paste `firestore.rules` into **Firestore → Rules → Publish**.

## 3. Deploy

### Option A — Firebase Hosting

The app is exported as static files (`output: "export"`), so Hosting serves the `out/` folder.

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # choose your project
npm run build                 # produces ./out
firebase deploy --only hosting,firestore:rules
```

Your site will be at `https://<project-id>.web.app`.

### Option B — Vercel

1. Push this folder to a GitHub repository.
2. In [Vercel](https://vercel.com), choose **Add New → Project** and import the repo (framework preset: Next.js).
3. Under **Environment Variables**, add all seven `NEXT_PUBLIC_*` variables from `.env.local.example`.
4. Click **Deploy**. Then publish `firestore.rules` from the Firebase console (or `firebase deploy --only firestore:rules`).

Note: `NEXT_PUBLIC_*` variables are baked in at build time, so redeploy after changing any of them.

## 4. Party-day checklist

1. Open `/admin`, enter the admin PIN, and add participants (single form or bulk paste: `Name | Wishlist`, one per line).
2. Share the main URL (or a QR code) with everyone.
3. Each person enters their name → spins → screenshots their match → sets a 4-digit PIN.
4. Someone forgot their PIN? Find it in the admin master table, or press **Reset User** to let them spin again (their previous match is freed up).

## How the draw works

- A Firestore `runTransaction` reads every participant, then picks a random target who is **not the spinner** and **not already drawn**.
- **Deadlock prevention:** it never picks a target that would leave the final unspun person as the only undrawn name (they would be forced to draw themselves).
- The spinner (`hasSpun`, `drawn*`, `spunAt`) and the target (`isDrawn`) are updated in the same transaction, so two people spinning at once can never get the same match.
- The wheel always shows every name, so nobody can deduce who is left.

## Project layout

```
src/
  app/            layout, participant page (/), admin page (/admin)
  components/     WheelCanvas, ResultModal, ParticipantFlow, AdminDashboard
  lib/            firebase.ts, types.ts, draw.ts (transaction)
firestore.rules   shape validation for the participants collection
firebase.json     Hosting + rules config
```

## Security notes (please read)

- There is no sign-in. The admin PIN and the participant PINs are **casual-party protection**, not real security. `NEXT_PUBLIC_*` values are visible in the browser bundle, and PINs are stored in Firestore as plain text because the spec has the admin view them for recovery.
- Anyone technical who opens the browser dev tools could read the `participants` collection and see the matches. For a friendly office party that is usually fine; for anything higher-stakes, move the draw into a Cloud Function with Firebase Authentication.
- `firestore.rules` restricts access to the `participants` collection and validates data shape, but cannot distinguish the admin from a participant without auth.
- Reading the match before a PIN is set: if someone refreshes after spinning but before saving a PIN, the app lets them (by name) finish setting the PIN. Tell everyone to set their PIN immediately, or use **Reset User** if needed.
