# Backup log
| When | Phase | Type | Location | Rows tx / cat-list | Notes |
|---|---|---|---|---|---|
| 2026-10-11 14:35 | P0 baseline | code tag `pre-fa-upgrade` (0bdd1dd, pushed) + bundle, app image `pre-fa-upgrade`, config, n8n logical (103 workflows, 9 tables), n8n volume tar (556 MB) | C:\Data\FA-baseline\2026-10-11\ (logical: n8n-logical\2026-10-11T11-35-56) | 2122 / 961 | tx Amount sum 29961.514; restore drill passed (count, sum and full row contents, incl. the delete-and-reinsert path); SHA256SUMS verified (122 files); n8n down ~78 s |
| 2026-10-11 15:26 | P1 start | n8n logical (103 workflows, 9 tables) | C:\data\n8n\n8n_Api\backups\2026-10-11T12-26-45 | 2122 / 961 | tx Amount sum 29961.514 |
| 2026-10-11 15:34 | P1 pre-migrate | n8n logical (after Categories/Settings + Payee_IBAN/Source columns, before data migration) | C:\data\n8n\n8n_Api\backups\2026-10-11T12-34-29 | 2122 / 961 | tx Amount sum 29961.514; best restore point to undo only the migration |
| 2026-10-11 15:42 | P1 end, rollback point | n8n logical | C:\data\n8n\n8n_Api\backups\2026-10-11T12-42-50 | 2122 / 961 | sum unchanged 29961.514; all Dates ISO; Source sms 1359 / fawri 678 / manual 85; Categories 20, Settings 1; Joseph Finance Query code fixed (still inactive by choice) |
| 2026-10-11 15:48 | P2 start | n8n logical (103 workflows) + n8n docker-compose.yaml/.env copies | C:\data\n8n\n8n_Api\backups\2026-10-11T12-48-28 | 2122 / 961 | tx Amount sum 29961.514 |
| 2026-10-11 16:02 | P2 end, rollback point | n8n logical (103 workflows) | C:\data\n8n\n8n_Api\backups\2026-10-11T13-02-24 | 2122 / 961 | sum 29961.514 (test rows deleted); FA - add transaction 78 nodes; bot token in n8n .env (FA_TG_BOT_TOKEN), n8n restarted 15:51 |
