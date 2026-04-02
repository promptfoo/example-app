# AGENTS.md

Guidance for AI agents and developers working on `promptfoo/example-app`.

## Repository Purpose

This is a TypeScript/Express example API gateway for AI chat. It exposes public and authenticated chat endpoints, maps fish-named path levels (`minnow`, `shark`) to internal prompt-safety levels, issues RS256 JWTs through OAuth-style token endpoints, and forwards chat completions to LiteLLM.

This repo is intentionally useful as a security-scanning example, so preserve clear auth, prompt, and model-routing boundaries when making changes.

## Common Commands

```bash
# Install dependencies
npm install

# Compile TypeScript to dist/
npm run build

# Start the compiled server
npm start

# Run the development server with ts-node
npm run dev

# Start LiteLLM from the local compose file
docker compose up -d
```

There is no local test script in `package.json` today, so use `npm run build` as the minimum validation command for code changes.

## Code Layout

- `src/server.ts`: Express app startup, middleware registration, route wiring, and in-memory RSA key generation.
- `src/routes/chat.ts`: request validation, fish-level to prompt-level mapping, model allowlist enforcement, and LiteLLM request forwarding.
- `src/routes/oauth.ts`: OAuth token and JWKS handlers for client credentials and password grants.
- `src/middleware/auth.ts`: JWT Bearer-token verification middleware.
- `src/domains/`: per-domain prompt text and prompt loaders for `general`, `finance`, `medicine`, `taxes`, and `vacation-rental`.
- `src/utils/jwt-keys.ts`: in-memory RSA key generation plus public/private key accessors and JWKS export.
- `src/utils/litellm-config.ts`: reads `litellm_config.yaml` and caches allowed model names.
- `litellm_config.yaml` and `docker-compose.yml`: local LiteLLM runtime configuration.

## Implementation Rules

- Load environment variables before modules that depend on them; `src/server.ts` intentionally calls `dotenv.config()` first.
- Preserve the `minnow`/`shark` API contract even though the implementation maps those names to `insecure`/`secure` prompt files internally.
- Keep Zod validation and explicit JSON error responses when changing route handlers.
- Do not commit real `.env` files, client secrets, user passwords, private keys, or API keys.
- Be careful with domain prompt edits: `secure.txt` files encode the safety/compliance behavior this app is meant to demonstrate.
- `src/utils/litellm-config.ts` currently fails open when the model config cannot be read; do not silently change that behavior without calling it out in the PR.

## Validation

- Run `npm run build` after TypeScript changes.
- Run `npm run dev` with `docker compose up -d` when you need to manually verify chat/OAuth flows against LiteLLM.
- CI currently runs the Promptfoo Code Scan workflow and requires the aggregate `CI Success` check.

## Git Workflow

- Do not push directly to `main`; create a branch and open a PR.
- Use Conventional Commit subjects (`feat:`, `fix:`, `docs:`, `refactor:`, `build:`, `ci:`, `chore:`) to match current repo history.
- Keep PR descriptions specific about API behavior, auth/prompt-safety impact, and manual validation performed.
