<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/73d9c49c-1ad4-42fe-9255-8c190973d7aa

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env.local`
3. Set `VITE_API_URL` in `.env.local` to your backend URL
4. Set `VITE_GOOGLE_MAPS_API_KEY` in `.env.local` so the in-app map can render
5. Optionally set `VITE_GEMINI_API_KEY` if you use the support chatbot
6. Run the app:
   `npm run dev`

The Vite dev server now defaults to `http://localhost:5173` to avoid clashing with backend services that commonly use port `3000`.

Local development can still fall back to `http://localhost:3001` when `VITE_API_URL` is omitted, but deployed builds should always set `VITE_API_URL` explicitly.

## CORS Note

If your frontend origin is not `http://localhost:3000` or `http://localhost:5173`, your backend `CORS_ORIGINS` must include the exact frontend origin.

When testing with ngrok, include the active ngrok frontend URL in `CORS_ORIGINS` and update it whenever the ngrok link changes.
