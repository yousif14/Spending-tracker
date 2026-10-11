# FA Rollback Guide

**Baseline** (the system as of 2026-10-11):
- folder `C:\Data\FA-baseline\2026-10-11\` (checksums in `SHA256SUMS.txt`)
- git tag `pre-fa-upgrade` (commit `0bdd1dd`, also pushed to GitHub)
- app image `finance-app-financial-app:pre-fa-upgrade`
- n8n logical backup `n8n-logical\2026-10-11T11-35-56\`: 103 workflows, all 9 tables; `transactions` 2,122 rows, Amount sum 29961.514; `Cat-list` 961 rows

**Later snapshots:** see `docs/plans/backup-log.md`.

**Before any rollback**, take a fresh backup (`node n8n/scripts/backup.mjs`) so the rollback itself can be undone.

**Shell notes:**
- Run the commands below in Git Bash. Prefix `docker run` with `MSYS_NO_PATHCONV=1` so the `-v` paths aren't mangled.
- Use `tar` on the volume archive from inside its folder: `cd` there first, or `tar` reads `C:` as a remote host.

## Level 1 — App only (old UI back in ~1 min)
```bash
docker tag finance-app-financial-app:pre-fa-upgrade finance-app-financial-app:latest
docker compose -f financial-composer.yaml up -d --no-build financial-app
```
- If the image is gone, run `docker load -i C:/Data/FA-baseline/2026-10-11/financial-app-image.tar` first.
- The old UI calls the old webhooks (FA - Get / Update / Merchant). If P5 deactivated them, re-activate `aoVZmvgR3GRTC8kR`, `PAVfWilnR0E9msqA` and `EGiQwEDvAKgHXebK` with `POST /workflows/{id}/activate`.

## Level 2 — One workflow
`node n8n/scripts/restore.mjs --dir <snapshot>/<stamp> --workflow <id> --apply`

For FA - add transaction (`I3EaJw8o1YNfkleN`), this brings back the original Telegram flow exactly.

## Level 3 — One table's data
`node n8n/scripts/restore.mjs --dir <snapshot>/<stamp> --table transactions --apply` (or `Cat-list`)

- It deletes all rows and re-inserts the backup, then checks the row count and every row's content.
- Rows created after that snapshot are lost. Export them first from the fresh backup if they're needed.
- Restored rows get new internal `id`s, which nothing in FA depends on.
- **Drill:** `--into new --apply` restores into a new `restore_drill_<stamp>` table instead, leaving live data untouched. Delete that table afterwards with `DELETE /data-tables/<id>`.

## Level 4 — Everything in n8n (disaster)
This restores all workflows, credentials, data tables and history to the baseline. Everything done in n8n since then is lost, including non-FA work.
```bash
docker stop n8n
MSYS_NO_PATHCONV=1 docker run --rm -v n8n_n8n_data:/data -v C:/Data/FA-baseline/2026-10-11:/backup alpine \
  sh -c "cd /data && rm -rf ./* ./.[!.]* 2>/dev/null; tar xzf /backup/n8n_data-volume.tar.gz"
docker start n8n
docker exec n8n wget -qO- http://localhost:5678/healthz   # expect {"status":"ok"}
```
- The public `/healthz` returns 302 (Cloudflare), so check health inside the container as above.
- If P2 changed `C:/Data/n8n/docker-compose.yaml` or `.env`, restore them from the baseline (`n8n-docker-compose.yaml`, `n8n.env`). Then run `docker compose -f C:/Data/n8n/docker-compose.yaml up -d n8n`.

## Level 5 — Code
- `main` is untouched while work happens on `fa-upgrade`, so `git switch main` gets the old code back. `git checkout pre-fa-upgrade` also works.
- The offline copy is `finance-app.bundle` (`git clone C:/Data/FA-baseline/2026-10-11/finance-app.bundle`).

## iPhone
Switch back to the Shortcut "FA SMS (original)".

## Per-phase undo
| Phase | Undo |
|---|---|
| P1 | Level 3 for `transactions` + `Cat-list` from the P1 start snapshot. Delete the `Categories`/`Settings` tables and the `Payee_IBAN`/`Source` columns (`DELETE /data-tables/{id}`, `DELETE /data-tables/{id}/columns/{colId}`). Level 2 for Joseph Finance Query (`RIbvggdanZ2tzERx`). |
| P2 | Level 2 for `I3EaJw8o1YNfkleN` from the P2-start snapshot `C:\data\n8n\n8n_Api\backups\2026-10-11T12-48-28` (`node n8n/scripts/restore.mjs --dir <it> --workflow I3EaJw8o1YNfkleN --apply`). Restore n8n's `docker-compose.yaml` and `.env` from the copies in that snapshot (`n8n.env`) and restart n8n. If the bot token was rotated, the old token is dead: put the **new** token into the restored workflow's "Ask for Category" URL and the Telegram credential. |
| P3 | Deactivate or delete "FA - App API". Delete the "FA App Key" credential. Level 2 for `I3EaJw8o1YNfkleN` (removes header auth from the Shortcut webhook). Switch the iPhone back to "FA SMS (original)". Level 1 for the app (old nginx config). |
| P4/P5 | Level 1 (old app image), and re-activate the old webhooks if P5 Task 7 ran. Data written by the new app is compatible with the old app (same tables), so nothing else is needed. |
