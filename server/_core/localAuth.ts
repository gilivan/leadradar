/**
 * localAuth.ts
 * Local authentication module for running LeadRadar without Manus OAuth.
 * Uses username/password stored in environment variables + JWT sessions.
 *
 * Set in .env:
 *   LOCAL_AUTH=true
 *   LOCAL_ADMIN_USER=admin
 *   LOCAL_ADMIN_PASSWORD=your_secure_password
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const LOCAL_AUTH_ENABLED = process.env.LOCAL_AUTH === "true";
const LOCAL_ADMIN_USER = process.env.LOCAL_ADMIN_USER ?? "admin";
const LOCAL_ADMIN_PASSWORD_HASH = process.env.LOCAL_ADMIN_PASSWORD_HASH ?? "";
const LOCAL_ADMIN_PASSWORD = process.env.LOCAL_ADMIN_PASSWORD ?? "leadradar";
const JWT_SECRET = process.env.JWT_SECRET ?? "local-dev-secret-change-me";

export function isLocalAuthEnabled(): boolean {
  return LOCAL_AUTH_ENABLED;
}

function getSecretKey() {
  return new TextEncoder().encode(JWT_SECRET);
}

/** Verify username + password, return JWT token if valid */
export async function localLogin(
  username: string,
  password: string
): Promise<string | null> {
  if (username !== LOCAL_ADMIN_USER) return null;

  // Support both plain password (dev) and bcrypt hash (production)
  let valid = false;
  if (LOCAL_ADMIN_PASSWORD_HASH) {
    valid = await bcrypt.compare(password, LOCAL_ADMIN_PASSWORD_HASH);
  } else {
    valid = password === LOCAL_ADMIN_PASSWORD;
  }

  if (!valid) return null;

  const token = await new SignJWT({
    openId: `local_${username}`,
    appId: "local",
    name: username,
    role: "admin",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(getSecretKey());

  return token;
}

/** Authenticate a request using local JWT cookie */
export async function localAuthenticateRequest(req: Request): Promise<{
  id: number;
  openId: string;
  name: string;
  email: string | null;
  role: "admin" | "user";
  loginMethod: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
} | null> {
  const cookieHeader = req.headers.cookie ?? "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
    })
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const { openId, name } = payload as Record<string, unknown>;
    if (typeof openId !== "string" || typeof name !== "string") return null;

    const now = new Date();
    return {
      id: 1,
      openId,
      name,
      email: null,
      role: "admin" as const,
      loginMethod: "local",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };
  } catch {
    return null;
  }
}

/** Generate a bcrypt hash for a password (use for setup) */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
