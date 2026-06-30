# Health Prediction Server

Backend API for the Health Prediction System.

Quick start:

1. copy `.env.example` to `.env` and fill values
2. cd `backend` and run `npm install`
3. `npm run dev` to start with nodemon

> Note: The backend uses Resend for email delivery. In test mode, set `RESEND_OWNER_EMAIL` to a verified Resend owner email address to allow retry fallback when sending to unverified recipients.

APIs are mounted under `/api`:
- `GET /api/patients`
- `GET /api/patients/:id`
- `POST /api/patients`
- `PUT /api/patients/:id`
- `DELETE /api/patients/:id`
- `POST /api/predict`
