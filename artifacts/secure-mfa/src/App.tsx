import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAutoLogout } from "@/hooks/useAutoLogout";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import ReKYC from "@/pages/ReKYC";
import MobileHandoff from "@/pages/MobileHandoff";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";
import { NotificationProvider } from "@/components/SystemNotification";
import { LanguageProvider } from "@/components/LanguageSwitcher";

const queryClient = new QueryClient();

function AppRoutes() {
  const [location, setLocation] = useLocation();
  const isMobileHandoff = location.startsWith("/m/h/");
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
      queryKey: getGetMeQueryKey(),
      enabled: !isMobileHandoff,
    },
  });

  // Auto-logout after 5 minutes of inactivity (only when authenticated)
  useAutoLogout(!!user && !isMobileHandoff);

  useEffect(() => {
    if (isMobileHandoff) return;
    if (isLoading) return;

    // Redirect logic
    const isAuthRoute = location === "/login" || location === "/register";
    const isProtectedRoute = location.startsWith("/dashboard");

    if (user && isAuthRoute) {
      setLocation("/dashboard");
    } else if (error && isProtectedRoute) {
      setLocation("/login");
    }
  }, [user, isLoading, error, location, setLocation, isMobileHandoff]);

  if (!isMobileHandoff && isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/re-kyc" component={ReKYC} />
      <Route path="/m/h/:token" component={MobileHandoff} />
      <Route component={NotFound} />
    </Switch>
  );
}

import { useBehavioralBiometrics } from "./hooks/useBehavioralBiometrics";

function App() {
  useBehavioralBiometrics();
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <NotificationProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
            <Toaster />
            <SonnerToaster richColors position="top-center" />
          </TooltipProvider>
        </NotificationProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
