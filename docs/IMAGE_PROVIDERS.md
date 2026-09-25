# AI image providers (video slide backgrounds)

`scripts/prod-video-drain.ts` → `lib/video/generateVideo.ts` → `generateWithFallback()` in
`lib/image/providers/index.ts` tries providers in order and falls back to solid-colour slides
only when every provider fails:

1. **pollinations** (`lib/image/providers/pollinations.ts`)
2. **huggingface** (`lib/image/providers/huggingface.ts`)
3. **local-sd** (placeholder, `LOCAL_SD_URL`)

Every provider logs a single-line error with HTTP status, endpoint/mode, attempt count and a
short body snippet (or the network cause, e.g. `ENOTFOUND`) so `[image] provider … failed`
lines are actionable.

## Pollinations

| Env | Meaning |
| --- | --- |
| `POLLINATIONS_API_KEY` | Secret `sk_…` key from <https://enter.pollinations.ai/keys>. Server-side only. |
| `POLLINATIONS_IMAGE_MODEL` | Optional model id (e.g. `flux`); empty = Pollinations default. |

- **With a key:** `GET https://gen.pollinations.ai/image/{prompt}?width=&height=&seed=[&model=]`
  with `Authorization: Bearer $POLLINATIONS_API_KEY` (docs: <https://gen.pollinations.ai/docs>).
  The key is sent in the header, never in the URL.
- **Without a key:** legacy anonymous `https://image.pollinations.ai/prompt/{prompt}` — heavily
  rate-limited (HTTP 429 at 1080×1920 / 1280×720).
- Retries: 3 attempts on 429/500/502/503/504 and transient network errors, backoff 1.5 s → 3 s,
  honouring `Retry-After` (capped at 10 s). 401/402 fail fast with a hint. Timeouts (90 s) are not retried.

## Hugging Face (Inference Providers)

`api-inference.huggingface.co` no longer resolves; requests now go through the router
`https://router.huggingface.co/{provider}/…` (docs:
<https://huggingface.co/docs/inference-providers/tasks/text-to-image>).

| Env | Meaning |
| --- | --- |
| `HF_TOKEN` | Fine-grained token with the **"Make calls to Inference Providers"** permission. |
| `HUGGINGFACE_IMAGE_PROVIDER` | `nscale` (default) or `hf-inference`. |
| `HUGGINGFACE_IMAGE_MODEL` | Model override. Defaults: `black-forest-labs/FLUX.1-schnell` (nscale), `stabilityai/stable-diffusion-3-medium-diffusers` (hf-inference). |

- `nscale`: `POST /nscale/v1/images/generations` with
  `{ model, prompt, size: "WxH", n: 1, response_format: "b64_json" }` → `data[0].b64_json`.
- `hf-inference`: `POST /hf-inference/models/{model}` with `{ inputs, parameters: { width, height, seed } }`
  → raw image bytes. The only text-to-image model currently served there is SD3-medium, which is
  **gated** (accept the licence on the model page first, otherwise HTTP 403).
- Requested sizes are scaled to ≈1 MP (multiples of 16, aspect preserved; 1920×1080 → 1360×768, 1280×720 unchanged);
  `generateVideo` resizes the result to the slide size anyway.
- Usage is billed against the account's Inference Providers credits (small monthly free tier).
- Retries: 3 attempts on 429/5xx (backoff 2 s → 4 s, `Retry-After` honoured, cap 20 s).

To check which providers serve a model:
`https://huggingface.co/api/models/<model>?expand[]=inferenceProviderMapping`.

## Tests

`npm test` runs `lib/image/providers/providers.test.ts` (mocked `fetch`, no network).
