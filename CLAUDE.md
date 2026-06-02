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

> **Fokus ab 2026-06-02: die Website selbst** – Optik, Frontend-Struktur und Verschlanken der
> Abhängigkeiten. KI-Themen sind nach hinten geschoben (optional). Keine großen Umbauten ohne Rückfrage.

### Baseline – Phase 0 (erledigt)
- Python einheitlich auf 3.12 (`Dockerfile`) und `AI_PY_TIMEOUT_MS` auf CPU-realistische `150000`
  vereinheitlicht (P1-2, P1-4). Committet auf `refactor/overhaul-phase-0`.
- _Bewusst weggelassen:_ der KI-End-to-End-Test mit `device=CPU` (nicht Teil des aktuellen Fokus).

### (A) Abhängigkeiten verschlanken — **nächster Schritt**
1. Ungenutzte/doppelte npm-Dependencies und tote Dateien/Exports je Workspace identifizieren
   (`nx graph`, `knip`/`depcheck`, `npm ls`) und eine Streichliste erstellen (Analyse siehe Abschnitt 10).
2. Sicher entfernbare Pakete/Dateien entfernen. **PrimeReact + PrimeIcons erst NACH der Design-Migration
   (C) entfernen** – nicht vorher.

### (B) Frontend-Struktur / Informationsarchitektur aufräumen
3. Routen/Seiten-Inventar und Nutzerfluss (Shop → Produkt → Warenkorb → Checkout → Konto; Admin getrennt)
   sauber strukturieren; tote/unfertige Routen klären (P3-17).
4. Übergroße Komponenten aufteilen (v.a. `ManageProducts.tsx`, P2-8); Namens-/Ordnerkonventionen
   (`pages/Admin/Ordner→Orders`, Status-Enums) und CSS-Strategie vereinheitlichen (P3/5.2).
5. Warenkorb-Persistenz nachrüsten (P2-9).

### (C) Visuelles Design (Zielbild: Abschnitt 9)
6. Tailwind + shadcn **inkrementell** einführen, parallel zu PrimeReact; seitenweise migrieren
   (Auth/Login zuerst → Shop/Produkt/Warenkorb → Admin zuletzt). Akzentfarbe als zentrale Variable.
7. PrimeReact + PrimeIcons entfernen, sobald keine Seite mehr darauf zugreift (→ schließt Punkt 2 ab).

### Später / optional
- **Backend-Härtung:** `helmet` aktivieren, Rate-Limiting Login/Signup (P1-3); `console.log` →
  `winston` (P2-6); typsichere Auth-Request-Typen statt `as any` (P2-7); WebSocket-CORS aus `APP_ORIGIN`
  (P2-5); Fehlerbehandlung vereinheitlichen (P3-12/13).
- **Tests gezielt** (P1-1): Bestandsreservierung/Bestellung und Auth; nicht flächendeckend.
- **Datenmodell & Terminologie** (Entscheidungen 1, 8): Soft-Delete für Produkte
  (`is_active`/`deleted_at`); „Microservices" → Feature-Module umbenennen.
- **KI-Themen (optional, nach hinten):** Deutsch-Output (`prompts.py`, `lang`), CPU-Default beim
  Device-Routing + INT4-Modelle bereitstellen (Entscheidungen 2, 4, 6), Mehrbild-Merging testen
  (Entscheidung 7), Contract-Sync automatisieren (P2-11), CLIP-Kandidaten konfigurierbar (P3-14).

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
  Modelle auf dem Hetzner-Server (vorgebaute IR mitliefern vs. `MODEL_FETCH_MODE=download`) – wird bei
  den (optionalen) KI-Themen konkretisiert.

---

## 9. Zielbild Design (noch NICHT umgesetzt)

> Referenz für die Design-Migration (Roadmap C). Wird erst nach Abstimmung umgesetzt.

### Stil
- Clean & modern, viel Weißraum, weiße Flächen, **ein** Akzent.
- Keine Schatten, weiche Radien (8–12px), eine ruhige Sans (z. B. Inter).

### Design-Tokens
Der **Akzent als eine zentrale Variable** halten, damit er später leicht tauschbar ist
(Vereinsfarben noch offen).

| Token | Wert | Zweck |
|---|---|---|
| `--color-accent` | `#2563EB` | Akzent (zentrale, tauschbare Variable) |
| `--color-accent-hover` | `#1D4ED8` | Akzent Hover |
| `--color-text` | `#0F172A` | Text |
| `--color-surface` | `#FFFFFF` | Fläche (Karten, Dialoge) |
| `--color-background` | `#F8FAFC` | Hintergrund |
| `--color-border` | `#E2E8F0` | Linien/Rahmen |
| `--color-success` | `#16A34A` | Erfolg |
| `--color-danger` | `#DC2626` | Gefahr/Fehler |
| Radius | `8–12px` | weiche Ecken |
| Schatten | keine | flaches Design |
| Font | Inter (o. ä. ruhige Sans) | Typografie |

### Zielstack & Migrationsweg
- **Zielstack:** Tailwind + shadcn, **inkrementell** eingeführt.
- Während der Migration **parallel zu PrimeReact** betreiben.
- **Seitenweise migrieren**, einfachste Seite zuerst:
  1. Auth/Login (einfachste)
  2. Shop / Produkt / Warenkorb
  3. Admin **zuletzt** (wegen `ManageProducts.tsx`)
- **PrimeReact + PrimeIcons erst entfernen**, wenn keine Seite mehr darauf zugreift.

---

## 10. Analyse-Befund: Abhängigkeiten & Frontend-Struktur (read-only, Stand 2026-06-02)

> Reine Analyse für Roadmap A/B. Es wurde **nichts** entfernt. Vor dem Entfernen entscheiden wir
> gemeinsam (siehe Streichliste-Kategorien). `depcheck`/`knip` haben bei Monorepos und CSS-/Dispatch-/
> Routing-Indirektion Fehlalarme – verifizierte Punkte sind markiert.

### 10.1 Interne Workspace-Abhängigkeiten (`nx graph`)
- `frontend → contracts` (static), `backend → contracts` (static).
- `python-ai-service`, `infra`, `repo-tools`: keine internen Abhängigkeiten.
- **Keine doppelten/divergierenden Paketversionen** (`npm ls`): `react`/`react-dom` 18.3.1, `typescript`
  5.9.3, `axios` 1.13.2, `primereact` 9.6.5 jeweils einmalig/dedupliziert.

### 10.2 Dependency-Streichliste je Workspace

**frontend**
- _Sicher entfernbar:_ `jwt-decode` (verifiziert: nur in `package.json`, nirgends importiert).
- _Behalten:_ `primeicons` (CSS-Import + 84× `pi pi-*`), `typescript`, `rimraf` (npm-Script `clean`) –
  depcheck/knip-Fehlalarme.
- _Entfernen NACH Migration:_ `primereact` + `primeicons` (erst wenn keine Seite mehr zugreift; in 19/22
  Seiten genutzt).
- _Tote lokale Dateien (untracked, nicht in git) → löschbar:_ `src/main.js`, `src/counter.js`,
  `src/javascript.svg`, `src/style.css` (Vite-Vanilla-Template-Reste; `main.js` importiert die drei
  anderen; `index.html` lädt `main.tsx`).
- _Kleinkram (knip, vor Entfernen je einzeln verifizieren):_ Komponenten doppelt als named **und**
  default exportiert (Footer, AdminDashboard, ManageOrders/-Products/-Users, OrderEditDialog);
  ungenutzte Selektoren/Actions (`selectCartItems`, `selectCurrentProductAiJob`, `resetProductError`,
  `clearUser`); ungenutzte Konstanten (`STORAGE_KEYS`, `UI`, `AVAILABLE_SIZES`, `CURRENCY`, ggf.
  `API_BASE_URL`).
- _Tote Routen-Konstanten_ in `utils/constants.ts` (nicht in `App.tsx`): `PRODUCTS`,
  `ORDER_CONFIRMATION`, `IMPRESSUM`, `DATENSCHUTZ`, `USER_DETAIL`.

**backend**
- _Deklaration ergänzen:_ `ms` wird in `authService.ts` importiert, ist aber **nicht** als Dependency
  deklariert (Phantom-Dependency über Transitiv-Abhängigkeit) → explizit aufnehmen.
- _Nicht entfernen, sondern aktivieren:_ `helmet` (ungenutzt, aber laut Roadmap → Security-Härtung).
- _Behalten:_ `mysql2` (Knex-Client via String, kein Import → depcheck-Fehlalarm); übrige genutzt.

**contracts:** sauber, nichts zu entfernen.

**python_ai_service** (JS-Tools n/a; Befund per Import-Analyse):
- _Runtime vs. Konvertierung trennen → großes Einsparpotenzial fürs CPU-Prod-Image:_
  - `torch`: **nur** in `app/tools/convert_*.py` (Konvertierung, Dev/Build) → im Runtime-Pfad nicht
    importiert → für CPU-Prod vermutlich entfernbar/in Dev-Gruppe (torch ist sehr groß). Verifizieren,
    dass `model_manager` zur Laufzeit kein torch lädt (ruft Convert-Skripte nur als Subprozess).
  - `optimum-intel[openvino]`, `onnx`, `onnxscript`, `huggingface-hub`: nur für
    `MODEL_FETCH_MODE=download`/Export → für Prod mit vorgebauter IR nicht im Runtime nötig.
  - `transformers`: **im Runtime genutzt** (`CLIPProcessor`/`BlipProcessor`) → behalten.

### 10.3 Frontend-Struktur-Inventar
- **Routen (App.tsx):** 15 aktive Routen + `*`-Fallback → HOME. Öffentlich: `/`, `/products/:id`,
  `/cart`, `/cart/checkout`, `/auth/login`, `/auth/signup`. `requireAdmin`: `/admin/{dashboard,products,
  orders,users}`. `requireUser`: `/user/{account,profile,orders,orders/:id,settings}`. Keine verwaisten
  Seiten; tote Routen nur als Konstanten (siehe 10.2).
- **Nutzerfluss:** Shop (`ProductListPage → ProductDetailPage → CartPage → CheckoutPage`) → Konto
  (`OrdersPage → OrderDetailPage`, `AccountPage/ProfilePage/SettingsPage`). Admin getrennt
  (`AdminDashboard → ManageProducts(+ProductDialog/ProductAiDialog) / ManageOrders / ManageUsers`).
- **Aufteil-Kandidaten (Zeilen):** `ManageProducts.tsx` (537), `ProductDialog.tsx` (336),
  `ManageOrders.tsx` (318), `ManageUsers.tsx` (226), `authSlice.ts` (298), `productSlice.ts` (264).
- **CSS-Strategie (uneinheitlich):** PrimeReact-Theme + `primeicons` zentral in `index.css`; sonst
  Mischung aus CSS-Modulen (Header/Footer) und page-scoped globalem CSS (`ManageProducts.css` etc.);
  nennenswerte Inline-Styles in `ProductCard.tsx`, `ProductDialog.tsx`, `ProductAiDialog.tsx`; **keine
  Design-Tokens**. `src/style.css` = totes Vite-Boilerplate.
- **PrimeReact-Nutzung:** 19/22 Seiten. Ohne PrimeReact (leicht migrierbar): `ProductListPage`,
  `ProductGrid`, `ProductCard`. Schwerste Migration: Admin-`DataTable`-Seiten.
```
