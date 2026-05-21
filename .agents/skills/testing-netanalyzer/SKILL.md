---
name: testing-netanalyzer
description: Test the NetAnalyzer app end-to-end locally (auth flow, analysis submission, Dify integration). Use when verifying auth or analysis-related changes.
---

# Testing NetAnalyzer

## Prerequisites

- MongoDB running locally (`sudo systemctl start mongod`)
- Node.js installed
- Backend dependencies: `cd backend && npm install`
- Frontend dependencies: `cd frontend && npm install`

## Setup

1. Create `backend/.env` with:
   ```
   MONGODB_URI=mongodb://localhost:27017/network_config_analyzer
   JWT_SECRET=<any-secret-string>
   FRONTEND_URL=http://localhost:3000
   PORT=5002
   DIFY_BASE_URL=<user's Dify URL>
   DIFY_API_KEY=<user's Dify API key>
   ```
2. Start backend: `cd backend && node server.js` (runs on port 5002)
3. Start frontend: `cd frontend && npm run dev` (runs on port 3000, may fallback to 3001 if 3000 is busy)
4. Create a test user via the `/register` page (first user becomes admin)

## Devin Secrets Needed

- No org/repo secrets required for basic testing
- Dify API key and URL are needed only for full AI analysis testing (user provides via `.env`)

## Testing Auth Flow

To test token expiry within a reasonable timeframe, temporarily shorten the access token expiry in `backend/config/jwt.js` (e.g., change `expiresIn: '15m'` to `expiresIn: '10s'`). **Remember to revert this after testing.**

### Token Refresh (Happy Path)
1. Log in, wait for access token to expire
2. Navigate to a protected page (e.g., Historique)
3. Verify in console: initial 401 -> refresh 200 -> retry 200
4. User should stay logged in

### Graceful Logout (Missing Refresh Token)
1. Log in, delete `refreshToken` cookie via DevTools -> Application -> Cookies
2. Wait for access token to expire, navigate to a protected page
3. Verify: refresh 401 propagates -> logout -> redirect to `/login` (no deadlock/hang)

### Cookie Attributes
Verify via curl:
```bash
curl -s -D - -o /dev/null -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}' | grep -i set-cookie
```
Expected: `SameSite=Lax; Path=/; HttpOnly`

## Testing Analysis Submission

### Device Type Detection
The app infers device type from config content. Use these sample configs to trigger specific types:
- **cisco_ios**: Config containing `hostname` or `interface GigabitEthernet`
- **juniper_junos**: Config containing `set system host-name` or `set interfaces`
- **palo_alto**: Config containing `set deviceconfig`
- **huawei**: Config containing `interface GigabitEthernet` + `undo shutdown`
- **generic**: Anything that doesn't match above patterns

### Verifying Analysis State in MongoDB
```bash
mongosh --quiet --eval "db.analyses.findOne({}, {agentUsed:1, status:1, _id:0})" network_config_analyzer
```

### Without Dify
If Dify is not available, analysis will transition from `pending` to `failed` with a Dify integration error. This is expected behavior. The key verification is that the server does NOT crash.

## Key Files

- Auth interceptor: `frontend/src/api.js`
- Cookie settings: `backend/controllers/authController.js` (register + login functions)
- JWT config: `backend/config/jwt.js`
- AI service: `backend/services/ai.js`
- Analysis controller: `backend/controllers/analysisController.js`
- Device type inference: `backend/utils/configProcessing.js`
- Analysis model (agentUsed enum): `backend/models/Analysis.js`

## Tips

- The frontend uses Vite with a proxy to the backend. API calls go through `/api` which proxies to port 5002.
- If port 3000 is busy, Vite will use 3001. The proxy still works.
- The `agentUsed` enum in `Analysis.js` must match the values returned by `inferDeviceType()` in `configProcessing.js`. A mismatch causes `ERR_HTTP_HEADERS_SENT` crashes.
- Backend errors after the 202 response is sent are guarded by `res.headersSent` checks.
