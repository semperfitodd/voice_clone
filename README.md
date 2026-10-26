# Voice Clone – Real-Time Speech Synthesis on Kubernetes

Self-hosted voice cloning and text-to-speech using Tortoise TTS, Flask, React, Cognito (Google sign-in), Terraform, Argo CD, and EKS.

Live demo: [https://voice-clone.brewsentry.com](https://voice-clone.brewsentry.com) (intended production URL; the running stack may still reflect the previous shared API-key deployment until the Cognito changes below are applied)

Architecture diagram: [architecture/exports/voice-clone.png](architecture/exports/voice-clone.png)

## Implementation status (26 October 2026)

**In this repository**

- Cognito with Google federation, custom auth domain, and browser PKCE sign-in
- API Gateway JWT authorizer and Flask ID-token verification
- Per-user voice directories keyed on the verified JWT `email` claim
- React static site with shared API client and architecture diagram exports
- Terraform and Helm versions aligned with the People Portal generation (AWS provider 6.x, EKS module 21.x, Kubernetes 1.37 target)

**Not deployed from this work**

- `terraform apply` was not run in this environment
- [k8s/microservices/values.yaml](k8s/microservices/values.yaml) `voiceGenerator.cognito.clientId` and `userPoolId` are still empty placeholders
- Tortoise image tag is still `20250610095832` until the next ECR build and Helm update

## What this does

- Sign in with Google through Cognito (`auth.brewsentry.com`)
- Record five training paragraphs in the browser
- Synthesize new speech from text using your cloned voice
- Store voice samples and outputs on an S3-backed volume mounted in the Tortoise pod

## Voice use, consent, privacy, and abuse prevention

- Clone and synthesize **only your own voice**, or a voice you recorded with that person’s **explicit permission**. Do not use this service to impersonate someone, commit fraud, harass, or generate deceptive content.
- Signing in with Google and uploading training audio is your confirmation that you are authorized to use that voice. The app does not collect a separate consent form or e-signature.
- The verified Cognito email is the storage identity. Training samples and synthesized files are scoped to that account and are not shared across users. Recordings are not sold or used for advertising. Application logs must not include ID tokens, refresh tokens, email addresses, or audio payloads.
- Operators may suspend access or delete stored files that violate these rules. There is no automated content moderation or deepfake detector in the application path.

## Architecture (summary)

```text
Browser → CloudFront → S3 (static site + config.js)
Browser → CloudFront → API Gateway (JWT) → internal ALB → Flask → S3 voice mount
Browser → Cognito → Google (OAuth)
Terraform provisions AWS; Argo CD deploys Kubernetes workloads
```

See [architecture/diagrams/voice-clone.excalidraw](architecture/diagrams/voice-clone.excalidraw) for the full diagram. Regenerate PNG/SVG:

```bash
cd architecture
npm install
npm run export
```

## Limitations

- `GET /synthesize` on the internal load balancer is unauthenticated and serves as the health check only. All user-facing API routes require a JWT.
- API Gateway stage throttling is 50 requests per second (burst 50). There is no per-user quota or billing meter.
- There is no “delete my recordings” API. Files remain on the S3 mount under `/mount/<email>/` until an operator removes them.
- Synthesis runs asynchronously on a single GPU-backed pod. `POST /synthesize` returns **202** before audio exists; clients must poll `GET /outputs`.
- The five-paragraph recording gate is enforced in browser `localStorage`, not on the server.

## Remaining production requirements

1. Apply Terraform with `TF_VAR_cognito_google_client_id` and `TF_VAR_cognito_google_client_secret`. On the Google OAuth client, allow redirect URI `https://auth.brewsentry.com/oauth2/idpresponse`.
2. Copy Terraform outputs into [k8s/microservices/values.yaml](k8s/microservices/values.yaml) (`voiceGenerator.cognito.clientId`, `userPoolId`, `region`).
3. Build the static site (`npm run build`), apply Terraform (uploads `dist` and `config.js`), and set `voiceGenerator.image.tag` to the new ECR tag Terraform pushes.
4. Smoke-test on the live URL: Google sign-in, one training upload, one synthesis request, and playback of an output file.
5. Confirm the Argo CD ingress serves TLS at the load balancer. The chart terminates HTTPS on the ALB and forwards HTTP to the Argo CD server pod.

## Prerequisites

- Terraform **>= 1.16.4**
- AWS account and credentials for Terraform
- Google OAuth client configured for Cognito (`https://auth.<your-domain>/oauth2/idpresponse`)
- `kubectl` access to the EKS cluster after Terraform apply

The EKS control plane target in [terraform/terraform.tfvars](terraform/terraform.tfvars) is **Kubernetes 1.37** (`eks_cluster_version`).

## Deploy infrastructure

Set Cognito Google credentials (do not commit these):

```bash
export TF_VAR_cognito_google_client_id="..."
export TF_VAR_cognito_google_client_secret="..."
```

```bash
cd terraform
terraform init -upgrade
terraform apply
```

Note outputs for Cognito and the voice EKS bucket:

```bash
terraform output cognito_client_id
terraform output cognito_user_pool_id
terraform output cognito_domain
```

Update [k8s/microservices/values.yaml](k8s/microservices/values.yaml) `voiceGenerator.cognito` with the client id, pool id, and region before syncing the microservices chart.

## Build and deploy the app

Terraform builds and pushes the Tortoise Docker image to ECR when `docker/tortoise` changes.

Build the static site before Terraform uploads it:

```bash
cd static_site/voice_clone
cp public/config.js.example public/config.js
# Fill public/config.js for local dev; production config.js is written by Terraform to S3.
npm install
npm run build
```

Argo CD (bootstrapped via Terraform) syncs [k8s/master](k8s/master) and child charts.

## Local frontend development

```bash
cd static_site/voice_clone
cp public/config.js.example public/config.js
# Set COGNITO_* values and localhost callback URLs.
npm install
npm run dev
```

API calls from Vite use relative paths (`/input`, `/outputs`, `/synthesize`) and expect the same origin or a dev proxy to the deployed API.

## API behavior

All routes except the internal health check require a Cognito ID token:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/synthesize` | Health check (internal ALB only; no JWT) |
| POST | `/synthesize` | Queue synthesis (`{"text":"..."}`) |
| POST | `/input` | Upload training WAV (multipart `file`) |
| GET | `/outputs` | List synthesized files for the signed-in user |
| GET | `/outputs/{filename}` | Download a WAV |

Flask ignores client-supplied email fields and uses the verified JWT `email` claim.

## Tests (26 October 2026)

Run locally:

```bash
cd static_site/voice_clone && npm test
cd docker/tortoise && python3 -m venv .venv && . .venv/bin/activate
pip install flask PyJWT cryptography requests pytest
python -m pytest test_auth.py test_app.py
cd static_site/voice_clone && npm run build
cd terraform && terraform init -upgrade -backend=false && terraform validate
```

Results on that date:

| Check | Result |
|-------|--------|
| Vitest (4 tests) | Passed — PKCE authorize URL, five-recording gate, bearer token on API client |
| Pytest (7 tests) | Passed — email sanitization, health check without token, unauthenticated synthesis rejected, token-scoped identity, unsafe filename rejected |
| `npm run build` | Succeeded |
| `terraform validate` | Succeeded after local `init -upgrade -backend=false` |

Not verified in this environment: remote Terraform state (S3 backend returned 403), end-to-end Google sign-in against Cognito, GPU synthesis on cluster, or the deployed production API.

## Environment and secrets

| Variable | Where |
|----------|--------|
| `TF_VAR_cognito_google_client_id` | Terraform apply (Google OAuth client id) |
| `TF_VAR_cognito_google_client_secret` | Terraform apply (Google OAuth secret) |
| `COGNITO_*` in `config.js` | Browser runtime (written by Terraform to S3) |
| `COGNITO_CLIENT_ID`, `COGNITO_USER_POOL_ID`, `COGNITO_REGION` | Flask pod env (Helm values) |

## Credits

- [Tortoise TTS](https://github.com/neonbjb/tortoise-tts)
- [Flask](https://flask.palletsprojects.com/)
- [Argo CD](https://argo-cd.readthedocs.io/)
- [Terraform](https://www.terraform.io/)

Built by [Todd Bernson](https://toddbernson.com)
