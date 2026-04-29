import { useState, createContext, useContext, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Languages } from "lucide-react";

type Language = "en" | "hi" | "ta";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    "nav.signin": "Sign in",
    "nav.signup": "Get Started",
    "landing.title": "Sovereign Identity",
    "landing.subtitle": "The hardware-backed protocol for secure, anonymous, and verifiable financial identity.",
    "landing.cta": "Secure Your Identity",
    "register.title": "Create your AuthFusion Vault",
    "register.email_desc": "Enter your email to begin setup.",
    "register.continue": "Continue",
    "login.title": "Access Your Vault",
    "login.desc": "Enter your email and MPIN to continue.",
    "dash.welcome": "Welcome back",
    "dash.welcome_back": "Welcome back, {name}",
    "dash.security": "Security Status",
    "dash.activity": "Recent Activity",
    "dash.account_details": "Account Details",
    "dash.email_verified": "Email Verified",
    "dash.mpin_active": "MPIN Active",
    "dash.face_enrolled": "Face Enrolled",
    "dash.biometric_enrolled": "Device Biometrics",
    "dash.action_required": "Action required",
    "dash.active": "Active",
    "dash.strengthen_security": "Strengthen your security",
    "dash.strengthen_desc": "Enroll missing factors to ensure maximum protection of your vault.",
    "dash.enroll_face": "Enroll Face",
    "dash.add_device": "Add Device",
    "dash.sign_out": "Sign Out",
    "dash.full_name": "Full Name",
    "dash.email": "Email",
    "dash.aadhaar": "Aadhaar",
    "dash.member_since": "Member Since",
    "dash.verifiable_proofs": "Verifiable Identity Proofs",
    "dash.verifiable_desc": "Generate and share cryptographic proofs of your identity (Aadhaar, Age, Residency) without revealing your raw personal data.",
    "dash.generate_proof": "Generate Proof",
  },
  hi: {
    "nav.signin": "साइन इन करें",
    "nav.signup": "शुरू करें",
    "landing.title": "संप्रभु पहचान",
    "landing.subtitle": "सुरक्षित, गुमनाम और सत्यापन योग्य वित्तीय पहचान के लिए हार्डवेयर-समர்த்தित प्रोटोकॉल।",
    "landing.cta": "अपनी पहचान सुरक्षित करें",
    "register.title": "अपना ऑथफ्यूजन वॉल्ट बनाएं",
    "register.email_desc": "सेटअप शुरू करने के लिए अपना ईमेल दर्ज करें।",
    "register.continue": "जारी रखें",
    "login.title": "अपने वॉल्ट तक पहुंचें",
    "login.desc": "जारी रखने के लिए अपना ईमेल और MPIN दर्ज करें।",
    "dash.welcome": "आपका स्वागत है",
    "dash.welcome_back": "स्वागत है, {name}",
    "dash.security": "सुरक्षा स्थिति",
    "dash.activity": "हाल की गतिविधि",
    "dash.account_details": "खाता विवरण",
    "dash.email_verified": "ईमेल सत्यापित",
    "dash.mpin_active": "MPIN सक्रिय",
    "dash.face_enrolled": "चेहरा नामांकित",
    "dash.biometric_enrolled": "डिवाइस बायोमेट्रिक्स",
    "dash.action_required": "कार्रवाई की आवश्यकता",
    "dash.active": "सक्रिय",
    "dash.strengthen_security": "अपनी सुरक्षा मजबूत करें",
    "dash.strengthen_desc": "अपने वॉल्ट की अधिकतम सुरक्षा सुनिश्चित करने के लिए लापता कारकों को नामांकित करें।",
    "dash.enroll_face": "चेहरा नामांकित करें",
    "dash.add_device": "डिवाइस जोड़ें",
    "dash.sign_out": "साइन आउट",
    "dash.full_name": "पूरा नाम",
    "dash.email": "ईमेल",
    "dash.aadhaar": "आधार",
    "dash.member_since": "सदस्यता की तिथि",
    "dash.verifiable_proofs": "सत्यापन योग्य पहचान प्रमाण",
    "dash.verifiable_desc": "अपने व्यक्तिगत डेटा को उजागर किए बिना अपनी पहचान (आधार, आयु, निवास) के क्रिप्टोग्राफ़ிக் प्रमाण उत्पन्न करें और साझा करें।",
    "dash.generate_proof": "प्रমাণ उत्पन्न करें",
  },
  ta: {
    "nav.signin": "உள்நுழைக",
    "nav.signup": "தொடங்கவும்",
    "landing.title": "இறையாண்மை அடையாளம்",
    "landing.subtitle": "பாதுகாப்பான, அநாமதேய மற்றும் சரிபார்க்கக்கூடிய நிதி அடையாளத்திற்கான வன்பொருள் ஆதரவு நெறிமுறை.",
    "landing.cta": "உங்கள் அடையாளத்தைப் பாதுகாக்கவும்",
    "register.title": "உங்கள் ஆத்பியூஷன் வால்ட்டை உருவாக்கவும்",
    "register.email_desc": "அமைப்பைத் தொடங்க உங்கள் மின்னஞ்சலை உள்ளிடவும்.",
    "register.continue": "தொடரவும்",
    "login.title": "உங்கள் வால்ட்டை அணுகவும்",
    "login.desc": "தொடர உங்கள் மின்னஞ்சல் மற்றும் MPIN ஐ உள்ளிடவும்.",
    "dash.welcome": "மீண்டும் வரவேற்கிறோம்",
    "dash.welcome_back": "மீண்டும் வரவேற்கிறோம், {name}",
    "dash.security": "பாதுகாப்பு நிலை",
    "dash.activity": "சமீபத்திய நடவடிக்கை",
    "dash.account_details": "கணக்கு விவரங்கள்",
    "dash.email_verified": "மின்னஞ்சல் சரிபார்க்கப்பட்டது",
    "dash.mpin_active": "MPIN செயலில் உள்ளது",
    "dash.face_enrolled": "முகம் பதிவு செய்யப்பட்டது",
    "dash.biometric_enrolled": "சாதன பயோமெட்ரிக்ஸ்",
    "dash.action_required": "நடவடிக்கை தேவை",
    "dash.active": "செயலில் உள்ளது",
    "dash.strengthen_security": "உங்கள் பாதுகாப்பை பலப்படுத்துங்கள்",
    "dash.strengthen_desc": "உங்கள் வால்ட்டின் அதிகபட்ச பாதுகாப்பை உறுதிப்படுத்த விடுபட்ட காரணிகளைப் பதிவு செய்யவும்.",
    "dash.enroll_face": "முகத்தைப் பதிவு செய்யவும்",
    "dash.add_device": "சாதனத்தைச் சேர்க்கவும்",
    "dash.sign_out": "வெளியேறு",
    "dash.full_name": "முழு பெயர்",
    "dash.email": "மின்னஞ்சல்",
    "dash.aadhaar": "ஆதார்",
    "dash.member_since": "உறுப்பினர் சேர்ந்த தேதி",
    "dash.verifiable_proofs": "சரிபார்க்கக்கூடிய அடையாளச் சான்றுகள்",
    "dash.verifiable_desc": "உங்கள் தனிப்பட்ட தரவை வெளிப்படுத்தாமல் உங்கள் அடையாளத்தின் (ஆதார், வயது, குடியிருப்பு) கிரிப்டோகிராஃபிக் சான்றுகளை உருவாக்கி பகிர்ந்து கொள்ளுங்கள்.",
    "dash.generate_proof": "பாதுகாப்பான சரிபார்ப்பு",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  const t = (key: string, params?: Record<string, string>) => {
    let text = translations[language][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const getLangName = (lang: Language) => {
    switch (lang) {
      case "en": return "English";
      case "hi": return "हिन्दी";
      case "ta": return "தமிழ்";
      default: return "English";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Languages className="w-4 h-4" />
          <span className="font-medium">
            {getLangName(language)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32 border-white/10 backdrop-blur-xl bg-background/80">
        <DropdownMenuItem onClick={() => setLanguage("en")} className="cursor-pointer">
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage("hi")} className="cursor-pointer">
          हिन्दी
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLanguage("ta")} className="cursor-pointer">
          தமிழ்
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
