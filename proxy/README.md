# Live answer proxy (optional)

Small FastAPI service for the dashboard's "Ask the evidence" box. The browser computes all counts from the frozen dataset and sends only those counts, the nearest tests and up to five reviewed passages; the service asks Claude on Google Cloud Vertex AI to write a 2–5 sentence answer from them and removes any sentence whose numbers are not in that context (`number_guard.py`). If anything fails, the dashboard keeps showing the retrieved counts and texts.

No API key and no `.env`: the Cloud Run service account calls Vertex AI with `roles/aiplatform.user`. Question text is not logged. CORS allows only the GitHub Pages origin; body ≤ 32 KB, question ≤ 300 characters, 10 requests per minute per IP.

## Deploy (team, Google Cloud credits)
1. Select the project, check billing uses the credits, enable the Vertex AI API, enable Claude Opus 5.5 in Model Garden (and Claude Opus 4.8 if the refusal fallback stays on; set `FALLBACK_MODEL=""` to turn it off).
2. Deploy:
   ```
   gcloud run deploy mfem-ask --source proxy --region europe-west1 --allow-unauthenticated \
     --min-instances 1 --max-instances 3 --concurrency 20 --memory 512Mi \
     --set-env-vars GCP_PROJECT=<project-id>,GCP_REGION=global,ALLOWED_ORIGIN=https://semanurcetinn.github.io
   ```
3. Grant the service account `roles/aiplatform.user`.
4. Health check: `curl https://<service-url>/health`.
5. Run `python scripts/eval_ask.py https://<service-url>` → `docs/ASK_EVAL.md` must say PASS.
6. Only then write the URL into `web/config.js` (`PROXY_URL`). Set a daily budget alert of 10 USD.

Tests without any network call: `python proxy/tests/test_number_guard.py`.
