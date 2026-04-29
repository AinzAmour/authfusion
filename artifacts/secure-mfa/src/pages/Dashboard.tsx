import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { 
  ShieldCheck, LogOut, Eye, EyeOff, AlertTriangle, ShieldAlert,
  Clock, CheckCircle2, User as UserIcon, Calendar, Fingerprint, ScanFace, Share2
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FaceCapture } from "@/components/FaceCapture";
import { BiometricButton } from "@/components/BiometricButton";
import { HandoffQR } from "@/components/HandoffQR";
import { Smartphone, Monitor } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLanguage, LanguageSwitcher } from "@/components/LanguageSwitcher";

import {
  useGetMe,
  useGetSecurityStatus,
  useGetRecentActivity,
  useLogout,
  useEnrollFace,
  useWebauthnRegisterOptions,
  useWebauthnRegisterVerify,
  getGetMeQueryKey,
  getGetSecurityStatusQueryKey,
  getGetRecentActivityQueryKey
} from "@workspace/api-client-react";
import { humanizeActivity } from "@/lib/humanizeActivity";

export default function Dashboard() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [enrollModal, setEnrollModal] = useState<"face" | "biometric" | null>(null);
  const [enrollMode, setEnrollMode] = useState<"device" | "phone">("device");

  const { data: userResponse, isLoading: userLoading } = useGetMe();
  const { data: security, isLoading: securityLoading } = useGetSecurityStatus();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  
  const logout = useLogout();
  const enrollFace = useEnrollFace();
  const webauthnOptions = useWebauthnRegisterOptions();
  const webauthnVerify = useWebauthnRegisterVerify();

  const user = userResponse?.user;

  const handleLogout = async () => {
    try {
      await logout.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch (err) {
      toast.error("Failed to sign out");
    }
  };

  const handleFaceEnrolled = async (descriptor: number[]) => {
    try {
      await enrollFace.mutateAsync({ data: { faceDescriptor: descriptor } });
      toast.success("Face enrolled successfully");
      queryClient.invalidateQueries({ queryKey: getGetSecurityStatusQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
      setEnrollModal(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to enroll face");
    }
  };

  const onBiometricSuccess = () => {
    toast.success("Biometric enrolled successfully");
    queryClient.invalidateQueries({ queryKey: getGetSecurityStatusQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
    setEnrollModal(null);
  };

  if (userLoading || securityLoading) {
    return (
      <div className="min-h-[100dvh] bg-muted/20 flex flex-col">
        <header className="border-b bg-background"><div className="h-16 flex items-center px-4"><Logo /></div></header>
        <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-64 col-span-2 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null; // Handled by App.tsx redirect

  if (!security) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8 max-w-sm mx-auto">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Connection Error</h2>
          <p className="text-sm text-muted-foreground">
            Could not fetch your security status. Please ensure the backend API is running.
          </p>
          <Button onClick={handleLogout} variant="outline" className="mt-4">
            Clear Session & Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const firstName = user.fullName.split(" ")[0];
  const isFullySecured = security.faceEnrolled && security.biometricEnrolled;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <header className="border-b border-white/5 bg-background/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t("dash.sign_out")}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-8 max-w-5xl space-y-8">
        
        {/* Hero Banner */}
        <section className="bg-primary text-primary-foreground rounded-2xl p-8 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <ShieldCheck className="w-48 h-48" />
          </div>
          <div className="relative z-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {t("dash.welcome_back", { name: firstName })}
            </h1>
            <div className="flex items-center gap-2 text-primary-foreground/80 mb-6">
              <span className="font-mono bg-primary-foreground/10 px-3 py-1 rounded-md tracking-widest text-sm">
                {showAadhaar ? "XXXX XXXX " + user.aadhaarMasked.slice(-4) : "XXXX XXXX XXXX"}
              </span>
              <button 
                onClick={() => setShowAadhaar(!showAadhaar)}
                className="p-1.5 hover:bg-primary-foreground/10 rounded-md transition-colors"
              >
                {showAadhaar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {security.lastLoginAt && (
              <p className="text-sm text-primary-foreground/60 flex items-center">
                <Clock className="w-4 h-4 mr-1.5" />
                Last sign-in {formatDistanceToNow(new Date(security.lastLoginAt))} ago
              </p>
            )}
          </div>
        </section>

        <div className="grid md:grid-cols-3 gap-6">
          
          {/* Security Status */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-secondary" />
                  {t("dash.security")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{t("dash.email_verified")}</p>
                      <p className="text-xs text-muted-foreground">{security.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{t("dash.mpin_active")}</p>
                      <p className="text-xs text-muted-foreground">Used for fallback access</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${security.faceEnrolled ? 'bg-card' : 'bg-destructive/5 border-destructive/20'}`}>
                    {security.faceEnrolled ? (
                      <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{t("dash.face_enrolled")}</p>
                      <p className="text-xs text-muted-foreground">
                        {security.faceEnrolled ? t("dash.active") : t("dash.action_required")}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${security.biometricEnrolled ? 'bg-card' : 'bg-destructive/5 border-destructive/20'}`}>
                    {security.biometricEnrolled ? (
                      <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{t("dash.biometric_enrolled")}</p>
                      <p className="text-xs text-muted-foreground">
                        {security.biometricEnrolled ? `${security.biometricCount} device(s)` : t("dash.action_required")}
                      </p>
                    </div>
                  </div>
                </div>

                {!isFullySecured && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-amber-900 dark:text-amber-500 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" />
                        {t("dash.strengthen_security")}
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-600 mt-1">
                        {t("dash.strengthen_desc")}
                      </p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      {!security.faceEnrolled && (
                        <Button variant="outline" size="sm" className="bg-white hover:bg-amber-50 dark:bg-background" onClick={() => setEnrollModal("face")}>
                          {t("dash.enroll_face")}
                        </Button>
                      )}
                      {!security.biometricEnrolled && (
                        <Button variant="outline" size="sm" className="bg-white hover:bg-amber-50 dark:bg-background" onClick={() => setEnrollModal("biometric")}>
                          {t("dash.add_device")}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Profile Info */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-primary" />
                  {t("dash.account_details")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 py-3 border-b">
                    <span className="text-sm text-muted-foreground">{t("dash.full_name")}</span>
                    <span className="text-sm font-medium col-span-2">{user.fullName}</span>
                  </div>
                  <div className="grid grid-cols-3 py-3 border-b">
                    <span className="text-sm text-muted-foreground">{t("dash.email")}</span>
                    <span className="text-sm font-medium col-span-2">{user.email}</span>
                  </div>
                  <div className="grid grid-cols-3 py-3 border-b">
                    <span className="text-sm text-muted-foreground">{t("dash.aadhaar")}</span>
                    <span className="text-sm font-medium col-span-2 font-mono">XXXX XXXX {user.aadhaarMasked.slice(-4)}</span>
                  </div>
                  <div className="grid grid-cols-3 py-3">
                    <span className="text-sm text-muted-foreground">{t("dash.member_since")}</span>
                    <span className="text-sm font-medium col-span-2 flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                      {new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-secondary/5 border-secondary/20">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-secondary" />
                  {t("dash.verifiable_proofs")}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground max-w-md">
                    {t("dash.verifiable_desc")}
                  </p>
                </div>
                <Button asChild variant="secondary" className="shrink-0 gap-2">
                  <Link href="/re-kyc">
                    <ShieldCheck className="w-4 h-4" />
                    {t("dash.generate_proof")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Activity Timeline */}
          <div className="md:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">{t("dash.activity")}</CardTitle>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="space-y-4">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : activity && activity.length > 0 ? (
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                    {activity.slice(0, 10).map((event, i) => (
                      <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className={`flex items-center justify-center w-5 h-5 rounded-full border-2 border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm ${event.success ? 'bg-secondary' : 'bg-destructive'}`}>
                          {/* dot */}
                        </div>
                        <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] pl-3 md:pl-0">
                          <div className="flex flex-col bg-card p-3 rounded-lg border shadow-xs group-hover:shadow-sm transition-all">
                            <span className="text-sm font-medium">{humanizeActivity(event)}</span>
                            <span className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(event.createdAt))} ago
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    No recent activity.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Enrollment Modals */}
      <Dialog
        open={enrollModal !== null}
        onOpenChange={(o) => {
          if (!o) {
            setEnrollModal(null);
            setEnrollMode("device");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {enrollModal === "face" ? "Enroll Face ID" : "Enroll Biometric Device"}
            </DialogTitle>
            <DialogDescription>
              {enrollModal === "face"
                ? "Scan your face to add it as a secure authentication factor."
                : "Register a fingerprint or Face ID — on this device, or your phone."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="flex p-1 bg-muted/60 rounded-lg mb-4">
              <button
                type="button"
                onClick={() => setEnrollMode("device")}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-colors ${
                  enrollMode === "device"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="dash-tab-device"
              >
                <Monitor className="w-3.5 h-3.5" />
                This device
              </button>
              <button
                type="button"
                onClick={() => setEnrollMode("phone")}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-colors ${
                  enrollMode === "phone"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="dash-tab-phone"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Use my phone
              </button>
            </div>

            {enrollModal === "face" && enrollMode === "device" && (
              <div className="max-w-[260px] mx-auto">
                <FaceCapture onDescriptor={handleFaceEnrolled} mode="enroll" className="aspect-square" />
              </div>
            )}
            {enrollModal === "face" && enrollMode === "phone" && (
              <HandoffQR
                purpose="register_face"
                onComplete={() => {
                  toast.success("Face enrolled from your phone");
                  queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
                  queryClient.invalidateQueries({ queryKey: getGetSecurityStatusQueryKey() });
                  setEnrollModal(null);
                  setEnrollMode("device");
                }}
              />
            )}

            {enrollModal === "biometric" && enrollMode === "device" && (
              <div className="text-center space-y-6 pt-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Fingerprint className="w-8 h-8 text-primary" />
                </div>
                <BiometricButton
                  mode="enroll"
                  optionsMutation={webauthnOptions}
                  verifyMutation={webauthnVerify}
                  onSuccess={onBiometricSuccess}
                />
              </div>
            )}
            {enrollModal === "biometric" && enrollMode === "phone" && (
              <HandoffQR
                purpose="register_biometric"
                onComplete={() => {
                  toast.success("Phone biometric added");
                  queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
                  queryClient.invalidateQueries({ queryKey: getGetSecurityStatusQueryKey() });
                  setEnrollModal(null);
                  setEnrollMode("device");
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
