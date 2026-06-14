# Backend-Audit – TvWallauShop (read-only)

> Stand: 2026-06-03. Auditor: Backend-Workspace. Alle Befunde mit datei:zeile belegt.
> Geprüft am echten Code, nicht an der Doku. Keine Code-Änderungen vorgenommen.

## Coverage-Tabelle

| Datei | gelesen | Verantwortung (1 Zeile) | Auffällige Imports/Exporte |
|---|---|---|---|
| backend/package.json | ja | npm-Manifest, Scripts (build/dev/migrate/seed/test) | deps: helmet+morgan vorhanden; `ms`, `multer`, `socket.io`, `swagger-*` |
| backend/project.json | ja | Nx-Targets (build/test/lint/serve/clear) | `lint` = nur `echo "No lint configured"` |
| backend/tsconfig.json | ja | TS-Config Quellcode (strict, CommonJS) | `strict: true`, `skipLibCheck` |
| backend/tsconfig.migrations.json | ja | TS-Config für knexfile/migrations/seeds | rootDir `.`, schließt `src` aus |
| backend/knexfile.ts | ja | Knex-Config dev/prod (mysql2) | `console.log` DB-Creds beim Start; `module.exports` |
| backend/Dockerfile | ja | Multi-Stage Build (node:20-slim) | kopiert dist/migrations/seeds; CMD startet index.js |
| backend/README.md | ja | Dev-Befehle/Runner-Doku | – |
| backend/migrations/202512091000_init_schema.ts | ja | Initiales DB-Schema (alle Tabellen) | enu `status` deutsch; kein `is_active`/`deleted_at` |
| backend/seeds/001_initial_data.ts | ja | Dev-Seed (Admin + Kunde) | Klartext `Password123`; bcrypt hash |
| backend/src/index.ts | ja | Bootstrap: DB-Retry, HTTP+Socket.IO, Graceful Shutdown | `logger`, `initWebsocket` |
| backend/src/app.ts | ja | Express-App: CORS, JSON, Debug-Routen, ErrorHandler | `@ts-ignore`; kein helmet; morgan optional |
| backend/src/database.ts | ja | Knex-Singleton (mysql2), bool-Konvertierung | `postProcessResponse` nur für `is_verified` |
| backend/src/gateway/app.ts | ja | Router: hängt 4 Service-Router unter /api + /api/v1 ein, Swagger-UIs | doppeltes Mounting an 2 BasePaths |
| backend/src/services/ai/app.ts | ja | Router-Wrapper /ai + statische /uploads | `express.static` ohne Auth |
| backend/src/services/auth/app.ts | ja | Router-Wrapper /auth + /users | – |
| backend/src/services/catalog/app.ts | ja | Router-Wrapper /products | – |
| backend/src/services/order/app.ts | ja | Router-Wrapper /orders | – |
| backend/src/services/authService.ts | ja | Auth-Logik: signup/login/refresh/logout/verify/resend | JWT, bcrypt, refresh_tokens-Tabelle |
| backend/src/services/orderService.ts | ja | Bestell-Logik inkl. Transaktionen/forUpdate/Restock | `console.error` bei Mail-Fehler |
| backend/src/services/productService.ts | ja | Produkt-CRUD, Sizes/Images/Tags, reserveStock | `console.log` Payloads; Hard-Delete |
| backend/src/services/productAiService.ts | ja | KI-Job-Verwaltung (DB + Socket.IO + Python-Call) | Factory + Default-Instanz; viele `console.*` |
| backend/src/services/userService.ts | ja | User-CRUD/Preferences/Password | `mapUserRow(row: any)` |
| backend/src/services/aiPythonClient.ts | ja | HTTP-Client zum Python-AI-Service | `AI_PY_TIMEOUT_MS` default 150000 |
| backend/src/controllers/authController.ts | ja | Auth-HTTP-Schicht, Cookie-Handling | `(result as any).refreshToken`; SameSite=lax |
| backend/src/controllers/orderController.ts | ja | Order-HTTP-Schicht | 6× `(req as any).user` |
| backend/src/controllers/productController.ts | ja | Produkt-HTTP-Schicht + Image-Upload/Delete | `(req as any).files` |
| backend/src/controllers/productAiController.ts | ja | KI-Job-HTTP-Schicht | liest `AI_PRODUCT_AI_USE_REAL_SERVICE` env |
| backend/src/controllers/userController.ts | ja | User-HTTP-Schicht | 6× `(req as any).user` |
| backend/src/routes/authRoutes.ts | ja | Auth-Routen (public) + OpenAPI-JSDoc | kein Rate-Limit |
| backend/src/routes/orderRoutes.ts | ja | Order-Routen (alle geschützt) | `requireRole('admin')` für status/delete |
| backend/src/routes/productRoutes.ts | ja | Produkt-Routen + multer-Upload | kein fileFilter (MIME) |
| backend/src/routes/aiRoutes.ts | ja | KI-Job-Routen (admin) + multer | multer ohne limits |
| backend/src/routes/userRoutes.ts | ja | User-Routen + Inline-Ownership-Checks | lokaler `RequestWithUser` (dupliziert) |
| backend/src/models/orderModel.ts | ja | Typ-Interfaces für Order-Rows | mehrere Typen ungenutzt |
| backend/src/models/productModel.ts | ja | Typ-Interfaces für Product-Rows | – |
| backend/src/models/userModel.ts | ja | User-DB-Typ + Knex-Helper + Sanitizer | `createUser`, `getUserByEmail`, `toSanitized` |
| backend/src/middlewares/authMiddleware.ts | ja | JWT-Verify + User-Load + requireRole | `(req as any).cookies` |
| backend/src/middlewares/errorHandler.ts | ja | Zentraler Error-Handler | `console.error`; InsufficientStock=200 |
| backend/src/middlewares/websocket.ts | ja | Socket.IO Init + getIO() | CORS `origin: 'http://localhost:3001'` hartkodiert |
| backend/src/errors/AuthError.ts | ja | Fehlerklasse Auth | `expose = true` (ungenutzt) |
| backend/src/errors/InsufficientStockError.ts | ja | Fehlerklasse Bestand | `status = 200` |
| backend/src/errors/ProductAiError.ts | ja | Fehlerklasse KI | typisierte Codes |
| backend/src/errors/ProductServiceError.ts | ja | Fehlerklassen Produkt | 4 Subklassen |
| backend/src/errors/ServiceError.ts | ja | Generische Service-Fehlerklasse | default status 500 |
| backend/src/utils/helpers.ts | ja | catchAsync, sendError, isValidEmail, formatDate | `isValidEmail`/`sendError` ungenutzt |
| backend/src/utils/logger.ts | ja | Winston-Logger (Console + File) | File-Transport `logs/app.log` |
| backend/src/utils/mailer.ts | ja | Nodemailer (Verify + Order-Mail) | `console.log`; HTML-Injection von firstName |
| backend/src/docs/swagger.ts | ja | swagger-jsdoc Spec-Generierung | `withBuildPaths` (src+dist) |
| backend/src/contracts/index.ts | ja | API-Basis-Pfade/Versionskonstanten | `SERVICE_IDS` |
| backend/src/contracts/v1/openapi/ai.ts | ja | statische OpenAPI (AI) | ungenutzt? (siehe Befund) |
| backend/src/contracts/v1/openapi/auth.ts | ja | statische OpenAPI (Auth) | ungenutzt? |
| backend/src/contracts/v1/openapi/catalog.ts | ja | statische OpenAPI (Catalog) | ungenutzt? |
| backend/src/contracts/v1/openapi/gateway.ts | ja | statische OpenAPI (Gateway) | ungenutzt? |
| backend/src/contracts/v1/openapi/index.ts | ja | Re-Export der statischen OpenAPI-Objekte | wird nirgends importiert (siehe Befund) |
| backend/src/contracts/v1/openapi/order.ts | ja | statische OpenAPI (Order) | ungenutzt? |
| backend/tests/placeholder.test.js | ja | 1+1-Platzhaltertest | – |
| backend/tests/product-ai-short-title.test.js | ja | echter Test: AI-Job-Persistenz mit Fake-Knex | nutzt `createProductAiService` |

---

## Befunde

### F: Keine Security-Header (helmet) und kein Rate-Limiting
- Kategorie: Sicherheit
- Schweregrad: Hoch
- Konfidenz: Bestätigt
- Ort: backend/src/app.ts:19-35 (kein `app.use(helmet())`); backend/package.json:26 (`helmet` deklariert, aber per Grep keine Referenz in backend/src); backend/src/routes/authRoutes.ts:47 (login) und :28 (signup) ohne Limiter
- Auswirkung: Fehlende Standard-Header (HSTS, X-Content-Type-Options, X-Frame-Options etc.). Login/Signup/Refresh/Resend sind ungebremst → Brute-Force von Passwörtern und E-Mail-Bombing (`/auth/resend`) möglich.
- Empfehlung: `helmet()` als erste Middleware einbinden; `express-rate-limit` auf `/auth/login`, `/auth/signup`, `/auth/resend`, `/auth/refresh`.
- Aufwand: S

### F: WebSocket-CORS-Origin hartkodiert auf localhost:3001
- Kategorie: Konfiguration/Env
- Schweregrad: Hoch
- Konfidenz: Bestätigt
- Ort: backend/src/middlewares/websocket.ts:9-13
- Auswirkung: Socket.IO akzeptiert nur `http://localhost:3001`. In Produktion (Hetzner) bricht die WebSocket-Verbindung → KI-Job-Live-Updates (`aiJob:updated`/`aiJob:completed`) erreichen das Frontend nicht. Inkonsistent zur HTTP-CORS-Config in app.ts, die `APP_ORIGIN` nutzt.
- Empfehlung: Origin aus `APP_ORIGIN` (Komma-Liste, wie app.ts:14-17) beziehen.
- Aufwand: S

### F: KI-Upload-Verzeichnis öffentlich statisch ausgeliefert (keine Auth)
- Kategorie: Sicherheit
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: backend/src/services/ai/app.ts:10-11 (`express.static(uploadsPath)`); gateway/app.ts:28 (`gatewayApp.use('/uploads', aiUploadsRouter)`)
- Auswirkung: Das gesamte `uploads/`-Verzeichnis (inkl. `uploads/ai/product-jobs/` und `uploads/products/`) ist ohne Authentifizierung erreichbar. Das ist by-design nötig, damit der Python-Service die Bild-URLs (`APP_URL` + Pfad, productAiService.ts:307-316) abrufen kann. Aber: Dateinamen für AI-Jobs sind ratebar (`<base>-<timestamp>-<random>`), und es gibt kein `fileFilter` (s. nächster Befund) → potenziell beliebige hochgeladene Dateien öffentlich abrufbar.
- Empfehlung: Akzeptieren mit Hinweis; alternativ signierte/temporäre URLs oder Auslieferung über einen authentifizierten Proxy. Mindestens MIME-Whitelist (s.u.).
- Aufwand: M

### F: Multer-Uploads ohne MIME/Dateityp-Filter; KI-Upload ohne Größenlimit
- Kategorie: Sicherheit
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: backend/src/routes/productRoutes.ts:30-36 (limits, aber kein `fileFilter`); backend/src/routes/aiRoutes.ts:30 (`multer({ storage })` – weder `limits` noch `fileFilter`)
- Auswirkung: Beliebige Dateitypen können hochgeladen werden (z.B. HTML/SVG mit aktivem Inhalt), die anschließend öffentlich aus `/uploads` ausgeliefert werden → Stored-XSS-/Content-Sniffing-Risiko. KI-Upload hat zudem keine Größenbegrenzung → DoS durch große Uploads.
- Empfehlung: `fileFilter` auf Bild-MIME-Typen beschränken; `limits.fileSize`/`limits.files` auch in aiRoutes setzen.
- Aufwand: S

### F: `InsufficientStockError` antwortet mit HTTP 200
- Kategorie: Korrektheit
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: backend/src/errors/InsufficientStockError.ts:21-24; ausgewertet in errorHandler.ts:35-51
- Auswirkung: Ein fehlgeschlagener Checkout (Bestand zu niedrig) liefert HTTP 200 mit einem Fehler-Body. Das verletzt HTTP-Semantik; Clients/Proxies/Tests, die nur den Statuscode prüfen, halten die Bestellung für erfolgreich. Frontend muss den Fehlercode aus einer 200-Antwort herauspuzzeln.
- Empfehlung: Auf 409 (Conflict) umstellen; Frontend (orderSlice/orderService) entsprechend anpassen.
- Aufwand: S

### F: Refresh-Token wird bei Refresh nicht rotiert / nicht gegen Ablauf in DB geprüft
- Kategorie: Sicherheit
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: backend/src/services/authService.ts:138-164 (refresh); authController.ts:167-187
- Auswirkung: Bei `/auth/refresh` wird das Refresh-Token zwar per JWT verifiziert und in `refresh_tokens` gesucht, aber (a) `expires_at` der DB-Zeile wird nicht geprüft (nur die JWT-Exp zählt – DB-Spalte damit faktisch ungenutzt), (b) das Token wird nicht rotiert (`newRefreshToken = result.refreshToken ?? token`, und `refresh()` liefert nie ein neues refreshToken → es bleibt dasselbe). Logout/Token-Diebstahl-Erkennung ist dadurch schwächer; gestohlene Refresh-Tokens bleiben bis zur 30-Tage-JWT-Exp gültig, selbst nach Logout nur, solange die DB-Zeile existiert – aber abgelaufene DB-Zeilen werden nie aufgeräumt.
- Empfehlung: DB-`expires_at` prüfen; Token-Rotation (alte Zeile löschen, neue einfügen) implementieren; abgelaufene Tokens periodisch löschen.
- Aufwand: M

### F: Login ist case-sensitiv für E-Mail, Signup speichert lowercased
- Kategorie: Korrektheit
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: authController.ts:65 (Signup: `String(email).toLowerCase().trim()`); authController.ts:99 + authService.ts:102-103 (Login: `getUserByEmail(email)` ohne Normalisierung)
- Auswirkung: Wird beim Login die E-Mail mit anderer Groß-/Kleinschreibung eingegeben als gespeichert, schlägt der Login fehl (`getUserByEmail` matched exakt auf den gespeicherten Lowercase-Wert). Inkonsistente Normalisierung an den beiden Grenzen.
- Empfehlung: E-Mail im Login (und in `resendVerification`) ebenfalls `toLowerCase().trim()` normalisieren.
- Aufwand: S

### F: `accessToken`-Cookie wird gelesen, aber nie gesetzt
- Kategorie: Toter Code/Duplikate
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: backend/src/middlewares/authMiddleware.ts:37-39 (liest `cookies.accessToken`); authController.ts:155-164 + userController.ts:97-108 (clearCookie 'accessToken'); kein `res.cookie('accessToken', …)` in backend/src (per Grep bestätigt: keine Treffer)
- Auswirkung: Cookie-basierter Access-Token-Pfad ist toter Code – es wird nur der Bearer-Header genutzt. clearCookie/Reader-Logik suggerieren ein Feature, das nie existiert. Verwirrend, Wartungslast.
- Empfehlung: Entweder Access-Token-Cookie konsistent setzen oder den Cookie-Lese-/Clear-Pfad entfernen.
- Aufwand: S

### F: `verifyEmail` prüft Token nicht auf Ablauf, wenn `verification_expires` als String zurückkommt
- Kategorie: Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Wahrscheinlich
- Ort: backend/src/services/authService.ts:186 (`user.verification_expires < new Date()`); userModel.ts:22 typisiert als `Date | null`
- Auswirkung: Der Vergleich funktioniert nur, wenn mysql2 die DATETIME-Spalte als `Date` liefert. Liefert der Treiber einen String (Treiber-/Config-abhängig, `dateStrings`), greift `string < Date` per Coercion uneinheitlich → abgelaufene Tokens könnten akzeptiert werden. Tokens sind ohnehin nur 24h gültig und werden nach Verifizierung gelöscht, daher niedriges Risiko.
- Empfehlung: Explizit `new Date(user.verification_expires).getTime() < Date.now()` vergleichen.
- Aufwand: S

### F: Tags/Sizes-Setzen läuft außerhalb einer Transaktion und ohne pro-User-Race-Schutz
- Kategorie: Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Wahrscheinlich
- Ort: backend/src/services/productService.ts:88-120 (`setTagsForProduct`), :129-156 (`setSizesForProduct`), aufgerufen in createProduct (:399) / updateProduct (:433/438)
- Auswirkung: `tags` hat ein UNIQUE-Constraint (`name`). Zwei parallele createProduct-Requests mit demselben neuen Tag können beim Insert kollidieren (Find-or-Create ist nicht atomar) → eine Anfrage scheitert mit Duplicate-Key. createProduct/updateProduct sind außerdem nicht transaktional: Produkt-Insert, Sizes und Tags sind separate Statements; ein Fehler bei Sizes/Tags lässt ein halb angelegtes Produkt zurück. Admin-only, daher geringe Wahrscheinlichkeit.
- Empfehlung: createProduct/updateProduct in eine Transaktion klammern; Tag-Insert mit `onConflict('name').ignore()` o.ä.
- Aufwand: M

### F: `getOpenProductAiJobs` listet ALLE Status (Name irreführend) + N-Job-Wachstum
- Kategorie: Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: backend/src/services/productAiService.ts:378-385 (`whereIn('status', ['PENDING','PROCESSING','FAILED','SUCCESS'])`)
- Auswirkung: Der Filter umfasst alle vier Status; das `whereNull('product_id')` ist die eigentliche Einschränkung ("noch nicht in ein Produkt übernommen"). Name "open" ist irreführend; SUCCESS-Jobs sammeln sich unbegrenzt an, bis sie manuell gelöscht werden.
- Empfehlung: Filter klären/umbenennen; optional Aufräum-Strategie für übernommene/alte Jobs.
- Aufwand: S

### F: `knexfile.ts` loggt DB-Verbindungsdaten beim Start
- Kategorie: Observability/Logging
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: backend/knexfile.ts:11-17 (`console.log` Host/Port/User/DB-Name)
- Auswirkung: DB-Host/User/Schema landen bei jedem Migrate/Seed/Start im Log (kein Passwort, aber unnötige Infrastruktur-Offenlegung). Außerdem `console.log` statt winston.
- Empfehlung: Debug-Block entfernen oder hinter `DEBUG`-Flag und winston legen.
- Aufwand: S

### F: Flächendeckend `console.log`/`console.error`/`console.warn` statt winston
- Kategorie: Observability/Logging
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: errorHandler.ts:15; productService.ts:373,405,571; productAiService.ts:102,121,271,322,338,401; orderService.ts:420; userController/authMiddleware (warn/error); mailer.ts:31-44; websocket.ts:17-24
- Auswirkung: Inkonsistentes Logging, kein Level/Format/Korrelations-ID; `[AI]`-Logs schreiben (gekürzte) Titel/Description in stdout. Der File-Transport von winston (`logs/app.log`) bekommt nichts davon mit.
- Empfehlung: Zentral auf `logger` umstellen; im ErrorHandler 5xx mit `logger.error`, 4xx ggf. `logger.warn`.
- Aufwand: M

### F: `(req as any).user` durchgängig statt typsicherem Request
- Kategorie: Typsicherheit
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: orderController.ts:7,27,35,48,55; userController.ts:29,39,51,63,77; app.ts:57 (`@ts-ignore`); authMiddleware.ts:37 & authController.ts:119 (`(req as any).cookies`)
- Auswirkung: Verlust der Typprüfung an der wichtigsten Sicherheitsgrenze (wer ist der User, welche Rolle). `RequestWithUser` ist in authMiddleware.ts:15 und userRoutes.ts:22 zweimal lokal definiert (Duplikat), aber nicht global per Express-Augmentation. Tippfehler in `user.role`/`user.id` würden nicht auffallen.
- Empfehlung: Globale `declare module 'express'`-Augmentation für `req.user`; lokale Duplikate entfernen.
- Aufwand: M

### F: Statische OpenAPI-Objekte unter src/contracts/v1/openapi sind toter Code
- Kategorie: Toter Code/Duplikate
- Schweregrad: Niedrig
- Konfidenz: Wahrscheinlich
- Ort: backend/src/contracts/v1/openapi/{index,ai,auth,catalog,gateway,order}.ts; Konsument ist swagger.ts, das stattdessen `swagger-jsdoc` aus JSDoc-Kommentaren generiert (swagger.ts:103-158)
- Auswirkung: Zwei parallele, divergierende API-Beschreibungen: die ausgelieferten Docs kommen aus den JSDoc-Annotationen in den Routen; die statischen Objekte in `contracts/v1/openapi/*` werden – soweit im gesamten src nicht importiert – nicht verwendet. Drift-/Wartungslast.
- Empfehlung: Verifizieren, dass nichts importiert; falls bestätigt, entfernen oder als Single Source of Truth nutzen.
- Aufwand: S

### F: Order-Status als deutscher Magic-String, keine englische Enum + kein Soft-Delete
- Kategorie: Architektur/Kopplung
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: migration:94 (`enu('status', ['Bestellt','Bezahlt','Storniert'])`); orderService.ts:10-12; Produkte: deleteProduct macht Hard-Delete (productService.ts:554-578) statt Soft-Delete
- Auswirkung: Deutsche Status-Strings über DB/Service/Frontend verstreut; Kommentar orderService.ts:562 erwähnt nicht existierenden Status "Versendet". Hard-Delete eines Produkts ist durch FK `order_items.product_id = RESTRICT` (migration:116) blockiert, sobald Bestellungen existieren → `deleteProduct` schlägt dann fehl (Entscheidung 8 sieht Soft-Delete vor, noch nicht umgesetzt).
- Empfehlung: Status als Enum/Konstante mit Anzeige-Mapping; Soft-Delete (`is_active`/`deleted_at`) wie in Entscheidung 8.
- Aufwand: M

### F: Service-Router doppelt unter /api UND /api/v1 gemountet (gleiche Handler)
- Kategorie: Architektur/Kopplung
- Schweregrad: Info
- Konfidenz: Bestätigt
- Ort: backend/src/gateway/app.ts:20-26
- Auswirkung: Jede Route ist unter zwei Pfaden erreichbar; Versionierung ist nominell (identische Handler). Keine echte v1-Trennung – wenn künftig v2 nötig wird, ist das irreführend.
- Empfehlung: Bewusste Entscheidung dokumentieren oder /api als Alias auf /api/v1 redirekten.
- Aufwand: S

### F: Sehr geringe Testabdeckung
- Kategorie: Tests/QS
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: backend/tests/placeholder.test.js (Platzhalter); backend/tests/product-ai-short-title.test.js (einziger echter Test, deckt nur AI-Job-Persistenz mit Fake-Knex ab)
- Auswirkung: Keine Tests für Auth (Login/Refresh/Verify), Order-Transaktionen/Bestandsreservierung, requireRole-Autorisierung, User-CRUD, Produkt-CRUD. Regressionen in sicherheits-/geldrelevanten Pfaden würden unbemerkt bleiben.
- Empfehlung: Gezielte Tests für reserveStock/createOrder (inkl. InsufficientStock), Auth-Flow, requireRole. Siehe Roadmap P1-1.
- Aufwand: L

### F: Kein echtes Backend-Linting
- Kategorie: DX/Tooling
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: backend/project.json:29-35 (`lint` = `echo "No lint configured for backend"`)
- Auswirkung: Keine statische Analyse/Formatierung im Backend → die o.g. Smells (any-Casts, console.*) werden nie automatisch erkannt.
- Empfehlung: ESLint + Prettier wie im Frontend einführen und ins `lint`-Target hängen.
- Aufwand: M

### F: `ms` ist Phantom-Dependency-Risiko / hier korrekt deklariert (Klarstellung)
- Kategorie: Abhängigkeiten
- Schweregrad: Info
- Konfidenz: Bestätigt
- Ort: backend/src/services/authService.ts:3 (`import ms, { StringValue } from 'ms'`); backend/package.json:30 (`"ms": "^2.1.3"`)
- Auswirkung: In CLAUDE.md/Abschnitt 10.2 als fehlende Deklaration gelistet – tatsächlich ist `ms` inzwischen in package.json deklariert. Kein Handlungsbedarf mehr; Doku ist hier veraltet.
- Empfehlung: Doku-Hinweis aktualisieren.
- Aufwand: S

### F: Debug-Routen exponieren `NODE_ENV` und Routenliste (nur bei DEBUG_ROUTES)
- Kategorie: Sicherheit
- Schweregrad: Info
- Konfidenz: Bestätigt
- Ort: backend/src/app.ts:50-79 (`/api/debug/ping`, `/api/debug/routes`)
- Auswirkung: Bei `DEBUG_ROUTES=true` ungeschützt erreichbar (keine Auth) → leakt Umgebung und vollständige Routentabelle. In Prod laut Doku deaktiviert; Risiko nur bei versehentlicher Aktivierung.
- Empfehlung: Sicherstellen, dass DEBUG_ROUTES in Prod nie gesetzt ist; ggf. zusätzlich auf non-prod beschränken.
- Aufwand: S

### F: Order-`createOrder` erlaubt Aggregat-/Status-Edgecases; doppelte priceMap-Prüfung
- Kategorie: Korrektheit
- Schweregrad: Info
- Konfidenz: Bestätigt
- Ort: backend/src/services/orderService.ts:354-394
- Auswirkung: Items werden für die Bestandsreservierung aggregiert (Z. 357-371), aber die `order_items`-Inserts (Z. 378-392) verwenden die nicht-aggregierten Rohdaten. Da PK `(order_id, product_id, size_id)` ist (migration:129), führt ein Request mit zwei Positionen desselben Produkt+Größe-Paares zu einem Duplicate-Key-Fehler beim Insert (statt Mengen zu summieren). Frontend schickt vermutlich aggregiert, aber die API ist hier inkonsistent. Die `missingProductIds`-Prüfung existiert doppelt (Z. 359-364 und 379-384).
- Empfehlung: Aggregierte Werte auch für die `order_items`-Inserts verwenden.
- Aufwand: S

### F: Mailer interpoliert `firstName` ungeschützt in HTML
- Kategorie: Sicherheit
- Schweregrad: Niedrig
- Konfidenz: Wahrscheinlich
- Ort: backend/src/utils/mailer.ts:65,130 (`Hallo ${firstName}`), :118-121 (productName/sizeLabel in Tabellenzellen)
- Auswirkung: `firstName` stammt aus User-Input (Signup) und wird ungefiltert in HTML-Mails eingebettet → HTML-Injection in E-Mails (begrenztes Risiko, da E-Mail-Clients Script meist blocken; aber Phishing-/Layout-Manipulation möglich).
- Empfehlung: HTML-Escaping für alle interpolierten User-Werte.
- Aufwand: S

### F: `deleteUser` ist Hard-Delete trotz vorhandenem `account_status`-Feld + FK auf orders
- Kategorie: Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: backend/src/services/userService.ts:117-125 (`.delete()`); migration:88-92 (`orders.user_id` FK ohne onDelete → RESTRICT default)
- Auswirkung: Löscht ein User Konto, scheitert das DELETE, sobald Bestellungen existieren (FK RESTRICT auf `orders.user_id`). Es gibt ein `account_status`-Feld ('active/suspended/deleted'), das im Code aber nirgends als Soft-Delete genutzt wird (nur gelesen in mapUserRow). deleteAccount (userController.ts:76-117) löscht nur Tokens vorab, nicht die Bestellungen.
- Empfehlung: Soft-Delete via `account_status='deleted'` oder Konflikt klar als 409 behandeln.
- Aufwand: M

---

## Fähigkeiten (Backend) – Status je Fähigkeit

| Fähigkeit | Status | Beleg (datei:zeile) |
|---|---|---|
| Registrierung (Signup + Verify-Mail) | ✅ funktioniert | authController.ts:22-90, authService.ts:43-99, mailer.ts:51-97 |
| E-Mail-Verifizierung | ✅ funktioniert (Ablauf-Vergleich fragil) | authService.ts:173-206, authController.ts:206-220 |
| Login (JWT + refreshToken-Cookie) | ⚠️ teilweise (case-sensitive E-Mail) | authService.ts:102-135, authController.ts:93-115 |
| Token-Refresh | ⚠️ teilweise (keine Rotation, DB-Exp ungeprüft) | authService.ts:138-164, authController.ts:167-187 |
| Logout (Token invalidieren) | ✅ funktioniert | authController.ts:189-203, authService.ts:167-170 |
| Autorisierung (requireRole/Ownership) | ✅ funktioniert | authMiddleware.ts:91-103, userRoutes.ts:171-185/241-255 |
| Produktliste/-Detail (public) | ✅ funktioniert | productController.ts:10-18, productService.ts:161-370 |
| Produkt-CRUD (admin) | ⚠️ teilweise (nicht transaktional, Hard-Delete vs FK) | productService.ts:372-578, productRoutes.ts:93-158 |
| Produkt-Bild-Upload/-Delete | ⚠️ teilweise (kein MIME-Filter) | productController.ts:39-92, productRoutes.ts:193-233 |
| Bestellung anlegen (Checkout + Bestandsreservierung) | ⚠️ teilweise (Aggregat-Mismatch, InsufficientStock=200) | orderService.ts:293-439, productService.ts:283-309 |
| Bestand reservieren (forUpdate) | ✅ funktioniert | productService.ts:283-309 |
| Eigene Bestellungen / Stornieren | ✅ funktioniert | orderService.ts:538-617, orderController.ts:47-60 |
| Order-Status ändern / löschen (admin, Restock) | ✅ funktioniert | orderService.ts:442-535, orderRoutes.ts:139/162 |
| User-Profil/Preferences/Passwort | ✅ funktioniert | userService.ts:59-213, userController.ts:28-129 |
| User löschen | ⚠️ teilweise (Hard-Delete, FK-Konflikt mgl.) | userService.ts:117-125, userController.ts:76-117 |
| KI-Job anlegen (Mock + Real) | ✅ funktioniert | productAiService.ts:175-242, productAiController.ts:8-33 |
| KI-Job verarbeiten (Python-Call → Persist → Socket) | ✅ funktioniert | productAiService.ts:277-372, aiPythonClient.ts:19-44 |
| KI-Job Retry/Delete/List | ✅ funktioniert | productAiService.ts:244-407 |
| WebSocket-Live-Updates | ⚠️ teilweise (CORS-Origin hartkodiert → in Prod kaputt) | websocket.ts:7-27, productAiService.ts:97-104 |
| E-Mail-Versand (Verify/Order) | ✅ funktioniert (abschaltbar via EMAIL_SEND) | mailer.ts:24-46 |
| Swagger/OpenAPI-Docs | ✅ funktioniert (JSDoc-basiert) | swagger.ts:103-158, gateway/app.ts:60-211 |
| Security-Header (helmet) | ❌ kaputt/fehlt | app.ts:19-35 (nicht eingebunden) |
| Rate-Limiting | ❌ fehlt | authRoutes.ts (kein Limiter) |
| Backend-Linting | 🔲 Stub | project.json:29-35 |
| Testabdeckung | ⚠️ teilweise (1 echter Test) | backend/tests/* |

---

## Workflow-relevante Notizen (Funktions-/Routenketten für den Tracer)

### Auth
- Register: `POST /api/auth/signup` → authRoutes.ts:28 → authController.signup (authController.ts:22) → authService.signup (authService.ts:43) → models/userModel.createUser (userModel.ts:56) + setVerificationForUser (userModel.ts:81) → mailer.sendVerificationEmail (mailer.ts:51).
- Login: `POST /api/auth/login` → authRoutes.ts:47 → authController.login (authController.ts:93) → authService.login (authService.ts:102) → getUserByEmail (userModel.ts:67) + bcrypt.compare → signJwt (authService.ts:36) → INSERT refresh_tokens (authService.ts:124) → Cookie set (authController.ts:104).
- Refresh: `POST /api/auth/refresh` → authRoutes.ts:60 → authController.refresh (authController.ts:167, extractRefreshToken :117) → authService.refresh (authService.ts:138) → jwt.verify + SELECT refresh_tokens.
- Verify: `GET /api/auth/verify?token=` → authRoutes.ts:86 → authController.verifyEmail (authController.ts:206) → authService.verifyEmail (authService.ts:173) → UPDATE users.is_verified.
- Schutz-Kette für geschützte Routen: authMiddleware (authMiddleware.ts:25) → jwt.verify → userService.getUserById (userService.ts:132) → setzt req.user → requireRole (authMiddleware.ts:91).

### Katalog (Produktliste/Detail)
- Liste: `GET /api/products` → catalog/app.ts:6 → productRoutes.ts:51 → productController.getAllProducts (productController.ts:10) → productService.getAllProducts (productService.ts:161; lädt sizes/images/tags).
- Detail: `GET /api/products/:id` → productRoutes.ts:70 → productController.getProductById (productController.ts:15) → productService.getProductById (productService.ts:323).

### Bestellung (Checkout → orderService → DB-Transaktion)
- `POST /api/orders` (authMiddleware) → order/app.ts:6 → orderRoutes.ts:111 → orderController.createOrder (orderController.ts:34, übergibt req.user) → orderService.createOrder (orderService.ts:293):
  - `knex.transaction` (Z.348) → INSERT orders (Z.349) → productService.getProductPricingByIds (productService.ts:247) → Aggregation (Z.357-371) → productService.reserveStock (productService.ts:283, `forUpdate` + decrement, wirft InsufficientStockError Z.302) → INSERT order_items (Z.394) → buildOrderItems (Z.86) → sendOrderConfirmationEmail (mailer.ts:99, Fehler nur geloggt).

### Admin-Produkt-CRUD inkl. Bild-Upload
- Create: `POST /api/products` (authMiddleware + requireRole admin) → productRoutes.ts:93 → productController.createProduct (productController.ts:20) → productService.createProduct (productService.ts:372) → INSERT products + setSizesForProduct (Z.129) + setTagsForProduct (Z.88).
- Update: `PUT /api/products/:id` → productRoutes.ts:126 → productController.updateProduct (productController.ts:25) → productService.updateProduct (productService.ts:404).
- Delete: `DELETE /api/products/:id` → productRoutes.ts:153 → productService.deleteProduct (productService.ts:554, Transaktion + fs.rm Uploads).
- Bild-Upload: `POST /api/products/:id/images` → productRoutes.ts:193 (multer.diskStorage → uploads/products/:id, productRoutes.ts:16-36) → productController.uploadProductImages (productController.ts:39) → productService.addImagesToProduct (productService.ts:445).
- Bild-Delete: `DELETE /api/products/:id/images/:imageId` → productRoutes.ts:228 → productController.deleteProductImage (productController.ts:64) → productService.deleteProductImage (productService.ts:496, Transaktion).

### KI-Job (POST product-job → product_ai_jobs → aiPythonClient → /analyze-product → Ergebnis → Socket.IO)
- `POST /api/ai/product-job` (authMiddleware + requireRole admin + multer.array images, aiRoutes.ts:67; Upload nach uploads/ai/product-jobs, aiRoutes.ts:13-30) → productAiController.createProductAiJob (productAiController.ts:8, liest AI_PRODUCT_AI_USE_REAL_SERVICE) → productAiService.createProductAiJob (productAiService.ts:175):
  - Real-Modus: INSERT product_ai_jobs status=PENDING (Z.198) → safeEmit 'aiJob:updated' (Z.214) → Antwort 201 → fire-and-forget productAiService.processProductAiJob (Controller Z.24 → service Z.374 → processProductAiJobImpl Z.277).
  - processProductAiJobImpl: applyJobUpdate→PROCESSING (Z.285, safeEmit Z.301) → Bild-URLs via APP_URL bauen (Z.307-316) → analyzeProductViaPython (aiPythonClient.ts:19 → `POST {AI_PY_SERVICE_URL}/analyze-product`, Payload `{jobId, price:{amount}, images:[{kind:'url',value}]}`, Timeout AI_PY_TIMEOUT_MS=150000) → validateAiCopyOutput (Z.319/77) → applyJobUpdate→SUCCESS (Z.344, Tags normalisiert) → safeEmit 'aiJob:completed' (Z.353); bei Fehler applyJobUpdate→FAILED (Z.358) + safeEmit 'aiJob:completed' (Z.369).
  - Mock-Modus (AI_PRODUCT_AI_USE_REAL_SERVICE!='true'): sofort INSERT status=SUCCESS mit Mock-Daten (Z.224) → safeEmit 'aiJob:completed' (Z.240).
- Retry: `POST /api/ai/product-job/:id/retry` → aiRoutes.ts:100 → productAiController.retryProductAiJob (productAiController.ts:35) → productAiService.retryProductAiJob (productAiService.ts:244).
- Liste: `GET /api/ai/product-jobs/open` → aiRoutes.ts:124 → getOpenProductAiJobs (productAiService.ts:378).
- Delete: `DELETE /api/ai/product-job/:id` → aiRoutes.ts:154 → deleteProductAiJob (productAiService.ts:387, löscht Bilddateien + Zeile).
- Bild-Auslieferung an Python: statisch über `GET /uploads/...` (services/ai/app.ts:10-11, gateway/app.ts:28), ohne Auth.
