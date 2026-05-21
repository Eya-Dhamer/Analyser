# NetAnalyzer — Automated Network Configuration Analysis Platform

> AI-powered platform that automatically analyzes network configurations to detect errors, security vulnerabilities, and compliance violations — with actionable recommendations to fix them.

## Features

### User Interface
- **Upload or Paste** — Accept `.txt`, `.cfg` configuration files or raw text paste
- **AI-Powered Analysis** — Real-time analysis using GroqCloud or Dify.ai agents
- **Detailed Results** — Errors, vulnerabilities, recommendations with severity badges & CVSS scores
- **Export & Share** — Download as **PDF** or **JSON**, copy to clipboard, generate shareable links
- **Guest Mode** — Analyze configs without creating an account

### Admin Dashboard
- **User Management** — Create, delete accounts, modify roles
- **Analysis Monitoring** — Track all analyses, statuses, and per-user history
- **Compliance Rules** — Define custom rules enforced during every analysis
- **AI Configuration** — Switch providers (Groq / Dify), customize model & prompt
- **Statistics** — Analyses per day, error/vulnerability detection rates, top users

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| AI | GroqCloud API / Dify.ai |
| Auth | JWT (access + refresh tokens) |
| PDF Export | jsPDF + jspdf-autotable |

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB running locally or a MongoDB Atlas URI
- A Groq API key ([console.groq.com](https://console.groq.com))

### 1. Backend Setup
```bash
cd backend
npm install
npm run dev                  # Starts on http://localhost:5000
```

Create/edit `backend/.env` with at least:

```env
MONGODB_URI=mongodb://localhost:27017/network_config_analyzer
JWT_SECRET=your-jwt-secret

# Dify (use the API root without /v1, e.g. http://localhost or http://localhost:8000)
DIFY_BASE_URL=http://localhost
DIFY_API_KEY=app-xxxxxxxxxxxxxxxx

# "workflow" = POST /v1/workflows/run (Workflow app) | "chat" = /v1/chat-messages
DIFY_REQUEST_MODE=workflow

# Optional: match your workflow's input variable name (see Dify → API → GET /parameters)
DIFY_WORKFLOW_INPUT_KEY=query

# Optional: force a published version — POST /v1/workflows/{id}/run
# DIFY_WORKFLOW_ID=00000000-0000-0000-0000-000000000000

# Optional: end-user id sent to Dify (default: per-request user id or "guest")
# DIFY_END_USER_ID=netanalyzer-user

# Optional
DIFY_TIMEOUT_MS=180000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm start                    # Starts on http://localhost:3000
```

### 3. First Login
- The **first user to register** is automatically assigned the **admin** role.
- Subsequent users get the `user` role by default.
- Admins can also create new accounts from the dashboard.

## Project Structure
```
├── backend/
│   ├── models/
│   │   ├── Analysis.js          # Analysis schema (errors, vulns, recommendations)
│   │   ├── ComplianceRule.js     # Custom compliance rules
│   │   ├── RefreshToken.js       # JWT refresh tokens
│   │   ├── Settings.js           # AI provider configuration
│   │   └── User.js               # User accounts
│   ├── routes/
│   │   ├── admin.js              # Admin: users, stats, compliance, settings
│   │   ├── analysis.js           # Submit, view, share, delete analyses
│   │   └── auth.js               # Register, login, refresh, logout
│   ├── services/
│   │   └── ai.js                 # AI analysis engine (Groq + Dify)
│   └── server.js                 # Express entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Header.js         # Navigation bar
│   │   ├── pages/
│   │   │   ├── AdminDashboard.js # Admin panel (5 tabs)
│   │   │   ├── Analyzer.js       # Config upload/paste & submit
│   │   │   ├── Dashboard.js      # User's personal analysis history
│   │   │   ├── Login.js          # Authentication
│   │   │   ├── Register.js       # Account creation
│   │   │   ├── Results.js        # Analysis results + PDF/JSON export
│   │   │   └── SharedResult.js   # Public shared report view
│   │   ├── api.js                # API client with auto token refresh
│   │   ├── App.js                # Routes, auth context, guards
│   │   └── index.css             # Design system
│   └── public/
│       └── index.html
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |

### Analysis
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/analysis/guest` | No | Guest analysis (no save) |
| POST | `/api/analysis/submit` | Yes | Submit analysis (saved) |
| GET | `/api/analysis` | Yes | List user's analyses |
| GET | `/api/analysis/shared/:token` | No | View shared result |
| GET | `/api/analysis/:id` | Yes | Get specific analysis |
| POST | `/api/analysis/:id/share` | Yes | Generate share link |
| DELETE | `/api/analysis/:id` | Yes | Delete analysis |

### Admin
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create user account |
| PATCH | `/api/admin/users/:id/role` | Change user role |
| DELETE | `/api/admin/users/:id` | Delete user + analyses |
| GET | `/api/admin/analyses` | List all analyses |
| GET | `/api/admin/users/:id/analyses` | User's analysis history |
| GET | `/api/admin/settings/ai` | Get AI settings |
| PATCH | `/api/admin/settings/ai` | Update AI settings |
| GET | `/api/admin/settings/ai/dify-readiness` | Validate Dify RAG backend readiness |
| POST | `/api/admin/settings/ai/test-dify` | Test Dify API connectivity |
| GET | `/api/admin/compliance` | List compliance rules |
| POST | `/api/admin/compliance` | Create rule |
| PUT | `/api/admin/compliance/:id` | Update rule |
| DELETE | `/api/admin/compliance/:id` | Delete rule |

## Dify RAG Integration Flow

1. Build your RAG app in Dify (Chat App or Workflow App) and publish it.
2. Copy the app API key from Dify and set `DIFY_API_KEY`.
3. Set `DIFY_BASE_URL` to your local Dify host (example: `http://localhost:8000`).
4. Choose mode:
   - `DIFY_REQUEST_MODE=chat` for Chat App (`/v1/chat-messages`)
   - `DIFY_REQUEST_MODE=workflow` for Workflow App (`/v1/workflows/run`)
5. Start backend and call:
   - `GET /api/admin/settings/ai/dify-readiness`
   - `POST /api/admin/settings/ai/test-dify`
6. If both pass, run real analyses:
   - `POST /api/analysis/guest`
   - `POST /api/analysis/submit`

## Security
- Passwords hashed with **bcrypt** (10 rounds)
- **JWT access tokens** (15 min) + **refresh tokens** (7 days, httpOnly cookie)
- CORS restricted to allowed origins
- Helmet.js security headers
- Admin role guard on all management endpoints
- JWT issuer/audience validation

## License
MIT
