# Live answer proxy (optional)

Small FastAPI service for the dashboard's "Ask the evidence" box. The browser computes all counts from the frozen dataset and sends only those counts, the nearest tests and up to five reviewed passages; the service asks a model to write a 2–5 sentence answer from them and removes any sentence whose numbers are not in that context (`number_guard.py`). If anything fails, the dashboard keeps showing the retrieved counts and texts.

Model: Gemini through Google AI Studio's standing free tier — a Space Apps Global Offer in its own right, separate from the Google Cloud $300 trial credit, so no billing account or card is needed for the model calls themselves. (The $300 credit cannot pay for a third-party model offered as a managed API, and Gemini's own Vertex AI access has its own date-gated exclusion — using AI Studio's free tier directly avoids both questions.) Hosting on Cloud Run stays inside Cloud Run's own perpetual free tier at this traffic level.

One secret: `GEMINI_API_KEY`, created once in Google AI Studio and bound to the Cloud Run service from Secret Manager — never written to a file in this repo, never logged, never pasted into chat. Question text is not logged. CORS allows only the GitHub Pages origin; body ≤ 32 KB, question ≤ 300 characters, 10 requests per minute per IP.

Data-use note: AI Studio's free tier may use submitted content to improve Google's products (its paid tier does not). What this service sends is counts and short passages derived from the public, frozen NASA dataset — no personal data — so the team judged this acceptable; say so in the SI-use declaration if asked.

## Deploy (team, free-tier resources only)
1. In Google AI Studio, accept the terms and create an API key (no credit card; stays on the free tier as long as no billing is attached to that project — see "Am I on the free or paid tier?" in AI Studio's own docs if unsure).
2. In Secret Manager (same Google Cloud project used for Cloud Run), create a secret holding that key, e.g. `gemini-api-key`. Grant the Cloud Run service's runtime service account `roles/secretmanager.secretAccessor` on it.
3. Deploy, binding the secret as an environment variable (the key itself never appears in this command):
   ```
   gcloud run deploy mfem-ask --source proxy --region europe-west1 --allow-unauthenticated \
     --min-instances 0 --max-instances 3 --concurrency 20 --memory 512Mi \
     --set-env-vars ALLOWED_ORIGIN=https://semanurcetinn.github.io \
     --set-secrets GEMINI_API_KEY=gemini-api-key:latest
   ```
   (`--min-instances 0` keeps this inside Cloud Run's free tier; the first request after idling is a little slower.)
4. Health check: `curl https://<service-url>/health`.
5. Run `python scripts/eval_ask.py https://<service-url>` → `docs/ASK_EVAL.md` must say PASS.
6. Only then write the URL into `web/config.js` (`PROXY_URL`).

Tests without any network call: `python proxy/tests/test_number_guard.py`.
