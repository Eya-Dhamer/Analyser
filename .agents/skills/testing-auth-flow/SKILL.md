---
name: testing-auth-flow
description: Test the NetAnalyzer JWT auth flow end-to-end (token refresh, deadlock prevention, cookie attributes). Use when verifying auth-related changes.
---

# Testing Auth Flow

## Prerequisites

- MongoDB running locally (`sudo systemctl start mongod`)
- Node.js installed
- Backend dependencies: `cd backend && npm install`
- Frontend dependencies: `cd frontend && npm install`

## Setup

1. Start backend: `cd backend && node server.js` (runs on port 5002)
2. Start frontend: `cd frontend && npm run dev` (runs on port 3000)
3. Create a test user via the `/register` page (first user becomes admin)

## Testing Token Refresh

To test token expiry within a reasonable timeframe, temporarily shorten the access token expiry in `backend/config/jwt.js` (e.g., change `expiresIn: '15m'` to `expiresIn: '10s'`). **Remember to revert this after testing.**

### Test 1: Happy-path token refresh
1. Log in, wait for access token to expire
2. Navigate to a protected page (e.g., Historique)
3. Verify in console: initial 401 → refresh 200 → retry 200
4. User should stay logged in

### Test 2: Graceful logout on missing refresh token
1. Log in, delete `refreshToken` cookie via DevTools → Application → Cookies
2. Wait for access token to expire, navigate to a protected page
3. Verify: refresh 401 propagates → logout → redirect to `/login` (no deadlock/hang)

### Test 3: Cookie attributes
Verify via curl or DevTools that Set-Cookie header contains:
- `SameSite=Lax` (not Strict)
- `Path=/`
- `HttpOnly`
- `Secure` only in production

```bash
curl -s -D - -o /dev/null -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}' | grep -i set-cookie
```

## Tips

- The app uses Axios interceptors for auto-refresh. The key file is `frontend/src/api.js`.
- Cookie settings are in `backend/controllers/authController.js` (both `register` and `login` functions).
- JWT config is in `backend/config/jwt.js`.
- Backend uses `cookie-parser` middleware; refresh tokens are sent as httpOnly cookies.
- If testing in browser, open DevTools Console before testing to capture API request logs.
