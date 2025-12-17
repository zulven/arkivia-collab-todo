import type { NextFunction, Request, Response } from "express";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "./firebaseAdmin.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: DecodedIdToken;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  if (!token) {
    res.status(401).json({ error: "Invalid Authorization header" });
    return;
  }

  try {
    const app = getFirebaseAdminApp();
    const decoded = await getAuth(app).verifyIdToken(token);
    req.auth = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
