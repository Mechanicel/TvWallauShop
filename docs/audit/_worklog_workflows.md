# Workflow-Tracing — TvWallauShop (statischer Audit, read-only)

> Stand: 2026-06-03. Reines Lesen quer durch alle Schichten. Belege als `datei:zeile`.
> Pfade relativ zu Repo-Root.

## Workflow-Tracings

### Workflow: 1a Auth – Registrierung (Signup + E-Mail-Verifizierung)
Status: ⚠️ teilweise/Lücke (prod-untaugliche Verify-URL, Verify-GET ohne Frontend-Seite)

Hop-Kette:
- Hop 1: Frontend `signup`-Thunk → `authService.signup(payload)` — `frontend/src/store/slices/authSlice.ts:82-92`
- Hop 2: `authService.signup` POST `/auth/signup` (multipart? nein, JSON) — `frontend/src/services/authService.ts:32-36`
- Hop 3: axios baseURL = `API_BASE_URL` = `http://localhost:3000/api/v1` (default) — `frontend/src/contracts/index.ts:7-8`, `frontend/src/services/api.ts:8-11`
- Hop 4: Gateway mountet alle Service-Router unter `/api` UND `/api/v1` — `backend/src/gateway/app.ts:20-26`
- Hop 5: authServiceApp → `/auth` Router — `backend/src/services/auth/app.ts:7`; Route POST `/signup` — `backend/src/routes/authRoutes.ts:28`
- Hop 6: `authController.signup` validiert Pflichtfelder, baut `SignupInput` — `backend/src/controllers/authController.ts:22-90`
- Hop 7: `authService.signup` → bcrypt-Hash, `createUser`, Verification-Token, `setVerificationForUser` — `backend/src/services/authService.ts:43-99`
- Hop 8: Verify-URL = `${APP_ORIGIN||http://localhost:3001}/api/auth/verify?token=...`, Mailversand — `backend/src/services/authService.ts:91-98`
- Hop 9: User klickt Link → GET `/auth/verify` (im selben authRouter) — `backend/src/routes/authRoutes.ts:86`
- Hop 10: `authController.verifyEmail` → `authService.verifyEmail(token)`; bei `redirect`-Query 302, sonst JSON 200 — `backend/src/controllers/authController.ts:206-220`
- Hop 11: `authService.verifyEmail` setzt `is_verified=true`, löscht Token — `backend/src/services/authService.ts:173-206`

Lücken/Brüche:
- `backend/src/services/authService.ts:91-92` + `:215-216`: Verify-Link nutzt `APP_ORIGIN` (Default = Frontend `:3001`) + Pfad `/api/auth/verify`. In Dev funktioniert das nur über den Vite-Proxy (`/api`→:3000, `frontend/vite.config.ts:17-21`). In Prod muss `APP_ORIGIN` zwingend auf die öffentliche Domain zeigen, hinter der `/api` zum Backend geroutet wird — sonst 404. Konfig-Abhängigkeit.
- `verifyEmail` rendert nur JSON bzw. redirectet auf eine übergebene `redirect`-URL — es gibt KEINE Frontend-Verify-Seite/Route (kein `/auth/verify` in `frontend/src/App.tsx`). Nutzer landet auf einer Backend-JSON-Antwort.
- `resendVerification` (Route POST `/auth/resend`, `backend/src/routes/authRoutes.ts:99`) wird vom Frontend NICHT aufgerufen (kein Treffer in `frontend/src/services/*`). Tote Server-Route aus Frontend-Sicht.

### Workflow: 1b Auth – Login (JWT Access + Refresh-Cookie)
Status: ✅ vollständig

Hop-Kette:
- Hop 1: `LoginPage.handleLogin` → dispatch `login({email,password})` — `frontend/src/pages/Auth/LoginPage.tsx:29-32`
- Hop 2: `login`-Thunk → `authService.login` — `frontend/src/store/slices/authSlice.ts:65-75`
- Hop 3: POST `/auth/login` mit `withCredentials` — `frontend/src/services/authService.ts:20-24`
- Hop 4: Route → `authController.login` — `backend/src/routes/authRoutes.ts:47`, `backend/src/controllers/authController.ts:93-115`
- Hop 5: `authService.login` prüft bcrypt + `is_verified`, signiert Access+Refresh, speichert Refresh in `refresh_tokens` — `backend/src/services/authService.ts:102-135`
- Hop 6: Controller setzt `refreshToken` als httpOnly-Cookie, gibt `{accessToken, refreshToken, user}` zurück — `backend/src/controllers/authController.ts:101-114`
- Hop 7: Slice speichert `accessToken`+`user` in State+localStorage — `frontend/src/store/slices/authSlice.ts:199-213`
- Hop 8: Redirect anhand `user.role` (admin→Dashboard, sonst Home) — `frontend/src/pages/Auth/LoginPage.tsx:30-32`

Lücken/Brüche: keine funktionalen. Hinweis: `accessToken` wird in `localStorage` gehalten (XSS-Exposition), und der Response-Body enthält `refreshToken` zusätzlich zum httpOnly-Cookie (`authController.ts:113-114`) — der Cookie ist der eigentliche Pfad, das Body-Feld ist redundant/„Abwärtskompatibilität".

### Workflow: 1c Auth – Token-Refresh (401-Interceptor + Request-Queue)
Status: ✅ vollständig

Hop-Kette:
- Hop 1: Beliebiger API-Call erhält 401; Response-Interceptor prüft `!isAuthEndpoint` und `!_retry` — `frontend/src/services/api.ts:46-63`
- Hop 2: Falls bereits ein Refresh läuft → Request in `failedQueue` puffern — `frontend/src/services/api.ts:65-75`
- Hop 3: Sonst POST `/auth/refresh` (Cookie geht automatisch mit) — `frontend/src/services/api.ts:82`
- Hop 4: Route → `authController.refresh`, liest Refresh-Token aus Cookie (Fallback Roh-Header) — `backend/src/routes/authRoutes.ts:60`, `backend/src/controllers/authController.ts:117-187`
- Hop 5: `authService.refresh` verifiziert Token + prüft `refresh_tokens`-Tabelle, gibt neuen Access-Token — `backend/src/services/authService.ts:138-164`
- Hop 6: Controller setzt Refresh-Cookie neu (Rotation optional: `refreshToken ?? token`), Body `{accessToken}` — `backend/src/controllers/authController.ts:174-186`
- Hop 7: Interceptor `setAccessToken(newToken)`, `processQueue`, Original-Request mit neuem Bearer wiederholen — `frontend/src/services/api.ts:84-95`
- Hop 8: Bei Refresh-Fehler `clearAuth()` — `frontend/src/services/api.ts:96-100`

Lücken/Brüche:
- Kleine Inkonsistenz: `authSlice.refreshAccessToken` (`authSlice.ts:117-135`) ruft zusätzlich `userService.me()` und liefert `{accessToken, user}`. Der zentrale Interceptor (`api.ts`) nutzt diesen Thunk NICHT, sondern dispatcht nur `setAccessToken`. Zwei parallele Refresh-Pfade; der Thunk wird im Code nirgends aufgerufen (kein Treffer) → potenziell toter Pfad.
- Refresh rotiert den Token serverseitig NICHT (kein neuer Eintrag/Invalidierung in `refresh_tokens`), `newRefreshToken = result.refreshToken ?? token` ist immer der alte Token (`authController.ts:174`); `authService.refresh` gibt nie ein neues `refreshToken` zurück (`authService.ts:163`). Funktioniert, aber keine Rotation.

### Workflow: 1d Auth – Logout
Status: ✅ vollständig

Hop-Kette:
- Hop 1: `logout`-Thunk → `authService.logout` POST `/auth/logout` — `frontend/src/store/slices/authSlice.ts:99-109`, `frontend/src/services/authService.ts:52-56`
- Hop 2: Route → `authController.logout` — `backend/src/routes/authRoutes.ts:73`, `backend/src/controllers/authController.ts:189-203`
- Hop 3: Refresh-Token aus DB löschen + alle Cookie-Varianten clearen — `backend/src/controllers/authController.ts:191-199`
- Hop 4: Slice leert State+localStorage — `frontend/src/store/slices/authSlice.ts:240-253`

Lücken/Brüche: keine.

### Workflow: 1e Auth – requireRole / requireAdmin / requireUser
Status: ✅ vollständig (mit Hinweis)

Hop-Kette:
- Hop 1: Frontend-Guards in `App.tsx`: `requireAdmin` (role==='admin'), `requireUser` (role==='customer'), sonst Redirect — `frontend/src/App.tsx:33-50, 66-78`
- Hop 2: Request-Interceptor hängt Bearer-Token an — `frontend/src/services/api.ts:15-24`
- Hop 3: `authMiddleware` liest Bearer/Cookie, verifiziert JWT, lädt User → `req.user` — `backend/src/middlewares/authMiddleware.ts:25-85`
- Hop 4: `requireRole(role)` prüft `req.user.role === role`, sonst 403 — `backend/src/middlewares/authMiddleware.ts:91-103`
- Hop 5: Geschützte Routen verwenden `authMiddleware`+`requireRole('admin')` (products POST/PUT/DELETE, ai/*, orders status/delete, users GET/PUT) — `productRoutes.ts:93-158`, `aiRoutes.ts:67-159`, `orderRoutes.ts:139,162`, `userRoutes.ts:146,216`

Lücken/Brüche:
- `requireUser` lässt NUR `customer` zu (`App.tsx:46-48`): ein Admin kann die Kundenseiten (`/user/*`) nicht öffnen, wird auf Home umgeleitet. Bewusst? Asymmetrisch zu `requireRole` (exakter Match).
- `authMiddleware` macht pro Request einen DB-Roundtrip (`userService.getUserById`, `authMiddleware.ts:62`) — Performance/Kopplung, kein Funktionsbruch.

### Workflow: 2 Katalog – Produktliste / Detail / Bild-URL
Status: ✅ vollständig

Hop-Kette:
- Hop 1 (Liste): `ProductListPage`/`ManageProducts` dispatch `fetchProducts` → `productService.getProducts` GET `/products` — `frontend/src/services/productService.ts:17-20`, `frontend/src/store/slices/productSlice.ts:44-53`
- Hop 2: Route → `productController.getAllProducts` → `productService.getAllProducts(query)` — `productRoutes.ts:51`, `productController.ts:10-13`, `services/productService.ts:161-245`
- Hop 3: Service joint `product_sizes`/`sizes`, `product_images`, `product_tags`/`tags`, setzt primary `imageUrl` — `services/productService.ts:189-242`
- Hop 4 (Detail): `ProductDetailPage` → `productService.getProduct(id)` GET `/products/:id` — `frontend/src/pages/Shop/ProductDetailPage.tsx:31`, `services/productService.ts:22-25`
- Hop 5: Route → `getProductById` → `productService.getProductById` (sizes/images/tags) — `productRoutes.ts:70`, `services/productService.ts:323-370`
- Hop 6: DB-Tabellen vorhanden (`products`,`product_sizes`,`sizes`,`product_images`,`tags`,`product_tags`) — `backend/migrations/202512091000_init_schema.ts:46-188`
- Hop 7: Bild-URL-Auflösung: relativer Pfad `/uploads/...` → `BACKEND_BASE_URL + path` (BASE = API_BASE_URL minus `/api/v1`/`/api`) — `frontend/src/utils/imageUrl.ts:8-23`
- Hop 8: Backend serviert `/uploads` statisch via `aiUploadsRouter` (express.static auf `backend/uploads`) — `backend/src/gateway/app.ts:28`, `backend/src/services/ai/app.ts:6-11`

Lücken/Brüche: keine. Hinweis: Produktbild-Upload-URLs `/uploads/products/<id>/...` (`productController.ts:53-56`) werden vom selben statischen Router erfasst — passt.

### Workflow: 3 Warenkorb → Checkout → Bestellung
Status: ⚠️ teilweise/Lücke (Persistenz fehlt; Redirect ins Leere; INSUFFICIENT_STOCK als HTTP 200)

Hop-Kette:
- Hop 1: `ProductDetailPage.handleAddToCart` dispatch `addToCart` — `frontend/src/pages/Shop/ProductDetailPage.tsx:64-91`
- Hop 2: `cartSlice.addToCart` legt Item in Redux (nur In-Memory) — `frontend/src/store/slices/cartSlice.ts:16-24`
- Hop 3: `CheckoutPage.handlePlaceOrder` baut Payload `{name,email,address,items[]}` → dispatch `placeOrder` — `frontend/src/pages/Cart/CheckoutPage.tsx:114-141`
- Hop 4: `placeOrder`-Thunk → `orderService.placeOrder` POST `/orders` — `frontend/src/store/slices/orderSlice.ts:33-37`, `frontend/src/services/orderService.ts:41-63`
- Hop 5: Route (geschützt via `authMiddleware`) → `orderController.createOrder(req.body, req.user)` — `orderRoutes.ts:8,111`, `orderController.ts:34-38`
- Hop 6: `orderService.createOrder`: Validierung, Status default `'Bestellt'`, Transaktion: Order-Insert, Pricing-Map, Aggregation, `reserveStock` (forUpdate + decrement), order_items-Insert, Bestätigungs-Mail — `backend/src/services/orderService.ts:293-439`
- Hop 7: `reserveStock` sperrt `product_sizes` mit `forUpdate`, wirft `InsufficientStockError` bei Unterdeckung — `services/productService.ts:283-309`
- Hop 8 (Erfolg): Order zurück → Slice `placeOrder.fulfilled` pusht in `state.order.items`; Checkout `clearCart()` + `navigate('/order-confirmation')` — `orderSlice.ts:121-123`, `CheckoutPage.tsx:142-143`
- Hop 9 (Fehler): `InsufficientStockError` → errorHandler antwortet mit `err.status` (=200) + `{code:'INSUFFICIENT_STOCK',...}` — `backend/src/middlewares/errorHandler.ts:35-51`, `backend/src/errors/InsufficientStockError.ts:21-25`
- Hop 10: `orderService.placeOrder` erkennt 200-Body mit `code==='INSUFFICIENT_STOCK'`, wirft synthetischen Error (`status=200`) — `frontend/src/services/orderService.ts:44-59`
- Hop 11: Thunk/`CheckoutPage` werten `code`/`details` aus, markieren betroffene Items — `orderSlice.ts:40-47`, `CheckoutPage.tsx:144-184`

Lücken/Brüche:
- `frontend/src/store/slices/cartSlice.ts` + `frontend/src/type/cart.ts:25-27`: KEINE localStorage-Persistenz und kein Persist-Middleware in `store/index.ts` → Warenkorb nach Reload leer (deckt CLAUDE.md P2-9).
- `frontend/src/pages/Cart/CheckoutPage.tsx:143`: Redirect auf `/order-confirmation`, aber in `frontend/src/App.tsx` existiert KEINE Route dafür (`ROUTES.ORDER_CONFIRMATION` ist nur Konstante, `constants.ts:17`) → `*`-Fallback leitet auf HOME um. Nutzer sieht keine Bestätigungsseite. (Bekannt: CLAUDE.md (B).6.)
- `backend/src/errors/InsufficientStockError.ts:21-23`: HTTP-Status bewusst 200 für fachlichen Fehler. Fragwürdig (eher 409). Front+Back tragen diese Sonderbehandlung über mehrere Schichten (`orderService.ts:44-59`, `orderSlice.ts:40-47`, `CheckoutPage.tsx:65-82,150-164`) = hohe Kopplung/Komplexität. (CLAUDE.md P3-13.)
- Feld-Mismatch (kosmetisch, kein Bruch): `PlaceOrderPayload` enthält `name/email/address` (`frontend/src/type/order.ts:25-35`), aber `orderService.createOrder` ignoriert diese — Empfänger/Adresse kommen aus dem eingeloggten User (`orderService.ts:346,408`). Die Checkout-Eingabefelder Name/E-Mail/Adresse sind funktional wirkungslos.
- Typ-Import-Mismatch (wahrscheinlicher TS-Fehler): `CheckoutPage.tsx:13` importiert `PlaceOrderPayload` aus `@/services/orderService`, dort aber NICHT exportiert (kommt aus `@/type/order`). Deckt sich mit den bekannten 4 Typecheck-Fehlern (CLAUDE.md P2-21).

### Workflow: 3b Order-Nebenflüsse (eigene Orders, Cancel, Admin-Status/Delete)
Status: ✅ vollständig

Hop-Kette:
- `getMyOrders` GET `/orders/me` → `orderService.getOrdersByUser` (OrderSummary) — `frontend/src/services/orderService.ts:23-26`, `orderRoutes.ts:42`, `orderController.ts:47-51`, `orderService.ts:577-617`
- `cancelMyOrder` POST `/orders/me/:id/cancel` → nur Status `'Bestellt'` stornierbar, Restock, 409 sonst — `orderService.ts:538-575`, `orderRoutes.ts:65`
- `getOrderById` GET `/orders/:id` → Ownership/Admin-Check — `orderService.ts:250-290`
- `updateOrderStatus` PUT `/orders/:id/status` (admin) → `assertOrderStatus` gegen `['Bestellt','Bezahlt','Storniert']`, Restock bei Storno — `orderService.ts:466-535`, `orderRoutes.ts:139`

Lücken/Brüche:
- Status-Strings sind deutsch (`'Bestellt'|'Bezahlt'|'Storniert'`) und als Magic Strings über Migration (`init_schema.ts:94`), Service (`orderService.ts:10-12`) und Frontend (ManageOrders) verteilt — keine zentrale Enum. Mismatch-Risiko (CLAUDE.md 5.2).

### Workflow: 4a Admin – Produkt-CRUD + Bild-Upload (multer)
Status: ✅ vollständig

Hop-Kette:
- Hop 1: `ManageProducts.saveProduct` → dispatch `addProduct`/`updateProduct`, danach `uploadProductImages` — `frontend/src/pages/Admin/Product/ManageProducts.tsx:313-333`
- Hop 2: `productService.addProduct` POST `/products`, `updateProduct` PUT `/products/:id` — `frontend/src/services/productService.ts:27-35`
- Hop 3: Routen geschützt (`authMiddleware`+`requireRole('admin')`) → Controller → `productService.create/update` (sizes/tags via setSizes/setTags) — `productRoutes.ts:93-131`, `productController.ts:20-31`, `services/productService.ts:372-442`
- Hop 4: Bild-Upload: `productService.uploadProductImages(id,files)` POST `/products/:id/images` (multipart) — `frontend/src/services/productService.ts:46-55`
- Hop 5: multer diskStorage nach `uploads/products/<id>/`, `upload.array('images',10)` — `productRoutes.ts:13-36,193-199`
- Hop 6: `uploadProductImages`-Controller baut `/uploads/products/<id>/<file>`-URLs → `addImagesToProduct` — `productController.ts:39-61`, `services/productService.ts:445-494`
- Hop 7: `deleteProduct` DELETE `/products/:id` → Transaktion löscht images/sizes/tags/product + Verzeichnis (hard delete) — `services/productService.ts:554-578`

Lücken/Brüche:
- Hard-Delete statt geplantem Soft-Delete (`is_active`/`deleted_at`, CLAUDE.md Entscheidung 8); FK `order_items.product_id = RESTRICT` (`init_schema.ts:116`) lässt das Löschen referenzierter Produkte fehlschlagen → 500 statt sauberer Meldung. Architektur/Lücke.

### Workflow: 4b Admin – Bestellverwaltung & Nutzerverwaltung
Status: ⚠️ teilweise/Lücke (USER_DETAIL-Route ohne Seite)

Hop-Kette (User):
- Hop 1: `ManageUsers` dispatch `fetchUsers` → `userService.getAll` GET `/users` — `frontend/src/pages/Admin/User/ManageUsers.tsx:29-31`, `frontend/src/services/userService.ts:29-32`
- Hop 2: Route (`authMiddleware` global + `requireRole('admin')`) → `getAllUsers` — `userRoutes.ts:30,146`, `userController.ts:8-11`
- Hop 3: Rollenwechsel `onRoleChange` → `updateUserById` PUT `/users/:id` — `ManageUsers.tsx:33-40`, `userSlice.ts:39-54`
- Hop 4: Route PUT `/:id` (`requireRole('admin')`) → `updateUserById`-Controller → `userService.updateUser` — `userRoutes.ts:216`, `userController.ts:118-129`
- Hop 5: Löschen `deleteUser(id)` DELETE `/users/:id` (Route prüft Admin-oder-Self) — `ManageUsers.tsx:42-46`, `userSlice.ts:57-65`, `userRoutes.ts:241-255`

Lücken/Brüche:
- `ROUTES.USER_DETAIL = '/admin/users/:id'` (`constants.ts:22`) hat KEINE Route in `App.tsx` und keine Seite → nicht gebautes Feature (CLAUDE.md (B).6). Kein Dead Code, aber Workflow läuft ins Leere, falls referenziert.
- Admin-Bestellverwaltung (`ManageOrders`) nutzt `orderSlice.fetchOrders`/`updateOrderStatus`/`deleteOrder` (GET/PUT/DELETE `/orders*`) — Pfad vorhanden (Workflow 3b). (ManageOrders.tsx nicht im Detail gelesen, Slice+Routen bestätigt.)

### Workflow: 5 KI-Produkt-Pipeline (Hauptfokus)
Status: ✅ vollständig (Real- und Mock-Pfad), mit Konfig-Risiken

Hop-Kette (Real-Modus, `AI_PRODUCT_AI_USE_REAL_SERVICE=true`):
- Hop 1: `ManageProducts.openNew` → `ProductAiDialog`; `onContinue` dispatch `createProductAiJob({price,files})` — `ManageProducts.tsx:177-207`, `ProductAiDialog.tsx:97-103`
- Hop 2: `productService.createProductAiJob` baut FormData (`price`, `images[]`) POST `/ai/product-job` — `frontend/src/services/productService.ts:70-80`
- Hop 3: Route (`authMiddleware`+`requireRole('admin')`+multer `uploads/ai/product-jobs`) → `createProductAiJob`-Controller — `aiRoutes.ts:13-30,67-73`, `productAiController.ts:8-33`
- Hop 4: `productAiService.createProductAiJob`: relative `/uploads/...`-Pfade, Insert `product_ai_jobs` (PENDING), `safeEmit('aiJob:updated')`, Job zurück (201) — `productAiService.ts:175-216`, Controller 201 — `productAiController.ts:21-28`
- Hop 5: Controller startet asynchron `processProductAiJob(job.id)` (fire-and-forget) — `productAiController.ts:24-28`
- Hop 6: `processProductAiJobImpl`: Status→PROCESSING, `safeEmit('aiJob:updated')`, baut öffentliche URLs `${APP_URL||http://localhost:3000}/<relpath>` — `productAiService.ts:277-316`
- Hop 7: `analyzeProductViaPython({jobId,price,imageUrls})` → POST `${AI_PY_SERVICE_URL}/analyze-product` mit `{jobId, price:{amount}, images:[{kind:'url',value}]}`, Timeout `AI_PY_TIMEOUT_MS` (150000) — `aiPythonClient.ts:11-44`
- Hop 8: FastAPI `POST /analyze-product` (Pydantic `AnalyzeProductRequest`, camelCase-Aliase via `validate_by_name`) → `analyze` → `run_pipeline` — `python_ai_service/app/main.py:98-130`, `services/jobs.py:7-8`
- Hop 9: Pipeline lädt Bilder per URL (`requests.get`) → CLIP-Tags → Merge → BLIP-Captions → Qwen-LLM (title/description) → Response — `pipeline/orchestrator.py:119-368`, `pipeline/image_loader.py:45-56,86-89`
- Hop 10: Backend validiert `title`/`description` (2–4 Sätze), normalisiert Tags, Update `product_ai_jobs` (SUCCESS), `safeEmit('aiJob:completed')`; bei Fehler FAILED + `aiJob:completed` — `productAiService.ts:318-371`
- Hop 11: Frontend Socket-Listener `aiJob:updated`/`aiJob:completed` → Queue-Upsert — `ManageProducts.tsx:136-171`
- Hop 12: Admin „Fertigstellen" (nur bei SUCCESS) → `handleCompleteFromAi` füllt `editingProduct` (name/desc/tags/price), rehydratet Files aus `image_paths` (fetch) — `ManageProducts.tsx:228-253,209-226`
- Hop 13: `ProductDialog` „Speichern" → `addProduct` + `uploadProductImages`, dann `deleteProductAiJob(completingJobId)` — `ManageProducts.tsx:313-348`

Mock-Modus (`AI_PRODUCT_AI_USE_REAL_SERVICE=false`):
- `createProductAiJob` schreibt sofort SUCCESS mit Mock-Texten, `safeEmit('aiJob:completed')`, kein Python-Aufruf — `productAiService.ts:218-242`; Controller antwortet 201 ohne `processProductAiJob` — `productAiController.ts:31-32`. Retry ist im Mock-Modus blockiert (`AI_REAL_SERVICE_REQUIRED`) — `productAiController.ts:36-44`.

Lücken/Brüche / Risiken:
- Öffentliche Bild-URLs hängen an `APP_URL` (Default `http://localhost:3000`, `productAiService.ts:307`). Der Python-Service MUSS diese URL erreichen. Im Docker-Stack ist `AI_PY_SERVICE_URL=http://python-ai-service:8000`, aber `APP_URL` muss dann auf den per-Service erreichbaren Backend-Host zeigen (z.B. `http://backend:3000`) — sonst lädt der Python-Container die Bilder von `localhost:8000`/`localhost:3000` (= sich selbst) und schlägt mit `INVALID_IMAGE` fehl. Konfig-Bruchgefahr (nicht im Code abgesichert).
- `processProductAiJob` ist fire-and-forget ohne Persistenz/Queue: Bei Backend-Neustart während PROCESSING bleibt der Job auf PROCESSING hängen (kein Resume). `getOpenProductAiJobs` listet PROCESSING zwar wieder (`productAiService.ts:378-385`), aber niemand setzt ihn fort.
- `validateAiCopyOutput` erzwingt 2–4 Sätze über Punkt-Splitting (`productAiService.ts:84-87`) — bei deutschem Output mit Abkürzungen/Zahlen (`z.B.`, `19,99 €.`) fehleranfällig → unnötige FAILED-Jobs (relevant da Entscheidung 2 = deutscher Output).
- `run_pipeline` wirft `INVALID_INPUT`, wenn `settings.ENABLE_CPU_FALLBACK` TRUE ist (`orchestrator.py:120-126`) — invertierte/irritierende Semantik; für CPU-only-Prod (Entscheidung 4) muss diese Flag-Bedeutung geprüft werden.
- `ProductDialog` „Fertigstellen": die im Job gespeicherten Bilder werden per `fetch` rehydriert und dann als NEUE Produktbilder hochgeladen (`ManageProducts.tsx:209-226,331-333`) — funktioniert, aber doppelte Speicherung (AI-Upload + Produkt-Upload).

### Workflow: 6 WebSocket allgemein (getIO/Broadcast, CORS, Frontend-Verbindung)
Status: ⚠️ teilweise/Lücke (CORS hartkodiert, keine Socket-Auth)

Hop-Kette:
- Hop 1: `index.ts` erstellt HTTP-Server, `initWebsocket(server)` — `backend/src/index.ts:46-49`
- Hop 2: `initWebsocket` setzt Socket.IO mit CORS `origin:'http://localhost:3001'`, Connection-Logging — `backend/src/middlewares/websocket.ts:7-27`
- Hop 3: `getIO()` liefert Singleton für Broadcasts — `backend/src/middlewares/websocket.ts:29-36`
- Hop 4: `productAiService.safeEmit` → `getIO().emit('aiJob:updated'|'aiJob:completed', payload)` — `productAiService.ts:97-104`
- Hop 5: Frontend `getSocket()` verbindet zu `VITE_API_WS_URL||VITE_API_BASE_URL||http://localhost:3000`, `withCredentials:true` — `frontend/src/services/socket.ts:11-29`
- Hop 6: `ManageProducts` registriert `aiJob:updated`/`aiJob:completed` Listener — `ManageProducts.tsx:164-170`

Lücken/Brüche:
- `backend/src/middlewares/websocket.ts:10`: CORS-`origin` ist hart `'http://localhost:3001'` statt `APP_ORIGIN` → bricht außerhalb localhost (CLAUDE.md P2-5).
- Keine Socket-Authentifizierung: Es wird KEIN Token an den Socket übergeben (`socket.ts:15-17` setzt nur `withCredentials`), und der Server prüft keine Identität (`websocket.ts:16-22`). `aiJob:*`-Events werden an ALLE verbundenen Clients gebroadcastet (`io.emit`, `productAiService.ts:100`) — KI-Ergebnisdaten (Titel/Beschreibung/Tags) leaken an jeden Socket-Client. Sicherheits-/Architektur-Lücke.
- `VITE_API_WS_URL`/`VITE_API_BASE_URL` werden für die Socket-Basis genutzt; `VITE_API_BASE_URL` ist aber typischerweise die `/api/v1`-REST-URL (`frontend/src/contracts/index.ts:7-8`). Falls gesetzt, verbindet sich Socket.IO ggf. auf einen Pfad mit `/api/v1`-Suffix → potenzieller Verbindungsfehler. Konfig-Risiko.

---

## Workflow-Befunde

### F: Bestellbestätigung läuft ins Leere (`/order-confirmation` ohne Route)
- Kategorie: Fehlende Funktion/Lücke
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: `frontend/src/pages/Cart/CheckoutPage.tsx:143`; fehlende Route in `frontend/src/App.tsx:56-82`; Konstante `frontend/src/utils/constants.ts:17`
- Auswirkung: Nach erfolgreicher Bestellung wird der Warenkorb geleert und auf `/order-confirmation` navigiert; mangels Route greift der `*`-Fallback → Redirect auf HOME. Der Nutzer erhält keine Bestätigungsansicht. Empfehlung: Order-Confirmation-Seite bauen (CLAUDE.md (B).6) und Route registrieren. Aufwand: M

### F: Warenkorb nicht persistent
- Kategorie: UX/Frontend
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: `frontend/src/store/slices/cartSlice.ts:1-65`, `frontend/src/type/cart.ts:25-27`, `frontend/src/store/index.ts:13-21`
- Auswirkung: Reload leert den Warenkorb (kein localStorage / Persist-Middleware). Empfehlung: Persistenz (localStorage-Sync oder redux-persist). Aufwand: S

### F: KI-Ergebnisse werden ungeschützt an alle Socket-Clients gebroadcastet
- Kategorie: Sicherheit
- Schweregrad: Hoch
- Konfidenz: Bestätigt
- Ort: `backend/src/services/productAiService.ts:97-104` (`io.emit`), `backend/src/middlewares/websocket.ts:7-27` (keine Auth), `frontend/src/services/socket.ts:15-17` (kein Token)
- Auswirkung: Jeder verbundene WebSocket-Client (auch unauthentifiziert) empfängt `aiJob:updated`/`aiJob:completed` inkl. Job-Daten. Empfehlung: Socket-Handshake authentifizieren (JWT im `auth`-Payload), nur an Admins/Räume emitten. Aufwand: M

### F: WebSocket-CORS hartkodiert auf localhost:3001
- Kategorie: Konfiguration/Env
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: `backend/src/middlewares/websocket.ts:10`
- Auswirkung: Socket-Verbindung bricht außerhalb localhost (Prod). Empfehlung: `APP_ORIGIN` (analog `app.ts:14-29`) verwenden. Aufwand: S

### F: Öffentliche Bild-URLs für Python-Service hängen an APP_URL (Docker-Erreichbarkeit)
- Kategorie: Konfiguration/Env
- Schweregrad: Hoch
- Konfidenz: Wahrscheinlich
- Ort: `backend/src/services/productAiService.ts:307-316`, Konsum `python_ai_service/app/services/pipeline/image_loader.py:45-56`
- Auswirkung: Der Python-Container lädt die Bilder per HTTP von `APP_URL`. Default `http://localhost:3000` ist aus dem Python-Container NICHT das Backend. Wenn `APP_URL` im Docker-Stack nicht auf den service-internen Backend-Host (z.B. `http://backend:3000`) gesetzt ist, schlagen alle Real-Jobs mit `INVALID_IMAGE` fehl. Empfehlung: `APP_URL` im `infra/backend.env` dokumentieren/erzwingen; alternativ Bilder als `base64`/`path` statt `url` übergeben. Aufwand: S

### F: INSUFFICIENT_STOCK als HTTP 200 (schichtenübergreifende Sonderbehandlung)
- Kategorie: Korrektheit / Architektur-Kopplung
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: `backend/src/errors/InsufficientStockError.ts:21-25`, `backend/src/middlewares/errorHandler.ts:35-51`, `frontend/src/services/orderService.ts:44-59`, `frontend/src/store/slices/orderSlice.ts:40-47`, `frontend/src/pages/Cart/CheckoutPage.tsx:65-82,150-164`
- Auswirkung: Fachlicher Fehler kommt als 200 zurück; Front+Back müssen den Body-Code manuell auf Erfolg/Fehler unterscheiden — fehleranfällig, hohe Kopplung. Empfehlung: 409 Conflict + einheitliche Fehlerauswertung. Aufwand: M

### F: Checkout-Adressfelder (Name/E-Mail/Adresse) sind wirkungslos
- Kategorie: Korrektheit / UX
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `frontend/src/pages/Cart/CheckoutPage.tsx:124-134,258-279`, `backend/src/services/orderService.ts:346,408-418`
- Auswirkung: `PlaceOrderPayload.name/email/address` werden vom Backend ignoriert; Empfänger/Mail kommen aus dem eingeloggten User. Eingaben suggerieren eine Wirkung, die nicht existiert. Empfehlung: Felder entfernen oder serverseitig als abweichende Liefer-/Rechnungsdaten verarbeiten. Aufwand: S

### F: `PlaceOrderPayload` aus falschem Modul importiert (Typecheck-Fehler)
- Kategorie: Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Wahrscheinlich
- Ort: `frontend/src/pages/Cart/CheckoutPage.tsx:13` (Import aus `@/services/orderService`), Definition `frontend/src/type/order.ts:25`, Export fehlt in `frontend/src/services/orderService.ts`
- Auswirkung: `vite build` (esbuild) übersieht es, `tsc --noEmit` meldet Fehler (deckt sich mit CLAUDE.md P2-21, 4 vorbestehende Typfehler). Empfehlung: Import auf `@/type/order` korrigieren. Aufwand: S

### F: Email-Verifizierungslink prod-untauglich + keine Frontend-Verify-Seite
- Kategorie: Konfiguration/Env + Fehlende Funktion
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: `backend/src/services/authService.ts:91-92,215-216`, `backend/src/controllers/authController.ts:206-220`, fehlende Route in `frontend/src/App.tsx`
- Auswirkung: Verify-Link = `APP_ORIGIN + /api/auth/verify`. In Dev nur über Vite-Proxy ok; in Prod muss `APP_ORIGIN` exakt die Domain mit `/api`→Backend-Routing sein. Ohne `redirect`-Query landet der Nutzer auf einer Backend-JSON-Antwort statt einer Bestätigungsseite. Empfehlung: dedizierte Frontend-Verify-Seite + redirect-Parameter konsequent setzen; `APP_URL`/`APP_ORIGIN` für Prod dokumentieren. Aufwand: M

### F: KI-Job-Verarbeitung fire-and-forget, kein Resume nach Neustart
- Kategorie: Architektur/Korrektheit
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: `backend/src/controllers/productAiController.ts:24-28`, `backend/src/services/productAiService.ts:277-376`
- Auswirkung: `processProductAiJob` läuft ohne Queue/Persistenz im selben Prozess. Backend-Crash/Restart während PROCESSING → Job hängt dauerhaft auf PROCESSING (kein automatischer Wiederaufnahme-Mechanismus; nur manuelles Retry, das im Mock-Modus zudem blockiert ist). Empfehlung: beim Startup hängende PROCESSING-Jobs auf FAILED/PENDING zurücksetzen oder echte Queue. Aufwand: M

### F: AI-Output-Validierung (2–4 Sätze per Punkt-Split) zerbricht bei deutschem Text
- Kategorie: Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Wahrscheinlich
- Ort: `backend/src/services/productAiService.ts:77-92,319-335`
- Auswirkung: `description.split('.')` zählt Abkürzungen/Dezimalzahlen als Satzenden → valide Beschreibungen fallen durch (FAILED), besonders relevant bei deutschem Output (Entscheidung 2). Empfehlung: robustere Satzzählung oder Validierung lockern. Aufwand: S

### F: Hard-Delete von Produkten kollidiert mit order_items RESTRICT
- Kategorie: Korrektheit/Architektur
- Schweregrad: Mittel
- Konfidenz: Wahrscheinlich
- Ort: `backend/src/services/productService.ts:554-578`, FK `backend/migrations/202512091000_init_schema.ts:110-116`
- Auswirkung: `deleteProduct` löscht hart; ist das Produkt in `order_items` referenziert (RESTRICT), schlägt die Transaktion fehl → generischer 500 statt sauberer Meldung. Soft-Delete (Entscheidung 8) nicht umgesetzt. Empfehlung: Soft-Delete (`is_active`/`deleted_at`). Aufwand: M

### F: Toter/duplizierter Refresh-Pfad + keine Refresh-Token-Rotation
- Kategorie: Architektur/Sicherheit
- Schweregrad: Niedrig
- Konfidenz: Wahrscheinlich
- Ort: `frontend/src/store/slices/authSlice.ts:117-135` (ungenutzter Thunk), `frontend/src/services/api.ts:82-95` (genutzter Pfad), `backend/src/services/authService.ts:138-164` / `backend/src/controllers/authController.ts:174`
- Auswirkung: Zwei Refresh-Implementierungen; `refreshAccessToken`-Thunk wird nirgends aufgerufen. Serverseitig keine Rotation/Invalidierung des Refresh-Tokens beim Refresh. Empfehlung: einen Pfad behalten; optional Rotation. Aufwand: S

### F: `requireUser` sperrt Admins aus Kundenbereich aus
- Kategorie: UX/Frontend
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `frontend/src/App.tsx:42-50`
- Auswirkung: Admin (role!=='customer') wird von `/user/*` auf HOME umgeleitet. Falls beabsichtigt: ok; sonst Guard auf „eingeloggt" lockern. Aufwand: S

### F: `resendVerification`-Route ohne Frontend-Aufrufer
- Kategorie: Fehlende Funktion/Lücke
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `backend/src/routes/authRoutes.ts:99`, `backend/src/controllers/authController.ts:223-233`; kein Aufruf in `frontend/src/services/*`
- Auswirkung: Backend bietet erneuten Versand, das Frontend nutzt ihn nicht (kein „E-Mail erneut senden"-UI). Empfehlung: UI ergänzen oder Route als bewusst-API markieren. Aufwand: S
