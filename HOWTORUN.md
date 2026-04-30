# 🚀 AuthFusion: How to Run

Follow these steps to set up and run the AuthFusion Identity Platform locally.

## 📋 Prerequisites

Ensure you have the following installed:
- **Node.js** (v18 or higher)
- **pnpm** (v9 or higher) - `npm install -g pnpm`
- **PostgreSQL** (or a [Neon.tech](https://neon.tech) database URL)
- **Redis** (or [Upstash Redis](https://upstash.com) credentials)

---

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/AinzAmour/Secure-Login-Hub.git
cd Secure-Login-Hub
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Environment Configuration
Create a `.env` file in the **root directory**. You can copy the template below:

```env
# Database (Neon/Postgres)
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require

# Redis (Upstash/Local)
UPSTASH_REDIS_REST_URL=https://your-project.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Security
SESSION_SECRET=your_long_random_secret_here

# AI Integration
GEMINI_API_KEY=your_google_gemini_api_key

# Reclaim Protocol (Optional for Production KYC)
VITE_RECLAIM_APP_ID=your_app_id
VITE_RECLAIM_APP_SECRET=your_app_secret
VITE_RECLAIM_PROVIDER_ID=your_provider_id
```

### 4. Database Schema Setup
Push the schema to your database:
```bash
pnpm db:push
```

---

## 🏃 Running the Platform

### 🚀 Full Stack Development
To start both the **Frontend** and **API Server** simultaneously:
```bash
pnpm dev
```
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:3000`

### 💻 Component-wise Run (Advanced)
If you wish to run parts of the monorepo individually:

| Command | Action |
| :--- | :--- |
| `pnpm --filter secure-mfa dev` | Run only Frontend (React/Vite) |
| `pnpm --filter api-server dev` | Run only Backend (Express/Node) |
| `pnpm --filter @workspace/db studio` | Open Drizzle Studio (DB Viewer) |

---

## 🛡️ Important Notes

1.  **HTTPS for Camera**: The camera/liveness features require a secure context. For local development on `localhost`, Vite handles this automatically. If accessing via IP, use an HTTPS tunnel (like `ngrok`).
2.  **Demo Mode**: If no `VITE_RECLAIM_APP_ID` is provided, the platform automatically enters **Demo Mode**, allowing you to test the QR/KYC flow with branded mock data.
3.  **Build for Production**:
    ```bash
    pnpm build
    pnpm start
    ```

---

## 📂 Project Structure
- `artifacts/secure-mfa`: The main React frontend.
- `artifacts/api-server`: The Express backend with Socket.io.
- `lib/db`: Database schema and Drizzle client.
- `lib/api-zod`: Shared validation schemas.
