# AuthFusion Identity Platform

[![Security: WebAuthn](https://img.shields.io/badge/Security-WebAuthn-blue.svg)](https://webauthn.io/)
[![Liveness: MediaPipe](https://img.shields.io/badge/Liveness-MediaPipe-green.svg)](https://developers.google.com/mediapipe)
[![Risk: ONNX--Web](https://img.shields.io/badge/Risk-ONNX--Web-orange.svg)](https://onnxruntime.ai/)
[![UI: Modern](https://img.shields.io/badge/UI-Modern--Glass-purple.svg)](https://tailwindcss.com/)

**AuthFusion** is a state-of-the-art identity platform that combines high-fidelity biometrics, behavior-based risk scoring, and zero-knowledge privacy. It is designed to harden authentication flows for high-stakes environments using a multi-layered security stack.

---

## ✨ Key Features

### 🛡️ Multi-Factor Identity Vault
*   **Verified Onboarding**: OTP-gated registration ensuring verified communication channels.
*   **Encrypted Identity**: PII (like Aadhaar) is encrypted via **AES-256-GCM** using the **Web Crypto API**.
*   **ZKP Foundations**: Ready for Zero-Knowledge Proofs using **snarkjs** to verify identity without exposing data.

### 🎭 AI-Powered Biometrics
*   **MediaPipe Engine**: Sub-100ms face landmarker detection with active liveness challenges (blink, smile, head turns).
*   **Behavioral Biometrics**: Analyzes user interaction patterns (keystrokes, mouse, touch) to build unique identity profiles.
*   **Local-First Privacy**: Biometric descriptors are processed in the browser; only encrypted metadata is stored.

### 🧠 Real-time Risk Engine
*   **ONNX.js Scoring**: Client-side ML inference for immediate anomaly detection.
*   **Gemini Ensemble**: Server-side AI analysis that cross-references login context with historical data.
*   **Audit Logging**: Comprehensive forensic trails for every authentication attempt.

### 🔑 Advanced Authentication
*   **WebAuthn (FIDO2)**: Hardware-backed passwordless access via Fingerprint/FaceID.
*   **Real-time Handoff**: Secure QR-based cross-device biometric enrollment via **Socket.io**.
*   **MPIN Fallback**: Cryptographically hashed 6-digit PIN for legacy access.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, Vite, TypeScript, tRPC Client |
| **Backend** | Node.js, Express, tRPC Server, Socket.io |
| **Database** | Neon PostgreSQL (Serverless), Drizzle ORM |
| **Cache/Limit** | Upstash Redis (Sliding Window Rate Limiting) |
| **AI/ML** | MediaPipe, ONNX Runtime Web, Gemini Pro |
| **Security** | Web Crypto API, snarkjs, Helmet, bcrypt |
| **Observability** | Sentry (Error Tracking), PostHog (Analytics) |
| **PWA** | vite-plugin-pwa (Offline Support) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- pnpm (v10+)
- Neon Database URL
- Upstash Redis URL & Token

### Installation

1. **Clone & Setup**:
   ```bash
   git clone https://github.com/AinzAmour/Secure-Login-Hub.git
   cd Secure-Login-Hub
   pnpm install
   ```

2. **Environment Configuration**:
   Create a `.env` file in the root:
   ```env
   DATABASE_URL=postgres://...
   UPSTASH_REDIS_REST_URL=https://...
   UPSTASH_REDIS_REST_TOKEN=...
   SESSION_SECRET=...
   GEMINI_API_KEY=...
   VITE_SENTRY_DSN=...
   VITE_POSTHOG_KEY=...
   ```

3. **Database Migration**:
   ```bash
   pnpm --filter @workspace/db run push
   ```

4. **Run Development Server**:
   ```bash
   pnpm run dev
   ```

---

## 🔒 Security Posture
AuthFusion implements **Defense in Depth**:
1.  **Transport Security**: Enforced HTTPS, Helmet headers, and origin-strict CORS.
2.  **Rate Limiting**: sliding-window protection on all auth-sensitive endpoints.
3.  **Local-First Cryptography**: Sensitive data is encrypted in a client-side vault before transmission.
4.  **Ensemble Risk Scoring**: Dual-layer verification (Local ML + Remote AI) to prevent synthetic identity fraud.

---

## 📄 License
This project is licensed under the MIT License. Developed for the HackHustle Hackathon.
