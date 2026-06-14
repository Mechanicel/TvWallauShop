# Audit-Worklog (append-only)

> Append-only Notizdatei für den statischen Audit. Bei Kontextverlust ist hier der Stand.
> Konsolidiert am Ende in `/AUDIT.md`.

## Meta
- Datum: 2026-06-03
- Commit: 90c24438ffc8a12738495fc24c992d60071b35be (main, clean)
- Modus: STATISCH (read-only, keine Code-Änderungen)

## Inventar (Stand: erfasst)
- Tracked Quelldateien erfasst via `git ls-files`. Keine untracked/non-ignored Dateien.
- ~20.429 Zeilen gesamt über die gemessenen Quelltypen.
- Tooling vorhanden: node_modules (root/frontend/backend), .venv (python), tsc, eslint.
- knip/nx-Binary nicht in root/.bin gefunden (ggf. via nx-Wrapper).
- CLAUDE.md-Drift: genannte tote Dateien `src/main.js|counter.js|javascript.svg|style.css` existieren NICHT mehr.

## Fortschritt
- [x] Inventar + Coverage-Checkliste erstellt
- [ ] Tooling-Reports (tsc/eslint/nx graph)
- [ ] Workspace backend gelesen
- [ ] Workspace frontend gelesen
- [ ] Workspace contracts gelesen
- [ ] Workspace python_ai_service gelesen
- [ ] Workspace infra + root gelesen
- [ ] Workflow-Tracings
- [ ] AUDIT.md konsolidiert

---

## Notizen (chronologisch)

### Abschluss (2026-06-03)
- Tooling: backend/contracts `tsc` fehlerfrei; frontend `tsc` = 5 Fehler / 4 Dateien; frontend `eslint` Config-Fehler (`react-hooks/exhaustive-deps` Plugin nicht registriert); `nx graph` → `docs/audit/nx-graph.json`.
- 5 Deep-Read-Agenten fertig: backend/frontend/python/infra/workflows → je `_worklog_<ws>.md`.
- Eigene Verifikation der schwersten Befunde: websocket.ts, socket.ts, InsufficientStockError.ts, docker-compose.yml, orchestrator.py(110-170), config.py(130-155), constants.ts, App.tsx. Alle bestätigt.
- Neuer eigener Befund: `python-ai-service` im Compose ohne `env_file`/`environment` → GPU/NPU-Defaults greifen (AUD-004). `Dockerfile.app` vom Compose NICHT referenziert (kein Build-Block).
- **AUDIT.md konsolidiert** (68 Befund-IDs AUD-001..068). Abdeckung ~100 % der nicht-generierten Quelldateien.

- [x] Inventar + Coverage-Checkliste erstellt
- [x] Tooling-Reports (tsc/eslint/nx graph)
- [x] Workspace backend gelesen
- [x] Workspace frontend gelesen
- [x] Workspace contracts gelesen
- [x] Workspace python_ai_service gelesen
- [x] Workspace infra + root gelesen
- [x] Workflow-Tracings
- [x] AUDIT.md konsolidiert