import { useState, useEffect, useRef } from "react";
import { useNotifications } from "./SystemNotification";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Smartphone, Loader2, Copy } from "lucide-react";

interface PhoneOtpStepProps {
  onVerified: () => void;
}

export function PhoneOtpStep({ onVerified }: PhoneOtpStepProps) {
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { showNotification } = useNotifications();

  const generateOtp = () => {
    return String(Math.floor(100000 + Math.random() * 900000));
  };

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    setSending(true);
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800));
    const code = generateOtp();
    setDemoOtp(code);
    setOtpSent(true);
    setSending(false);
    
    showNotification({
      title: "Messages",
      message: `Your AuthFusion mobile verification code is ${code}. valid for 5 mins.`,
      type: "otp"
    });
  };

  const handleResend = async () => {
    setSending(true);
    await new Promise((r) => setTimeout(r, 500));
    const code = generateOtp();
    setDemoOtp(code);
    setOtp("");
    setSending(false);

    showNotification({
      title: "Messages",
      message: `New code: ${code}`,
      type: "otp"
    });
  };

  const hasStartedVerification = useRef(false);

  // Auto-verify when OTP is complete
  useEffect(() => {
    let mounted = true;
    if (otp.length === 6 && demoOtp && otpSent && !verifying && !hasStartedVerification.current) {
      if (otp === demoOtp) {
        hasStartedVerification.current = true;
        setVerifying(true);
        const timer = setTimeout(() => {
          if (mounted) {
            try {
              toast.success("Phone verified successfully");
              onVerified();
            } catch (err) {
              console.error("Verification callback failed:", err);
              setVerifying(false);
              hasStartedVerification.current = false;
              toast.error("An error occurred during transition. Please try again.");
            }
          }
        }, 800);
        return () => {
          mounted = false;
          clearTimeout(timer);
        };
      } else {
        toast.error("Invalid OTP. Please try again.");
        setOtp("");
      }
    }
    return () => { mounted = false; };
  }, [otp, demoOtp, otpSent, onVerified]); // Removed verifying from deps to prevent self-cancellation

  if (!otpSent) {
    return (
      <div className="space-y-5">
        <div className="text-center mb-2 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Verify Phone</h2>
          <p className="text-sm text-muted-foreground mt-2">
            We'll send a verification code to your mobile number.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Mobile Number</Label>
          <div className="flex gap-2">
            <div className="flex items-center px-3 bg-muted rounded-lg border text-sm font-medium text-muted-foreground shrink-0">
              +91
            </div>
            <Input
              id="phone"
              type="tel"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                // Format as XXXXX XXXXX
                if (val.length > 5) {
                  setPhone(val.slice(0, 5) + " " + val.slice(5));
                } else {
                  setPhone(val);
                }
              }}
              autoFocus
            />
          </div>
        </div>

        <Button
          onClick={handleSendOtp}
          className="w-full"
          disabled={sending}
        >
          {sending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Send OTP
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center mb-2 flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Smartphone className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Enter phone OTP</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">
          We've sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">+91 {phone}</span>
        </p>
      </div>

      <div className="flex flex-col items-center space-y-6">
        <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={verifying}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>

        {verifying && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...
          </div>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          className="text-sm text-primary hover:underline font-medium"
        >
          Resend code
        </button>
      </div>
    </div>
  );
}
