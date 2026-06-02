# CLAUDE.md – TvWallauShop

> Diese Datei ist die gemeinsame Arbeitsgrundlage für die Überarbeitung des Projekts.
> Sie beschreibt **den Ist-Zustand, so wie er im Code steht** (Stand: 2026-06-02).
> Empfehlungen sind klar als solche gekennzeichnet. Offene Fragen stehen am Ende.

---

## 1. Projektzweck und Überblick

TvWallauShop ist ursprünglich ein **Online-Shop für einen Verein** (TV Wallau). Verkauft werden
Artikel mit Größen und Lagerbeständen; es gibt Kundenkonten, einen Warenkorb, Bestellungen und
einen Admin-Bereich zur Verwaltung von Produkten, Bestellungen und Nutzern.

Später kam eine **KI-gestützte Produkterstellung** hinzu: Ein Admin lädt Produktbilder + Preis hoch,
ein separater Python-Service analysiert die Bilder (Tags + Bildbeschreibung) und ein LLM erzeugt daraus
einen Produkttitel und eine Beschreibung. Das Ergebnis wird im Admin-UI als Vorschlag angezeigt und kann
in ein echtes Produkt übernommen werden.

Das Projekt ist ein **Nx-Monorepo** mit vier Workspaces (`contracts`, `backend`, `frontend`,
`python_ai_service`) plus einem `infra`-Projekt für den Docker-Stack.

Hinweis: Große Teile des Codes sind mit frühen KI-Modellen entstanden, daher uneinheitlich und teilweise
unfertig. Die unten gelisteten Probleme (Abschnitt 6) spiegeln das wider.

---

## 2. Architektur

### 2.1 Gesamtbild

```
 Browser
   │  (HTTP /api, WebSocket)
   ▼
 frontend (React/Vite, Port 3001)
   │  axios → /api  (Vite-Proxy → :3000)
   ▼
 backend (Express, Port 3000)  ──Knex──►  MariaDB/MySQL (Port 3306)
   │
   │  axios POST /analyze-product  (HTTP, Bild-URLs)
   ▼
 python_ai_service (FastAPI, Port 8000)  ──►  OpenVINO-Modelle (CLIP, BLIP, Qwen-LLM)

 contracts (TypeScript-Typen, kein Runtime-Code) ── wird von backend & frontend importiert
                                                  └─ JSON-Schema → Pydantic-Modelle im Python-Service
```

### 2.2 Backend (`backend/`, TypeScript/Express)

**Modularer Monolith**, kein echtes Microservice-Setup (wichtig zu wissen):

- Einstiegspunkt `src/index.ts`: startet HTTP-Server + Socket.IO, wartet mit Retry auf die DB,
  Graceful Shutdown.
- `src/app.ts`: zentrale Express-App (CORS via `APP_ORIGIN`, `cookie-parser`, `express.json`,
  `/health`, optionale Debug-Routen via `DEBUG_ROUTES`, globaler Error-Handler) → delegiert an das Gateway.
- `src/gateway/app.ts`: ein `express.Router`, der vier **Service-Router** unter `/api` **und** `/api/v1`
  einhängt und Swagger-UIs bereitstellt.
- Die "Services" `src/services/{auth,catalog,order,ai}/app.ts` sind **nur dünne Router-Wrapper** um die
  jeweiligen Routen – sie laufen alle im selben Prozess, mit einer gemeinsamen DB. Laut Entscheidung 1
  (Abschnitt 8) werden diese künftig als **Feature-Module** verstanden und benannt (nicht als „Microservices");
  die Umbenennung ist als Phase-3-Aufgabe vorgemerkt.

Schichten: `routes/ → controllers/ → services/ → models/ (Knex)`. Eigene Fehlerklassen in `src/errors/`
(`AuthError`, `ProductAiError`, `ProductServiceError`, `InsufficientStockError`, `ServiceError`),
zentral behandelt in `src/middlewares/errorHandler.ts`.

Wichtige Bausteine:
- **Auth** (`src/services/authService.ts`, `middlewares/authMiddleware.ts`): JWT Access-Token +
  Refresh-Token (httpOnly-Cookie), `bcrypt`-Hashing, E-Mail-Verifizierung, Rollen `customer|admin`
  via `requireRole(...)`.
- **Produkte** (`productService.ts`): CRUD inkl. Größen (`product_sizes`), Bildern (`product_images`),
  Tags (`product_tags`/`tags`); Bild-Upload per `multer` nach `./uploads/products/<id>/`.
- **Bestellungen** (`orderService.ts`): Transaktionen mit pessimistischem Lock (`forUpdate`) zur
  Bestandsreservierung; Status `Bestellt|Bezahlt|Storniert` (deutsch).
- **KI-Jobs** (`productAiService.ts`, `controllers/productAiController.ts`, `aiPythonClient.ts`):
  Job-Tabelle `product_ai_jobs`, asynchrone Verarbeitung, Status `PENDING→PROCESSING→SUCCESS|FAILED`,
  Echtzeit-Updates per Socket.IO (`aiJob:updated`, `aiJob:completed`).
- **WebSocket** (`middlewares/websocket.ts`): Socket.IO; `getIO()` zum Broadcasten aus Services.
- Utils: `winston`-Logger, `nodemailer`-Mailer (per `EMAIL_SEND` abschaltbar), Swagger/OpenAPI-Docs.

### 2.3 Frontend (`frontend/`, React 18 + Vite + Redux Toolkit + PrimeReact)

- `src/main.tsx` → `src/App.tsx`: Routing mit `react-router-dom` v6. Öffentliche Routen (Shop, Cart,
  Auth), Admin-Routen (`requireAdmin`) und Kundenrouten (`requireUser`).
- Seiten unter `src/pages/{Shop,Cart,Auth,Admin,User}`. KI-Anbindung liegt im Admin-Produktbereich:
  `pages/Admin/Product/ManageProducts.tsx` (~537 Zeilen, KI-Queue + WebSocket), `ProductAiDialog.tsx`
  (Upload), `ProductDialog.tsx` (Übernahme als Produkt).
- State: Redux Toolkit Slices unter `src/store/slices/` (`auth`, `cart`, `order`, `product`, `user`).
- API: `axios` in `src/services/api.ts` mit Request-Interceptor (Bearer-Token) und Response-Interceptor
  (401 → Token-Refresh mit Request-Queue). `socket.ts` für Socket.IO. `utils/imageUrl.ts` löst relative
  Bild-URLs auf.
- Build/Proxy: `vite.config.ts` (Dev-Port 3001, Proxy `/api` → `http://localhost:3000`).

### 2.4 Contracts (`contracts/`, TypeScript)

- **Reines Typ-Paket** (`"type": "module"`, Exports nur `types`, `build` ist `tsc --noEmit`). Kein
  Runtime-Code → in TS nur als `import type` nutzbar.
- Wird von Backend und Frontend via npm-Workspace `@tvwallaushop/contracts` (`file:../contracts`) genutzt.
- `src/ai-product.ts` definiert `AnalyzeProductRequest`/`AnalyzeProductResponse`. Daraus erzeugt
  `npm run gen:schema` JSON-Schemas in `schema/`, die der Python-Service per
  `python_ai_service/scripts/generate_contracts.py` (`datamodel-codegen`) in
  `app/contracts_models.py` (Pydantic) übersetzt.

### 2.5 Python-AI-Service (`python_ai_service/`, FastAPI + OpenVINO)

- `app/main.py`: Endpunkte `GET/HEAD /health` und `POST /analyze-product`. Beim Startup: OpenVINO-
  Tokenizer-Extension laden, Modelle prüfen/ggf. laden (`MODEL_FETCH_MODE`), optional LLM vorladen.
- **Pipeline** (`app/services/pipeline/`), Ablauf je Anfrage (synchron):
  1. `image_loader.py` – Bilder laden (path/url/base64 → RGB).
  2. `tagger_openvino.py` – CLIP (`openai/clip-vit-base-patch32`) → Tags. **Kandidatenliste ist im Code
     hartkodiert (Fashion/Kleidung).**
  3. `multi_image.py` – Tags/Captions über mehrere Bilder zusammenführen (Schnittmenge bzw. Fallback).
  4. `captioner_openvino.py` – BLIP (`Salesforce/blip-image-captioning-base`) → Bildbeschreibungen.
  5. `llm_openvino_genai.py` – Qwen2.5-3B-Instruct (OpenVINO IR) → JSON mit `title`/`description`,
     `prompts.py` liefert den Prompt; mit Retry bei ungültigem JSON.
  6. `normalize.py` – Tags normalisieren; Ergebnis als `AnalyzeProductResponse`.
- `model_manager.py` / `ov_runtime.py`: Modell-Download/-Konvertierung (HF snapshot, `optimum-cli`,
  oder eigene Skripte in `app/tools/convert_*.py`), Device-Routing (CLIP/BLIP/LLM auf GPU/NPU/CPU),
  Caching, FileLock.
- `app/services/jobs.py`: dünner `analyze()`-Wrapper – **keine eigene Job-Queue im Python-Service**
  (die Job-Verwaltung liegt im Backend). Verarbeitung ist synchron.
- Verwaltung über `scripts/service.py` (start/stop/status/build/test) via `uv`.

### 2.6 End-to-End-Fluss "KI-Produkt"

1. Admin lädt im Frontend Bilder + Preis hoch → `POST /api/ai/product-job` (multipart).
2. Backend legt `product_ai_jobs`-Eintrag (`PENDING`) an, speichert Bilder unter
   `./uploads/ai/product-jobs/`, startet die Verarbeitung asynchron.
3. Backend ruft `POST {AI_PY_SERVICE_URL}/analyze-product` mit **öffentlichen Bild-URLs** (`APP_URL` +
   Pfad) auf.
4. Python-Service liefert `title`, `description`, `tags`, `captions`, `meta` zurück.
5. Backend speichert Ergebnis am Job, Status `SUCCESS|FAILED`, sendet Socket.IO-Event.
6. Frontend aktualisiert die KI-Queue; Admin übernimmt das Ergebnis in den `ProductDialog` und legt ein
   echtes Produkt an.

> Mock-Modus: Bei `AI_PRODUCT_AI_USE_REAL_SERVICE=false` antwortet das Backend sofort mit Testdaten,
> ohne den Python-Service zu rufen.

---

## 3. Tech-Stack und zentrale Abhängigkeiten

| Bereich | Stack |
|---|---|
| Monorepo | Nx `^19.8.3`, npm Workspaces, Node (LTS empfohlen) |
| Backend | TypeScript `^5`, Express `^4.18`, Knex `^2.4` + `mysql2` `^3.2`, `jsonwebtoken`, `bcrypt`, `cookie-parser`, `cors`, `multer`, `socket.io`, `nodemailer`, `winston`, `swagger-jsdoc`/`swagger-ui-express`, `axios`. (`helmet`, `morgan` sind als Dependency vorhanden – `helmet` wird **nicht** genutzt, `morgan` nur optional.) Dev: `ts-node-dev`. |
| Frontend | React `^18.2`, Vite `^5.4`, Redux Toolkit `^1.9` + React-Redux `^8`, `react-router-dom` `^6.14`, PrimeReact `^9.5` + PrimeIcons, `axios`, `socket.io-client`, `jwt-decode`. ESLint + Prettier konfiguriert (in `package.json`). |
| Contracts | TypeScript-only, `ts-json-schema-generator`. |
| Python-AI | Python 3.12 (laut `pyproject.toml`), FastAPI, Uvicorn, Pydantic, OpenVINO/openvino-genai/openvino-tokenizers `2024.4.0`, `torch`, `transformers`, `optimum-intel[openvino]`, `huggingface-hub`, `Pillow`, `numpy`. Paketmanager: **uv**. |
| Datenbank | MariaDB `11.4` (Docker) bzw. MySQL-kompatibel. |
| Infra | Docker Compose (`mariadb`, `backend`, `frontend`, `python-ai-service`, `db-init`). |

---

## 4. Setup & Befehle

> Quelle: `package.json` (Root), `README.md`, `infra/`. **Alle Root-Befehle laufen über Nx.**

### 4.1 Voraussetzungen
- Node.js (aktuelle LTS), MariaDB, Python 3 + `uv` (nur für den AI-Service), optional Docker.

### 4.2 Lokale Entwicklung (ohne Docker)
```bash
npm run install:all          # Dependencies (Root + Workspaces) installieren
# backend/.env anlegen (siehe README.md, Abschnitt "Backend konfigurieren")
npm run dev                  # startet DB-Container + alle Services parallel (Nx serve)
npm run stop                 # stoppt alle Services + DB
```
- Einzelne Services: `npx nx run backend:serve`, `npx nx run frontend:serve`,
  `npx nx run python-ai-service:serve`.
- Python-Deps: `npx nx run python-ai-service:install` (führt `uv` aus).
- Services laufen detached; PID/Logs liegen in `<projekt>/target/` (Mechanik:
  `scripts/dev/service-runner-node.js`).

### 4.3 Build
```bash
npm run build                # nx run-many -t build (alle Projekte)
```

### 4.4 Tests
```bash
npm run test                 # nx run-many -t test
```
- Backend/Frontend/Contracts: `node --test`. Python: `pytest` (via `uv`, über `scripts/service.py test`).
- **Achtung:** Die Testabdeckung ist sehr gering (siehe Abschnitt 6).

### 4.5 Linting
```bash
npm run lint                 # nx run-many -t lint
```
- **Nur das Frontend hat echtes Linting** (ESLint + Prettier). Das Backend-`lint`-Target gibt nur
  `echo "No lint configured for backend"` aus; Contracts/Python analog ohne echtes Lint.

### 4.6 Docker-Stack (`infra/`)
```bash
npm run stack:init           # Images bauen + DB initialisieren (migrate + seed)
npm run stack:up             # Images bauen + Stack starten
npm run stack:down           # Stack stoppen
npm run infra:logs           # Logs
```
- `infra/.env` und `infra/backend.env` werden bei Bedarf aus den `*.example`-Dateien erzeugt
  (`scripts/env/init-env.js`) – mit **geleerten** Werten; Secrets müssen manuell ergänzt werden.
- Im Docker-Netz gilt `DB_HOST=mariadb` und `AI_PY_SERVICE_URL=http://python-ai-service:8000`.

### 4.7 Aufräumen
```bash
npm run clear                # generierte Artefakte entfernen (node_modules, dist, caches, venvs)
npm run deps:reset           # zusätzlich Root-Lockfile entfernen (danach neu installieren)
```

### 4.8 Env-Dateien – welche gilt wann (Entscheidung)

| Datei | Gilt für | Inhalt | In Git? |
|---|---|---|---|
| `backend/.env` | **Lokale Entwicklung ohne Docker** | Alle Backend-Variablen (DB, JWT, SMTP, AI-URL …) | nein (gitignored) |
| `infra/backend.env` | **Docker-Stack** (Backend-Container) | Alle Backend-Variablen, `DB_HOST=mariadb`, `AI_PY_SERVICE_URL=http://python-ai-service:8000` | nein (gitignored) |
| `infra/.env` | **Docker Compose selbst** | Nur Compose-Variablen (Ports, DB-Name/-User/-Pass, Root-PW) | nein (gitignored) |
| `python_ai_service/.env` | AI-Service (lokal/Container) | OpenVINO-/Pipeline-Konfiguration | nein (gitignored) |

- Vorlagen liegen als `*.example` im Repo (`infra/.env.example`, `infra/backend.env.example`,
  `python_ai_service/example.env`); die `backend/.env`-Vorlage steht im `README.md`.
- `scripts/env/init-env.js` erzeugt `infra/.env` und `infra/backend.env` bei Bedarf aus den `*.example`-
  Dateien (mit **geleerten** Werten – Secrets manuell ergänzen).

---

## 5. Konventionen

### 5.1 Ist-Zustand
- **Sprache gemischt:** UI-Texte und einige Bezeichner sind deutsch (Order-Status `Bestellt/Bezahlt/
  Storniert`, Frontend-Ordner `pages/Admin/Ordner/`), der übrige Code überwiegend englisch
  (`Product/`, `User/`, Rollen `admin/customer`). Kommentare teils deutsch, teils englisch.
- **Backend:** Schichtenmodell `routes → controllers → services → models`; eigene Fehlerklassen;
  `catchAsync`-Wrapper. DB-Spalten in `snake_case`, TS-Felder/DTOs in `camelCase`. Datei-/Funktionsnamen
  in `camelCase`, Klassen in `PascalCase`.
- **Frontend:** Komponenten in `PascalCase` mit Suffix `Page`/`Dialog`; ein Verzeichnis je Seitenbereich.
  CSS **uneinheitlich**: teils CSS-Module (`*.module.css`, Header/Footer), teils globale/plain CSS
  (`ManageProducts.css` etc.). Geteilte Typen kommen aus `@tvwallaushop/contracts`, ergänzt um lokale
  Typen in `src/type/`.
- **Python:** Klare Modul-Trennung in `app/services/pipeline/`; Konfiguration zentral in `config.py`
  über Env-Variablen; `snake_case`.
- **Formatierung Frontend:** Prettier mit `tabWidth: 3`, `printWidth: 120`, `singleQuote`, `trailingComma: all`.

### 5.2 Empfehlungen (für die Überarbeitung)
- Eine konsistente Sprachstrategie festlegen (Empfehlung: **Code/Bezeichner englisch**, nur sichtbare
  UI-Texte ggf. deutsch). Konkret: `pages/Admin/Ordner/` → `pages/Admin/Orders/`; Order-Status als
  englische Enum mit Anzeige-Mapping.
- Einheitliche CSS-Strategie (durchgängig CSS-Module **oder** eine Lösung).
- Backend-Linting (ESLint + Prettier) einführen und in das `lint`-Target hängen.
- Status-/Rollen-Strings zentral als Konstanten/Enums (kein "Magic String").

---

## 6. Bekannte Probleme & technische Schulden (priorisiert)

> Verifiziert am Code. Bei Punkten, die in der Vor-Analyse strittig waren, ist die Prüfung vermerkt.

### P1 – Hoch (vor "fertigstellen" angehen)
1. **Kaum Tests.** Nur Platzhalter (`*/tests/placeholder.test.js`) + ein echter Backend-Test
   (`backend/tests/product-ai-short-title.test.js`) + die Python-Tests (`python_ai_service/tests/*`).
   Keine Tests für Auth-, Order-, User-, Product-Logik im Backend; keine echten Frontend-Tests.
2. **Python-Versions-Konflikt.** _[Phase 0, in Arbeit]_ `python_ai_service/Dockerfile` nutzte
   `python:3.11-slim`, während `pyproject.toml`/`uv.lock` 3.12 verlangen → auf `python:3.12-slim`
   vereinheitlicht.
3. **Security-Header fehlen.** `helmet` ist als Dependency vorhanden, wird in `backend/src/app.ts` aber
   **nicht** eingebunden (verifiziert: keine Referenz in `backend/src/`). Kein Rate-Limiting auf
   Login/Signup.
4. **AI-Timeout inkonsistent.** _[Phase 0, in Arbeit]_ Default war `AI_PY_TIMEOUT_MS=8000`, zu kurz für
   CPU-Inferenz (BLIP+CLIP+LLM) → `FAILED`-Jobs. Auf `150000` (CPU-Wert) vereinheitlicht über
   Code (`aiPythonClient.ts`), `README.md` und `infra/backend.env.example`.

### P2 – Mittel
5. **WebSocket-CORS hartkodiert.** `backend/src/middlewares/websocket.ts` setzt `origin:
   'http://localhost:3001'` fest, statt `APP_ORIGIN` zu nutzen → CORS-Bruch außerhalb localhost.
6. **`console.log`/`console.error` im Produktivcode** (statt `winston`/zentralem Logger) an vielen
   Stellen in Backend und Frontend (u. a. `userService`, `socket.ts`, `ManageProducts.tsx`,
   `productService.ts`, `knexfile.ts`). Risiko: Log-Spam, evtl. sensible Daten.
7. **Schwache TypeScript-Typsicherheit im Backend.** Viele `(req as any).user`-Casts; kein gemeinsamer
   `RequestWithUser`-Typ. `@ts-ignore` in `app.ts` (Debug-Route).
8. **Sehr große Dateien ohne Aufteilung:** `orderService.ts` (~618), `productService.ts` (~579),
   `frontend/.../ManageProducts.tsx` (~537), `authSlice.ts` (~298). Schwer testbar/wartbar.
9. **Warenkorb nicht persistent.** `cartSlice` schreibt nicht in `localStorage` → Warenkorb ist nach
   Reload leer.
10. **Inkonsistente Microservice-Abstraktion.** `services/{auth,catalog,order,ai}/app.ts` suggerieren
    Microservices, sind aber nur Router im selben Prozess. Entweder echte Trennung oder die Abstraktion
    vereinfachen/klar benennen.
11. **`generate_contracts.py` nicht automatisiert.** Bei Änderungen an `contracts/src/ai-product.ts`
    müssen `gen:schema` und die Pydantic-Generierung manuell laufen → Drift-Gefahr zwischen TS und Python.

### P3 – Niedrig / Aufräumen
12. **Inkonsistente Fehlerbehandlung:** teils eigene Fehlerklassen, teils `throw new Error(...)`.
13. **`InsufficientStockError` mit HTTP-Status 200** (bewusst als "fachlicher Fehler"); fragwürdig,
    eher 409. Frontend (`orderSlice`/`orderService`) wertet den Code aus `200`-Antwort aus.
14. **Hartkodierte CLIP-Kandidatenliste** (Fashion-spezifisch) in `tagger_openvino.py` – nicht
    generalisierbar/konfigurierbar.
15. **Irreführender Kommentar** in `pyproject.toml` (`# FEHLT für MODEL_FETCH_MODE=download:` direkt über
    bereits gelisteten Paketen).
16. **Seed mit Klartext-Passwort** `Password123` in `backend/seeds/001_initial_data.ts` (nur Dev-Seed,
    wird gehasht).
17. **Mögliche tote/unfertige Stellen im Frontend:** Route/Konstante `order-confirmation` referenziert,
    aber keine zugehörige Seite in `App.tsx` (zu verifizieren bei Bearbeitung). Frontend-Paketname
    `verein-shop-frontend` weicht vom Rest ab.
18. **Backend-Debug-Routen** (`/api/debug/*`) liefern Env-/Routeninfos – nur per `DEBUG_ROUTES=true`,
    in Produktion deaktiviert lassen.

### Sicherheit – Klarstellung (NICHT als Fund werten)
- `infra/backend.env` enthält lokal echte/echt aussehende Secrets (JWT, SMTP-Passwort), ist aber in
  `.gitignore` (Zeile 4) und wurde **nie committet** (per `git log --all` geprüft). Es liegt damit
  **kein Secret im Repository**. Trotzdem sinnvoll: für Produktion eigene, rotierte Secrets verwenden und
  niemals committen. (Eine frühere automatische Analyse meldete dies fälschlich als "Secrets im Repo".)
- Knex nutzt parametrisierte Queries → keine offensichtlichen SQL-Injection-Stellen gefunden.

---

## 7. Roadmap (nach Wichtigkeit)

> An die Entscheidungen aus Abschnitt 8 angepasst. Keine großen Umbauten ohne Rückfrage.

**Phase 0 – Lauffähig + für Hetzner-CPU validiert (AKTIV)**
1. **[in Arbeit]** Python-Versions-Konflikt fixen (`Dockerfile` → `python:3.12-slim`) und
   `AI_PY_TIMEOUT_MS` auf realistischen CPU-Wert (~`150000`) setzen; Werte über Code/README/env
   vereinheitlichen (P1-2, P1-4).
2. KI-Fluss einmal **end-to-end mit erzwungenem `device=CPU`** durchspielen (nicht nur NPU/GPU), reale
   Laufzeit messen und festhalten – damit der Hetzner-Pfad sicher läuft.
3. `helmet` aktivieren + Rate-Limiting auf Login/Signup (P1-3; früh mitnehmen, kleiner Aufwand).
4. `console.log`/`console.error` im Backend durch den `winston`-Logger ersetzen (P2-6).

**Phase 1 – KI für Prod-CPU tauglich machen (Entscheidungen 2, 4, 6, 7)**
5. Device-Routing defaultet in Prod sauber auf **CPU**; **NPU-only-IR wird nicht deployt**; CPU-taugliche
   IR-Artefakte (LLM bevorzugt **INT4**) bereitstellen. Bereitstellungsweg festlegen (siehe offener
   Detailpunkt in Abschnitt 8).
6. KI-Output auf **Deutsch** umstellen (`prompts.py`, `lang`); Tags intern englisch belassen (P3-14 bleibt).
7. **Mehrbild**-Tag-/Caption-Merging sauber behandeln **und testen** (Standardfall, Entscheidung 7).

**Phase 2 – Tests gezielt (kritische Pfade zuerst, P1-1)**
8. Tests für **Bestandsreservierung/Bestellung** und **Auth**. Bewusst **nicht** flächendeckend; weitere
   Pfade (Produkt-CRUD, KI-Job-Lebenszyklus, Frontend-Smoke) nach Bedarf.

**Phase 3 – Datenmodell & Terminologie (Entscheidungen 1, 8)**
9. **Soft-Delete** für Produkte (`is_active`/`deleted_at`): Migration, Shop blendet inaktive aus,
   Bestellungen bleiben erhalten (P3 / ehem. offene Frage 8).
10. „Microservices" → **Feature-Module** umbenennen (`services/{auth,catalog,order,ai}` + Doku);
    typsichere Auth-Request-Typen statt `as any` (P2-7), Fehlerbehandlung vereinheitlichen (P3-12/13).

**Phase 4 – Aufräumen & Konsistenz**
11. Sprach-/Namenskonventionen (`pages/Admin/Ordner→Orders`, Status-Enums, CSS-Strategie, P3/5.2).
12. Große Module aufteilen (`orderService`, `productService`, `ManageProducts`, P2-8); WebSocket-CORS aus
    `APP_ORIGIN` (P2-5).
13. Warenkorb-Persistenz, tote Routen/Seiten klären (P2-9, P3-17); Contract-Sync automatisieren (P2-11).

---

## 8. Getroffene Entscheidungen (Architektur & Scope)

> Stand 2026-06-02 gemeinsam festgelegt. Diese Entscheidungen sind für die weitere Arbeit verbindlich.

1. **Backend-Architektur:** Bewusst **modularer Monolith**. `services/{auth,catalog,order,ai}` bleiben
   bestehen, werden aber als **Feature-Module** verstanden/benannt – nicht als „Microservices". (Rename/
   Umbenennung der Begriffe in Code/Doku ist Phase-3-Aufgabe.)
2. **KI-Output: Deutsch.** `prompts.py` auf deutsche Titel/Beschreibungen umstellen, `lang` entsprechend
   setzen. CLIP-/BLIP-Tags dürfen intern englisch bleiben.
3. **Python-Laufzeit: einheitlich 3.12.** `Dockerfile` läuft auf `python:3.12-slim` (passend zu
   `pyproject.toml` `>=3.12,<3.13` und `uv.lock` `==3.12.*`).
4. **Deployment: Hetzner Cloud, CPU-only.** Kein Intel NPU/GPU in Prod. Die für Intel NPU/GPU
   kompilierten Modelle sind reine lokale Dev-Optimierung, **nicht** der Prod-Pfad. Prod-Inferenz läuft
   auf CPU.
5. **Env-Strategie (siehe Tabelle in Abschnitt 4.8):** `backend/.env` = lokal ohne Docker,
   `infra/backend.env` = Docker-Stack, `infra/.env` = nur Compose-Variablen.
6. **Modelle für Prod:** CPU-taugliche Artefakte bereitstellen (generisches IR; LLM bevorzugt **INT4**).
   Device-Routing muss in Prod sauber auf **CPU** defaulten; **NPU-only-IR NICHT deployen**.
7. **Mehrbild-Analyse ist der Standardfall.** Tag-/Caption-Merging über mehrere Bilder muss sauber
   behandelt und getestet werden.
8. **Produkt-Löschen: Soft-Delete** (`is_active`/`deleted_at`). Inaktive Produkte werden aus dem Shop
   ausgeblendet, in Bestellungen aber erhalten. Der FK `order_items.product_id = RESTRICT` kann bleiben.

### Offene Detailpunkte (nicht blockierend)
- Beim realen KI-Betrieb (`AI_PRODUCT_AI_USE_REAL_SERVICE=true`): Bereitstellungsweg der CPU-/INT4-
  Modelle auf dem Hetzner-Server (vorgebaute IR mitliefern vs. `MODEL_FETCH_MODE=download`) – wird in
  Phase 1 konkretisiert.
```
