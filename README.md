# EventHorizon API

Node.js, Express, and MongoDB API foundation for EventHorizon account registration, email verification, login, and authenticated profile access.

## Requirements

- Node.js 20 or newer
- MongoDB running locally or a MongoDB connection URI
- SMTP credentials for sending verification emails

## Local Setup

Install dependencies and create a local environment file:

```powershell
npm install
Copy-Item .env.example .env
```

Set these values in `.env`:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port; defaults to `4555`. |
| `MONGODB_URI` | MongoDB connection string. The example points to a local `eventhorizon` database. |
| `JWT_SECRET` | Secret used to sign login tokens. Use a randomly generated value of at least 32 characters. |
| `JWT_EXPIRES_IN` | Login token lifetime accepted by `jsonwebtoken`, for example `1h`. |
| `API_BASE_URL` | Public base URL of this API, used to build the clickable verification link. For local testing use `http://localhost:4555`. |
| `FRONTEND_URL` | Reserved for the frontend origin when a frontend is added. |
| `EMAIL_VERIFICATION_TTL_HOURS` | Verification-link lifetime in hours; defaults to `24`. |
| `SMTP_HOST`, `SMTP_PORT` | SMTP server address and port. |
| `SMTP_SECURE` | Set to `true` when the SMTP server expects an immediate TLS connection, commonly port `465`; otherwise use `false`. |
| `SMTP_USER`, `SMTP_PASSWORD` | SMTP account credentials. |
| `EMAIL_FROM` | Sender address accepted by the SMTP service. |

Generate a JWT secret with Node.js, then put its output in `.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The API base URL and SMTP settings must be correct before registration can send email. Clicking the verification link opens the API and verifies the address directly. Do not commit `.env` or share its secrets.

Start the API in development mode:

```powershell
npm run dev
```

The API listens on `http://localhost:4555` by default. `npm start` runs the same server without Nodemon. MongoDB must be reachable at startup.

## API

JSON request bodies are validated with Joi. Registration passwords must be 8-128 alphanumeric characters and contain at least one letter and one number. Verification uses a cryptographically random 32-byte token; only its SHA-256 hash is stored, and the token is single-use and time-limited.

### Register

`POST /api/auth/register`

```json
{
	"email": "person@example.com",
	"password": "meetup2026"
}
```

Returns `201` after the account is saved and the verification email is sent. Duplicate email returns `409`; invalid input returns `400`.

### Resend verification email

`POST /api/auth/resend-verification`

```json
{
	"email": "person@example.com"
}
```

If the account exists and is not yet verified, the API sends a new link and invalidates the previous link. The response is intentionally the same whether the account exists, is already verified, or is unknown. Requests are rate-limited with the other authentication endpoints.

### Verify email

`GET /api/auth/verify-email?token=...` (clickable email link) or `POST /api/auth/verify-email` (API client)

```json
{
	"token": "the-token-from-the-verification-link"
}
```

Returns `200` for a valid, unexpired token. Invalid, expired, or previously used tokens return `400`.

### Login

`POST /api/auth/login`

```json
{
	"email": "person@example.com",
	"password": "meetup2026"
}
```

Returns a signed JWT after successful authentication. Unverified accounts receive `403`; invalid credentials receive `401`.

### Get profile

`GET /api/user/profile`

Send the login token as a bearer token:

```http
Authorization: Bearer <jwt>
```

Only verified users with a valid token can access the profile. Tokens are verified with HS256 and checked against the current user record.

## Postman Collection

Import [`postman/EventHorizon.postman_collection.json`](postman/EventHorizon.postman_collection.json) into Postman. Set the collection variables `email` and `password` to your test account. Keep `baseUrl` as `http://localhost:4555` for local development.

Run `Register` for a new account, or `Resend verification email` if that email is already registered. Copy the token value from the latest verification email URL into the `verificationToken` collection variable, then run `Verify email`, `Login`, and `Get profile` in order. The Login request saves its JWT to `accessToken` automatically for the profile request. Never put real credentials or tokens into a collection that you plan to share.

## Tests

```powershell
npm test
```

The HTTP tests cover health, request validation, and unauthenticated profile access. Registration, email delivery, database persistence, and successful login/verification require the configured external services.