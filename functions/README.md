# TechRun race photos: backend

Cloud Functions (Node 20, TypeScript) behind `photos/*.html`: the upload pipeline (Cloud Vision bib reading),
per photographer GCash orders, and the admin setup callables. Settings live in `src/config.ts`.

## Setup for a real project

1. Create the Firebase project (or change `.firebaserc`) and switch it to the Blaze plan. Set a budget alert.
2. Use `asia-southeast1` for Firestore and the default Storage bucket. It must match `REGION` in `src/config.ts`
   and `js/photos/firebase.js`.
3. Turn on Authentication (Google and Email link), Firestore, Storage, and the Cloud Vision API
   (`gcloud services enable vision.googleapis.com iamcredentials.googleapis.com`).
4. **Download links.** `getDownloads` signs URLs to the originals, which needs the functions runtime service account
   to hold Service Account Token Creator on itself. Without it every approved buyer gets an error. Grant it once
   (the account is shown on the function's details page, usually the Compute Engine default service account):

   ```sh
   SA="PROJECT_NUMBER-compute@developer.gserviceaccount.com"
   gcloud iam service-accounts add-iam-policy-binding "$SA" \
     --member="serviceAccount:$SA" --role="roles/iam.serviceAccountTokenCreator" --project techrun-2027
   ```

5. Paste the web app config into `FIREBASE_CONFIG` in `js/photos/firebase.js`.
6. Install the Trigger Email extension (`firebase ext:install firebase/firestore-send-email`), collection `mail`,
   SMTP credentials kept in Secret Manager.
7. Create `functions/.env` with `SITE_URL=https://<hosting domain>` so links in emails are correct.
8. Make the first admin: sign in once on `photos/admin.html`, then
   `npx tsx scripts/grant-admin.ts <email> --project techrun-2027`.
9. Before launch, add the reCAPTCHA Enterprise key to `js/photos/firebase.js` and set `ENFORCE_APP_CHECK = true`
   in `src/config.ts` together.
10. Deploy: `npm ci && npm run typecheck && npm test`, then from the repo root
    `firebase deploy --only firestore:rules,firestore:indexes,storage`, `firebase deploy --only functions`,
    `firebase deploy --only hosting`. Wait for the indexes and the TTL policies on `orders.expireAt` and
    `rateLimits.expireAt` before announcing.

## Local emulators with sample data

```sh
npm run build
firebase emulators:start --project techrun-2027          # from the repo root
# in another terminal, from functions/:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 node scripts/seed-emulator.mjs
```

The seed adds an admin and two photographers (`admin@techrun.test`, `lens@techrun.test`, `shutter@techrun.test`;
sign in with an email link, the link appears at http://127.0.0.1:4000/auth), bibs, 12 sample photos and two orders,
and prints the order page links. Emulator data is not kept between restarts, so run the seed again after each start.
Vision and URL signing need real credentials, so on the emulator every scan lands in review and downloads fail.
