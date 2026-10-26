// Lazy Admin SDK access. Call these inside handlers (not at module load) so tests can import modules freely.
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export function ensureApp(): void {
  if (getApps().length === 0) initializeApp();
}

export function db(): Firestore {
  ensureApp();
  return getFirestore();
}

export function auth(): Auth {
  ensureApp();
  return getAuth();
}

/** Default Storage bucket, or a named one (the trigger event carries the bucket name). */
export function bucket(name?: string) {
  ensureApp();
  return name ? getStorage().bucket(name) : getStorage().bucket();
}
