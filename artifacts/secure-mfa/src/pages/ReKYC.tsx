import { useState } from "react";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, 
  UserCheck, 
  MapPin, 
  Calendar, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Share2,
  Lock,
  ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Link, useLocation } from "wouter";
import { useLanguage, LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useGetMe } from "@workspace/api-client-react";

// Reclaim Constants - Should ideally be in .env
const APP_ID = import.meta.env.VITE_RECLAIM_APP_ID || "YOUR_APP_ID";
const APP_SECRET = import.meta.env.VITE_RECLAIM_APP_SECRET || "YOUR_APP_SECRET";
const PROVIDER_ID = import.meta.env.VITE_RECLAIM_PROVIDER_ID || "YOUR_PROVIDER_ID"; // e.g., Aadhaar Verification

export default function ReKYC() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { data: userResponse, isLoading: userLoading } = useGetMe();

  const [isGenerating, setIsGenerating] = useState(false);
  const [proof, setProof] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  if (!userLoading && !userResponse?.user) {
    setLocation("/login");
    return null;
  }

  const handleGenerateProof = async () => {
    try {
      setIsGenerating(true);

      // Demo Mode Fallback for testing/presentation
      if (APP_ID.includes("YOUR_APP_ID") || APP_ID.includes("0x3855")) {
        console.log("DEMO MODE: Simulating Reclaim verification...");
        await new Promise(r => setTimeout(r, 2000));
        
        const mockProof = {
          identifier: "mock_aadhaar_proof_" + Math.random().toString(36).slice(2),
          claimData: {
            providerId: PROVIDER_ID,
            parameters: JSON.stringify({ isAdult: true, isIndianResident: true }),
            timestampS: Math.floor(Date.now() / 1000).toString(),
            context: "authfusion_demo"
          },
          signatures: ["demo_signature"],
          witnesses: [{ id: "demo_witness", url: "https://demo.reclaimprotocol.org" }]
        };

        setProof(mockProof);
        toast.success("Identity proof generated (Demo Mode)");
        verifyWithBackend(mockProof);
        return;
      }
      
      const reclaimProofRequest = await ReclaimProofRequest.init(
        APP_ID,
        APP_SECRET,
        PROVIDER_ID
      );

      // Reclaim v5+ uses signatures for security
      // In production, the signature should be generated on the backend
      // and passed to the frontend to keep the APP_SECRET secure.
      
      const requestUrl = await reclaimProofRequest.getRequestUrl();
      
      // Open the Reclaim verification URL
      window.open(requestUrl, "_blank");

      // Start session to listen for success
      await reclaimProofRequest.startSession({
        onSuccess: (proof) => {
          console.log("Reclaim Proof Received:", proof);
          // proof is often an array or single object depending on version
          const proofData = Array.isArray(proof) ? proof[0] : proof;
          setProof(proofData);
          toast.success("Identity proof received!");
          verifyWithBackend(proofData);
        },
        onError: (error) => {
          console.error("Reclaim Verification Error:", error);
          toast.error("Verification failed or cancelled");
          setIsGenerating(false);
        }
      });

    } catch (error) {
      console.error("Reclaim Init Error:", error);
      toast.error("Reclaim Protocol initialization failed");
      setIsGenerating(false);
    }
  };

  const verifyWithBackend = async (proofData: any) => {
    try {
      setIsGenerating(false);
      setIsVerifying(true);
      const response = await fetch("/api/reclaim/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof: proofData }),
      });

      if (!response.ok) throw new Error("Backend verification failed");

      const result = await response.json();
      setVerificationResult(result);
      toast.success("Identity verified by server");
    } catch (error) {
      console.error("Backend Verify Error:", error);
      toast.error("Server-side verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background flex flex-col">
      <header className="p-6">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {!verificationResult ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="border-white/10 shadow-2xl backdrop-blur-xl bg-background/60">
                  <CardHeader className="text-center">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <CardTitle className="text-3xl font-bold">
                      {language === "ta" ? "🛡️ பாதுகாப்பான சரிபார்ப்பு" : "Verifiable KYC Proof"}
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      {language === "ta" 
                        ? "உங்கள் தனிப்பட்ட விவரங்களை வெளிப்படுத்தாமல் உங்கள் அடையாளத்தை நிரூபிக்கவும்."
                        : "Share your identity status without revealing sensitive documents."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-secondary/5 rounded-xl border border-border p-4">
                      <h3 className="text-sm font-medium mb-4 flex items-center">
                        <Lock className="w-4 h-4 mr-2 text-secondary" />
                        Requested Assertions
                      </h3>
                      <div className="grid gap-3">
                        <div className="flex items-center justify-between text-sm p-3 bg-background/50 rounded-lg border border-white/5">
                          <div className="flex items-center">
                            <UserCheck className="w-4 h-4 mr-3 text-muted-foreground" />
                            <span>Identity Verification (Aadhaar)</span>
                          </div>
                          <Badge variant="outline">Required</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm p-3 bg-background/50 rounded-lg border border-white/5">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-3 text-muted-foreground" />
                            <span>Age &ge; 18 Years</span>
                          </div>
                          <Badge variant="outline">Required</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm p-3 bg-background/50 rounded-lg border border-white/5">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-3 text-muted-foreground" />
                            <span>Residency (India)</span>
                          </div>
                          <Badge variant="outline">Required</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 text-xs text-primary/80 leading-relaxed">
                      <strong>How it works:</strong> We send a request to Reclaim. You'll log in to your provider (e.g., Digilocker or Aadhaar Portal). Reclaim generates a cryptographic proof that you meet the criteria, and we only receive a "Yes/No" confirmation.
                    </div>

                    <Button 
                      className="w-full h-14 text-lg font-semibold"
                      onClick={handleGenerateProof}
                      disabled={isGenerating || isVerifying}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          {language === "ta" ? "காத்திருக்கவும்..." : "Waiting for Reclaim..."}
                        </>
                      ) : isVerifying ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          {language === "ta" ? "சரிபார்க்கப்படுகிறது..." : "Verifying with server..."}
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-5 h-5 mr-2" />
                          {language === "ta" ? "🛡️ பாதுகாப்பான சரிபார்ப்பு (Private Verification)" : "Generate KYC Proof"}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <Card className="border-secondary/20 shadow-2xl backdrop-blur-xl bg-background/60 overflow-hidden">
                  <div className="h-2 bg-secondary" />
                  <CardContent className="pt-8 pb-8">
                    <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-bold mb-2">
                      {language === "ta" ? "✅ சரிபார்ப்பு முடிந்தது" : "Proof Verified"}
                    </h2>
                    <p className="text-muted-foreground mb-8">
                      {language === "ta" 
                        ? "உங்கள் அடையாளச் சான்று வெற்றிகரமாக சரிபார்க்கப்பட்டு பாதுகாப்பாக சேமிக்கப்பட்டது."
                        : "Your identity proof has been successfully verified and stored securely."}
                    </p>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="p-4 bg-background/40 border border-white/5 rounded-xl">
                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">KYC</div>
                        <div className="font-semibold text-secondary">
                          {language === "ta" ? "சரிபார்க்கப்பட்டது" : "Verified"}
                        </div>
                      </div>
                      <div className="p-4 bg-background/40 border border-white/5 rounded-xl">
                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Adult</div>
                        <div className="font-semibold text-secondary">
                          {language === "ta" ? "ஆம்" : "Yes"}
                        </div>
                      </div>
                      <div className="p-4 bg-background/40 border border-white/5 rounded-xl">
                        <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Resident</div>
                        <div className="font-semibold text-secondary">
                          {language === "ta" ? "இந்தியா" : "India"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button asChild className="w-full h-12">
                        <Link href="/dashboard">Return to Dashboard</Link>
                      </Button>
                      <p className="text-[10px] text-muted-foreground flex items-center justify-center">
                        <ShieldCheck className="w-3 h-3 mr-1" />
                        Proof Hash: {verificationResult.proofHash.slice(0, 20)}...
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
