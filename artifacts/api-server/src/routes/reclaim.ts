import { Router } from "express";
import { Reclaim } from "@reclaimprotocol/js-sdk";
import { db } from "@workspace/db";
import { verifiableCredentialsTable, riskEventsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// Reclaim Config - Should ideally be in .env
const APP_ID = process.env.VITE_RECLAIM_APP_ID || "YOUR_APP_ID";
const APP_SECRET = process.env.VITE_RECLAIM_APP_SECRET || "YOUR_APP_SECRET";

router.post("/verify", async (req, res) => {
  const { proof } = req.body;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  console.log("RECLAIM_VERIFY_REQUEST:", { userId, proof: !!proof });
  if (!proof) {
    return res.status(400).json({ message: "Proof missing" });
  }

  try {
    // 0. Demo/Mock proof bypass for presentation
    if (proof.identifier?.startsWith("mock_aadhaar_proof_") || proof.claimData?.context === "authfusion_demo") {
      console.log("Processing DEMO Reclaim proof:", proof.identifier);
      
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
    const isVerified = await Reclaim.verifySignedProof(proof);

    if (!isVerified) {
      // Log failed verification attempt as risk event
      await db.insert(riskEventsTable).values({
        userId,
        eventType: "RECLAIM_VERIFICATION_FAILED",
        severity: "medium",
        metadata: { ip: req.ip, timestamp: new Date().toISOString() }
      });
      return res.status(400).json({ message: "Invalid proof signature" });
    }

    // 2. Extract specific claims (assertions)
    // The proof structure depends on the provider used
    
    const result = {
      isKYCVerified: true,
      isAdult: true, // Placeholder: in real use, extract from proof.claimData.parameters
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
