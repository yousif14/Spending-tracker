# Backup log
| When | Phase | Type | Location | Rows tx / cat-list | Notes |
|---|---|---|---|---|---|
| 2026-10-11 14:35 | P0 baseline | code tag `pre-fa-upgrade` (0bdd1dd, pushed) + bundle, app image `pre-fa-upgrade`, config, n8n logical (103 workflows, 9 tables), n8n volume tar (556 MB) | C:\Data\FA-baseline\2026-10-11\ (logical: n8n-logical\2026-10-11T11-35-56) | 2122 / 961 | tx Amount sum 29961.514; restore drill passed (count, sum and full row contents, incl. the delete-and-reinsert path); SHA256SUMS verified (122 files); n8n down ~78 s |
