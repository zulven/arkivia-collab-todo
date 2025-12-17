import admin from "firebase-admin";

let initialized = false;

export function getFirebaseAdminApp() {
  if (!initialized) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    initialized = true;
  }

  return admin.app();
}
