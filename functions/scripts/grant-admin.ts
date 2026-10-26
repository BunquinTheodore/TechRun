// Bootstraps an admin: sets the `admin` custom claim on one user so they can use photos/admin.html.
// Every later admin action (inviting photographers, importing bibs, the review queue) goes through that page.
//
// The user must exist first: sign in once on photos/admin.html (email link or Google) with the address.
//
// Run from functions/ with Application Default Credentials for the target project:
//   gcloud auth application-default login
//   npx tsx scripts/grant-admin.ts someone@example.com --project <project-id>
// Remove the claim:
//   npx tsx scripts/grant-admin.ts someone@example.com --project <project-id> --revoke
// Against the local Auth emulator instead (no credentials needed):
//   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npx tsx scripts/grant-admin.ts someone@example.com --project techrun-2027
//
// The user has to sign out and in again (or refresh their ID token) before the new claim takes effect.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

interface Args {
  email: string;
  projectId: string | undefined;
  revoke: boolean;
}

function parseArgs(argv: string[]): Args {
  const email = argv.find((a) => !a.startsWith("--") && a.includes("@"));
  const projectFlag = argv.indexOf("--project");
  const projectId = projectFlag >= 0 ? argv[projectFlag + 1] : process.env.GCLOUD_PROJECT;
  if (!email) {
    console.error("Usage: npx tsx scripts/grant-admin.ts <email> --project <project-id> [--revoke]");
    process.exit(2);
  }
  return { email: email.trim().toLowerCase(), projectId, revoke: argv.includes("--revoke") };
}

async function main(): Promise<void> {
  const { email, projectId, revoke } = parseArgs(process.argv.slice(2));
  initializeApp(projectId ? { projectId } : undefined);
  const auth = getAuth();

  const user = await auth.getUserByEmail(email).catch((err: { code?: string }) => {
    if (err.code === "auth/user-not-found") {
      console.error(`No user with ${email}. Sign in once on photos/admin.html first, then run this again.`);
      process.exit(1);
    }
    throw err;
  });

  const { admin: _previous, ...otherClaims } = user.customClaims ?? {};
  const claims = revoke ? otherClaims : { ...otherClaims, admin: true };
  await auth.setCustomUserClaims(user.uid, claims);
  console.log(`${revoke ? "Removed admin from" : "Granted admin to"} ${email} (uid ${user.uid}) in ${projectId ?? "the default project"}.`);
  console.log("Claims now:", JSON.stringify(claims));
}

main().catch((err: unknown) => {
  console.error("grant-admin failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
