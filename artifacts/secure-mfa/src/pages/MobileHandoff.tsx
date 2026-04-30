import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import {
  useHandoffMobileInfo,
  getHandoffMobileInfoQueryKey,
  useHandoffMobileFace,
  useHandoffMobileBiometricOptions,
  useHandoffMobileBiometricVerify,
} from "@workspace/api-client-react";
import { Logo } from "@/components/Logo";
import { FaceCapture } from "@/components/FaceCapture";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  ShieldCheck,
  Fingerprint,
  ScanFace,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

export default function MobileHandoff() {
  const [, params] = useRoute("/m/h/:token");
  const token = params?.token ?? "";

  const { data, isLoading, error, refetch } = useHandoffMobileInfo(token, {
    query: {
      enabled: !!token,
      retry: false,
      queryKey: getHandoffMobileInfoQueryKey(token),
    },
  });

  const submitFace = useHandoffMobileFace();
  const biometricOptions = useHandoffMobileBiometricOptions();
  const biometricVerify = useHandoffMobileBiometricVerify();

  const [phase, setPhase] = useState<"ready" | "running" | "done" | "failed">(
    "ready",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data && (data.expired || data.status !== "pending")) {
      // Already done or expired
      if (data.status === "completed" || data.status === "consumed") {
        setPhase("done");
      } else if (data.expired || data.status === "expired") {
        setPhase("failed");
        setErrorMessage("This code has expired. Generate a new one on your computer.");
      } else if (data.status === "failed") {
        setPhase("failed");
        setErrorMessage("This verification already failed. Generate a new code on your computer.");
      }
    }
  }, [data]);

  const handleFaceDescriptor = async (descriptor: number[]) => {
    setPhase("running");
    setErrorMessage(null);
    try {
      await submitFace.mutateAsync({ token, data: { faceDescriptor: descriptor } });
      setPhase("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Face verification failed";
      setErrorMessage(msg);
      setPhase("failed");
      void refetch();
    }
  };

  const handleBiometric = async () => {
    setPhase("running");
    setErrorMessage(null);
    try {
      const opts = (await biometricOptions.mutateAsync({ token })) as Record<
        string,
        unknown
      >;
      let credential: unknown;
      if (data?.purpose === "register_biometric") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        credential = await startRegistration({ optionsJSON: opts as any });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        credential = await startAuthentication({ optionsJSON: opts as any });
      }
      await biometricVerify.mutateAsync({
        token,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { credential: credential as any },
      });
      setPhase("done");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Biometric verification failed";
      setErrorMessage(msg);
      setPhase("failed");
      void refetch();
    }
  };

  if (!token) {
    return (
      <Container>
        <ErrorPanel title="Invalid link" message="This handoff link is missing its token." />
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container>
        <div className="flex flex-col items-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading verification…</p>
        </div>
      </Container>
    );
  }

  if (error || !data) {
    return (
      <Container>
        <ErrorPanel
          title="Verification not found"
          message="This handoff link could not be loaded. Generate a fresh code on your computer."
        />
      </Container>
    );
  }

  if (phase === "done") {
    return (
      <Container>
        <SuccessPanel
          purpose={data.purpose}
          subtitle="You can now return to your computer — it'll continue automatically."
        />
      </Container>
    );
  }

  if (phase === "failed") {
    return (
      <Container>
        <ErrorPanel
          title="Verification failed"
          message={errorMessage ?? "Generate a new code on your computer and try again."}
        />
      </Container>
    );
  }

  const isFace =
    data.purpose === "register_face" || data.purpose === "login_face";
  const isBiometric =
    data.purpose === "register_biometric" || data.purpose === "login_biometric";
  const isLogin = data.purpose.startsWith("login_");

  return (
    <Container>
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              {isFace ? <ScanFace className="w-5 h-5" /> : <Fingerprint className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="font-semibold tracking-tight">
                {isLogin ? "Verify your identity" : "Enroll on this device"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.userHint ? `For ${data.userHint.fullName}` : "Sentinel handoff"}
              </p>
            </div>
          </div>

          <div className="mt-5">
            {isFace && phase === "ready" && (
              <>
                <FaceCapture
                  onDescriptor={handleFaceDescriptor}
                  mode={isLogin ? "verify" : "enroll"}
                  className="w-full aspect-square"
                />
                <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                  Your camera image stays on this device — only a 128-number
                  mathematical descriptor is sent to Sentinel.
                </p>
              </>
            )}

            {isFace && phase === "running" && (
              <div className="flex flex-col items-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                <p className="text-sm">Verifying with Sentinel…</p>
              </div>
            )}

            {isBiometric && phase === "ready" && (
              <div className="flex flex-col items-center text-center py-4">
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  {isLogin
                    ? "Use your fingerprint, Face ID, or device passcode to confirm it's you."
                    : "Add this phone's biometric (fingerprint or Face ID) as a second factor on your Sentinel account."}
                </p>
                <Button
                  type="button"
                  size="lg"
                  onClick={handleBiometric}
                  className="w-full h-12"
                  data-testid="button-mobile-biometric"
                >
                  <Fingerprint className="w-5 h-5 mr-2" />
                  {isLogin ? "Verify with biometric" : "Enroll biometric"}
                </Button>
              </div>
            )}

            {isBiometric && phase === "running" && (
              <div className="flex flex-col items-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                <p className="text-sm">Talking to your device…</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}

function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-muted/30 flex flex-col">
      <header className="p-5 flex justify-center">
        <Logo />
      </header>
      <main className="flex-1 flex items-start justify-center p-4 pb-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <footer className="text-center text-[11px] text-muted-foreground pb-6 px-4">
        <ShieldCheck className="inline w-3 h-3 mr-1 -mt-px" />
        Encrypted in transit · End-to-end Sentinel handoff
      </footer>
    </div>
  );
}

function SuccessPanel({ purpose, subtitle }: { purpose: string; subtitle: string }) {
  const isLogin = purpose.startsWith("login_");
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">
          {isLogin ? "Identity confirmed" : "Enrollment complete"}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{message}</p>
      </CardContent>
    </Card>
  );
}
