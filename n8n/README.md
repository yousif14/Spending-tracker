# n8n tooling for FA

- `code/` — pure JS used inside n8n Code nodes. Unit-tested with vitest (`*.test.js`).
- `scripts/` — Node scripts that talk to the n8n public API (backup, migrate, patch workflows).
- `workflows/` — build scripts that generate or patch workflow JSON.
- `.out/` — generated files (gitignored).

API key is read from `C:\data\n8n\n8n_Api\n8n_api.env` (override with env `N8N_API_KEY_FILE`).
