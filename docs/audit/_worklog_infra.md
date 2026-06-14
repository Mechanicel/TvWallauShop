# Audit: CONTRACTS · INFRA · ROOT-CONFIG
**Scope:** contracts/, infra/, package.json (root), nx.json, .gitignore, .dockerignore, README.md, scripts/dev/service-runner-node.js, scripts/env/init-env.js, tools/repo-tools/project.json
**Stand:** 2026-06-03 | Auditor: Claude Sonnet 4.6 (read-only)

---

## Coverage-Tabelle

| Datei | gelesen | Verantwortung | Auffälliges |
|---|---|---|---|
| `contracts/package.json` | ja | npm-Paket-Definition, Exports, Scripts | `build` ist nur `tsc --noEmit`; kein `"license"` |
| `contracts/project.json` | ja | Nx-Targets für contracts | lint = nur echo |
| `contracts/tsconfig.json` | ja | TypeScript-Kompilierung contracts | OK, `"strict": true` |
| `contracts/contracts.iml` | ja | IntelliJ-Modulkonfiguration | IDE-only, kein funktionaler Inhalt |
| `contracts/src/index.ts` | ja | Re-Export aller Contract-Module | OK |
| `contracts/src/ai-product.ts` | ja | KI-Pipeline-Typen (Request/Response) | `LanguageCode = 'en'` hardkodiert; `DeviceRouting` in TS aber nicht im JSON-Schema |
| `contracts/src/ai-errors.ts` | ja | KI-Fehlercodes | OK |
| `contracts/src/auth.ts` | ja | Login/Signup/Auth-Typen | OK |
| `contracts/src/errors.ts` | ja | `InsufficientStockResponse` | OK |
| `contracts/src/order.ts` | ja | Order/OrderSummary-Typen | `status: string` (kein Enum) |
| `contracts/src/product.ts` | ja | Product/ProductAiJob-Typen | `product_id`, `result_display_name` etc. snake_case im TS-Interface (Stilbruch) |
| `contracts/src/user.ts` | ja | User/UserRole/PaymentMethod etc. | OK |
| `contracts/schema/analyze-product-request.schema.json` | ja | JSON-Schema für AnalyzeProductRequest | konsistent mit TS |
| `contracts/schema/analyze-product-response.schema.json` | ja | JSON-Schema für AnalyzeProductResponse | `AnalyzeDebug` stark abgeschnitten vs. TS/Pydantic |
| `contracts/tests/placeholder.test.js` | ja | Platzhalter-Test contracts | Trivial, kein echter Mehrwert |
| `infra/docker-compose.yml` | ja | Docker-Stack-Definition | Kein Netzwerk explizit; kein healthcheck für backend/frontend/python; Ports exponiert |
| `infra/Dockerfile.app` | ja | App-Dockerfile (infra/) | **Datei ist leer** (0 Byte) |
| `infra/.env.example` | ja | Compose-Variablen (Ports, DB) | `DB_PASS=change_me`, `DB_ROOT_PASS=change_me` als Beispielwert |
| `infra/backend.env.example` | ja | Backend-Env für Docker-Container | `DB_PASSWORD=` (leeres Duplikat); `APP_URL`/`APP_ORIGIN` = localhost |
| `infra/README.md` | ja | Infra-Doku | Erwähnt `docker:build` statt `npm run docker:build`; ansonsten korrekt |
| `infra/project.json` | ja | Nx-Targets für infra | Kein `test`-Target; `compose:init` nutzt `--abort-on-container-exit` (gut) |
| `infra/infra.iml` | ja | IntelliJ-Modulkonfiguration | IDE-only |
| `infra/tests/run-tests.cmd` | ja | Windows-Testskript | Ruft `npm test` im PROJECT_DIR (nicht infra/) auf — falsch |
| `infra/tests/run-tests.sh` | ja | POSIX-Testskript | Nur Datei-Existenz-Checks; `Dockerfile.app` ist leer → Test irreführend |
| `package.json` (root) | ja | npm Workspaces, Root-Scripts | `python_ai_service` als npm-Workspace (hat kein vollwertiges package.json); kein `"license"` |
| `nx.json` | ja | Nx-Konfiguration, Named Inputs, Target Defaults | `outputs` fehlt bei mehreren Targets → kein Caching möglich |
| `.gitignore` | ja | Git-Ignore-Regeln | `backend/.env` nicht explizit ignoriert (aber via `**/.env`? Nein — nicht vorhanden) |
| `.dockerignore` | ja | Docker-Build-Ausschlüsse | Kein `*.env`, `**/*.env` → env-Dateien könnten in Images landen |
| `README.md` (root) | ja | Projektdokumentation | `ACCESS_TOKEN_EXPIRES_IN=1m` in Beispiel (sehr kurz); ansonsten korrekt |
| `scripts/dev/service-runner-node.js` | ja | Dev-Prozessmanager (start/stop/status) | OK; Windows + POSIX-Pfade berücksichtigt |
| `scripts/env/init-env.js` | ja | Env-Datei-Initialisierung | Erzeugt geleerte Werte korrekt; liest nur `.example` → `.env` |
| `tools/repo-tools/project.json` | ja | Root-Aufräum-Targets | OK |

---

## Befunde

### F01: `infra/Dockerfile.app` ist leer (0 Byte)
- **Kategorie:** Korrektheit
- **Schweregrad:** Hoch
- **Konfidenz:** Bestätigt
- **Ort:** `infra/Dockerfile.app` (gesamte Datei)
- **Auswirkung:** Die Datei existiert nur auf dem Dateisystem, hat aber keinen Inhalt. `infra/tests/run-tests.sh` testet lediglich ihre Existenz (`if [ ! -f "Dockerfile.app" ]`) und besteht dadurch den Test, obwohl das Artefakt inhaltsleer ist. Es ist unklar, welches Docker-Image hier gebaut werden sollte — die eigentlichen Dockerfiles liegen unter `backend/Dockerfile`, `frontend/Dockerfile` und `python_ai_service/Dockerfile`.
- **Empfehlung:** Entweder (a) die Datei mit dem korrekten Inhalt befüllen, falls sie ein zentrales App-Image beschreiben soll, oder (b) die leere Datei und den zugehörigen Test entfernen, falls sie überflüssig ist. Den Test in `run-tests.sh` ggf. auf sinnvollen Inhalt erweitern.
- **Aufwand:** S

---

### F02: `infra/tests/run-tests.cmd` führt `npm test` im falschen Verzeichnis aus
- **Kategorie:** Korrektheit / DX/Tooling
- **Schweregrad:** Mittel
- **Konfidenz:** Bestätigt
- **Ort:** `infra/tests/run-tests.cmd:5–6`
- **Auswirkung:** `PROJECT_DIR` wird auf `%SCRIPT_DIR%..` gesetzt (= `infra/`), `pushd` wechselt dorthin, dann wird `npm test` aufgerufen. `infra/` enthält aber kein `package.json` — das `if exist package.json` schlägt fehl, die Zeile `echo No tests defined for infra.` gibt exit 0 zurück. Faktisch: auf Windows werden infra-Tests nie ausgeführt (allerdings gibt es auch keine echten infra-Tests, daher momentan folgenlos).
- **Empfehlung:** Entweder den Pfad korrigieren oder das Skript an das POSIX-Pendant angleichen (Datei-Existenz-Checks).
- **Aufwand:** S

---

### F03: `infra/tests/run-tests.sh` testet nur Datei-Existenz, nicht Inhalt
- **Kategorie:** Tests/QS
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `infra/tests/run-tests.sh:4–14`
- **Auswirkung:** `Dockerfile.app` ist leer (F01), besteht aber den Existenz-Check. Der Test vermittelt falsche Sicherheit.
- **Empfehlung:** Nach Klärung von F01 den Test entweder entfernen oder durch echte Compose-Validierung (`docker compose config`) ersetzen.
- **Aufwand:** S

---

### F04: `.dockerignore` schließt `.env`-Dateien nicht aus
- **Kategorie:** Sicherheit
- **Schweregrad:** Hoch
- **Konfidenz:** Bestätigt
- **Ort:** `.dockerignore` (gesamte Datei)
- **Auswirkung:** Wenn lokal eine `backend/.env`, `infra/backend.env` oder `python_ai_service/.env` mit echten Secrets vorhanden ist, wird sie beim Docker-Build-Kontext an den Docker-Daemon übertragen und landet potenziell im Image-Layer (falls ein `COPY . .` o.ä. im Dockerfile steht). Die aktuellen Dockerfiles verwenden selektive `COPY`-Befehle (kein `COPY . .`), daher ist das Risiko im Ist-Zustand gering — aber ein zukünftiger Dockerfile-Edit könnte das unbewusst aktivieren.
- **Empfehlung:** `**/.env`, `infra/backend.env` und `python_ai_service/.env` explizit in `.dockerignore` aufnehmen.
- **Aufwand:** S

---

### F05: `.gitignore` ignoriert `backend/.env` nicht explizit
- **Kategorie:** Sicherheit
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `.gitignore` (gesamte Datei)
- **Auswirkung:** `.gitignore` hat keine Zeile für `backend/.env`. Es existieren Einträge für `/infra/.env`, `/infra/backend.env`, `/python_ai_service/.env` (mit absolutem Pfad). `backend/.env` wird nur durch keinen commit geschützt, wenn es nie staged wurde — aber es gibt keine explizite Regel. Ein `git add -A` könnte es versehentlich einschließen.
- **Empfehlung:** `/backend/.env` explizit in `.gitignore` ergänzen.
- **Aufwand:** S

---

### F06: Keine expliziten Docker-Netzwerke in `docker-compose.yml`
- **Kategorie:** Architektur/Kopplung
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `infra/docker-compose.yml` (gesamte Datei)
- **Auswirkung:** Alle Services nutzen das automatisch erzeugte Default-Netzwerk. Das funktioniert, ist aber nicht explizit dokumentiert. Bei einem Netzwerk-Splitting (z.B. DB nur intern erreichbar) müsste man nachträglich umbauen.
- **Empfehlung:** Optionales Aufräumen: explizites Netzwerk `internal` für mariadb←→backend und ggf. `external` für frontend/python-ai-service. Keine Dringlichkeit.
- **Aufwand:** M

---

### F07: Kein `healthcheck` für `backend`, `frontend`, `python-ai-service`
- **Kategorie:** Observability/Logging
- **Schweregrad:** Mittel
- **Konfidenz:** Bestätigt
- **Ort:** `infra/docker-compose.yml:20–65`
- **Auswirkung:** Nur `mariadb` hat einen Healthcheck. `backend` startet nach `mariadb:service_healthy`, aber eigene Readiness wird nicht überwacht. In Prod kann das Stack-Monitoring (`docker compose ps`) nur den Container-Status (running), nicht die Anwendungsbereitschaft anzeigen.
- **Empfehlung:** `healthcheck` für Backend (`GET /health → 200`) und Python-AI-Service (`GET /health`) ergänzen. Frontend (Nginx) ggf. auch.
- **Aufwand:** S

---

### F08: Kein `restart`-Policy für `backend`, `frontend`, `python-ai-service`
- **Kategorie:** Konfiguration/Env
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `infra/docker-compose.yml:20–65`
- **Auswirkung:** Nur `mariadb` hat `restart: unless-stopped`. Bei einem Absturz des Backends oder Python-Services werden diese nicht automatisch neugestartet.
- **Empfehlung:** `restart: unless-stopped` für alle produktiven Services ergänzen.
- **Aufwand:** S

---

### F09: Container laufen als `root` (kein `USER`-Statement)
- **Kategorie:** Sicherheit
- **Schweregrad:** Mittel
- **Konfidenz:** Bestätigt
- **Ort:** `backend/Dockerfile` (gesamte Datei), `python_ai_service/Dockerfile` (gesamte Datei)
- **Auswirkung:** Node- und Python-Prozesse laufen im Container als root. Ein Container-Escape-Exploit hätte dadurch direkten root-Zugriff auf den Host-Namespace (sofern kein User-Namespace-Remapping konfiguriert ist).
- **Empfehlung:** In `backend/Dockerfile` und `python_ai_service/Dockerfile` einen unprivilegierten User anlegen und via `USER` setzen (z.B. `RUN addgroup --system app && adduser --system --ingroup app app` + `USER app`). Frontend (Nginx-Image) läuft ohnehin mit eigenem Nginx-User, aber auch dort prüfen.
- **Aufwand:** S

---

### F10: `infra/.env.example` enthält `DB_PASS=change_me` und `DB_ROOT_PASS=change_me`
- **Kategorie:** Sicherheit
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `infra/.env.example:3–4`
- **Auswirkung:** Die Werte `change_me` sind keine echten Secrets, aber ein schwaches Signal. `init-env.js` leert alle Werte beim Erzeugen der `.env`, also landen diese Werte nie automatisch in Produktion. Das Risiko ist, dass unerfahrene Nutzer das Example direkt kopieren und nicht ersetzen.
- **Empfehlung:** Kommentar oder Warnung ergänzen: `# ACHTUNG: Vor Produktiveinsatz ändern!`. Alternativ Platzhalter `<bitte_setzen>` statt `change_me` nutzen.
- **Aufwand:** S

---

### F11: `infra/backend.env.example` hat `DB_PASSWORD=` (leere Duplikat-Variable)
- **Kategorie:** Konfiguration/Env
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `infra/backend.env.example:15`
- **Auswirkung:** `backend/knexfile.ts:64` verwendet `process.env.DB_PASSWORD ?? process.env.DB_PASS` nur im `production`-Config-Block. `DB_PASSWORD` ist in der Example-Datei leer und wird nie befüllt. Jemand, der die Docker-Env ausschließlich liest, könnte verwirrt sein, welche Variable zu setzen ist (`DB_PASS` oder `DB_PASSWORD`).
- **Empfehlung:** Kommentar ergänzen: `# Alias für DB_PASS – nur im production-Modus von knexfile genutzt; normalerweise nicht setzen.` Oder die Duplikat-Variable entfernen und `knexfile.ts` vereinfachen.
- **Aufwand:** S

---

### F12: `APP_URL` und `APP_ORIGIN` in `infra/backend.env.example` zeigen auf `localhost`
- **Kategorie:** Konfiguration/Env
- **Schweregrad:** Mittel
- **Konfidenz:** Bestätigt
- **Ort:** `infra/backend.env.example:27–28`
- **Auswirkung:** Im Docker-Stack gelten diese Werte für den Backend-Container. `APP_URL=http://localhost:3000` würde Backend-intern generierte öffentliche Bild-URLs (z.B. für den Python-AI-Service) auf localhost zeigen — außerhalb des Containers unerreichbar. `APP_ORIGIN=http://localhost:3001` schränkt CORS auf localhost-Frontend ein, was im Prod-Docker-Deployment bricht.
- **Empfehlung:** Kommentar ergänzen: `# Im Docker-Stack oder Prod: auf externe/öffentliche Hostadresse setzen, z.B. APP_URL=https://tvwallau.de`. Ggf. als Pflichtfeld markieren (`# PFLICHT FÜR PROD`).
- **Aufwand:** S

---

### F13: WebSocket-CORS in `backend/src/middlewares/websocket.ts` hartkodiert
- **Kategorie:** Konfiguration/Env / Sicherheit
- **Schweregrad:** Mittel
- **Konfidenz:** Bestätigt
- **Ort:** `backend/src/middlewares/websocket.ts:10`
- **Auswirkung:** `origin: 'http://localhost:3001'` ist fest eingetragen, statt `process.env.APP_ORIGIN` zu verwenden. Außerhalb von localhost (Docker, Prod, Staging) schlagen alle WebSocket-Verbindungen mit CORS-Fehler fehl. Bereits als P2-5 in CLAUDE.md dokumentiert.
- **Empfehlung:** `origin: process.env.APP_ORIGIN || 'http://localhost:3001'` verwenden (analog zu `app.ts:14`).
- **Aufwand:** S

---

### F14: `LanguageCode = 'en'` — Contract-Typ stimmt nicht mit Roadmap-Entscheidung überein
- **Kategorie:** Architektur/Kopplung / Typsicherheit
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `contracts/src/ai-product.ts:1`, `contracts/schema/analyze-product-request.schema.json:37–40`
- **Auswirkung:** Entscheidung 2 (CLAUDE.md Abschnitt 8) legt deutsch als KI-Output-Sprache fest. Der Typ `LanguageCode = 'en'` und das JSON-Schema `"enum": ["en"]` erlauben kein `'de'`. Wenn `lang: 'de'` gesendet werden soll, schlägt die Schema-Validierung im Python-Service fehl.
- **Empfehlung:** `LanguageCode = 'en' | 'de'` erweitern, JSON-Schema und Pydantic-Modell synchron anpassen, wenn die Deutsch-Roadmap angegangen wird. Bis dahin als bekannte Lücke im CLAUDE.md vermerkt lassen.
- **Aufwand:** S

---

### F15: `AnalyzeDebug`-Interface in TS/Pydantic hat deutlich mehr Felder als das JSON-Schema
- **Kategorie:** Typsicherheit / Architektur/Kopplung
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `contracts/src/ai-product.ts:114–137`, `contracts/schema/analyze-product-response.schema.json:88–144`, `python_ai_service/app/contracts_models.py:136–194`
- **Auswirkung:** Das JSON-Schema für `AnalyzeDebug` enthält nur `clipTagsTop`, `clipTagsPerImage`, `blipCaption`, `blipCaptionsPerImage` und `llm`. Die TS-Typen definieren zusätzlich `tagMergeStrategy`, `tagsStrict`, `tagsSoft`, `tagStats`, `blipCaptionImage1/2`, `captionsSentToLlm`, `brandCandidate`, etc. — Felder, die die Pydantic-Klasse auch kennt. Das Schema validiert die vollständige Response nicht vollständig, kann also Pydantic-Felder ungeprüft durchlassen. Da `debug` nur optional und rein intern ist, ist die Auswirkung gering; es führt aber zu Drift zwischen TS-Typen und Schema.
- **Empfehlung:** Entweder das JSON-Schema auf `AnalyzeDebug`-Vollständigkeit erweitern (oder aus dem Schema komplett ausschließen, da Debug-only), oder in CLAUDE.md als bewusste Vereinfachung dokumentieren.
- **Aufwand:** M

---

### F16: `LlmDebug` hat Felder in Pydantic, die im TS-Interface fehlen
- **Kategorie:** Typsicherheit
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `python_ai_service/app/contracts_models.py:107–133`, `contracts/src/ai-product.ts:99–112`
- **Auswirkung:** Pydantic `LlmDebug` enthält `parsed_title`, `parsed_description`, `extracted_json`, `stop_strings_used`, `stop_triggered` — alles Felder, die das TS-Interface `LlmDebug` nicht kennt. Frontend-Code, der `debug.llm` typisiert verwendet, sieht diese Felder nicht. Da `debug` nur optional und nicht im normalen Frontend-Flow genutzt wird, ist der praktische Impact gering.
- **Empfehlung:** TS-Interface `LlmDebug` um die Pydantic-Felder ergänzen (zumindest als optional). Oder als bewusste Vereinfachung dokumentieren.
- **Aufwand:** S

---

### F17: `contracts/build` erzeugt keine Ausgabedateien (nur `tsc --noEmit`)
- **Kategorie:** Architektur/Kopplung / DX/Tooling
- **Schweregrad:** Info
- **Konfidenz:** Bestätigt
- **Ort:** `contracts/package.json:34`, `contracts/project.json:9`
- **Auswirkung:** Das `build`-Target führt nur eine Typprüfung durch, emittiert aber keine `.js`-Dateien. Das ist bewusste Designentscheidung (rein typ-basiertes Paket), bedeutet aber: (a) `npm run build --workspace contracts` im Backend-Dockerfile baut nichts wirklich Nutzbares — es ist eine reine Validierung. (b) Downstream-Konsumenten (Backend, Frontend) importieren direkt die `.ts`-Quellen via TypeScript-Resolver. Das funktioniert in Dev-Modus und beim Build, ist aber unüblich für eine Library. (c) Falls `contracts` jemals echten Runtime-Code bekäme, würde der `build`-Aufruf im Dockerfile nichts produzieren.
- **Empfehlung:** Das ist eine bekannte und bewusste Entscheidung (CLAUDE.md Abschnitt 2.4 dokumentiert sie). Im Backend-Dockerfile erzeugt `npm run build --workspace contracts` daher unnötigen Overhead (tsc --noEmit); es kann weggelassen werden ohne Auswirkung auf das Runtime-Image. Ggf. einen Kommentar ins Dockerfile ergänzen.
- **Aufwand:** S

---

### F18: `Order.status` ist `string` statt typisierter Union
- **Kategorie:** Typsicherheit
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `contracts/src/order.ts:15`, `contracts/src/order.ts:31`
- **Auswirkung:** `Order.status` und `OrderSummary.status` sind `string`. Die tatsächlichen Werte sind `Bestellt|Bezahlt|Storniert` (deutsch, aus der DB). Eine typisierte Union würde Tippfehler und Mismatch zwischen Backend und Frontend zur Kompilierzeit aufdecken. Bereits als P3/5.2 in CLAUDE.md vermerkt (Roadmap B).
- **Empfehlung:** `type OrderStatus = 'Bestellt' | 'Bezahlt' | 'Storniert'` (oder englisch + Display-Mapping) in contracts definieren und in `Order`/`OrderSummary` verwenden.
- **Aufwand:** S

---

### F19: `ProductAiJob`-Interface in `contracts/src/product.ts` nutzt snake_case-Felder
- **Kategorie:** Typsicherheit / Toter Code/Duplikate
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `contracts/src/product.ts:37–48`
- **Auswirkung:** `product_id`, `result_display_name`, `result_description`, `result_tags`, `error_message`, `created_at`, `updated_at` sind snake_case — inkonsistent mit dem sonst durchgehend camelCase-Stil aller anderen Contract-Interfaces. Das deutet darauf hin, dass die Felder direkt aus dem DB-Schema übernommen wurden statt gemappt zu werden.
- **Empfehlung:** Felder zu camelCase umbenennen (`productId`, `resultDisplayName`, etc.) und Backend-Mapping anpassen. Oder zumindest als bekannten Stilbruch kommentieren.
- **Aufwand:** S

---

### F20: `python_ai_service` als npm-Workspace ohne vollwertiges `package.json`
- **Kategorie:** DX/Tooling / Architektur/Kopplung
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `package.json:9`, `python_ai_service/package.json`
- **Auswirkung:** `python_ai_service` ist als npm-Workspace deklariert, hat aber nur ein minimales `package.json` (kein `name` passend zum Workspace-Pattern, keine Dependencies). npm behandelt es als Workspace, aber `npm install` installiert dort nichts Relevantes. Die Nutzung ist primär als Proxy für `uv`-Kommandos. Das ist ein unüblicher Ansatz, funktioniert aber.
- **Empfehlung:** Einen Kommentar in `python_ai_service/package.json` ergänzen, der erklärt, dass dieses Paket nur als Nx/npm-Proxy für uv-Befehle dient, kein JS-Paket ist.
- **Aufwand:** S

---

### F21: `nx.json` hat kein `outputs`-Caching für die meisten Targets
- **Kategorie:** DX/Tooling / Performance
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `nx.json:23–38`, `backend/project.json:12` (hat `outputs`), `contracts/project.json` (kein `outputs`), `infra/project.json` (kein `outputs`)
- **Auswirkung:** Ohne `outputs` kann Nx den Task-Cache nicht für alle Targets nutzen. `build` beim Backend hat `outputs: ["{projectRoot}/dist"]` (korrekt), aber contracts/infra/python-ai-service-Build fehlt das. `test`/`lint` haben kein `outputs` — das ist für diese Targets normal (kein Artefakt). Kein kritisches Problem, aber Caching-Potenzial ungenutzt.
- **Empfehlung:** Für `contracts:build` ggf. `outputs: []` setzen (explizit kein Artefakt, aber Cache-Invalidierung korrekt). Für `python-ai-service:build` ebenfalls. Niedrige Prio.
- **Aufwand:** S

---

### F22: `README.md` zeigt `ACCESS_TOKEN_EXPIRES_IN=1m` (sehr kurzer Wert)
- **Kategorie:** Konfiguration/Env / DX/Tooling
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `README.md:67`
- **Auswirkung:** Die Beispiel-Env im README zeigt `ACCESS_TOKEN_EXPIRES_IN=1m`, das Backend-Default ist `15m` (in `backend.env.example:19`). Inkonsistenz kann zu Verwirrung und unnötigen Token-Refresh-Fehlern beim Setup führen.
- **Empfehlung:** README auf `15m` angleichen (konsistent mit `backend.env.example`).
- **Aufwand:** S

---

### F23: Kein `license`-Feld in `contracts/package.json` und Root-`package.json`
- **Kategorie:** Recht/Compliance
- **Schweregrad:** Info
- **Konfidenz:** Bestätigt
- **Ort:** `contracts/package.json` (gesamte Datei), `package.json` (Root, gesamte Datei)
- **Auswirkung:** Kein `LICENSE`-File im Repo, kein `"license"`-Feld in package.json. Für ein privates Vereinsprojekt (`"private": true`) ist das rechtlich zunächst unkritisch. npm liest ohne `"license"` den Default `UNLICENSED`.
- **Empfehlung:** Für ein internes Projekt ist das akzeptabel. Wenn der Code öffentlich oder mit Dritten geteilt wird, sollte eine explizite Lizenz (z.B. MIT, proprietär) ergänzt werden.
- **Aufwand:** S

---

### F24: Contracts `gen:schema` und Pydantic-Generierung nicht automatisiert / in Nx eingebunden
- **Kategorie:** DX/Tooling / Fehlende Funktion/Lücke
- **Schweregrad:** Mittel
- **Konfidenz:** Bestätigt
- **Ort:** `contracts/package.json:36`, `contracts/project.json` (kein `gen:schema`-Target)
- **Auswirkung:** `npm run gen:schema` ist nur in `contracts/package.json` als Script vorhanden, nicht als Nx-Target. Es existiert kein Nx-Target für die Pydantic-Generierung. Änderungen an `contracts/src/ai-product.ts` führen nicht automatisch zu aktualisierten Schemas oder Pydantic-Modellen — manuelles Vergessen erzeugt Drift. Bereits als P2-11 in CLAUDE.md dokumentiert.
- **Empfehlung:** `gen:schema` als Nx-Target in `contracts/project.json` ergänzen; optional als `dependsOn`-Step vor `python-ai-service:build` oder `python-ai-service:test` hängen.
- **Aufwand:** M

---

### F25: `init-env.js` — Werte wie `AI_PY_TIMEOUT_MS=150000` werden auf leer gesetzt
- **Kategorie:** DX/Tooling / Konfiguration/Env
- **Schweregrad:** Niedrig
- **Konfidenz:** Bestätigt
- **Ort:** `scripts/env/init-env.js:16–31`
- **Auswirkung:** `toEmptyEnv()` setzt ALLE Werte auf leer (auch sinnvolle Defaults wie `AI_PY_TIMEOUT_MS=150000`, `PORT=3000`, `NODE_ENV=production`). Ein Nutzer, der `npm run stack:up` zum ersten Mal aufruft, erhält eine `.env` mit komplett geleerten Werten — auch für Variablen, die sinnvolle Defaults haben. Das ist bewusstes Design (Secrets sollen explizit gesetzt werden), hat aber Potenzial für Verwirrung bei Nicht-Secret-Defaults.
- **Empfehlung:** Kommentar in `init-env.js` und/oder in den `.example`-Dateien ergänzen, welche Werte Secrets sind (müssen gesetzt werden) und welche Defaults bereits in `backend.env.example` stehen und nur bei Bedarf überschrieben werden.
- **Aufwand:** S

---

## Fähigkeiten/Targets – Status

| Target / Fähigkeit | Status | Beleg (datei:zeile) |
|---|---|---|
| `contracts:build` (tsc --noEmit) | ✅ funktioniert (Typprüfung) | `contracts/package.json:34`, `contracts/tsconfig.json` |
| `contracts:test` (Platzhalter) | ⚠️ läuft, aber trivial (2 assert.equal) | `contracts/tests/placeholder.test.js:1–10` |
| `contracts:lint` | ❌ kein echtes Lint, nur echo | `contracts/project.json:21` |
| `contracts:gen:schema` | ⚠️ vorhanden, aber manuell; kein Nx-Target | `contracts/package.json:36` |
| `backend:build` | ✅ | `backend/project.json:8` |
| `backend:test` | ⚠️ läuft, kaum echte Tests | `backend/project.json:22` |
| `backend:lint` | ❌ kein echtes Lint, nur echo | `backend/project.json:29` |
| `backend:serve` (dev) | ✅ via service-runner-node.js | `backend/project.json:36` |
| `backend:docker:build` | ✅ | `backend/project.json:14` |
| `frontend:build` | ✅ | `frontend/project.json:8` |
| `frontend:test` | ⚠️ läuft, Platzhalter | `frontend/project.json:22` |
| `frontend:lint` | ✅ ESLint+Prettier echt | `frontend/project.json:29` |
| `frontend:serve` (dev) | ✅ via service-runner-node.js | `frontend/project.json:36` |
| `frontend:docker:build` | ✅ | `frontend/project.json:14` |
| `python-ai-service:build` | ❓ ruft `uv run python scripts/service.py build` | `python_ai_service/project.json:14` |
| `python-ai-service:test` | ⚠️ pytest, real aber separater Scope | `python_ai_service/project.json:28` |
| `python-ai-service:lint` | ❌ kein echtes Lint, nur echo | `python_ai_service/project.json:35` |
| `python-ai-service:serve` | ✅ via scripts/service.py start | `python_ai_service/project.json:42` |
| `python-ai-service:docker:build` | ✅ | `python_ai_service/project.json:20` |
| `infra:compose:up` | ✅ init-env.js + docker compose up | `infra/project.json:6` |
| `infra:compose:down` | ✅ | `infra/project.json:12` |
| `infra:compose:init` | ✅ mit --profile init, db-init-Container | `infra/project.json:47` |
| `infra:compose:db` | ✅ nur MariaDB | `infra/project.json:33` |
| `infra:test` | 🔲 kein Nx-Target vorhanden | `infra/project.json` (fehlt) |
| Docker-Stack gesamt | ✅ (mit Einschränkungen F07, F08, F09) | `infra/docker-compose.yml` |

---

## Workflow-relevante Notizen

### Systemstart (lokal, ohne Docker)

```
npm run dev
  → nx run infra:compose:db        # startet MariaDB-Container
    → scripts/env/init-env.js      # erzeugt infra/.env + infra/backend.env falls nicht vorhanden
    → docker compose up -d mariadb
  → nx run-many -t serve --parallel
    → backend:serve   → scripts/dev/service-runner-node.js start ... -- npm run start:dev
    → frontend:serve  → scripts/dev/service-runner-node.js start ... -- npm run dev:start
    → python-ai-service:serve → python scripts/service.py start
```

PID- und Meta-Dateien liegen unter `<workspace>/target/dev.pid` und `<workspace>/target/dev.meta.json`.
Log-Dateien: `<workspace>/target/<service>.log` und `<service>.err.log`.

### Systemstart (Docker-Stack)

```
npm run stack:up
  → npm run docker:build            # nx run-many -t docker:build
    → backend:docker:build          # docker build -t tvwallaushop/backend:local -f backend/Dockerfile .
    → frontend:docker:build         # docker build -t tvwallaushop/frontend:local -f frontend/Dockerfile .
    → python-ai-service:docker:build # docker build -t tvwallaushop/python-ai-service:local -f python_ai_service/Dockerfile .
  → npm run infra:up
    → nx run infra:compose:up
      → node scripts/env/init-env.js   (scripts/env/init-env.js:34–46)
      → docker compose up -d
```

Einmaliges DB-Init:
```
npm run stack:init
  → npm run docker:build (s.o.)
  → nx run infra:compose:init
    → node scripts/env/init-env.js
    → docker compose --profile init up --abort-on-container-exit db-init
      → db-init-Container: cd backend && npm run migrate && npm run seed
```

### Env-Erzeugung: `scripts/env/init-env.js`

- Liest `infra/.env.example` und `infra/backend.env.example` (Zeile 5–13)
- Überspringt die Zieldatei, falls sie bereits existiert (Zeile 34–36) → idempotent
- `toEmptyEnv()` (Zeile 16–31): iteriert Zeilen, behält Kommentare/Leerzeilen unverändert, entfernt alle Werte (setzt `KEY=`)
- Schreibt mit `\n`-Zeilenenden (UTF-8) (Zeile 44)

**Wichtig:** init-env.js erzeugt **nur** `infra/.env` und `infra/backend.env`. `backend/.env` (für lokale Entwicklung ohne Docker) muss manuell angelegt werden (Anleitung in `README.md`). `python_ai_service/.env` ebenfalls manuell (Vorlage: `python_ai_service/example.env`).

### `service-runner-node.js` — Kurzübersicht

- Aktionen: `start | stop | status` (Zeile 253–261)
- `start`: prüft PID-File → stale cleanup → `spawn(cmd, args, { detached: true, stdio: [ignore, logFd, errFd] })` → `child.unref()` → PID + Metadaten schreiben (Zeile 152–193)
- `stop` (Unix): `process.kill(-pid, SIGTERM)` → 5s warten → ggf. `SIGKILL`; (Windows) `taskkill /T /F` (Zeile 98–120)
- `status`: liest PID, prüft via `isProcessAlive()` (Zeile 224–237)
- Windows-Check in `isProcessAlive()`: `tasklist /FI "PID eq <pid>"` (Zeile 65–68)
- Log-Files werden im `append`-Modus geöffnet (Zeile 134) → kein Log-Rotation

---

*Ende des Audit-Berichts*
