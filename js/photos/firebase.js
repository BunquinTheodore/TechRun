// Firebase web SDK setup for the race photo pages (photos/*.html). No bundler: modular SDK from gstatic.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js";

/** Base URL of the Firebase JS SDK modules; import other SDK functions from `${SDK}/firebase-*.js`. */
export const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

// PASTE THE REAL WEB CONFIG HERE: Firebase console > Project settings > Your apps > Web app > SDK setup.
// The web config is not a secret, but keep it out of this file until the project exists.
const FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY",
  authDomain: "techrun-2027.firebaseapp.com",
  projectId: "techrun-2027",
  storageBucket: "techrun-2027.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID",
};

// PASTE THE reCAPTCHA ENTERPRISE SITE KEY HERE: Firebase console > App Check > Apps > Web app > reCAPTCHA Enterprise.
// When functions/src/config.ts ENFORCE_APP_CHECK is true, the buyer callables (createOrders, getOrder, submitReceipt,
// getDownloads) reject calls without an App Check token. Set this key and that flag together before launch.
const APP_CHECK_SITE_KEY = "PASTE_RECAPTCHA_ENTERPRISE_SITE_KEY";

/** Must match functions/src/config.ts REGION. */
export const REGION = "asia-southeast1";

/** Must match functions/src/config.ts DEFAULT_EVENT_ID. */
export const EVENT_ID = "techrun-2027";

/** True on localhost / 127.0.0.1: every service talks to the Emulator Suite (ports from firebase.json). */
export const USING_EMULATORS = ["localhost", "127.0.0.1"].includes(location.hostname);

/** False until the placeholder web config above is replaced (emulators work either way). */
export const IS_CONFIGURED = !FIREBASE_CONFIG.apiKey.startsWith("PASTE_");

export const app = initializeApp(FIREBASE_CONFIG);
// App Check proves calls come from this site. Skipped on the emulators (not enforced there) and until the key is set.
if (!USING_EMULATORS && !APP_CHECK_SITE_KEY.startsWith("PASTE_")) {
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
}
export const auth = getAuth(app);
export const db = getFirestore(app);
// The Storage emulator registers the upload trigger on the legacy default bucket, so use it there.
export const storage = USING_EMULATORS ? getStorage(app, `gs://${FIREBASE_CONFIG.projectId}.appspot.com`) : getStorage(app);
export const functions = getFunctions(app, REGION);

if (USING_EMULATORS) {
  const host = "127.0.0.1";
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
  connectFunctionsEmulator(functions, host, 5001);
}
