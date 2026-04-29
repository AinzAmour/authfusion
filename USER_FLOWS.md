# AuthFusion System Flows

This document outlines the end-to-end flows for the AuthFusion Identity Platform, covering user interactions and backend logic.

## 1. User Registration Flow (SignUp)

The registration flow is a multi-step process designed to ensure identity proofing and biometric enrollment.

```mermaid
sequenceDiagram
    participant U as User (Frontend)
    participant B as Backend API
    participant D as Database (Neon)

    U->>B: POST /api/auth/register/start (Email)
    B->>D: Store OTP & Hash
    B-->>U: Return Demo OTP (for dev)
    
    U->>B: POST /api/auth/register/verify-otp (Email, OTP)
    B->>D: Validate OTP
    B-->>U: Return registrationToken (Short-lived)
    
    U->>U: Aadhaar Capture (Webcam/Upload)
    Note over U: OCR (Tesseract.js) extracts 12-digit ID
    
    U->>U: Biometric Capture (MediaPipe)
    Note over U: Liveness Checks: Blink, Smile, Head Turn
    
    U->>B: POST /api/auth/register/complete (Token, Name, Aadhaar, MPIN, FaceDescriptor)
    B->>B: Encrypt Aadhaar (AES-GCM)
    B->>B: Hash MPIN (bcrypt)
    B->>D: Create User Record
    B->>B: Initialize Session (cookie-session)
    B-->>U: Return User Profile & Session Cookie
```

### Key Security Features in SignUp:
- **Liveness Verification**: Ensures the user is a real person, not a photo/video.
- **Data Encryption**: Aadhaar numbers are never stored in plain text.
- **Rate Limiting**: Protected against OTP brute-forcing via Upstash Redis.

---

## 2. User Authentication Flow (Login)

AuthFusion uses a two-factor approach: Knowledge (MPIN) + Inherence (Face/Biometric).

```mermaid
sequenceDiagram
    participant U as User (Frontend)
    participant B as Backend API
    participant D as Database (Neon)

    U->>B: POST /api/auth/login/lookup (Email, MPIN)
    B->>D: Verify MPIN Hash
    B->>D: Check Enrolled Factors (Face/WebAuthn)
    B-->>U: Return challengeToken & availableFactors
    
    alt Face Verification
        U->>U: Capture Face Landmarkers
        U->>B: POST /api/auth/login/face (ChallengeToken, FaceDescriptor)
        B->>D: Retrieve Enrolled Descriptor
        B->>B: Euclidean Distance Comparison (Threshold: 0.6)
    else Device Biometric (WebAuthn)
        U->>B: POST /api/auth/login/webauthn/options (ChallengeToken)
        B-->>U: Return WebAuthn Options
        U->>U: OS-level Biometric Auth (Fingerprint/FaceID)
        U->>B: POST /api/auth/login/webauthn/verify (Assertion)
    end
    
    B->>B: Risk Analysis (ONNX + Gemini Ensemble)
    B->>B: Set Session Cookie
    B-->>U: Authentication Success
```

---

## 3. Backend Architecture Flow

The backend is built for security, scalability, and type safety.

### Request Pipeline:
1. **Security Headers**: `helmet` adds strict security headers (CORS, COOP, COEP).
2. **Rate Limiting**: `Upstash Ratelimit` checks the IP address against a sliding window.
3. **Session Middleware**: `cookie-session` decrypts the session cookie to identify the user.
4. **tRPC / REST Routing**: Requests are routed to specific controllers with Zod validation.
5. **Database Layer**: `Drizzle ORM` performs type-safe queries to the Neon PostgreSQL database.

### Risk Detection Flow:
- **Client-side**: ONNX Runtime Web analyzes behavioral patterns (keystrokes/mouse) and generates a risk score.
- **Server-side**: The backend integrates with Gemini to analyze the context of the login attempt (IP changes, unusual timing).
- **Audit Logging**: Every success and failure is logged in the `activity_events` table for forensic analysis.

---

## 4. Cross-Device Handoff (QR Flow)

Allows a user on a Desktop to use their Mobile device for biometric enrollment.

1. **Desktop**: Requests a handoff session.
2. **Backend**: Generates a `handoff_token` and starts a Socket.io room.
3. **Desktop**: Displays QR code containing the mobile URL + token.
4. **Mobile**: Scans QR, navigates to `/m/h/:token`.
5. **Mobile**: Performs biometric capture and sends data to Backend.
6. **Backend**: Emits `handoff-complete` via WebSockets to the Desktop.
7. **Desktop**: Automatically proceeds to the next step.
