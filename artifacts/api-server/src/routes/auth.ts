import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { db, usersTable, otpsTable, registrationTokensTable, webauthnCredentialsTable, webauthnChallengesTable, loginChallengesTable, activityEventsTable } from "@workspace/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import {
  RegisterStartBody,
  RegisterVerifyOtpBody,
  RegisterCompleteBody,
  EnrollFaceBody,
  LoginLookupBody,
  LoginFaceBody,
  LoginWebauthnOptionsBody,
  LoginWebauthnVerifyBody,
  WebauthnRegisterVerifyBody,
} from "@workspace/api-zod";
import {
  encryptString,
  generateOtp,
  generateToken,
  hashSecret,
  sha256,
  verifySecret,
} from "../lib/crypto";
import { setSessionUser, clearSession, getSession, requireAuth } from "../lib/session";
import { getRpInfo } from "../lib/webauthn";
import { euclideanDistance, FACE_MATCH_THRESHOLD } from "../lib/face";
import { serializeUser } from "../lib/serializeUser";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const router: IRouter = Router();

const OTP_TTL_SECONDS = 300; // 5 minutes
const REG_TOKEN_TTL_SECONDS = 900; // 15 minutes
const LOGIN_CHALLENGE_TTL_SECONDS = 300;
const WEBAUTHN_CHALLENGE_TTL_SECONDS = 300;

function getIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0]!.trim();
  if (Array.isArray(fwd) && fwd[0]) return fwd[0];
  return req.ip ?? null;
}

async function logActivity(opts: {
  userId?: string | null;
  email?: string | null;
  kind: string;
  method?: string | null;
  success: boolean;
  ipAddress?: string | null;
}): Promise<void> {
  await db.insert(activityEventsTable).values({
    userId: opts.userId ?? null,
    email: opts.email ?? null,
    kind: opts.kind,
    method: opts.method ?? null,
    success: opts.success,
    ipAddress: opts.ipAddress ?? null,
  });
}

router.post("/auth/register/start", async (req, res) => {
  const parsed = RegisterStartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const otp = generateOtp();
  const otpHash = await hashSecret(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  // Invalidate previous OTPs for this email
  await db
    .update(otpsTable)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpsTable.email, email), isNull(otpsTable.consumedAt)));

  await db.insert(otpsTable).values({
    email,
    otpHash,
    expiresAt,
  });

  req.log.info({ email }, "OTP issued");

  // No email provider in this environment — return demoOtp so the UI can display it.
  res.json({
    email,
    expiresInSeconds: OTP_TTL_SECONDS,
    demoOtp: otp,
  });
});

router.post("/auth/register/verify-otp", async (req, res) => {
  const parsed = RegisterVerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();
  const { otp } = parsed.data;

  const candidates = await db
    .select()
    .from(otpsTable)
    .where(
      and(
        eq(otpsTable.email, email),
        isNull(otpsTable.consumedAt),
        gt(otpsTable.expiresAt, new Date()),
      ),
    )
    .orderBy(sql`${otpsTable.createdAt} desc`)
    .limit(1);

  const otpRow = candidates[0];
  if (!otpRow) {
    res.status(400).json({ error: "OTP expired or not found. Please request a new one." });
    return;
  }

  if (otpRow.attempts >= 5) {
    res.status(429).json({ error: "Too many attempts. Please request a new OTP." });
    return;
  }

  const ok = await verifySecret(otp, otpRow.otpHash);
  if (!ok) {
    await db
      .update(otpsTable)
      .set({ attempts: otpRow.attempts + 1 })
      .where(eq(otpsTable.id, otpRow.id));
    res.status(400).json({ error: "Incorrect OTP" });
    return;
  }

  await db
    .update(otpsTable)
    .set({ consumedAt: new Date() })
    .where(eq(otpsTable.id, otpRow.id));

  const token = generateToken(32);
  const tokenHash = sha256(token);
  await db.insert(registrationTokensTable).values({
    email,
    tokenHash,
    expiresAt: new Date(Date.now() + REG_TOKEN_TTL_SECONDS * 1000),
  });

  res.json({
    registrationToken: token,
    email,
    expiresInSeconds: REG_TOKEN_TTL_SECONDS,
  });
});

router.post("/auth/register/complete", async (req, res) => {
  const parsed = RegisterCompleteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid registration payload" });
    return;
  }
  const { registrationToken, fullName, aadhaarNumber, mpin, faceDescriptor } = parsed.data;

  if (!/^[0-9]{12}$/.test(aadhaarNumber)) {
    res.status(400).json({ error: "Aadhaar must be exactly 12 digits" });
    return;
  }
  if (!/^[0-9]{6}$/.test(mpin)) {
    res.status(400).json({ error: "MPIN must be 6 digits" });
    return;
  }

  const tokenHash = sha256(registrationToken);
  const tokens = await db
    .select()
    .from(registrationTokensTable)
    .where(
      and(
        eq(registrationTokensTable.tokenHash, tokenHash),
        isNull(registrationTokensTable.consumedAt),
        gt(registrationTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const tokenRow = tokens[0];
  if (!tokenRow) {
    res.status(400).json({ error: "Registration session expired. Please start over." });
    return;
  }

  const email = tokenRow.email;
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with that email already exists" });
    return;
  }

  const mpinHash = await hashSecret(mpin);
  const aadhaarEncrypted = encryptString(aadhaarNumber);
  const aadhaarLast4 = aadhaarNumber.slice(-4);

  const inserted = await db
    .insert(usersTable)
    .values({
      email,
      fullName,
      mpinHash,
      aadhaarEncrypted,
      aadhaarLast4,
      faceDescriptor: Array.isArray(faceDescriptor) && faceDescriptor.length > 0 ? faceDescriptor : null,
    })
    .returning();
  const user = inserted[0]!;

  await db
    .update(registrationTokensTable)
    .set({ consumedAt: new Date() })
    .where(eq(registrationTokensTable.id, tokenRow.id));

  setSessionUser(req, user.id);
  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(usersTable.id, user.id));

  await logActivity({
    userId: user.id,
    email,
    kind: "register",
    method: "otp",
    success: true,
    ipAddress: getIp(req),
  });

  res.json({ user: serializeUser(user, 0) });
});

router.post("/auth/face/enroll", requireAuth, async (req, res) => {
  const parsed = EnrollFaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid face descriptor" });
    return;
  }
  const session = getSession(req);
  const userId = session.userId!;
  const desc = parsed.data.faceDescriptor as number[];
  if (!Array.isArray(desc) || desc.length < 64 || desc.length > 256) {
    res.status(400).json({ error: "Face descriptor must be a numeric array of length 64-256" });
    return;
  }
  await db.update(usersTable).set({ faceDescriptor: desc }).where(eq(usersTable.id, userId));
  await logActivity({
    userId,
    kind: "enroll_face",
    method: "face",
    success: true,
    ipAddress: getIp(req),
  });
  res.json({ ok: true });
});

router.post("/auth/webauthn/register/options", requireAuth, async (req, res) => {
  const session = getSession(req);
  const userId = session.userId!;
  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { rpId } = getRpInfo(req);
  const existing = await db
    .select()
    .from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.userId, userId));

  const options = await generateRegistrationOptions({
    rpName: "Sentinel",
    rpID: rpId,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.fullName,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: (c.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
    })),
  });

  await db
    .insert(webauthnChallengesTable)
    .values({
      userId,
      kind: "register",
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + WEBAUTHN_CHALLENGE_TTL_SECONDS * 1000),
    });

  res.json(options);
});

import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

router.post("/auth/webauthn/register/verify", requireAuth, async (req, res) => {
  const parsed = WebauthnRegisterVerifyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid attestation payload" });
    return;
  }
  const session = getSession(req);
  const userId = session.userId!;
  const { rpId, origin } = getRpInfo(req);

  const challenges = await db
    .select()
    .from(webauthnChallengesTable)
    .where(
      and(
        eq(webauthnChallengesTable.userId, userId),
        eq(webauthnChallengesTable.kind, "register"),
        gt(webauthnChallengesTable.expiresAt, new Date()),
      ),
    )
    .orderBy(sql`${webauthnChallengesTable.createdAt} desc`)
    .limit(1);

  const challengeRow = challenges[0];
  if (!challengeRow) {
    res.status(400).json({ error: "Registration challenge expired. Try again." });
    return;
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: parsed.data.attestation as any,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: false,
    });
  } catch (err) {
    req.log.error({ err }, "WebAuthn registration verification failed");
    res.status(400).json({ error: "Could not verify biometric registration" });
    return;
  }

  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: "Biometric registration not verified" });
    return;
  }

  const info = verification.registrationInfo;
  const credentialId = info.credential.id;
  const publicKey = Buffer.from(info.credential.publicKey).toString("base64url");

  await db.insert(webauthnCredentialsTable).values({
    userId,
    credentialId,
    publicKey,
    counter: info.credential.counter,
    transports: info.credential.transports as string[] | null,
    deviceType: info.credentialDeviceType,
    backedUp: info.credentialBackedUp,
  });

  await db
    .update(webauthnChallengesTable)
    .set({ expiresAt: new Date(0) })
    .where(eq(webauthnChallengesTable.id, challengeRow.id));

  await logActivity({
    userId,
    kind: "enroll_biometric",
    method: "biometric",
    success: true,
    ipAddress: getIp(req),
  });

  res.json({ ok: true });
});

router.post("/auth/login/lookup", async (req, res) => {
  const parsed = LoginLookupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();
  const { mpin } = parsed.data;
  const rows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const user = rows[0];
  if (!user) {
    await logActivity({
      email,
      kind: "login_failed",
      method: "mpin",
      success: false,
      ipAddress: getIp(req),
    });
    res.status(401).json({ error: "Invalid email or MPIN" });
    return;
  }

  // Check if user is locked out
  if (user.mpinLockedUntil && user.mpinLockedUntil > new Date()) {
    const diff = Math.ceil((user.mpinLockedUntil.getTime() - Date.now()) / 60000);
    res.status(403).json({ 
      error: `Too many invalid attempts. Account locked for ${diff} minutes.`,
      lockedUntil: user.mpinLockedUntil
    });
    return;
  }

  const ok = await verifySecret(mpin, user.mpinHash);
  if (!ok) {
    // Increment attempts
    const newAttempts = user.mpinAttempts + 1;
    let mpinLockedUntil = user.mpinLockedUntil;

    if (newAttempts >= 3) {
      mpinLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    }

    await db.update(usersTable)
      .set({ mpinAttempts: newAttempts, mpinLockedUntil })
      .where(eq(usersTable.id, user.id));

    await logActivity({
      userId: user.id,
      email,
      kind: "login_failed",
      method: "mpin",
      success: false,
      ipAddress: getIp(req),
    });
    
    if (newAttempts >= 3) {
      res.status(403).json({ error: "Too many invalid attempts. Account locked for 15 minutes." });
    } else {
      res.status(401).json({ error: `Invalid MPIN. ${3 - newAttempts} attempts remaining.` });
    }
    return;
  }

  // Reset attempts on successful MPIN check
  await db.update(usersTable)
    .set({ mpinAttempts: 0, mpinLockedUntil: null })
    .where(eq(usersTable.id, user.id));

  const creds = await db
    .select()
    .from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.userId, user.id));

  const factors: ("face" | "biometric")[] = [];
  if (Array.isArray(user.faceDescriptor) && user.faceDescriptor.length > 0) factors.push("face");
  if (creds.length > 0) factors.push("biometric");

  if (factors.length === 0) {
    res.status(400).json({
      error:
        "No second factor enrolled on this account. Please re-register and enroll a biometric or face.",
    });
    return;
  }

  const challenge = generateToken(32);
  const tokenHash = sha256(challenge);
  await db.insert(loginChallengesTable).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + LOGIN_CHALLENGE_TTL_SECONDS * 1000),
  });

  res.json({
    challengeToken: challenge,
    availableFactors: factors,
    userHint: { fullName: user.fullName, email: user.email },
  });
});

async function consumeLoginChallenge(token: string): Promise<{ userId: string } | null> {
  const tokenHash = sha256(token);
  const rows = await db
    .select()
    .from(loginChallengesTable)
    .where(
      and(
        eq(loginChallengesTable.tokenHash, tokenHash),
        isNull(loginChallengesTable.consumedAt),
        gt(loginChallengesTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  await db
    .update(loginChallengesTable)
    .set({ consumedAt: new Date() })
    .where(eq(loginChallengesTable.id, row.id));
  return { userId: row.userId };
}

router.post("/auth/login/face", async (req, res) => {
  const parsed = LoginFaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { challengeToken, faceDescriptor } = parsed.data;
  if (!Array.isArray(faceDescriptor) || faceDescriptor.length < 64 || faceDescriptor.length > 256) {
    res.status(400).json({ error: "Invalid face descriptor" });
    return;
  }
  const consumed = await consumeLoginChallenge(challengeToken);
  if (!consumed) {
    res.status(400).json({ error: "Login session expired. Please re-enter your MPIN." });
    return;
  }

  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, consumed.userId)).limit(1);
  const user = userRows[0];
  if (!user || !Array.isArray(user.faceDescriptor) || user.faceDescriptor.length === 0) {
    res.status(400).json({ error: "Face not enrolled for this account" });
    return;
  }
  const distance = euclideanDistance(faceDescriptor as number[], user.faceDescriptor);
  if (distance > FACE_MATCH_THRESHOLD) {
    await logActivity({
      userId: user.id,
      email: user.email,
      kind: "login_failed",
      method: "face",
      success: false,
      ipAddress: getIp(req),
    });
    res.status(401).json({ error: "Face did not match. Please try again." });
    return;
  }

  setSessionUser(req, user.id);
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
  await logActivity({
    userId: user.id,
    email: user.email,
    kind: "login_success",
    method: "face",
    success: true,
    ipAddress: getIp(req),
  });
  const credCount = await db
    .select({ id: webauthnCredentialsTable.id })
    .from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.userId, user.id));
  res.json({ user: serializeUser(user, credCount.length) });
});

router.post("/auth/login/webauthn/options", async (req, res) => {
  const parsed = LoginWebauthnOptionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { challengeToken } = parsed.data;
  const tokenHash = sha256(challengeToken);
  const rows = await db
    .select()
    .from(loginChallengesTable)
    .where(
      and(
        eq(loginChallengesTable.tokenHash, tokenHash),
        isNull(loginChallengesTable.consumedAt),
        gt(loginChallengesTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(400).json({ error: "Login session expired" });
    return;
  }

  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, row.userId)).limit(1);
  const user = userRows[0];
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { rpId } = getRpInfo(req);
  const creds = await db
    .select()
    .from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.userId, user.id));

  const options = await generateAuthenticationOptions({
    rpID: rpId,
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: (c.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
    })),
    userVerification: "preferred",
  });

  // Replace stored login challenge token's expectation with the WebAuthn challenge by storing alongside.
  await db.insert(webauthnChallengesTable).values({
    userId: user.id,
    kind: "auth",
    challenge: options.challenge,
    expiresAt: new Date(Date.now() + WEBAUTHN_CHALLENGE_TTL_SECONDS * 1000),
  });

  res.json(options);
});

router.post("/auth/login/webauthn/verify", async (req, res) => {
  const parsed = LoginWebauthnVerifyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { challengeToken, assertion } = parsed.data;

  const consumed = await consumeLoginChallenge(challengeToken);
  if (!consumed) {
    res.status(400).json({ error: "Login session expired. Please re-enter your MPIN." });
    return;
  }
  const userId = consumed.userId;

  const userRows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const challenges = await db
    .select()
    .from(webauthnChallengesTable)
    .where(
      and(
        eq(webauthnChallengesTable.userId, userId),
        eq(webauthnChallengesTable.kind, "auth"),
        gt(webauthnChallengesTable.expiresAt, new Date()),
      ),
    )
    .orderBy(sql`${webauthnChallengesTable.createdAt} desc`)
    .limit(1);
  const challengeRow = challenges[0];
  if (!challengeRow) {
    res.status(400).json({ error: "Authentication challenge expired" });
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assertionAny = assertion as any;
  const credentialId: string | undefined = assertionAny.id ?? assertionAny.rawId;
  if (!credentialId) {
    res.status(400).json({ error: "Missing credential id" });
    return;
  }
  const credRows = await db
    .select()
    .from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.credentialId, credentialId))
    .limit(1);
  const cred = credRows[0];
  if (!cred || cred.userId !== userId) {
    res.status(400).json({ error: "Credential not recognized" });
    return;
  }

  const { rpId, origin } = getRpInfo(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: assertionAny,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: cred.credentialId,
        publicKey: Buffer.from(cred.publicKey, "base64url"),
        counter: cred.counter,
        transports: (cred.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
      },
      requireUserVerification: false,
    });
  } catch (err) {
    req.log.error({ err }, "WebAuthn auth verification failed");
    await logActivity({
      userId,
      email: user.email,
      kind: "login_failed",
      method: "biometric",
      success: false,
      ipAddress: getIp(req),
    });
    res.status(401).json({ error: "Biometric verification failed" });
    return;
  }

  if (!verification.verified) {
    await logActivity({
      userId,
      email: user.email,
      kind: "login_failed",
      method: "biometric",
      success: false,
      ipAddress: getIp(req),
    });
    res.status(401).json({ error: "Biometric verification failed" });
    return;
  }

  await db
    .update(webauthnCredentialsTable)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(webauthnCredentialsTable.id, cred.id));

  await db
    .update(webauthnChallengesTable)
    .set({ expiresAt: new Date(0) })
    .where(eq(webauthnChallengesTable.id, challengeRow.id));

  setSessionUser(req, userId);
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, userId));
  await logActivity({
    userId,
    email: user.email,
    kind: "login_success",
    method: "biometric",
    success: true,
    ipAddress: getIp(req),
  });

  const credCount = await db
    .select({ id: webauthnCredentialsTable.id })
    .from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.userId, user.id));

  res.json({ user: serializeUser(user, credCount.length) });
});

router.post("/auth/logout", (req, res) => {
  const session = getSession(req);
  const userId = session.userId;
  clearSession(req);
  if (userId) {
    void logActivity({
      userId,
      kind: "logout",
      success: true,
      ipAddress: getIp(req),
    });
  }
  res.json({ ok: true });
});

// Suppress unused import warnings for z (used for typing in shared modules later)
void z;

export default router;
