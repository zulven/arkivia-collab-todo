import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "./firebaseAdmin.js";

const COOKIE_NAME = "__session";

function isSecureRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.header("x-forwarded-proto");
  return proto === "https";
}

export async function createSession(req: Request, res: Response) {
  const header = req.header("authorization");
  if (!header) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  const idToken = match?.[1];
  if (!idToken) {
    res.status(401).json({ error: "Invalid Authorization header" });
    return;
  }

  try {
    const app = getFirebaseAdminApp();
    const auth = getAuth(app);

    // Verify first (also avoids minting cookies for invalid tokens)
    await auth.verifyIdToken(idToken);

    const expiresInMs = 1000 * 60 * 60 * 24 * 5; // 5 days
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: expiresInMs });

    const secure = isSecureRequest(req);
    const parts = [
      `${COOKIE_NAME}=${sessionCookie}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${Math.floor(expiresInMs / 1000)}`
    ];
    if (secure) parts.push("Secure");

    res.setHeader("Set-Cookie", parts.join("; "));
    res.status(204).send();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function clearSession(_req: Request, res: Response) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  res.status(204).send();
}

export function readSessionCookie(req: Request): string | null {
  const cookieHeader = req.header("cookie");
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const key = p.slice(0, idx);
    const val = p.slice(idx + 1);
    if (key === COOKIE_NAME) return val;
  }
  return null;
}
