import { Link } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Shield,
  Lock,
  Fingerprint,
  ScanFace,
  FileDigit,
  Server,
  CheckCircle2,
  ArrowRight,
  Zap,
  Globe,
  ShieldCheck,
  Smartphone,
  Cpu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/Logo";
import { useRef } from "react";
import { useLanguage, LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Landing() {
  const { t, language } = useLanguage();
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
    }
  };

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[10%] right-[-5%] w-[35%] h-[35%] rounded-full bg-secondary/5 blur-[100px] animate-pulse delay-700" />
      </div>

      <header className="fixed top-0 z-50 w-full transition-all duration-300 border-b border-white/5 bg-background/50 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors hidden sm:block">
              {t("nav.signin")}
            </Link>
            <Link href="/register">
              <Button className="rounded-full px-6 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300">
                {t("nav.signup")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-20">
        {/* Hero Section */}
        <section ref={targetRef} className="relative h-[90vh] flex items-center justify-center overflow-hidden px-6">
          <motion.div
            style={{ opacity, scale }}
            className="container mx-auto text-center"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={containerVariants}
              className="max-w-4xl mx-auto"
            >
              <motion.div variants={itemVariants} className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-8 backdrop-blur-sm">
                <Zap className="w-3.5 h-3.5 mr-2 fill-primary" />
                Next-Gen Identity Protocol v2.0
              </motion.div>

              <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.1] text-foreground">
                {language === "ta" ? "பாதுகாப்பான சரிபார்ப்பு" : t("landing.title")}
              </motion.h1>

              <motion.p variants={itemVariants} className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto">
                {language === "ta"
                  ? "உங்கள் தனிப்பட்ட தரவைப் பகிராமல், பாதுகாப்பாக உங்களை நீங்களே நிரூபிக்கவும்."
                  : t("landing.subtitle")}
              </motion.p>

              <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-6 justify-center">
                <Link href="/register">
                  <Button size="lg" className="h-14 px-10 text-lg rounded-full group">
                    Secure My Vault
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="h-14 px-10 text-lg rounded-full border-white/10 hover:bg-white/5 transition-colors">
                    Access Vault
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Floating Security Elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <motion.div
              animate={{
                y: [0, -20, 0],
                rotate: [0, 5, 0]
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-[20%] left-[10%] p-4 bg-card/40 border border-white/5 rounded-2xl backdrop-blur-xl hidden lg:block"
            >
              <Fingerprint className="w-10 h-10 text-secondary" />
            </motion.div>
            <motion.div
              animate={{
                y: [0, 30, 0],
                rotate: [0, -10, 0]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-[25%] right-[15%] p-4 bg-card/40 border border-white/5 rounded-2xl backdrop-blur-xl hidden lg:block"
            >
              <ScanFace className="w-10 h-10 text-primary" />
            </motion.div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="security" className="py-32 relative">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 flex flex-col justify-center">
                <Badge className="w-fit mb-4" variant="secondary">Core Features</Badge>
                <h2 className="text-4xl font-bold mb-6">Designed for <br />the 0.1%</h2>
                <p className="text-muted-foreground mb-8">
                  We don't just secure your login; we build a cryptographic perimeter around your existence.
                </p>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  </div>
                  <span className="font-semibold">SOC2 Type II Compliant</span>
                </div>
              </div>

              {[
                {
                  title: "Aadhaar OCR",
                  desc: "Instant identity extraction with client-side Tesseract.js processing.",
                  icon: FileDigit,
                  color: "from-blue-500/20 to-cyan-500/20"
                },
                {
                  title: "Liveness Detection",
                  desc: "Real-time biometric validation preventing high-quality spoofing.",
                  icon: ScanFace,
                  color: "from-purple-500/20 to-pink-500/20"
                },
                {
                  title: "WebAuthn Binding",
                  desc: "Hard-bind your account to physical secure enclaves on your device.",
                  icon: Smartphone,
                  color: "from-amber-500/20 to-orange-500/20"
                },
                {
                  title: "ZKP Proof Sharing",
                  desc: "Share verification status without exposing raw personal data strings.",
                  icon: Globe,
                  color: "from-green-500/20 to-emerald-500/20"
                },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group p-8 rounded-3xl border border-white/5 bg-card/30 hover:bg-card/50 transition-all duration-300 relative overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-background border border-white/10 flex items-center justify-center mb-6 shadow-inner">
                      <feature.icon className="w-6 h-6 text-foreground" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Architecture Section */}
        <section id="architecture" className="py-32 bg-secondary/5 border-y border-white/5">
          <div className="container mx-auto px-6">
            <div className="flex flex-col lg:flex-row gap-20 items-center">
              <div className="flex-1 space-y-10">
                <div className="space-y-4">
                  <h2 className="text-4xl font-bold tracking-tight">Encryption at the Edge</h2>
                  <p className="text-lg text-muted-foreground">
                    Your biometrics and Aadhaar images never hit our servers.
                    Encryption happens locally using the Web Crypto API.
                  </p>
                </div>

                <div className="space-y-6">
                  {[
                    { title: "AES-256-GCM", desc: "Military-grade authenticated encryption for PII.", icon: Lock },
                    { title: "Argon2 / Bcrypt", desc: "Resistant to side-channel and GPU attacks.", icon: Cpu },
                    { title: "FIDO2 / U2F", desc: "Eliminating the concept of passwords entirely.", icon: Shield },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-background border border-white/10 flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-secondary" />
                      </div>
                      <div>
                        <h4 className="font-bold">{item.title}</h4>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 relative">
                <div className="absolute inset-0 bg-primary/20 blur-[100px] animate-pulse" />
                <div className="relative bg-card/60 backdrop-blur-2xl border border-white/10 rounded-[40px] p-10 shadow-2xl">
                  <pre className="text-[10px] md:text-xs text-primary/80 font-mono leading-relaxed overflow-x-hidden">
                    {`
{
  "identity": "AuthFusion_Sovereign",
  "security_layer": "Tier_1",
  "encryption": {
    "algo": "AES-256-GCM",
    "mode": "client-side-only"
  },
  "biometric": {
    "provider": "MediaPipe_Face_Mesh",
    "liveness": true,
    "store": "mathematical_hash_only"
  },
  "network": {
    "protocol": "HTTPS_ZKP",
    "binding": "WebAuthn_FIDO2"
  }
}
                    `}
                  </pre>
                  <div className="absolute -bottom-6 -right-6 p-6 bg-secondary text-secondary-foreground rounded-2xl shadow-xl font-bold">
                    100% SECURE
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32">
          <div className="container mx-auto px-6">
            <div className="bg-primary rounded-[40px] p-12 md:p-24 text-center text-primary-foreground relative overflow-hidden shadow-2xl shadow-primary/30">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10 max-w-2xl mx-auto">
                <h2 className="text-4xl md:text-6xl font-bold mb-8 leading-tight">Ready to evolve your security?</h2>
                <p className="text-lg md:text-xl opacity-80 mb-12">
                  Join thousands of users who have chosen true identity sovereignty.
                  Start your 3-stage protection journey today.
                </p>
                <Link href="/register">
                  <Button size="lg" variant="secondary" className="h-16 px-12 text-xl rounded-full hover:scale-105 transition-transform">
                    Initialize My Vault
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-20 bg-background relative z-10">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
            <div className="space-y-6">
              <Logo />
              <p className="text-muted-foreground max-w-xs text-sm">
                Advanced multi-factor identity infrastructure built for the decentralized world.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
              <div className="space-y-4">
                <h4 className="font-bold">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-primary">Features</a></li>
                  <li><a href="#" className="hover:text-primary">Security</a></li>
                  <li><a href="#" className="hover:text-primary">Roadmap</a></li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="font-bold">Company</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-primary">About</a></li>
                  <li><a href="#" className="hover:text-primary">Privacy</a></li>
                  <li><a href="#" className="hover:text-primary">Terms</a></li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="font-bold">Contact</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#" className="hover:text-primary">Support</a></li>
                  <li><a href="#" className="hover:text-primary">Sales</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} AuthFusion Security. Absolute Privacy Guaranteed.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-primary transition-colors">Twitter</a>
              <a href="#" className="hover:text-primary transition-colors">GitHub</a>
              <a href="#" className="hover:text-primary transition-colors">Discord</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
