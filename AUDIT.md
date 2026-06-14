# AUDIT.md – TvWallauShop (statischer Vollaudit)

> Rein statischer, read-only Audit. Es wurde **kein Code geändert**, nichts installiert,
> kein Service/Modell gestartet. Belege durchgängig als `datei:zeile`.

---

## 0. Meta & Abdeckung

| Feld | Wert |
|---|---|
| Datum | 2026-06-03 |
| Commit | `90c24438ffc8a12738495fc24c992d60071b35be` (Branch `main`, Working-Tree clean) |
| Modus | **STATISCH** (read-only) |
| Methode | Vollständiges Datei-Inventar → Datei-für-Datei-Lesung je Workspace (5 Auditoren) → Tooling-Reports (`tsc --noEmit`, `eslint`, `nx graph`) → Workflow-Tracing Hop-für-Hop → eigene Stichproben-Verifikation der schwersten Befunde. |
| Quelldateien gesamt | ~150 (≈20.429 Zeilen), ohne `node_modules`, `dist`, Lockfiles, Modell-Binärdateien |
| Gelesene Quelldateien | **alle** der unten gelisteten (siehe §8 Abdeckungsbericht) |
| Worklog | `docs/audit/_worklog.md` + `_worklog_{backend,frontend,python,infra,workflows}.md` |
| Tooling | Backend/Contracts `tsc` **fehlerfrei**; Frontend `tsc` **5 Fehler in 4 Dateien**; Frontend `eslint` **Config kaputt** (Regel `react-hooks/exhaustive-deps` nicht gefunden); `nx graph` → `docs/audit/nx-graph.json` |

**Wichtige Korrekturen an der bestehenden CLAUDE.md (Doku-Drift):**
- Die als „tote Dateien" gelisteten `frontend/src/main.js|counter.js|javascript.svg|style.css` existieren **nicht mehr**.
- `ms` ist im Backend inzwischen **deklariert** (`backend/package.json`), entgegen CLAUDE.md §10.2.
- Es sind **5** Frontend-`tsc`-Fehler (in 4 Dateien), nicht 4 (CLAUDE.md P21).

---

## 1. Executive Summary

Solider modularer Monolith mit durchgehend verdrahteten Kern-Workflows (Auth, Katalog, Bestellung, Admin, KI). **Kein** Befund der Stufe *Kritisch* (nichts, das nicht baut/startet, kein Datenverlust, keine triviale Übernahme). Der Build läuft; die Hauptflüsse sind funktional. Die Substanz der Schulden liegt bei **Sicherheits-Härtung**, **Produktions-Konfiguration des KI-Pfads**, **fehlenden Pflicht-/Bestätigungsseiten** und **Typsicherheit/Tests**.

### Ampel je Workspace

| Workspace | Ampel | Begründung |
|---|---|---|
| backend | 🟡 | Funktional, aber fehlendes helmet/Rate-Limiting, hartkodiertes WS-CORS, Hard-Delete vs. FK, `(req as any)`-Wildwuchs, fast keine Tests. |
| frontend | 🟡 | Funktional, aber 5 tsc-Fehler, Warenkorb nicht persistent, fehlende Routen/Seiten, kaputtes ESLint-Setup, A11y-Lücken. |
| contracts | 🟢 | Sauber typisiert; nur Drift TS↔JSON-Schema↔Pydantic und fehlende Generator-Automatisierung. |
| python_ai_service | 🟠 | Pipeline schlüssig, aber **Prod-(CPU)-Pfad standardmäßig kaputt** (GPU/NPU-Defaults, Windows-only-Tokenizer), kein Auth/SSRF, Prompt englisch statt deutsch. |
| infra | 🟡 | Stack lauffähig, aber python-Service ohne Env, keine Healthchecks/Restart, Container als root, `.dockerignore` ohne `.env`, leeres `Dockerfile.app`. |

### Top-Befunde nach Schweregrad

**Hoch**
1. **AUD-001** – Keine Security-Header (`helmet` ungenutzt) + kein Rate-Limiting auf Login/Signup/Refresh.
2. **AUD-002** – Python-Service `/analyze-product` **ohne Auth**, **SSRF** (URL folgt Redirects, `kind:'path'` = lokaler Dateizugriff), Port im Stack zum Host exponiert.
3. **AUD-003** – WebSocket **ohne Auth**: KI-Job-Daten werden an **alle** Clients gebroadcastet; CORS hartkodiert `localhost:3001` → Prod-Bruch.
4. **AUD-004** – Realer KI-Pfad in Prod/Docker **standardmäßig defekt**: Device-Defaults GPU/NPU + `DEVICES_STRICT=true`, `python-ai-service` ohne `env_file` im Compose, `AI_PRODUCT_AI_USE_REAL_SERVICE=true` als Default.
5. **AUD-005** – 5 `tsc`-Fehler (4 Dateien); `vite build` prüft **keine** Typen → Fehler bleiben unentdeckt.
6. **AUD-008** – Impressum/Datenschutz/AGB/Widerruf fehlen (für deutschen Verbraucher-Shop rechtlich Pflicht).
7. **AUD-006** – Warenkorb nicht persistent (kein `localStorage`) → nach Reload leer.
8. **AUD-007** – Frontend-Container (nginx) ohne SPA-Fallback (`try_files`) → Deep-Links/Reload liefern 404.

---

## 2. Architektur & Modul-/Dateikarte

Nx-Monorepo, 6 Nx-Projekte: `backend`, `frontend`, `contracts`, `python-ai-service`, `infra`, `repo-tools` (`nx show projects`). Interne Abhängigkeiten (`nx graph` → `docs/audit/nx-graph.json`): `frontend → contracts`, `backend → contracts` (beide statisch, `import type`). `python-ai-service`/`infra`/`repo-tools` ohne interne JS-Abhängigkeit.

```
Browser ──HTTP /api──▶ frontend (React/Vite :3001, axios→Vite-Proxy :3000)
                         │
                         ▼
                       backend (Express :3000) ──Knex──▶ MariaDB :3306
                         │  ├─ Gateway-Router mountet /api UND /api/v1 (gateway/app.ts)
                         │  ├─ Feature-Router auth/catalog/order/ai (services/*/app.ts, dünn)
                         │  └─ Socket.IO (middlewares/websocket.ts) — broadcastet aiJob:*
                         │
                         │  axios POST /analyze-product (öffentliche Bild-URLs aus APP_URL)
                         ▼
                       python_ai_service (FastAPI :8000)
                         main.py → services/jobs.py → pipeline/orchestrator.py
                         → image_loader → tagger(CLIP) → multi_image → captioner(BLIP)
                         → llm(Qwen, OpenVINO) → normalize → AnalyzeProductResponse

contracts (nur TS-Typen + JSON-Schema) → gen:schema → datamodel-codegen → python contracts_models.py
```

**Schichten Backend:** `routes/ → controllers/ → services/ → models/(Knex)`; Fehlerklassen in `src/errors/`, zentral in `middlewares/errorHandler.ts`. **Frontend:** `pages/* → store/slices/* → services/api.ts(axios)`. **Python:** `app/services/pipeline/*` mit zentralem `config.py`.

Detaillierte Datei-Inventare mit 1-Zeilen-Verantwortung stehen in §7 und in den Worklog-Dateien.

---

## 3. Tech-Stack & Abhängigkeiten

Stack wie in CLAUDE.md §3 (am Code bestätigt). `npm ls`: keine divergierenden Doppelversionen (react/react-dom 18.3.1, typescript 5.9.3, axios, primereact einmalig).

### Dependency-Streichliste

| Workspace | Sicher entfernbar | Vermutlich / prüfen | Behalten | Nach Migration entfernen |
|---|---|---|---|---|
| frontend | `jwt-decode` (nie importiert, `package.json`) | leere `Header.module.css`/`Footer.module.css` löschen | `primeicons`, `typescript`, `rimraf` | **`primereact` + `primeicons`** (erst wenn keine Seite mehr zugreift – 18/~22 Komponenten nutzen sie) |
| backend | – | `helmet` **nicht entfernen → aktivieren** (AUD-001) | `mysql2` (Knex-Client via String), `ms` (jetzt deklariert, in `authService.ts` genutzt), `morgan` (optional) | – |
| contracts | – | – | sauber | – |
| python_ai_service | – | **`torch`, `optimum-intel[openvino]`, `onnx`, `onnxscript`, `huggingface-hub`**: nur in `app/tools/convert_*` bzw. `MODEL_FETCH_MODE=download` → für CPU-Prod-Runtime in Dev-Gruppe verschiebbar (Image-Größe, AUD-019) | `transformers` (Runtime: CLIP-/BLIP-Processor) | – |

**Toter Code (kein Migrations-Vorbehalt):**
- `backend/src/contracts/v1/openapi/*.ts` – statische OpenAPI-Objekte, **nirgends importiert**; Docs kommen aus JSDoc (`docs/swagger.ts`). (AUD-043)
- Frontend ungenutzte Exporte/Konstanten: `selectCartItems`, `selectCurrentProductAiJob`, `resetProductError`, `clearUser`, `STORAGE_KEYS`*, `UI`, `AVAILABLE_SIZES`, `CURRENCY`. (*`STORAGE_KEYS.CART` für AUD-006 aktivieren statt löschen.) (AUD-048)
- `infra/Dockerfile.app` – **leer (0 Byte)**, vom Compose nicht referenziert (Compose nutzt vorgebaute Images). (AUD-058)

**Routen-Konstanten ohne Seite** (`utils/constants.ts`): `PRODUCTS`, `ORDER_CONFIRMATION`, `USER_DETAIL`, `IMPRESSUM`, `DATENSCHUTZ` – **kein Dead Code**, sondern fehlende Features/Pflichtseiten (AUD-008, AUD-009).

---

## 4. Fähigkeiten-Inventar

✅ funktioniert · ⚠️ teilweise · ❌ kaputt · 🔲 Stub/unfertig · ❓ unklar

| Fähigkeit | Status | Beleg (datei:zeile) | Vermerk |
|---|---|---|---|
| Registrierung + Verify-Mail | ⚠️ | `authService.ts:43-99`, `mailer.ts:51` | Verify-Link prod-untauglich, keine Verify-Seite (AUD-009-nah) |
| Login | ⚠️ | `authService.ts:102-135`, `authController.ts:101-114` | E-Mail case-sensitiv (AUD-038) |
| Token-Refresh (Interceptor+Queue) | ✅ | `frontend/.../api.ts:46-108`, `authService.ts:138-164` | keine Rotation, DB-`expires_at` ungeprüft (AUD-015) |
| Logout | ✅ | `authSlice.ts:99-109`, `authController.ts:189-203` | DB-Delete + Cookie-Clear |
| Autorisierung (requireRole/Guards) | ⚠️ | `authMiddleware.ts:91-103`, `App.tsx:33-50` | `requireUser` sperrt Admins (AUD-012) |
| Produktliste / -Detail | ✅ | `productService.ts:161-370`, `ProductListPage.tsx` | Detail ohne Fehler-UI (AUD-029) |
| In-den-Warenkorb / Warenkorb | ✅ / ❌ | `cartSlice.ts:16-24` | nicht persistent (AUD-006) |
| Checkout + Bestellung | ⚠️ | `orderService.ts:293-439`, `CheckoutPage.tsx` | Stock=200 (AUD-010), Redirect ins Leere (AUD-009), kein Auth-Guard (AUD-011) |
| Bestandsreservierung (forUpdate) | ✅ | `productService.ts:283-309` | korrekt pessimistisch gelockt |
| order_items-Aufbau | ⚠️ | `orderService.ts:378-394` | un-aggregiert → Duplicate-Key-Risiko (AUD-033) |
| Eigene Bestellungen / Stornieren | ✅ | `orderService.ts:538-617`, `OrdersPage.tsx` | – |
| Produkt-CRUD | ⚠️ | `productService.ts:372-578` | nicht transaktional (AUD-034), Hard-Delete vs. FK (AUD-026) |
| Bild-Upload/-Delete | ⚠️ | `productRoutes.ts:30-36/193-233` | kein MIME-Filter/Limit (AUD-013) |
| KI-Job anlegen/verarbeiten/retry/delete | ✅(Mock) / ⚠️(Real) | `productAiService.ts:175-407` | Real-Pfad in Prod defekt (AUD-004); fire-and-forget ohne Resume (AUD-027) |
| KI-Pipeline (CLIP/BLIP/Qwen) | ⚠️ | `orchestrator.py:119-368` | GPU/NPU-Default (AUD-004), Prompt EN (AUD-016), Timeout 20s (AUD-017) |
| WebSocket-Live-Updates | ⚠️ | `websocket.ts:7-27`, `socket.ts:11-29` | kein Auth/Broadcast (AUD-003), Prod-CORS-Bruch |
| Admin Bestell-/Nutzerverwaltung | ✅ | `ManageOrders.tsx`, `ManageUsers.tsx`, `userRoutes.ts` | `USER_DETAIL`-Seite fehlt |
| Bestellbestätigungsseite | ❌ | `CheckoutPage.tsx:143`, `App.tsx` | Route fehlt (AUD-009) |
| Impressum/Datenschutz/AGB/Widerruf | ❌ | `Footer.tsx:10-15`, `App.tsx` | rechtlich Pflicht (AUD-008) |
| Security-Header / Rate-Limiting | ❌ | `app.ts:19-35`, `authRoutes.ts` | fehlt (AUD-001) |
| Backend/Contracts/Python-Linting | 🔲 | `*/project.json` (`echo`) | nur Frontend-Lint, und das ist kaputt (AUD-022) |
| Tests | ⚠️ | `*/tests/*` | 1 echter Backend-Test + 5 Python-Tests (AUD-032) |

---

## 5. Workflow-Tracings

Legende: ✅ vollständig · ⚠️ Lücke · ❌ gebrochen. Querschnitt: `frontend/src/contracts/index.ts:7` setzt axios-baseURL auf `…/api/v1`; das Gateway mountet **beide** `/api` und `/api/v1` (`gateway/app.ts:20-26`) → **kein** Pfad-Bruch. camelCase↔snake_case zwischen Backend und Python sauber via Pydantic-Aliase (`contracts_models.py`).

### W1 – Auth ⚠️
- **Signup:** `SignupPage.tsx:68` → `signup`-Thunk `authSlice.ts:82` → `authService.signup` POST `/auth/signup` → `authController.signup:22-90` → `authService.signup:43-99` (bcrypt, Token, Mail). **Lücke:** Verify-Link `${APP_ORIGIN||:3001}/api/auth/verify` (`authService.ts:91-92`) ist prod-/proxy-abhängig; **keine** Frontend-Verify-Seite; `POST /auth/resend` (`authRoutes.ts:99`) wird nie aufgerufen.
- **Login:** `LoginPage.tsx:23` → `login`-Thunk → POST `/auth/login` → `authController.login:101-114` (Refresh als httpOnly-Cookie) → `authService.login:102-135`. ✅ (Hinweis: `accessToken` in `localStorage` = XSS-Exposition; E-Mail case-sensitiv, AUD-038.)
- **Refresh:** `api.ts:46-108` (Queue) → `authController.refresh:117-187` → `authService.refresh:138-164`. ✅ (toter Parallel-Thunk `refreshAccessToken` `authSlice.ts:117-135`; keine Rotation.)
- **Logout / Guards:** ✅ (`App.tsx:33-50`, `authMiddleware.ts:25-103`).

### W2 – Katalog ✅
`fetchProducts` (`productSlice.ts:44`) → `/products` → `productService.ts:161-370` (Join sizes/images/tags, DB `init_schema.ts:46-188`); Detail via direktem `productService.getProduct` (kein Redux); Bild-URL-Auflösung `imageUrl.ts:8-23`; `/uploads` statisch (`gateway/app.ts:28`, `services/ai/app.ts:6-11`). Lücke: Detailseite ohne Fehlerzustand (AUD-029).

### W3 – Warenkorb → Checkout → Bestellung ⚠️
`addToCart` (nur In-Memory, `cartSlice.ts:16-24`) → `CheckoutPage` POST `/orders` → `orderService.createOrder` Transaktion + `reserveStock` (`productService.ts:283-309`). **Brüche:** (1) keine Persistenz (AUD-006); (2) Redirect `/order-confirmation` ohne Route → `*`→HOME (`CheckoutPage.tsx:143`, `App.tsx:81`) (AUD-009); (3) `InsufficientStockError` HTTP 200 schichtenübergreifend (AUD-010); (4) Checkout-Felder name/email/address vom Backend ignoriert (AUD-057); (5) `PlaceOrderPayload`-Fehlimport (`CheckoutPage.tsx:13`, tsc-Fehler, AUD-005).

### W4 – Admin (Produkt/Bestellung/Nutzer) ⚠️
Produkt-CRUD + Upload `productController.ts:39-61` → `uploads/products/<id>/`. **Bruch:** Hard-Delete kollidiert mit `order_items.product_id` RESTRICT (`init_schema.ts:116`, `productService.ts:554-578`) (AUD-026). User-/Bestellverwaltung ✅; `USER_DETAIL`-Seite fehlt (AUD-009-nah).

### W5 – KI-Produkt-Pipeline ✅(Mock)/⚠️(Real) — *Hauptfokus*
1. `ProductAiDialog` → `createProductAiJob` → POST `/api/ai/product-job` (multipart) → Insert `product_ai_jobs` PENDING + `aiJob:updated` (`productAiService.ts:175-216`).
2. Fire-and-forget `processProductAiJob` (`productAiController.ts:24-28`) → baut öffentliche URLs `${APP_URL}/…` → POST `/analyze-product` `{jobId, price:{amount}, images:[{kind:'url',value}]}` (`aiPythonClient.ts:19-44`, Timeout 150000 ms).
3. FastAPI `main.py:98` validiert (Pydantic) → `jobs.analyze` → `run_pipeline` (`orchestrator.py:119`): **Guard** `if ENABLE_CPU_FALLBACK: raise` (invertiert! AUD-018) → `ensure_models(never)` → `device_routing()` → `load_images` (SSRF-Vektor, `image_loader.py:45-56`) → CLIP pro Bild (neu kompiliert) → `merge_tags_for_images` → BLIP (neu kompiliert) → Qwen-LLM (gecacht, EN-Prompt, 20s-Timeout) → `parse_llm_output` (JSON+2-4-Sätze+1 Retry) → `AnalyzeProductResponse`.
4. Backend persistiert SUCCESS/FAILED + `aiJob:completed` (`productAiService.ts:97-104`) → Frontend-Socket-Queue (`ManageProducts.tsx:136-171`) → „Fertigstellen" → `setEditingProduct` (**tsc-Fehler `:241`**) → `ProductDialog` → `addProduct`+`uploadProductImages`+`deleteProductAiJob`.
- **Mock:** sofort SUCCESS ohne Python-Call (`productAiService.ts:218-242`).
- **Risiken (Real, Prod):** `APP_URL=localhost` → Python-Container erreicht Backend nicht (AUD-028); GPU/NPU-Defaults + kein Compose-Env (AUD-004); fire-and-forget ohne Resume (PROCESSING hängt nach Neustart, AUD-027); 2-4-Satz-Validierung per Punkt-Split bricht bei Deutsch (AUD-055).

### W6 – WebSocket ⚠️
`initWebsocket` (`websocket.ts:7-27`) → `getIO().emit` (`productAiService.ts:97-104`) → Frontend `getSocket` (`socket.ts:11-29`). **Brüche:** CORS hart `localhost:3001`; **keine Socket-Auth**; `io.emit` broadcastet KI-Daten an **alle** Clients (AUD-003); Socket-Basis nutzt ggf. `VITE_API_BASE_URL` (=`…/api/v1`) als Origin (`socket.ts:13`).

**Routen, die ins Leere laufen:** `/order-confirmation`, `/impressum`, `/datenschutz`, `/admin/users/:id`, sowie `AccountPage.tsx:49` → `/login` (statt `/auth/login`) → alle via `*`→HOME (`App.tsx:81`).

---

## 6. Befund-Register (sortiert nach Schweregrad)

> Aufwand: S ≤ ½ Tag · M ½–2 Tage · L > 2 Tage. Bereich: BE=backend, FE=frontend, PY=python, CT=contracts, IN=infra/root.

### Hoch

| ID | Titel | Bereich | Kategorie | Konfidenz | Ort | Auswirkung | Empfehlung | Aufw. |
|---|---|---|---|---|---|---|---|---|
| AUD-001 | Keine Security-Header + kein Rate-Limiting | BE | Sicherheit | Bestätigt | `app.ts:19-35`; `authRoutes.ts:*` | Brute-Force/Mail-Bombing auf Login/Signup/Resend/Refresh; fehlende HTTP-Härtung | `helmet` einbinden; `express-rate-limit` auf Auth-Routen | M |
| AUD-002 | Python `/analyze-product` ohne Auth + SSRF + Port exponiert | PY/IN | Sicherheit | Bestätigt | `main.py:98`; `image_loader.py:45-56`; `docker-compose.yml:57-58` | Unauth. SSRF (folgt Redirects), `kind:'path'`=lokaler Dateizugriff; im Stack zum Host offen | Service nicht zum Host exponieren; Backend-only-Auth (Shared-Secret/Netz); URL-Allowlist, keine `path`-Quelle in Prod, Redirects sperren | M |
| AUD-003 | WebSocket ohne Auth → Broadcast an alle; CORS hart | BE/FE | Sicherheit | Bestätigt | `websocket.ts:10/16`; `productAiService.ts:97-104`; `socket.ts:15` | KI-Job-Daten (Titel/Beschr./Bildpfade) an jeden Client; Prod-CORS-Bruch | Socket-Handshake mit JWT auth; pro-User/Room statt `io.emit`; `origin: APP_ORIGIN` | M |
| AUD-004 | Realer KI-Pfad in Prod/Docker standardmäßig defekt | PY/IN | Konfiguration/Env | Bestätigt | `config.py:142-145`; `docker-compose.yml:55-58`; `infra/backend.env.example:6` | CPU-only-Prod: GPU/NPU-Default + `DEVICES_STRICT=true`, `python-ai-service` ohne `env_file`; Real-Modus ist Default → Jobs schlagen fehl | CPU als Default-Device-Routing; `env_file` für python-Service im Compose; in Prod CPU-IR/INT4 bereitstellen | M |
| AUD-005 | 5 `tsc`-Fehler; Build prüft keine Typen | FE | Typsicherheit | Bestätigt | `ManageProducts.tsx:241`; `SignupPage.tsx:96,99`; `CheckoutPage.tsx:13`; `OrderDetailPage.tsx:77` | Typfehler unentdeckt (esbuild ignoriert Typen); `CheckoutPage`-Fehlimport real | `CheckoutPage`-Import sofort fixen; Rest bei Seitenmigration; `tsc --noEmit` als Build/CI-Schritt | M |
| AUD-006 | Warenkorb nicht persistent | FE | Korrektheit/UX | Bestätigt | `cartSlice.ts:1-64`; `constants.ts:34` | Reload leert Warenkorb | `STORAGE_KEYS.CART` aus/in `localStorage` hydrieren | S |
| AUD-007 | Frontend-nginx ohne SPA-Fallback | FE/IN | Korrektheit | Bestätigt | `frontend/Dockerfile:16-18` | Direktaufruf/Reload jeder Route → 404 | nginx-Conf mit `try_files $uri /index.html;` | S |
| AUD-008 | Impressum/Datenschutz/AGB/Widerruf fehlen | FE | Recht/Compliance | Bestätigt | `Footer.tsx:10-15`; `App.tsx` | Für DE-Verbraucher-Shop gesetzlich Pflicht (TMG/DSGVO/BGB); Footer-Links → HOME | Seiten+Routen anlegen, Rechtstexte einholen | L |

### Mittel

| ID | Titel | Bereich | Kategorie | Konfidenz | Ort | Auswirkung | Empfehlung | Aufw. |
|---|---|---|---|---|---|---|---|---|
| AUD-009 | Fehlende Seiten/Routen (order-confirmation, USER_DETAIL) | FE | Fehlende Funktion | Bestätigt | `CheckoutPage.tsx:143`; `constants.ts:17,22`; `App.tsx` | Nach Bestellung Redirect ins Leere → HOME; Admin-User-Detail fehlt | Bestätigungsseite + Route bauen; USER_DETAIL nachrüsten | M |
| AUD-010 | `InsufficientStockError` = HTTP 200 | BE | Korrektheit | Bestätigt | `InsufficientStockError.ts:23` | Fehlgeschlagener Checkout liefert 200; Sonderlogik in 5 Schichten | 409 + sauberes Error-Mapping FE/BE | M |
| AUD-011 | Checkout-Route ohne Auth-Guard | FE | Korrektheit | Bestätigt | `App.tsx:61` | Gast erreicht Checkout, Bestellung 401 ohne UX | Hinter `requireUser` bzw. Redirect bei `!user` | S |
| AUD-012 | `requireUser` sperrt Admins aus `/user/*` | FE | Korrektheit | Bestätigt | `App.tsx:42-48` | Admin kann eigenes Konto/Profil/Settings nicht öffnen | Guard auf `!user` beschränken | S |
| AUD-013 | Multer ohne MIME-Filter / ohne Größenlimit | BE | Sicherheit | Bestätigt | `productRoutes.ts:30-36`; `aiRoutes.ts:30` | Stored-XSS via `/uploads`, Upload-DoS | `fileFilter` (Bild-MIME) + `limits.fileSize/files` | S |
| AUD-014 | `/uploads` ohne Auth statisch | BE | Sicherheit | Bestätigt | `services/ai/app.ts:10-11`; `gateway/app.ts:28` | Bilder/Job-Assets öffentlich lesbar (per Design für Python) | Signierte URLs oder eigener authentifizierter Pfad für Job-Assets | M |
| AUD-015 | Refresh-Token: keine Rotation, DB-`expires_at` ungeprüft | BE | Sicherheit | Bestätigt | `authService.ts:138-164` | Gestohlenes Refresh-Token bis 30d gültig, kein Invalidieren | Rotation + DB-Ablauf/Revoke prüfen | M |
| AUD-016 | LLM-Prompt englisch (Entscheidung: Deutsch) | PY | Korrektheit | Bestätigt | `prompts.py:8,22` | KI-Output EN statt DE; `lang` ignoriert | Prompt auf DE; `lang` durchreichen | S |
| AUD-017 | `LLM_TIMEOUT_SECONDS=20` << Backend-Timeout | PY | Konfiguration/Env | Bestätigt | `config.py:117`; `example.env:70` | Interner Timeout greift vor 150s auf CPU → FAILED | CPU-realistischen Wert; an Backend-Timeout koppeln | S |
| AUD-018 | `ENABLE_CPU_FALLBACK` invertierte Semantik | PY | Konfiguration/Env | Bestätigt | `orchestrator.py:120-126` | `=1` ("CPU-Fallback an") **deaktiviert** den Service – Footgun gerade auf CPU-Prod | Flag umbenennen/Logik korrigieren oder entfernen | S |
| AUD-019 | `torch`/`optimum`/`onnx` im Runtime-Image | PY | Abhängigkeiten/Performance | Bestätigt | `pyproject.toml:19`; `Dockerfile:13` | Sehr großes CPU-Prod-Image, nur in Convert-Tools genutzt | In Dev-/Build-Gruppe verschieben; Runtime ohne torch | M |
| AUD-020 | CLIP/BLIP pro Request neu kompiliert | PY | Performance | Bestätigt | `orchestrator.py:149,242` | Hohe Latenz je Anfrage (nur LLM gecacht) | CLIP/BLIP-Modelle wie LLM cachen | M |
| AUD-021 | Contract-Generierung nicht automatisiert / überschreibt | CT/PY | DX/Tooling | Bestätigt | `contracts/package.json:36`; `scripts/generate_contracts.py` | TS↔Pydantic-Drift; Generator überschreibt hand-erweitertes Modell | `gen:schema`+codegen als Nx-Target mit `dependsOn`; Generierung idempotent | M |
| AUD-022 | Frontend-ESLint-Config kaputt (Regel nicht gefunden) | FE | DX/Tooling | Bestätigt | `OrderDetailPage.tsx:45`; `SettingsPage.tsx:52` | `react-hooks/exhaustive-deps` nicht registriert → `lint`-Target schlägt fehl (das einzige echte Lint) | `eslint-plugin-react-hooks` einbinden/konfigurieren | S |
| AUD-023 | `console.*` im Produktivcode (inkl. PII) | BE/FE | Observability/Logging | Bestätigt | `userService.ts:14`(FE, Payloads!); `socket.ts`; `ManageProducts.tsx`; `errorHandler.ts`; `productService.ts`; `mailer.ts`; `websocket.ts` | Log-Spam; `userService.ts:14` loggt Update-Payloads (personenbezogen) | `userService.ts:14` sofort entfernen; sonst `winston`/Dev-Guard | M |
| AUD-024 | Keine Healthchecks/Restart für App-Container | IN | Observability | Bestätigt | `docker-compose.yml:20-63` | Nur MariaDB hat Healthcheck/Restart; App-Bereitschaft unbekannt | `healthcheck`+`restart: unless-stopped` für backend/frontend/python | S |
| AUD-025 | Container laufen als root | IN | Sicherheit | Bestätigt | `backend/Dockerfile`; `python_ai_service/Dockerfile` | Bei Container-Escape direkter root | unprivilegierten `USER` setzen | S |
| AUD-026 | Hard-Delete vs. FK RESTRICT (kein Soft-Delete) | BE | Korrektheit/Daten | Bestätigt | `productService.ts:554-578`; `userService.ts:117-125`; `init_schema.ts:116` | `deleteProduct/User` scheitert bei referenzierten Order-Items; `account_status='deleted'` ungenutzt | Soft-Delete (`is_active`/`deleted_at`) gemäß Entscheidung 8 | M |
| AUD-027 | KI-Job fire-and-forget ohne Resume | BE | Korrektheit | Bestätigt | `productAiController.ts:24-28`; `productAiService.ts:277-376` | `PROCESSING`-Jobs hängen nach Backend-Neustart dauerhaft | Resume/Requeue beim Start; Timeout-Watchdog | M |
| AUD-028 | `APP_URL=localhost` → Bild-URLs containerübergreifend unerreichbar | IN/BE | Konfiguration/Env | Bestätigt | `infra/backend.env.example:27`; `productAiService.ts:307-316` | Python-Container lädt `localhost`-URLs (=sich selbst) → `INVALID_IMAGE` | `APP_URL` auf service-internen/öffentl. Host; als Pflicht markieren | S |
| AUD-029 | ProductListPage zeigt Fehler-State nicht | FE | UX/Frontend | Bestätigt | `ProductListPage.tsx:14-46` | Bei `fetchProducts`-Fehler nur Leer-Meldung | `error` selektieren + Retry-UI | S |
| AUD-030 | SettingsPage ConfirmDialog State-Race | FE | Korrektheit | Bestätigt | `SettingsPage.tsx:110-155` | `accept`-Callback liest ggf. veralteten Bestätigungstext | eigenes Modal / `useRef` | M |
| AUD-031 | Barrierefreiheit (Labels, alt, Landmarks, aria) | FE | Barrierefreiheit | Bestätigt | `ProductListToolbar.tsx:25`; `SignupPage.tsx:116-274`; `ProductDialog.tsx:272`; `ProductDetailPage.tsx:138-214`; `Header.tsx` | Screenreader/Tastatur eingeschränkt | `label htmlFor`/`aria-label`, beschreibende `alt`, `<nav>` | M |
| AUD-032 | Sehr geringe Testabdeckung | BE/FE/CT | Tests/QS | Bestätigt | `*/tests/*` (Platzhalter) | Keine Tests für Auth/Order/requireRole/CRUD; keine echten FE-Tests | Gezielt: Bestandsreservierung/Bestellung + Auth | L |
| AUD-033 | `createOrder`: order_items un-aggregiert | BE | Korrektheit | Wahrscheinlich | `orderService.ts:378-394` | Doppelte (product,size)-Zeilen → mögl. Duplicate-Key/Doppelreservierung | Items vor Insert aggregieren | M |
| AUD-034 | Produkt-Create/Update nicht transaktional; Tag find-or-create nicht atomar | BE | Korrektheit | Wahrscheinlich | `productService.ts:88-120,372-442` | Teilzustände bei Fehler; Tag-Race | In Transaktion kapseln; `INSERT … ON DUPLICATE` | M |
| AUD-035 | Mailer interpoliert `firstName` ungeschützt in HTML | BE | Sicherheit | Wahrscheinlich | `mailer.ts:65,130` | E-Mail/HTML-Injection über nutzerkontrollierten Namen | HTML-Escaping der Variablen | S |
| AUD-036 | Tokenizer-Extension nur `.dll` (Windows-only) | PY | Korrektheit | Bestätigt | `openvino_tokenizers_ext.py:13,53` | Linux-Prod-Pfad (Hetzner) ungetestet/bricht ggf. | plattformabhängige Lib (`.so`) laden | M |
| AUD-037 | `.dockerignore` ohne `.env` | IN | Sicherheit | Bestätigt | `.dockerignore` | Latent: Secrets in Build-Kontext/Layer bei künftigem `COPY . .` | `**/.env`, `infra/backend.env` etc. ergänzen | S |
| AUD-038 | Login E-Mail case-sensitiv | BE | Korrektheit | Bestätigt | `authService.ts:102-103` vs. `authController.ts:65` | Signup lowercased, Login nicht → Login schlägt fehl | E-Mail beim Login lowercasen | S |

### Niedrig

| ID | Titel | Bereich | Kategorie | Konfidenz | Ort | Empfehlung |
|---|---|---|---|---|---|---|
| AUD-039 | accessToken-Cookie gelesen/gecleart, nie gesetzt (toter Pfad) | BE | Toter Code | Bestätigt | `authMiddleware.ts:37-39` | Pfad entfernen |
| AUD-040 | `verifyEmail` String-Datum-Vergleich fragil | BE | Korrektheit | Wahrscheinlich | `authService.ts:186` | Date-Vergleich typisieren |
| AUD-041 | `knexfile.ts` loggt DB-Verbindungsdaten | BE | Observability/Sicherheit | Bestätigt | `knexfile.ts:11-17` | Log entfernen |
| AUD-042 | `(req as any).user` / dup. `RequestWithUser` / `@ts-ignore` | BE | Typsicherheit | Bestätigt | `authMiddleware.ts:15`; `userRoutes.ts:22`; `app.ts:57` | gemeinsamer Request-Typ |
| AUD-043 | Statische OpenAPI-Objekte toter Code | BE | Toter Code | Bestätigt | `src/contracts/v1/openapi/*.ts` | entfernen oder nutzen |
| AUD-044 | Order-Status Magic-Strings, kein Enum (auch in contracts) | BE/CT | Typsicherheit | Bestätigt | `orderService.ts:10-12`; `contracts/src/order.ts:15` | zentrale Enum + Display-Mapping |
| AUD-045 | Router doppelt unter `/api` + `/api/v1` | BE | Architektur | Bestätigt | `gateway/app.ts:20-26` | echte Versionierung oder vereinfachen |
| AUD-046 | Kein echtes Lint (backend/contracts/python = echo) | BE/CT/PY | DX/Tooling | Bestätigt | `*/project.json` | ESLint/ruff einführen |
| AUD-047 | `jwt-decode` ungenutzte Dependency | FE | Abhängigkeiten | Bestätigt | `frontend/package.json:35` | entfernen |
| AUD-048 | Ungenutzte Selektoren/Actions/Konstanten | FE | Toter Code | Bestätigt | `cartSlice.ts:63`; `productSlice.ts:260,262`; `userSlice.ts:71,155`; `constants.ts:33-52` | entfernen (CART für AUD-006 nutzen) |
| AUD-049 | Doppelte named+default Exporte | FE | Toter Code | Bestätigt | `AdminDashboard/ManageOrders/OrderEditDialog/ManageProducts/ManageUsers` | auf named vereinheitlichen |
| AUD-050 | `vite-env.d.ts` ohne `VITE_API_ORIGIN`/`VITE_API_WS_URL` | FE | Typsicherheit | Bestätigt | `vite-env.d.ts`; `socket.ts:13`; `contracts/index.ts:5` | Env-Typen ergänzen |
| AUD-051 | AccountPage falscher `/login`-Redirect | FE | Korrektheit | Bestätigt | `AccountPage.tsx:49` | `ROUTES.LOGIN` nutzen |
| AUD-052 | `window.confirm/alert` statt Dialog | FE | UX/A11y | Bestätigt | `AdminDashboard.tsx:93,101,137`; `ManageProducts.tsx:293,302`; u.a. | einheitlicher Dialog |
| AUD-053 | CSS-Inkonsistenz + leere `.module.css` | FE | Architektur | Bestätigt | `index.css`; `pages/**/*.css`; `Header/Footer.module.css` (leer) | je Migration Tokens; leere Dateien löschen |
| AUD-054 | `getOpenProductAiJobs` filtert alle 4 Status | BE | Korrektheit | Bestätigt | `productAiService.ts:378-385` | nur offene Status; SUCCESS-Wachstum begrenzen |
| AUD-055 | Python-Kleinkram (meta.device nur LLM, merge-strategy-Label, `min_items`, `@app.on_event`, currency USD) | PY | Korrektheit | Bestätigt | `orchestrator.py:331,345`; `multi_image.py:130-136`; `contracts_models.py`; `main.py` | je einzeln korrigieren; EUR statt USD |
| AUD-056 | Contracts-Drift (LanguageCode 'en', AnalyzeDebug abgeschnitten, ProductAiJob snake_case) | CT | Typsicherheit | Bestätigt | `ai-product.ts:1,114-137`; `product.ts:37-48`; `schema/*.json` | Schema/TS/Pydantic angleichen |
| AUD-057 | Checkout-Adressfelder vom Backend ignoriert | BE/FE | Korrektheit | Wahrscheinlich | `CheckoutPage.tsx`; `orderService.ts` | Felder verarbeiten oder UI entfernen |
| AUD-058 | `infra/Dockerfile.app` leer + irreführender Existenz-Test + `run-tests.cmd` falsches Verzeichnis | IN | Toter Code/Tests | Bestätigt | `infra/Dockerfile.app`; `infra/tests/run-tests.{sh,cmd}` | entfernen oder befüllen+korrigieren |
| AUD-059 | README/Env-Inkonsistenzen (`ACCESS_TOKEN_EXPIRES_IN=1m`, `DB_PASSWORD=` Dup, `change_me`) | IN | Konfiguration/Env | Bestätigt | `README.md:67`; `infra/backend.env.example:15`; `infra/.env.example:3-4` | angleichen/kommentieren |
| AUD-060 | DX: `nx.json` ohne `outputs` (kein Cache), python npm-Workspace-Proxy, `init-env` leert auch Defaults | IN | DX/Tooling | Bestätigt | `nx.json:23-38`; `python_ai_service/package.json`; `scripts/env/init-env.js:16-31` | `outputs` setzen; kommentieren |
| AUD-061 | `.gitignore` ohne `backend/.env` | IN | Sicherheit | Bestätigt | `.gitignore` | `/backend/.env` ergänzen |
| AUD-062 | DB-Port 3306 zum Host exponiert | IN | Sicherheit | Bestätigt | `docker-compose.yml:5-6` | in Prod nicht exponieren |
| AUD-063 | `CartItem.productId` optional (kann undefined) | FE | Typsicherheit | Bestätigt | `type/cart.ts` | Pflichtfeld machen |
| AUD-064 | OrdersPage/OrderDetailPage umgehen Redux (direkter API-Call) | FE | Architektur | Bestätigt | `OrdersPage.tsx:19-35`; `OrderDetailPage.tsx:23-41` | in `orderSlice` integrieren oder bewusst dokumentieren |
| AUD-065 | `fetchOrders.rejected` nutzt `action.error.message` statt `rejectValue` | FE | Korrektheit | Bestätigt | `orderSlice.ts:92` | `rejectWithValue` |

### Info

| ID | Titel | Bereich | Kategorie | Ort | Hinweis |
|---|---|---|---|---|---|
| AUD-066 | `contracts:build` = nur `tsc --noEmit` (kein Artefakt) | CT | Architektur | `contracts/package.json:34` | Bewusst; im `backend/Dockerfile` nur Typprüfung |
| AUD-067 | Keine `license`/LICENSE | CT/Root | Recht | `package.json` | Bei Weitergabe ergänzen (privat unkritisch) |
| AUD-068 | Doku-Drift in CLAUDE.md | Doku | DX | s. §0 | `ms` deklariert; tote FE-Dateien entfernt; 5 statt 4 tsc-Fehler |

---

## 7. Pro-Workspace-Detail (nennenswerte Dateien)

### backend (🟡)
- `index.ts` ✅ Bootstrap mit DB-Retry/Graceful-Shutdown. `app.ts` ⚠️ kein helmet, `@ts-ignore` (AUD-001/042). `gateway/app.ts` ⚠️ doppeltes Mount (AUD-045).
- `services/authService.ts` ⚠️ JWT/bcrypt solide, aber keine Token-Rotation, case-sensitive Login (AUD-015/038). `orderService.ts` ✅ Transaktion/forUpdate korrekt, aber order_items-Aggregat (AUD-033) + Stock=200 (AUD-010). `productService.ts` ⚠️ Hard-Delete, nicht transaktional (AUD-026/034). `productAiService.ts` ✅ Job-Logik + Socket, fire-and-forget (AUD-027). `aiPythonClient.ts` ✅ Timeout 150000.
- `middlewares/websocket.ts` ⚠️ CORS hart + kein Auth (AUD-003). `errorHandler.ts` ⚠️ `console.error`. `authMiddleware.ts` ⚠️ `(req as any)`, toter Cookie-Pfad (AUD-039/042).
- `errors/InsufficientStockError.ts` ⚠️ status=200. `utils/mailer.ts` ⚠️ HTML-Interpolation (AUD-035). `src/contracts/v1/openapi/*` ❌ toter Code (AUD-043). `migrations/…init_schema.ts` ✅ Schema (deutsche Status-Enum, FK RESTRICT). `tests/` ⚠️ 1 echter Test.

### frontend (🟡)
- `services/api.ts` ✅ Token-Refresh + Queue sauber. `socket.ts` ⚠️ Basis-URL/kein Auth. `services/userService.ts:14` ⚠️ loggt Payloads (AUD-023).
- `store/slices/cartSlice.ts` ❌ keine Persistenz (AUD-006). `authSlice.ts` ✅ (toter `refreshAccessToken`). `userSlice.ts`/`orderSlice.ts` ⚠️ `any`-Thunks (AUD-018-FE/AUD-065).
- `pages/Shop/*` ✅ (Tailwind-migriert, kein PrimeReact); Detailseite ohne Fehler-UI (AUD-029). `pages/Cart/CheckoutPage.tsx` ⚠️ tsc-Fehler + kein Guard (AUD-005/011). `pages/Auth/SignupPage.tsx` ⚠️ tsc-Fehler + A11y (AUD-005/031). `pages/Admin/Product/ManageProducts.tsx` ⚠️ tsc-Fehler, `console.*`, `window.confirm` (groß, 537 Z.). `App.tsx` ⚠️ Guards/Fallback (AUD-009/011/012).
- `components/ui/*` ✅ shadcn sauber. `Header/Footer.module.css` leer (AUD-053).
- **PrimeReact:** in 18/~22 Komponenten – **erst nach Migration entfernen** (kein Dead Code).

### contracts (🟢)
- `src/*.ts` sauber typisiert; `order.ts` Status als `string` (AUD-044); `product.ts` ProductAiJob snake_case (AUD-056). `ai-product.ts` `LanguageCode='en'` (AUD-056). `schema/*.json` AnalyzeDebug abgeschnitten ggü. TS/Pydantic. `build` = `tsc --noEmit` (AUD-066).

### python_ai_service (🟠)
- `config.py` ⚠️ GPU/NPU-Defaults + STRICT (AUD-004), `LLM_TIMEOUT=20` (AUD-017). `main.py` ⚠️ kein Auth, `@app.on_event` deprecated. `orchestrator.py` ⚠️ `ENABLE_CPU_FALLBACK`-Guard invertiert (AUD-018), CLIP/BLIP neu kompiliert (AUD-020). `image_loader.py` ⚠️ SSRF/path (AUD-002). `prompts.py` ⚠️ englisch (AUD-016). `openvino_tokenizers_ext.py` ⚠️ Windows-only `.dll` (AUD-036). `pyproject.toml`/`Dockerfile` ⚠️ torch im Runtime (AUD-019). `tests/*` ✅ 5 echte (parse/merge/normalize/orchestrator-mock/validation). `scripts/generate_contracts.py` ⚠️ überschreibt (AUD-021).

### infra + root (🟡)
- `docker-compose.yml` ⚠️ python-Service ohne Env (AUD-004), keine Healthchecks/Restart (AUD-024), DB-Port offen (AUD-062), nutzt vorgebaute Images (kein `build:`). `Dockerfile.app` ❌ leer (AUD-058). `backend.env.example` ⚠️ APP_URL=localhost (AUD-028). Dockerfiles als root (AUD-025). `.dockerignore`/`.gitignore` (AUD-037/061). `nx.json` ohne `outputs` (AUD-060). `scripts/{dev/service-runner-node.js,env/init-env.js}` ✅ funktional.

---

## 8. Abdeckungsbericht

**Vollständig gelesen** (Datei-für-Datei, je 1-Zeilen-Verantwortung in den Worklog-Coverage-Tabellen):
- **backend** – alle 56 Quell-/Config-Dateien (`src/**`, `migrations`, `seeds`, `routes`, `controllers`, `services`, `models`, `middlewares`, `errors`, `utils`, `docs`, `contracts/**`, `tests`, `*.json`, `Dockerfile`).
- **frontend** – alle ~70 Dateien (`src/**` inkl. pages/components/store/services/utils/type, Config, `index.html`, `Dockerfile`); CSS nur auf Auffälligkeiten geprüft.
- **contracts** – alle 14 Dateien (`src/**`, `schema/*.json`, Config, Test).
- **python_ai_service** – alle 37 Dateien (`app/**`, `tools/**`, `scripts/**`, `tests/**`, `pyproject.toml`, `Dockerfile`, env/cmd).
- **infra + root** – alle (`docker-compose.yml`, `Dockerfile.app`, `*.env.example`, `project.json`, `nx.json`, Root-`package.json`, `.gitignore`, `.dockerignore`, `README.md`, `scripts/**`, `tools/repo-tools`).

**Bewusst nicht gelesen (begründet):** `node_modules/**`, `dist/**`/`target/**`, `package-lock.json`, `uv.lock` (Inhalt), Modell-/Binärartefakte; `*.iml` (IDE-Metadaten, nur als vorhanden vermerkt); generierte `docs/audit/nx-graph.json` (nur als Graph-Beleg).

**Eigene Stichproben-Verifikation des Orchestrators** (über die Agentenberichte hinaus direkt gelesen): `websocket.ts`, `socket.ts`, `InsufficientStockError.ts`, `docker-compose.yml`, `orchestrator.py:110-170`, `config.py:130-155`, `constants.ts`, `App.tsx`, plus Tooling (`tsc`, `eslint`, `nx`).

**Tatsächliche Abdeckung: ~100 %** der nicht-generierten Quell-/Config-Dateien wurden gelesen.

---

## 9. Für Run 2 zu verifizieren (Konfidenz „Wahrscheinlich")

- **AUD-033** – Laufzeit prüfen: erzeugt doppelte (product,size)-Position im Warenkorb tatsächlich einen Duplicate-Key/Doppelreservierung? (`orderService.ts:378-394`)
- **AUD-034** – Verhalten bei Fehler mitten in `createProduct`/`updateProduct` (Teilzustand) + Tag-Race unter Last.
- **AUD-035** – `firstName` aus Signup ungeschützt in Verify-/Order-Mail-HTML → tatsächlicher Injection-PoC.
- **AUD-040** – `verifyEmail`-Datumsvergleich bei String- vs. Date-Spalte (DB-Treiber-Verhalten).
- **AUD-057** – ob Backend Checkout-Adress-/Namensfelder wirklich verwirft (Datenmodell `orders` prüfen).

> Hinweis: Alle „Hoch"-Befunde sind **Bestätigt** (statisch belegt, mehrheitlich zusätzlich eigenhändig nachgelesen). Die „Wahrscheinlich"-Punkte sind ausschließlich Mittel/Niedrig.

---
*Erstellt rein statisch; keine Code-Änderung, kein Build/Run. Detail-Worklogs unter `docs/audit/`.*
