import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { ProgressSteps } from "@/components/ProgressSteps";
import { FaceCapture } from "@/components/FaceCapture";
import { BiometricButton } from "@/components/BiometricButton";
import { PhoneOtpStep } from "@/components/PhoneOtpStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { 
  Loader2, 
  Shield, 
  Lock, 
  Smartphone, 
  User, 
  ScanFace, 
  CheckCircle2, 
  ChevronRight, 
  Fingerprint, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Camera, 
  RefreshCw, 
  X, 
  Mail, 
  ShieldCheck,
  Copy,
  Info
} from "lucide-react";
import { useNotifications } from "@/components/SystemNotification";
import { formatAadhaar, unformatAadhaar } from "@/lib/formatAadhaar";
import { HandoffQR } from "@/components/HandoffQR";
import { AadhaarCapture } from "@/components/AadhaarCapture";
import { useLanguage, LanguageSwitcher } from "@/components/LanguageSwitcher";

import {
  useRegisterStart,
  useRegisterVerifyOtp,
  useRegisterComplete,
  useEnrollFace,
  useWebauthnRegisterOptions,
  useWebauthnRegisterVerify,
  getGetMeQueryKey,
  getGetSecurityStatusQueryKey,
  getGetRecentActivityQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const STEPS = ["Email", "OTP", "Phone", "Identity", "Face", "Biometric", "Complete"];

export default function Register() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  // State
  const [email, setEmail] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  
  const [fullName, setFullName] = useState("");
  const [aadhaarDisplay, setAadhaarDisplay] = useState("");
  const [mpin, setMpin] = useState("");
  const [confirmMpin, setConfirmMpin] = useState("");

  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const { showNotification } = useNotifications();
  const [faceMode, setFaceMode] = useState<"device" | "phone">("device");
  const [bioMode, setBioMode] = useState<"device" | "phone">("device");

  // Mutations
  const registerStart = useRegisterStart();
  const verifyOtp = useRegisterVerifyOtp();
  const registerComplete = useRegisterComplete();
  const enrollFace = useEnrollFace();
  const webauthnOptions = useWebauthnRegisterOptions();
  const webauthnVerify = useWebauthnRegisterVerify();

  // Step Handlers
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    try {
      const res = await registerStart.mutateAsync({ data: { email } });
      if (res.demoOtp) {
        showNotification({
          title: "System Message",
          message: `Your AuthFusion verification code is ${res.demoOtp}. Do not share this code.`,
          type: "otp"
        });
      }
      setCurrentStep(1);
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    }
  };

  const handleResendOtp = async () => {
    try {
      const res = await registerStart.mutateAsync({ data: { email } });
      if (res.demoOtp) {
        showNotification({
          title: "System Message",
          message: `Your new verification code is ${res.demoOtp}.`,
          type: "otp"
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to resend OTP");
    }
  };

  useEffect(() => {
    if (currentStep === 1 && otp.length === 6) {
      verifyOtp.mutateAsync({ data: { email, otp } })
        .then((res) => {
          setRegistrationToken(res.registrationToken);
          setCurrentStep(2); // Go to Phone OTP step
        })
        .catch((err) => {
          toast.error(err.message || "Invalid OTP");
          setOtp("");
        });
    }
  }, [otp, currentStep]);

  const handlePhoneVerified = useCallback(() => goToStep(3), [goToStep]);

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawAadhaar = unformatAadhaar(aadhaarDisplay);
    if (fullName.length < 2) {
      toast.error("Name is too short");
      return;
    }
    if (rawAadhaar.length !== 12) {
      toast.error("Aadhaar must be 12 digits");
      return;
    }
    if (mpin.length !== 6) {
      toast.error("MPIN must be 6 digits");
      return;
    }
    if (mpin !== confirmMpin) {
      toast.error("MPINs do not match");
      return;
    }

    try {
      await registerComplete.mutateAsync({
        data: {
          registrationToken,
          fullName,
          aadhaarNumber: rawAadhaar,
          mpin
        }
      });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setCurrentStep(4); // Go to Face step
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    }
  };

  const handleFaceComplete = useCallback(async (descriptor: number[]) => {
    try {
      await enrollFace.mutateAsync({ data: { faceDescriptor: descriptor } });
      setFaceEnrolled(true);
      setTimeout(() => goToStep(5), 1500); // Go to Biometric step
    } catch (err: any) {
      toast.error(err.message || "Face enrollment failed");
    }
  }, [enrollFace, goToStep]);

  const finishRegistration = () => {
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetSecurityStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
    setLocation("/dashboard");
  };

  useEffect(() => {
    if (currentStep === 6) {
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    }
  }, [currentStep, queryClient]);

  const variants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      <header className="p-6 flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <LanguageSwitcher />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <ProgressSteps steps={STEPS} currentStep={currentStep} className="mb-12" />

        <div className="w-full max-w-md relative">
          <AnimatePresence mode="wait">
            {/* Step 0: Email */}
            {currentStep === 0 && (
              <motion.div key="step0" variants={variants} initial="initial" animate="animate" exit="exit">
                <Card className="border-white/10 shadow-2xl backdrop-blur-xl bg-background/60">
                  <CardContent className="pt-6">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-semibold tracking-tight">{t("register.title")}</h2>
                      <p className="text-sm text-muted-foreground mt-2">{t("register.email_desc")}</p>
                    </div>
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          placeholder="name@example.com" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoFocus
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={registerStart.isPending}>
                        {registerStart.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {t("register.continue")}
                      </Button>
                    </form>
                    <div className="text-center mt-6 text-sm">
                      <span className="text-muted-foreground">Already have an account? </span>
                      <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 1: Email OTP */}
            {currentStep === 1 && (
              <motion.div key="step1" variants={variants} initial="initial" animate="animate" exit="exit">
                <Card className="border-white/10 shadow-2xl backdrop-blur-xl bg-background/60">
                  <CardContent className="pt-6">
                    <div className="text-center mb-6 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Mail className="w-6 h-6 text-primary" />
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight">Check your email</h2>
                      <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                        We've sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
                      </p>
                    </div>
                    
                    <div className="flex flex-col items-center space-y-6">
                      <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={verifyOtp.isPending}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>

                      {verifyOtp.isPending && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...
                        </div>
                      )}

                      <button 
                        type="button" 
                        onClick={handleResendOtp}
                        disabled={registerStart.isPending}
                        className="text-sm text-primary hover:underline font-medium"
                      >
                        Resend code
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 2: Phone OTP (NEW) */}
            {currentStep === 2 && (
              <motion.div key="step2" variants={variants} initial="initial" animate="animate" exit="exit">
                <Card className="border-white/10 shadow-2xl backdrop-blur-xl bg-background/60">
                  <CardContent className="pt-6">
                    <PhoneOtpStep onVerified={handlePhoneVerified} />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 3: Identity Details (was step 2) */}
            {currentStep === 3 && (
              <motion.div key="step3" variants={variants} initial="initial" animate="animate" exit="exit">
                <Card className="border-white/10 shadow-2xl backdrop-blur-xl bg-background/60">
                  <CardContent className="pt-6">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-semibold tracking-tight">Identity Details</h2>
                      <p className="text-sm text-muted-foreground mt-2">Secure your vault with your identity and a PIN.</p>
                    </div>
                    <form onSubmit={handleIdentitySubmit} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input 
                          id="fullName" 
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="As per Aadhaar"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Aadhaar Identity Verification</Label>
                        <p className="text-[10px] text-muted-foreground mb-3 leading-tight">
                          Please capture or upload an image of your Aadhaar card. 
                          The system will extract your ID automatically for verification.
                        </p>
                        
                        <AadhaarCapture 
                          onCapture={(num) => {
                            setAadhaarDisplay(formatAadhaar(num));
                          }}
                        />

                        {aadhaarDisplay && (
                          <div className="mt-3 p-3 bg-secondary/5 border border-secondary/20 rounded-lg flex items-center justify-between">
                            <Input 
                              value={aadhaarDisplay}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "").slice(0, 12);
                                setAadhaarDisplay(formatAadhaar(val));
                              }}
                              className="bg-transparent border-none shadow-none font-mono tracking-widest text-secondary p-0 h-auto focus-visible:ring-0"
                            />
                            <div className="flex items-center text-[10px] text-secondary font-medium uppercase shrink-0">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Identity Extracted
                            </div>
                          </div>
                        )}
                        
                        <p className="text-[10px] text-muted-foreground flex items-center mt-2">
                          <ShieldCheck className="w-3 h-3 mr-1 text-secondary" />
                          Encrypted with AES-256-GCM at rest
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 flex flex-col">
                          <Label>6-Digit MPIN</Label>
                          <InputOTP maxLength={6} value={mpin} onChange={setMpin} className="w-full flex justify-between">
                            <InputOTPGroup className="w-full flex justify-between">
                              {[0,1,2,3,4,5].map(i => (
                                <InputOTPSlot key={i} index={i} className="w-full" style={{ WebkitTextSecurity: "disc" } as React.CSSProperties} />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        <div className="space-y-2 flex flex-col">
                          <Label>Confirm MPIN</Label>
                          <InputOTP maxLength={6} value={confirmMpin} onChange={setConfirmMpin} className="w-full flex justify-between">
                            <InputOTPGroup className="w-full flex justify-between">
                              {[0,1,2,3,4,5].map(i => (
                                <InputOTPSlot key={i} index={i} className="w-full" style={{ WebkitTextSecurity: "disc" } as React.CSSProperties} />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </div>

                      <Button type="submit" className="w-full mt-6" disabled={registerComplete.isPending}>
                        {registerComplete.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Secure My Vault
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 4: Face Enrollment (was step 3) */}
            {currentStep === 4 && (
              <motion.div key="step4" variants={variants} initial="initial" animate="animate" exit="exit">
                <Card className="border-white/10 shadow-2xl backdrop-blur-xl bg-background/60">
                  <CardContent className="pt-6">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-semibold tracking-tight">Enroll Face ID</h2>
                      <p className="text-sm text-muted-foreground mt-2">Used as an extra factor to access your vault. No images leave your device.</p>
                    </div>

                    <DeviceModeTabs value={faceMode} onChange={setFaceMode} className="mb-5" />

                    {faceMode === "device" ? (
                      <div className="max-w-[280px] mx-auto mb-6">
                        <FaceCapture onDescriptor={handleFaceComplete} mode="enroll" className="aspect-square" />
                      </div>
                    ) : (
                      <div className="mb-6">
                        <HandoffQR
                          purpose="register_face"
                          onComplete={() => {
                            setFaceEnrolled(true);
                            toast.success("Face enrolled from your phone");
                            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
                            queryClient.invalidateQueries({ queryKey: getGetSecurityStatusQueryKey() });
                            setTimeout(() => goToStep(5), 1200);
                          }}
                        />
                      </div>
                    )}

                    <div className="flex justify-center">
                      <Button variant="ghost" onClick={() => goToStep(5)} className="text-muted-foreground">
                        Skip for now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 5: Biometric Enrollment (was step 4) */}
            {currentStep === 5 && (
              <motion.div key="step5" variants={variants} initial="initial" animate="animate" exit="exit">
                <Card className="border-white/10 shadow-2xl backdrop-blur-xl bg-background/60">
                  <CardContent className="pt-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                      <Fingerprint className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-2">Device Biometrics</h2>
                    <p className="text-sm text-muted-foreground mb-6">
                      Add a fingerprint or Face ID factor — from this device, or by scanning a QR with your phone.
                    </p>

                    {biometricEnrolled ? (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
                        <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2" />
                        <p className="font-medium">Device enrolled</p>
                      </div>
                    ) : (
                      <>
                        <DeviceModeTabs value={bioMode} onChange={setBioMode} className="mb-5 text-left" />
                        {bioMode === "device" ? (
                          <BiometricButton
                            mode="enroll"
                            optionsMutation={webauthnOptions}
                            verifyMutation={webauthnVerify}
                            onSuccess={() => {
                              setBiometricEnrolled(true);
                              toast.success("Biometric enrolled securely");
                              setTimeout(() => goToStep(6), 1000);
                            }}
                            className="mb-4"
                          />
                        ) : (
                          <div className="mb-4 text-left">
                            <HandoffQR
                              purpose="register_biometric"
                              onComplete={() => {
                                setBiometricEnrolled(true);
                                toast.success("Phone biometric enrolled");
                                queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
                                queryClient.invalidateQueries({ queryKey: getGetSecurityStatusQueryKey() });
                                setTimeout(() => goToStep(6), 1200);
                              }}
                            />
                          </div>
                        )}
                      </>
                    )}

                    <Button variant="ghost" onClick={() => goToStep(6)} className="text-muted-foreground w-full">
                      {biometricEnrolled ? "Continue" : "Skip for now"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 6: Complete */}
            {currentStep === 6 && (
              <motion.div key="step6" variants={variants} initial="initial" animate="animate" exit="exit">
                <Card className="border-primary/20 bg-gradient-to-b from-primary/5 to-transparent backdrop-blur-xl bg-background/60 shadow-2xl">
                  <CardContent className="pt-8 pb-8 text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-6 shadow-lg shadow-primary/20">
                      <ShieldCheck className="w-10 h-10 text-primary-foreground" />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight mb-2">Vault Secured</h2>
                    <p className="text-muted-foreground mb-8">Your identity data is now protected by AuthFusion.</p>

                    <div className="w-full bg-card border-white/10 rounded-xl p-4 mb-8 text-left space-y-3 shadow-sm backdrop-blur-md bg-background/40">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Email Verified</span>
                        <CheckCircle2 className="w-4 h-4 text-secondary" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Phone Verified</span>
                        <CheckCircle2 className="w-4 h-4 text-secondary" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">MPIN Set</span>
                        <CheckCircle2 className="w-4 h-4 text-secondary" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Face Liveness Verified</span>
                        {faceEnrolled ? <CheckCircle2 className="w-4 h-4 text-secondary" /> : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Biometric Device</span>
                        {biometricEnrolled ? <CheckCircle2 className="w-4 h-4 text-secondary" /> : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </div>

                    <Button size="lg" className="w-full text-base group" onClick={finishRegistration}>
                      Open Dashboard
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
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

function DeviceModeTabs({
  value,
  onChange,
  className,
}: {
  value: "device" | "phone";
  onChange: (v: "device" | "phone") => void;
  className?: string;
}) {
  return (
    <div className={`flex p-1 bg-muted/60 rounded-lg ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => onChange("device")}
        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-colors ${
          value === "device" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid="tab-device"
      >
        <Monitor className="w-3.5 h-3.5" />
        This device
      </button>
      <button
        type="button"
        onClick={() => onChange("phone")}
        className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-colors ${
          value === "phone" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
        data-testid="tab-phone"
      >
        <Smartphone className="w-3.5 h-3.5" />
        Use my phone
      </button>
    </div>
  );
}
