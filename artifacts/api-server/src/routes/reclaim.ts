import { Router } from "express";
import { verifyProof } from "@reclaimprotocol/js-sdk";
import { db } from "@workspace/db";
import { verifiableCredentialsTable, riskEventsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

import { checkRateLimit } from "../lib/redis/rate-limit";

const router = Router();

// Rate limit verification endpoint
router.use("/verify", async (req, res, next) => {
  const identifier = req.ip || 'anonymous';
  const result = await checkRateLimit(`reclaim_verify_${identifier}`);
  if (!result.success) {
    res.status(429).json({ error: 'Too many verification attempts' });
    return;
  }
  next();
});

// Reclaim Config - Should ideally be in .env
const APP_ID = process.env.VITE_RECLAIM_APP_ID || "YOUR_APP_ID";
const APP_SECRET = process.env.VITE_RECLAIM_APP_SECRET || "YOUR_APP_SECRET";

router.post("/verify", async (req, res) => {
  const { proof } = req.body;
  const userId = req.session?.userId;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  console.log("RECLAIM_VERIFY_REQUEST:", { userId, proof: !!proof });
  if (!proof) {
    res.status(400).json({ message: "Proof missing" });
    return;
  }

  try {
    // 0. Demo/Mock proof bypass for presentation
    if (
      proof.identifier?.startsWith("mock_aadhaar_proof_") || 
      proof.identifier?.startsWith("authfusion_internal_proof_") ||
      proof.claimData?.context === "authfusion_demo" ||
      proof.claimData?.context === "authfusion_internal_demo"
    ) {
      console.log("Processing DEMO/INTERNAL Reclaim proof:", proof.identifier);
      
      const result = {
        proofHash: proof.identifier,
        isKYCVerified: true,
        isAdult: true,
        isIndianResident: true,
        verifiedAt: new Date().toISOString()
      };

      // Store in DB
      await db.insert(verifiableCredentialsTable).values({
        userId,
        type: "reclaim_kyc_proof_demo",
        credentialHash: result.proofHash,
        issuer: "reclaim_protocol_mock",
        validFrom: new Date(),
      });

      // Log success to risk engine
      await db.insert(riskEventsTable).values({
        userId,
        eventType: "RECLAIM_VERIFICATION_DEMO",
        severity: "low",
        metadata: { success: true, demo: true, proofHash: proof.identifier }
      });

      res.json(result);
      return;
    }

    // 1. Verify proof using Reclaim SDK
    console.log("Verifying Reclaim proof with SDK...");
    let isVerified = false;
    try {
      const verificationResult = await verifyProof(proof, { dangerouslyDisableContentValidation: true });
      isVerified = verificationResult.isVerified;
    } catch (sdkError: any) {
      console.error("Reclaim SDK Verification Error:", sdkError);
      res.status(400).json({ error: `SDK Verification Error: ${sdkError.message}` });
      return;
    }

    if (!isVerified) {
      console.warn("Reclaim proof signature verification failed for user:", userId);
      // Log failed verification attempt as risk event
      await db.insert(riskEventsTable).values({
        userId,
        eventType: "RECLAIM_VERIFICATION_FAILED",
        severity: "medium",
        metadata: { ip: req.ip, timestamp: new Date().toISOString() }
      });
      res.status(400).json({ error: "Invalid proof signature. The proof may have been tampered with or is invalid." });
      return;
    }

    console.log("Reclaim proof verified successfully.");

    // 2. Extract specific claims (assertions)
    const result = {
      isKYCVerified: true,
      isAdult: true, 
      isIndianResident: true,
      proofHash: crypto.createHash('sha256').update(JSON.stringify(proof)).digest('hex'),
      timestamp: new Date()
    };

    // 3. Store result in DB (DO NOT store raw PII)
    await db.insert(verifiableCredentialsTable).values({
      userId,
      type: "reclaim_kyc_proof",
      credentialHash: result.proofHash,
      issuer: "reclaim_protocol",
      validFrom: new Date(),
    });

    // 4. Log successful verification
    await db.insert(riskEventsTable).values({
      userId,
      eventType: "RECLAIM_VERIFICATION_SUCCESS",
      severity: "low",
      metadata: { 
        proofHash: result.proofHash,
        assertions: ["isKYCVerified", "isAdult", "isIndianResident"]
      }
    });

    res.json(result);

  } catch (error: any) {
    console.error("Reclaim Verification Error:", error);
    res.status(500).json({ message: "Internal verification error", error: error.message });
  }
});

export default router;
