# Frontend Audit – TvWallauShop
> Stand: 2026-06-03 | Auditor: Claude Code (Sonnet 4.6)
> Scope: READ-ONLY. Alle Befunde belegt mit datei:zeile aus tatsächlich gelesen Code.

---

## Coverage-Tabelle

| Datei | gelesen | Verantwortung | PrimeReact? | Auffälliges |
|---|---|---|---|---|
| frontend/package.json | ja | Abhängigkeiten, Scripts | ja (dep) | `jwt-decode` nie importiert; paketname `verein-shop-frontend` weicht ab |
| frontend/project.json | ja | Nx-Targets | nein | build ruft `vite build` (kein tsc); kein typecheck-Target |
| frontend/tsconfig.json | ja | TS-Konfiguration | nein | `strict: true`; `moduleResolution: Node` (veraltet, aber funktional) |
| frontend/vite.config.ts | ja | Build/Dev-Server | nein | `open: true` – öffnet Browser bei jedem Start |
| frontend/vite-env.d.ts | ja | Env-Typen | nein | Deklariert nur `VITE_API_BASE_URL`; `VITE_API_ORIGIN` und `VITE_API_WS_URL` fehlen → kein TS-Fehler wegen `import.meta.env.*` Loose Typing |
| frontend/tailwind.config.ts | ja | Design-Tokens | nein | `preflight: false` korrekt; Farben per var() korrekt; keine Dark-Mode-Unterstützung |
| frontend/postcss.config.js | ja | CSS-Processing | nein | Standard; ok |
| frontend/components.json | ja | shadcn-Config | nein | Korrekt; baseColor: slate |
| frontend/index.html | ja | HTML-Shell | nein | `lang="de"` korrekt; title "Vereins-Shop" ok |
| frontend/Dockerfile | ja | Docker-Build | nein | nginx ohne SPA-Fallback (`try_files`) – direkte URL-Aufrufe liefern 404 |
| frontend/README.md | ja | Dokumentation | nein | Vollständig; ok |
| src/main.tsx | ja | App-Bootstrap | nein | Korrekt; Inter-Font + beide CSS-Dateien importiert |
| src/App.tsx | ja | Routing, Guards | ja (Toast) | `requireUser` blockiert Admin; `requireAdmin` blockiert customer – korrekt; Checkout/Cart öffentlich |
| src/index.css | ja | Globale Styles | ja | PrimeReact-Imports; `body { font-family: 'Segoe UI' }` widerspricht Inter-Ziel |
| src/styles/globals.css | ja | Tailwind + Tokens | nein | Design-Tokens korrekt; `.tw-scope` als Scope-Wrapper |
| src/lib/utils.ts | ja | cn-Utility | nein | Standard shadcn-cn; ok |
| src/services/api.ts | ja | Axios-Instance, Interceptors | nein | Token-Refresh + Request-Queue korrekt implementiert |
| src/services/authService.ts | ja | Auth-API | nein | Kommentiertes `console.log` (Z.18) |
| src/services/orderService.ts | ja | Order-API | nein | `any`-Cast (Z.45); HTTP-200-Business-Error-Handling |
| src/services/productService.ts | ja | Product/AI-API | nein | Sauber; ok |
| src/services/userService.ts | ja | User-API | nein | `console.log(updates)` (Z.14) in Produktion |
| src/services/socket.ts | ja | WebSocket | nein | 2× `console.log` (Z.20, Z.24); `VITE_API_WS_URL` nicht in vite-env.d.ts |
| src/store/index.ts | ja | Redux-Store | nein | Korrekt |
| src/store/slices/authSlice.ts | ja | Auth-State | nein | localStorage-Persistenz für accessToken + user; korrekt |
| src/store/slices/cartSlice.ts | ja | Warenkorb-State | nein | **KEIN localStorage** – Warenkorb nach Reload leer (bekanntes P2-9) |
| src/store/slices/orderSlice.ts | ja | Order-State | nein | `as any`-Casts (Z.101, Z.107); `fetchOrders.rejected` nutzt `action.error.message` statt `rejectValue` |
| src/store/slices/productSlice.ts | ja | Produkt-State | nein | `selectCurrentProductAiJob` und `resetProductError` nirgends importiert → toter Export |
| src/store/slices/userSlice.ts | ja | User-State | nein | 2× `console.log` (Z.102, Z.106); `fetchUser/fetchUsers/updateUser/updateUserById` typisiert als `any`; `clearUser` nirgends importiert |
| src/utils/constants.ts | ja | Konstanten | nein | `STORAGE_KEYS`, `UI`, `AVAILABLE_SIZES`, `CURRENCY` nirgends verwendet; `API_BASE_URL` re-export redundant |
| src/utils/error.ts | ja | Fehler-Hilfsfunktionen | nein | Sauber |
| src/utils/helpers.ts | ja | mapApiUserToUser | nein | `raw: any` Parameter; `preferredPayment as any` (Z.49) |
| src/utils/imageUrl.ts | ja | Bild-URL | nein | Korrekt; BACKEND_BASE_URL-Ableitung clever |
| src/utils/useDebouncedValue.ts | ja | Debounce-Hook | nein | Sauber |
| src/type/cart.ts | ja | CartItem-Typ | nein | `productId?: number` ist optional – könnte undefined sein |
| src/type/order.ts | ja | Order-Typen | nein | Korrekt |
| src/type/product.ts | ja | Produkt-Typen | nein | Korrekt |
| src/type/user.ts | ja | User-Typen | nein | Korrekt |
| src/contracts/index.ts | ja | API-URL-Konstanten | nein | `VITE_API_ORIGIN` im Code aber nicht in vite-env.d.ts |
| src/components/Header/Header.tsx | ja | Navigation | ja | Kein `<nav>`-Element; keine Keyboard-Focus-Indikatoren auf non-button Elementen |
| src/components/Header/Header.module.css | ja | Header-Styles | nein | **Leer** (0 Bytes) |
| src/components/Footer/Footer.tsx | ja | Footer | nein | Links zeigen auf nicht existierende Routen `/impressum`, `/datenschutz` |
| src/components/Footer/Footer.module.css | ja | Footer-Styles | nein | **Leer** (0 Bytes); Footer nutzt globale Klassen aus index.css |
| src/components/ui/button.tsx | ja | shadcn Button | nein | Korrekt; PrimeReact-Koexistenz beachtet |
| src/components/ui/card.tsx | ja | shadcn Card | nein | Korrekt |
| src/components/ui/input.tsx | ja | shadcn Input | nein | Korrekt |
| src/components/ui/label.tsx | ja | shadcn Label | nein | Korrekt |
| src/pages/Shop/ProductListPage.tsx | ja | Produktliste | nein | **Kein Fehler-State angezeigt** trotz `error` im Store |
| src/pages/Shop/ProductGrid.tsx | ja | Produkt-Grid | nein | Korrekt; Tailwind |
| src/pages/Shop/ProductCard.tsx | ja | Produkt-Karte | nein | Korrekt; `format.ts`-Util genutzt |
| src/pages/Shop/ProductDetailPage.tsx | ja | Produktdetail | ja | `console.error` (Z.46); kein Fehler-UI für Ladefehlschlag; viele Inline-Styles; kein `<main>`/semantisches Landmark |
| src/pages/Shop/ProductListToolbar.tsx | ja | Such-/Sort-Toolbar | nein | Korrekt; Tailwind + shadcn; `<label>` fehlt für Input |
| src/pages/Cart/CartPage.tsx | ja | Warenkorb | ja | `productId` aus CartItem könnte undefined sein (Typ) |
| src/pages/Cart/CartPage.css | ja | Cart-Styles | nein | Globales CSS; keine Design-Tokens |
| src/pages/Cart/CheckoutPage.tsx | ja | Checkout | ja | **tsc-Fehler** (Z.13: falscher Import-Pfad für `PlaceOrderPayload`); `console.log/error` in dev-Mode bedingt (Z.138, Z.170); Formvalidierung nur client-seitig; kein Redirect-Guard (Checkout ohne Login möglich) |
| src/pages/Cart/CheckoutPage.css | ja | Checkout-Styles | nein | Globales CSS |
| src/pages/Auth/LoginPage.tsx | ja | Login | nein | Korrekt; shadcn/Tailwind; `required`-Attribut fehlt auf Inputs |
| src/pages/Auth/SignupPage.tsx | ja | Registrierung | ja | **2 tsc-Fehler** (Z.96, Z.99: `PaymentMethod`/`Gender` Union-Type-Konflikt); keine `htmlFor`/`id`-Verknüpfung für Labels und Inputs; sehr langer Signup-Flow |
| src/pages/User/AccountPage.tsx | ja | Konto-Übersicht | ja | `(user as any)?.isAdmin` (Z.34) – Typ-Workaround; Login-Redirect zeigt auf `/login` statt `ROUTES.LOGIN` |
| src/pages/User/ProfilePage.tsx | ja | Profil | ja | `updateUser(payload as any)` (Z.133); `console.error` (Z.147) |
| src/pages/User/SettingsPage.tsx | ja | Einstellungen | ja | `authUser` mit `(s: any)` Selector (Z.31); `ConfirmDialog`-Pattern mit InputText in message (React-State-Race bekannt, Z.136-137) |
| src/pages/User/OrdersPage.tsx | ja | Bestellungen | ja | `console.error` (Z.25, Z.89); `severity as any` (Z.54) |
| src/pages/User/OrderDetailPage.tsx | ja | Bestelldetail | ja | **tsc-Fehler** (Z.77: `OrderSummary.items` vs `Order.items`); `console.error` (Z.31, Z.92); `priceTemplate: (row: any)` |
| src/pages/Admin/AdminDashboard.tsx | ja | Admin-Dashboard | ja | `(action as any).payload` (Z.111); `window.confirm` (Z.93, Z.101, Z.137); lädt alle 3 Stores auf einmal |
| src/pages/Admin/Product/ManageProducts.tsx | ja | Produkt-Verwaltung | ja | **tsc-Fehler** (Z.241: `EditableProduct` id-Pflichtfeld); `console.log/error/warn` (mehrere); `window.confirm/alert` (Z.293, Z.302) |
| src/pages/Admin/Product/ProductDialog.tsx | ja | Produkt-Dialog | ja | `(crypto as any)?.randomUUID` (Z.85); Bilder-`alt=""` (Z.272) |
| src/pages/Admin/Product/ProductAiDialog.tsx | ja | KI-Dialog | ja | `window.alert` (Z.99); kein Label/id auf file-input |
| src/pages/Admin/Ordner/ManageOrders.tsx | ja | Bestell-Verwaltung | ja | Verzeichnis `Ordner/` statt `Orders/`; `filters: any` (Z.127); `mapApiUserToUser` doppelt aufgerufen |
| src/pages/Admin/Ordner/OrderEditDialog.tsx | ja | Bestell-Dialog | ja | `window.confirm` (Z.66) |
| src/pages/Admin/User/ManageUsers.tsx | ja | User-Verwaltung | ja | `window.confirm` (Z.43) |
| src/pages/Admin/User/UserEditDialog.tsx | ja | User-Dialog | ja | `handleFieldChange(field, value: any)` |

---

## Befunde

### F01: Nginx-Dockerfile ohne SPA-Fallback
- Kategorie: Korrektheit
- Schweregrad: Hoch
- Konfidenz: Bestätigt
- Ort: frontend/Dockerfile:16-18
- Auswirkung: Direkter Aufruf jeder Route (z.B. `/admin/products`, `/user/orders`) liefert nginx 404, da nginx kein `try_files $uri /index.html` hat. App funktioniert nur über die Root-URL mit clientseitigem Navigation.
- Empfehlung: Nginx-Config-Datei mit `location / { try_files $uri /index.html; }` erstellen und in Dockerfile kopieren. COPY `nginx.conf /etc/nginx/conf.d/default.conf`.
- Aufwand: S

---

### F02: 4 bestätigte TypeScript-Fehler (tsc --noEmit)
- Kategorie: Typsicherheit
- Schweregrad: Hoch
- Konfidenz: Bestätigt
- Ort:
  - `src/pages/Admin/Product/ManageProducts.tsx:241` – `EditableProduct` verlangt `id` (Pflichtfeld von `Product`); `setEditingProduct({ name, description, price, imageUrl, sizes: [], images: [], tags: [] })` fehlt `id`.
  - `src/pages/Auth/SignupPage.tsx:96` – `preferredPayment` ist `string`, Vertrag erwartet `PaymentMethod | null | undefined`.
  - `src/pages/Auth/SignupPage.tsx:99` – `gender` ist `string`, Vertrag erwartet `Gender | null | undefined`.
  - `src/pages/Cart/CheckoutPage.tsx:13` – `import type { PlaceOrderPayload } from '@/services/orderService'` – `PlaceOrderPayload` ist nicht von `orderService` exportiert, sondern von `@/type/order`. Korrekte Quelle: `import type { PlaceOrderPayload } from '@/type/order'`.
  - `src/pages/User/OrderDetailPage.tsx:77` – `cancelMyOrder` gibt `OrderSummary` zurück; spread auf `Order`-State schlägt fehl weil `OrderSummary.items` (`OrderSummaryItem[]`) inkompatibel mit `Order.items` (`OrderItem[]`).
- Auswirkung: Laufzeitfehler möglich (CheckoutPage, ManageProducts KI-Flow). `vite build` kompiliert trotzdem wegen esbuild, tsc-Fehler bleiben unbemerkt ohne separates Typecheck-Target.
- Empfehlung: (1) Sofort-Fix für CheckoutPage-Import (trivial, 1 Zeile). (2) Weitere drei Fehler bei der jeweiligen Seitenmigration beheben. (3) `tsc --noEmit` als Build/CI-Schritt ergänzen (steht als Backlog-Item in CLAUDE.md).
- Aufwand: S (Fix CheckoutPage), M (Rest bei Migration)

---

### F03: Warenkorb nicht persistent (bekanntes P2-9)
- Kategorie: Korrektheit / UX/Frontend
- Schweregrad: Hoch
- Konfidenz: Bestätigt
- Ort: `src/store/slices/cartSlice.ts:1-64`; `src/type/cart.ts:25-27`
- Auswirkung: `initialState = { items: [] }` – kein localStorage-Load. Nach Browser-Refresh oder Tab-Wechsel ist der Warenkorb leer. `STORAGE_KEYS.CART` ist definiert (`constants.ts:34`) wird aber nirgends verwendet.
- Empfehlung: Beim Slice-Start `localStorage.getItem(STORAGE_KEYS.CART)` lesen; nach jeder Mutation schreiben (Subscriber oder `extraReducers`). Alternativ: Redux Persist.
- Aufwand: S

---

### F04: Checkout ohne Authentifizierungsschutz
- Kategorie: Korrektheit / Sicherheit
- Schweregrad: Hoch
- Konfidenz: Bestätigt
- Ort: `src/App.tsx:61` – `ROUTES.CHECKOUT` ist öffentliche Route (kein Guard)
- Auswirkung: Nicht eingeloggte Nutzer können zur Checkout-Seite navigieren und eine Bestellung absenden. Das Backend prüft zwar Auth, aber das Frontend zeigt keinerlei Hinweis. Bestellung schlägt mit 401 fehl – der Fehlertext ist dann generisch.
- Empfehlung: Checkout hinter `requireUser` stellen (oder zumindest bei leerem `user`-State auf Login umleiten).
- Aufwand: S

---

### F05: requireUser blockiert Admin-Zugriff auf User-Seiten
- Kategorie: Korrektheit
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: `src/App.tsx:42-50` – `requireUser` prüft `user.role !== 'customer'` → Redirect HOME
- Auswirkung: Admin-User können `/user/account`, `/user/profile`, `/user/orders` etc. nicht aufrufen, obwohl diese Seiten keine admin-spezifischen Funktionen enthalten. Admins können ihren eigenen Account nicht verwalten.
- Empfehlung: `requireUser` auf `!user` Redirect ändern (nur auf unauthentifiziert prüfen), oder dedizierte Seiten für Admins anlegen. Alternativ: User-Seiten auch für `admin`-Rolle öffnen.
- Aufwand: S

---

### F06: console.log/error in Produktivcode
- Kategorie: Observability/Logging
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort:
  - `src/services/userService.ts:14` – `console.log(updates)` – **kein dev-Guard**, läuft in Produktion
  - `src/store/slices/userSlice.ts:102,106` – `console.log` – kein Guard
  - `src/services/socket.ts:20,24` – WebSocket connect/disconnect – kein Guard
  - `src/pages/Admin/Product/ManageProducts.tsx:128,155,160,236,279,284,301,340` – diverse `console.*`
  - `src/pages/Shop/ProductDetailPage.tsx:46`, `src/pages/User/OrdersPage.tsx:25,89`, `src/pages/User/OrderDetailPage.tsx:31,92`, `src/pages/User/ProfilePage.tsx:147` – ungegartete Errors
  - `src/pages/Cart/CheckoutPage.tsx:138,170` – mit `import.meta.env.MODE === 'development'` Guard (korrekt)
- Auswirkung: Logs in Produktion (Browser-Konsole), potentiell sensible Daten bei `console.log(updates)` in userService.
- Empfehlung: Entweder alle `console.*` entfernen (Fehler via Error-State/Toast anzeigen) oder durch ein zentrales Logger-Utility ersetzen das in Produktion stumm ist. Mindestens `userService.ts:14` sofort entfernen.
- Aufwand: S

---

### F07: Toter Code – Ungenutzte Selektoren/Actions/Konstanten
- Kategorie: Toter Code/Duplikate
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort:
  - `src/store/slices/cartSlice.ts:63` – `selectCartItems` – exportiert, nirgends importiert
  - `src/store/slices/productSlice.ts:260` – `selectCurrentProductAiJob` – exportiert, nirgends importiert
  - `src/store/slices/productSlice.ts:131,262` – `resetProductError` – exportiert, nirgends importiert
  - `src/store/slices/userSlice.ts:71,155` – `clearUser` – exportiert, nirgends importiert
  - `src/utils/constants.ts:33-36` – `STORAGE_KEYS` – definiert, nirgends genutzt
  - `src/utils/constants.ts:39-43` – `UI` – definiert, nirgends genutzt (nur Kommentar-Abschnitt in ManageProducts)
  - `src/utils/constants.ts:45` – `AVAILABLE_SIZES` – definiert, nirgends genutzt
  - `src/utils/constants.ts:48-52` – `CURRENCY` – definiert, nirgends genutzt
- Auswirkung: Aufgeblähte Bundle-Exporte; können bei Refactoring zu Verwirrung führen.
- Empfehlung: Selektoren und Actions auf tatsächlichen Verwendungsbedarf prüfen; ungenutzte entfernen. Konstanten behalten oder konsolidieren nach Entscheidung (z.B. STORAGE_KEYS für Warenkorb-Persistenz benötigt).
- Aufwand: S

---

### F08: Doppelte named + default Exporte in Admin-Seiten
- Kategorie: Toter Code/Duplikate
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort:
  - `AdminDashboard.tsx:31,335`, `ManageOrders.tsx:31,318`, `OrderEditDialog.tsx:31,145`, `ManageProducts.tsx:52,537`, `ManageUsers.tsx:18,226`
- Auswirkung: Konsumenten können Komponenten über beide Exportformen importieren, was inkonsistente Import-Patterns erzeugt. App.tsx nutzt named exports.
- Empfehlung: Default-Exporte entfernen (nur named behalten), oder umgekehrt. Einheitlich halten.
- Aufwand: S

---

### F09: Fehlende Umgebungsvariablen in vite-env.d.ts
- Kategorie: Typsicherheit / Konfiguration/Env
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `frontend/vite-env.d.ts:1-5`; `src/contracts/index.ts:5`; `src/services/socket.ts:13`
- Auswirkung: `VITE_API_ORIGIN` (contracts/index.ts) und `VITE_API_WS_URL` (socket.ts) sind im Code genutzt aber nicht in `ImportMetaEnv` deklariert. TypeScript akzeptiert `import.meta.env.VITE_*` wegen `any`-artiger env-Typen; kein compile-Fehler, aber keine IDE-Autovervollständigung und kein Tippschutz.
- Empfehlung: Beide Variablen in `vite-env.d.ts` ergänzen.
- Aufwand: S

---

### F10: ProductListPage zeigt Fehler-State nicht an
- Kategorie: UX/Frontend
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: `src/pages/Shop/ProductListPage.tsx:14-46`
- Auswirkung: `error`-State aus `productSlice` wird gelesen nicht (nicht einmal selektiert). Bei fehlgeschlagenem `fetchProducts` sieht der Nutzer eine leere Liste ("Keine Produkte gefunden.") ohne Fehlermeldung.
- Empfehlung: `error` aus Store lesen; bei Fehler eine Fehlermeldung mit Retry-Option anzeigen.
- Aufwand: S

---

### F11: ProductDetailPage – kein Fehler-UI, nur console.error
- Kategorie: UX/Frontend
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: `src/pages/Shop/ProductDetailPage.tsx:44-51`
- Auswirkung: Bei API-Fehler wird `console.error` aufgerufen; UI zeigt nur "Produkt nicht gefunden." – ohne Unterschied zwischen "nicht vorhanden" und "Netzwerkfehler".
- Empfehlung: Separaten `error`-State halten; bei Netzwerkfehler eine sprechende Meldung mit Retry anzeigen.
- Aufwand: S

---

### F12: Fehlende Barrierefreiheit (Labels, alt-Texte, semantische Landmarks)
- Kategorie: Barrierefreiheit
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort:
  - `src/pages/Shop/ProductListToolbar.tsx:25-29` – `<Input>` hat kein `<label>` (nur `placeholder`)
  - `src/pages/Admin/Product/ProductDialog.tsx:272` – `alt=""` auf vorhandenen Produktbildern (nicht dekorativ!)
  - `src/pages/Admin/Product/ProductAiDialog.tsx:139` – `<input type="file">` hat kein `<label>` und kein `aria-label`
  - `src/pages/Auth/SignupPage.tsx:116-274` – `<label>` ohne `htmlFor`, `<InputText>` ohne `id` – keine echte Label-Verknüpfung; bei Screen-Reader unbrauchbar
  - `src/pages/Shop/ProductDetailPage.tsx:198-214` – Thumbnail-`<img>` mit `alt="thumbnail"` (nicht beschreibend; besser `alt={Produktname + ' Bild ' + (i+1)}`)
  - `src/components/Header/Header.tsx` – kein `<nav>`-Element um die Button-Gruppe
  - `src/pages/Shop/ProductDetailPage.tsx:138-157` – Bildkarussell-Pfeile sind `<button>` mit ‹ / › Text-Symbolen ohne `aria-label`
- Auswirkung: Screen-Reader und Keyboard-Navigation stark eingeschränkt; Verstöße gegen WCAG 2.1 AA.
- Empfehlung: Alle Inputs mit `<label htmlFor>` oder `aria-label` versehen; Produktbilder mit beschreibenden alt-Texten; Karussell-Buttons mit `aria-label="Voriges Bild"/"Nächstes Bild"`; Header in `<nav>` wrappen.
- Aufwand: M

---

### F13: SettingsPage – ConfirmDialog mit InputText in message (State-Race)
- Kategorie: Korrektheit / UX/Frontend
- Schweregrad: Mittel
- Konfidenz: Bestätigt
- Ort: `src/pages/User/SettingsPage.tsx:110-155`
- Auswirkung: `confirmDialog({ message: <JSX mit InputText> })` ist ein PrimeReact-Anti-Pattern: Der Dialog rendert React-JSX, aber State-Updates im React-Component (`deleteConfirmText`) sind nicht synchron mit dem Dialog-`accept`-Callback. Der Kommentar auf Z.133-137 benennt das Problem explizit und arbeitet es mit `deleteConfirmText` ref-ähnlichem Trick um. Wenn React und PrimeReact-Dialog außerhalb des React-Baums batchen, kann `deleteConfirmText.trim()` den alten Wert enthalten.
- Empfehlung: ConfirmDialog durch eigenes Modal ersetzen, das korrekt in den React-State integriert ist, oder `deleteConfirmText` als `useRef` führen, der sofort aktualisiert.
- Aufwand: M

---

### F14: AccountPage – fehlerhafter Login-Redirect
- Kategorie: Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `src/pages/User/AccountPage.tsx:49` – `onClick={() => go('/login')}` statt `ROUTES.LOGIN` (`/auth/login`)
- Auswirkung: Der "Zum Login"-Button auf der Konto-Seite navigiert nach `/login` – eine Route, die nicht existiert (Fallback → HOME). Der Nutzer wird auf die Startseite weitergeleitet statt zur Login-Seite.
- Empfehlung: `go('/login')` → `go(ROUTES.LOGIN)`.
- Aufwand: S

---

### F15: window.confirm/alert – Barrierefreiheit und UX
- Kategorie: Barrierefreiheit / UX/Frontend
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `AdminDashboard.tsx:93,101,137`; `ManageProducts.tsx:293,302`; `ProductAiDialog.tsx:99`; `OrderEditDialog.tsx:66`; `ManageUsers.tsx:43`
- Auswirkung: Browsernative Dialoge sind nicht stylingfähig, blockieren den Haupt-Thread, sind auf einigen Mobil-Browsern unterdrückt und nicht keyboard-navigierbar für Screen-Reader. Manche Seiten nutzen bereits `primereact/confirmdialog`; Mischung ist inkonsistent.
- Empfehlung: Einheitlich PrimeReact `confirmDialog` oder shadcn-Dialog verwenden.
- Aufwand: M

---

### F16: Recht/Compliance – Impressum/Datenschutz/AGB/Widerruf fehlen
- Kategorie: Recht/Compliance
- Schweregrad: Hoch
- Konfidenz: Bestätigt
- Ort: `src/components/Footer/Footer.tsx:10-15` – Links auf `/impressum` und `/datenschutz` vorhanden; `src/App.tsx` – keine Route dafür registriert
- Auswirkung: Footer-Links führen ins Leere (Fallback → HOME). Für einen deutschen Verbraucher-Webshop sind Impressum (TMG §5), Datenschutzerklärung (DSGVO Art. 13), AGB und Widerrufsbelehrung (BGB §312g) **gesetzlich Pflicht**. Ohne diese Seiten darf der Shop nicht öffentlich betrieben werden.
- Empfehlung: Seiten und Routen für Impressum, Datenschutz, AGB, Widerrufsbelehrung anlegen. Rechtlichen Text mit Anwalt oder Dienst (z.B. eRecht24) erstellen lassen.
- Aufwand: L (Content, nicht Code)

---

### F17: CSS-Inkonsistenz – gemischte Strategien, keine Design-Tokens in PrimeReact-Seiten
- Kategorie: Architektur/Kopplung
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `src/index.css` (globales Reset + PrimeReact), `src/styles/globals.css` (Tailwind-Tokens), `src/pages/**/*.css` (page-scoped global CSS), `src/pages/Shop/ProductDetailPage.tsx` (massiv Inline-Styles), `src/components/Header/Header.module.css` (leer), `src/components/Footer/Footer.module.css` (leer)
- Auswirkung: Kein einheitliches Erscheinungsbild; Design-Tokens (`--accent`, `--border` etc.) sind nur für Tailwind-Scope nutzbar; PrimeReact-Seiten verwenden Hardcoded-Werte (`#007ad9`, `#ccc`). Migrations-Chaos nimmt mit jeder neuen Seite zu.
- Empfehlung: Gemäß Roadmap C: bei jeder Seitenmigration page-scoped CSS entfernen und Tailwind-Utilities + Design-Tokens verwenden. Leere `.module.css`-Dateien löschen. Inline-Styles in `ProductDetailPage` in der nächsten Migrationswelle entfernen.
- Aufwand: M (fortlaufend bei Migration)

---

### F18: jwt-decode in package.json – nie importiert
- Kategorie: Abhängigkeiten
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `frontend/package.json:35` (in `dependencies`); kein Import in `frontend/src/**`
- Auswirkung: Unnötige Abhängigkeit (Bundelgröße minimal, aber Sicherheits-Update-Last).
- Empfehlung: Aus `dependencies` entfernen.
- Aufwand: S

---

### F19: Typschwäche in userSlice-Thunks
- Kategorie: Typsicherheit
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `src/store/slices/userSlice.ts:12,17,22,39` – `fetchUser: createAsyncThunk<any>`, `fetchUsers: createAsyncThunk<any[]>`, `updateUser: createAsyncThunk<any, Partial<User>>`, `updateUserById: createAsyncThunk<any, { id: number; changes: any }>`
- Auswirkung: Vollständiger Typen-Verlust im Slice; `action.payload` ist überall `any`; keine Compile-Zeit-Sicherheit für Reducer-Transformationen.
- Empfehlung: Konkrete Return-Typen verwenden (z.B. `createAsyncThunk<User>`); `mapApiUserToUser` direkt in Thunk aufrufen.
- Aufwand: M

---

### F20: OrdersPage/OrderDetailPage – direkte API-Aufrufe ohne Redux-Thunk
- Kategorie: Architektur/Kopplung
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `src/pages/User/OrdersPage.tsx:19-35`; `src/pages/User/OrderDetailPage.tsx:23-41`
- Auswirkung: `OrdersPage` und `OrderDetailPage` rufen `orderService` direkt auf und halten State lokal (useState), während Admin-Seiten Redux-Store verwenden. Inkonsistenz; bei paralleler Nutzung von `/admin/orders` und `/user/orders` sind Daten nicht synchron.
- Empfehlung: User-Bestellungen entweder ebenfalls in `orderSlice` (mit eigenem `userOrders`-Feld) oder bewusst lokal halten und dokumentieren.
- Aufwand: M

---

### F21: ManageProducts – Socket-Verbindung nie getrennt bei Component-Unmount
- Kategorie: Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `src/pages/Admin/Product/ManageProducts.tsx:136-171`
- Auswirkung: `useEffect` hängt Listener per `socket.on('aiJob:updated', ...)` an, entfernt sie per `socket.off(...)` im Cleanup. Das ist korrekt für die Listener. Jedoch wird `getSocket()` als Singleton implementiert – die Verbindung selbst bleibt die gesamte App-Laufzeit offen, auch wenn der Admin-Bereich verlassen wird. Dies ist ein bewusstes Design (Singleton), aber es bedeutet, dass Socket-Events (theoretisch) auch empfangen werden könnten, wenn der Listener nicht aktiv ist, wenn ein Event vor dem Re-Mount kommt.
- Empfehlung: In Ordnung für den aktuellen Anwendungsfall. Dokumentieren dass der Socket global ist; bei Wachstum des WS-Nutzung einen Context-Provider in Betracht ziehen.
- Aufwand: S (Doku)

---

### F22: Verzeichnis `Admin/Ordner/` statt `Admin/Orders/`
- Kategorie: DX/Tooling
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `src/pages/Admin/Ordner/ManageOrders.tsx`, `OrderEditDialog.tsx`
- Auswirkung: Inkonsistente Namensgebung (Roadmap B-4); englischsprachige Codebase mit deutschem Verzeichnisnamen.
- Empfehlung: Umbenennen in `Admin/Orders/` bei nächster Überarbeitung.
- Aufwand: S

---

### F23: ProductListToolbar – Select-Komponente ohne shadcn select.tsx definiert
- Kategorie: Konfiguration/Env
- Schweregrad: Info
- Konfidenz: Bestätigt
- Ort: `src/pages/Shop/ProductListToolbar.tsx:3` – `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'`
- Auswirkung: `select.tsx` existiert (`frontend/src/components/ui/select.tsx` per Glob bestätigt), wird aber nicht in der audit-Liste aufgeführt. Tatsächlich nicht gelesen – kein Befund zum Inhalt.
- Empfehlung: In nächster Prüfrunde lesen; shadcn-Select importiert `@radix-ui/react-select` welches in `package.json` vorhanden ist.
- Aufwand: S

---

### F24: orderSlice – fetchOrders.rejected nutzt action.error statt rejectValue
- Kategorie: Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `src/store/slices/orderSlice.ts:92` – `state.error = action.error.message ?? '...'`
- Auswirkung: `fetchOrders` ist ohne `rejectValue` definiert (`createAsyncThunk<Order[]>`); bei Fehlern wird der interne Serialisierungsfehler-String (`action.error.message`) genutzt statt einer benutzerfreundlichen Nachricht. Inkonsistent zu anderen Thunks.
- Empfehlung: `fetchOrders` mit `{ rejectValue: string }` und `rejectWithValue` ausstatten, analog zu `placeOrder`.
- Aufwand: S

---

### F25: ProductDialog – neue Größen erhalten Date.now() als id-Fallback
- Kategorie: Korrektheit
- Schweregrad: Niedrig
- Konfidenz: Bestätigt
- Ort: `src/pages/Admin/Product/ProductDialog.tsx:85` – `id: (crypto as any)?.randomUUID?.() ?? Date.now()`
- Auswirkung: `ProductSize.id` ist laut Contracts ein `number`; `crypto.randomUUID()` gibt einen UUID-String zurück. Damit ist der Typ falsch (uuid statt number), solange der Server keine ID zugewiesen hat. Beim Speichern werden neue Größen sowieso als neue DB-Einträge angelegt; die lokale ID ist temporär. In der Praxis kein Laufzeitfehler, aber TS-unsauber.
- Empfehlung: Neue Größen als separate Liste (ohne id) verwalten oder explizit `-1`/`null` als temporäre id nutzen.
- Aufwand: S

---

## Fähigkeiten (Frontend) – Status

| Fähigkeit/Seite | Status | Beleg |
|---|---|---|
| Login / Logout | ✅ | LoginPage.tsx; authSlice.ts; api.ts Token-Refresh |
| Token-Refresh-Interceptor + Queue | ✅ | api.ts:29-103 |
| Signup / Registrierung | ⚠️ | SignupPage.tsx – 2 tsc-Fehler (Z.96,99); keine label/id-Verknüpfung |
| Produktliste | ✅ | ProductListPage + ProductGrid + ProductCard (Tailwind migriert) |
| Produktsuche (debounced) | ✅ | ProductListPage.tsx:19; useDebouncedValue.ts |
| Produktdetail | ⚠️ | ProductDetailPage.tsx – kein Fehler-State; massive Inline-Styles; PrimeReact |
| In-den-Warenkorb | ✅ | ProductDetailPage.tsx:64-98; cartSlice.ts |
| Warenkorb anzeigen | ✅ | CartPage.tsx |
| Warenkorb persistenz | ❌ | cartSlice.ts – kein localStorage (P2-9) |
| Checkout (Bestellung aufgeben) | ⚠️ | CheckoutPage.tsx – tsc-Fehler Z.13; kein Auth-Guard; console.log |
| INSUFFICIENT_STOCK Handling | ✅ | orderService.ts:41-63; orderSlice.ts:39-47; CheckoutPage.tsx:53-58 |
| Bestellbestätigung | ❌ | ROUTES.ORDER_CONFIRMATION navigiert nach `/order-confirmation`; keine Route/Seite |
| Auth-Guard (Admin) | ✅ | App.tsx:33-40 |
| Auth-Guard (User) | ⚠️ | App.tsx:42-50 – blockiert Admin (F05) |
| Konto-Übersicht (AccountPage) | ⚠️ | AccountPage.tsx – falscher /login-Redirect (F14) |
| Profil bearbeiten | ✅ | ProfilePage.tsx; userSlice updateUser; dirty-check |
| Einstellungen (Passwort/Präferenzen) | ⚠️ | SettingsPage.tsx – ConfirmDialog State-Race (F13) |
| Eigene Bestellungen | ✅ | OrdersPage.tsx – direkter orderService-Call |
| Bestelldetail (User) | ⚠️ | OrderDetailPage.tsx – tsc-Fehler Z.77 |
| Bestellung stornieren (User) | ✅ | OrdersPage+OrderDetailPage; orderService.cancelMyOrder |
| Admin-Dashboard | ✅ | AdminDashboard.tsx – Übersicht aller Bereiche |
| Admin: Produkte verwalten | ✅ | ManageProducts.tsx |
| Admin: KI-Job erstellen | ✅ | ProductAiDialog → createProductAiJob-Thunk → socket updates |
| Admin: Socket-Listener (aiJob:updated/completed) | ✅ | ManageProducts.tsx:136-171 |
| Admin: KI-Job fertigstellen | ⚠️ | ManageProducts.tsx:228-253 – tsc-Fehler Z.241 |
| Admin: Bestellungen verwalten | ✅ | ManageOrders.tsx; orderSlice |
| Admin: User verwalten | ✅ | ManageUsers.tsx; userSlice |
| Impressum | ❌ | Kein Route/Seite; Footer-Link → Fallback HOME |
| Datenschutz | ❌ | Kein Route/Seite; Footer-Link → Fallback HOME |
| AGB | ❌ | Nicht vorhanden (rechtlich Pflicht) |
| Widerrufsbelehrung | ❌ | Nicht vorhanden (rechtlich Pflicht) |
| E-Mail-Verifizierung (Frontend) | ❓ | Backend implementiert; kein Frontend-Flow sichtbar |
| Passwort-Zurücksetzen | ❌ | Kein Frontend-Flow |

---

## Workflow-relevante Notizen

### Login-Flow
```
LoginPage.tsx (Z.23-41)
  → dispatch(login(credentials))          [authSlice.ts:65-75]
  → authService.login(credentials)         [authService.ts:16-25]
  → api.post('/auth/login')               [api.ts:8-11, withCredentials]
  → login.fulfilled: accessToken+user in State + localStorage [authSlice.ts:199-213]
  → navigate(admin → ADMIN_DASHBOARD, customer → HOME)
```
**Token-Refresh:** api.ts:46-108 – isRefreshing-Flag + failedQueue korrekt; excl. /auth/* endpoints.

### Signup-Flow
```
SignupPage.tsx (Z.68-108)
  → dispatch(signup(payload))              [authSlice.ts:82-92]
  → authService.signup(payload)            [authService.ts:32-36]
  → api.post('/auth/signup')
  → Kein Auto-Login; navigate('/auth/login')
  ⚠️ 2 tsc-Fehler: preferredPayment (Z.96), gender (Z.99)
```

### Produktliste → Detail → Warenkorb
```
ProductListPage.tsx
  → dispatch(fetchProducts({q, limit}))    [productSlice.ts:44-53]
  → productService.getProducts(params)     [productService.ts:17-20]
  → ProductGrid → ProductCard
  → navigate(ROUTES.PRODUCT_DETAIL(id))
  
ProductDetailPage.tsx
  → productService.getProduct(id)          [productService.ts:22-25, direkt, kein Redux]
  → dispatch(addToCart({...}))             [cartSlice.ts:16-23]
  ⚠️ Kein Redux-State für Produktdetail; lokales useState
```
**PrimeReact:** ProductDetailPage (Card, Dropdown, Button, Toast).

### Warenkorb → Checkout → Bestellung
```
CartPage.tsx (PrimeReact: DataTable, InputNumber, Button)
  → state.cart.items (cartSlice, NICHT persistent)
  → navigate('/cart/checkout')
  
CheckoutPage.tsx (PrimeReact: Card, InputText, Button)
  → dispatch(placeOrder(payload))          [orderSlice.ts:33-75]
  → orderService.placeOrder(payload)       [orderService.ts:41-63]
  → HTTP-200 INSUFFICIENT_STOCK Check
  → dispatch(clearCart()) + navigate('/order-confirmation')
  ❌ /order-confirmation hat keine Route/Seite → Fallback HOME
  ⚠️ tsc-Fehler Z.13 (falscher PlaceOrderPayload-Import)
```

### Konto/Bestellungen (User)
```
AccountPage.tsx (PrimeReact: Avatar, Button)
  → state.auth.user (selectAuth)
  ❌ Login-Redirect zeigt auf /login statt /auth/login
  
ProfilePage.tsx (PrimeReact: InputText, Dropdown, Checkbox, Toast)
  → dispatch(fetchUser()) → userService.me()      [userSlice.ts:12-14]
  → dispatch(updateUser(payload)) → userService.update()
  → dispatch(fetchUser()) als "Truth refresh"
  
OrdersPage.tsx (PrimeReact: DataTable, Tag, Button, ConfirmDialog)
  → orderService.getMyOrders() DIREKT (kein Redux)  [OrdersPage.ts:19]
  → orderService.cancelMyOrder(id)
  → navigate('/user/orders/:id')
  
OrderDetailPage.tsx (PrimeReact: DataTable, Tag, Button, ConfirmDialog)
  → orderService.getOrderById(id) DIREKT (kein Redux)
  ⚠️ tsc-Fehler Z.77: OrderSummary.items ≠ Order.items
```

### Admin-Produkt (inkl. KI-Dialog + Socket-Listener)
```
ManageProducts.tsx (PrimeReact: DataTable, Column, Button, InputText)
  Initiales Laden:
    → dispatch(fetchProducts())
    → productService.getOpenProductAiJobs()  (Queue-Restore)
  
  WebSocket-Setup (useEffect:136-171):
    → getSocket()                            [socket.ts:12-29, Singleton]
    → socket.on('aiJob:updated', applyJobUpdate)
    → socket.on('aiJob:completed', applyJobUpdate)
    → cleanup: socket.off(...) bei Unmount
  
  Neues KI-Produkt:
    → openNew() → setDisplayNewAiDialog(true)
    → ProductAiDialog.onContinue({price, files})
    → dispatch(createProductAiJob({price, files}))  [productSlice.ts:114-123]
    → productService.createProductAiJob(params)      [productService.ts:70-79]
    → POST /api/ai/product-job (multipart)
    → Job landet in queuedAiItems
    → Socket-Updates aktualisieren Job-Status (PENDING→PROCESSING→SUCCESS/FAILED)
  
  Fertigstellen:
    → handleCompleteFromAi(item) [Z.228-253]
    → rehydrateFilesIfNeeded() – fetch() der Bild-URLs
    → setEditingProduct({name, description, price, ...}) ⚠️ tsc-Fehler Z.241
    → ProductDialog öffnet sich mit KI-Vorschlag
    → saveProduct() → dispatch(addProduct/updateProduct) + uploadProductImages
    → productService.deleteProductAiJob(completingJobId) – Cleanup
  
  Retry:
    → handleRetryAiJob(item) → productService.retryProductAiJob(jobId)
    → Optimistisches UI-Update auf PROCESSING
```

### Routen die ins Leere laufen (keine Seite)
| Route | Konstante | Problem |
|---|---|---|
| `/order-confirmation` | `ROUTES.ORDER_CONFIRMATION` | CheckoutPage navigiert dorthin nach Erfolg; Route nicht in App.tsx; Fallback → HOME |
| `/impressum` | `ROUTES.IMPRESSUM` | Footer-Link; Route fehlt; Fallback → HOME |
| `/datenschutz` | `ROUTES.DATENSCHUTZ` | Footer-Link; Route fehlt; Fallback → HOME |
| `/products` | `ROUTES.PRODUCTS` | Konstante definiert, nicht als Route; ProductListPage liegt auf `/` |
| `/admin/users/:id` | `ROUTES.USER_DETAIL` | Konstante definiert; keine Detail-Seite |
| `/login` | (kein Alias) | AccountPage.tsx:49 navigiert dorthin (Bug F14); richtig wäre `/auth/login` |

### PrimeReact-Nutzung je Seite (vor Migration entfernen – NICHT als Dead Code werten)
| Seite | PrimeReact-Komponenten |
|---|---|
| App.tsx | Toast |
| Header.tsx | Menubar, Button |
| ProductDetailPage | Card, Dropdown, Button, Toast |
| CartPage | DataTable, Column, Button, InputNumber |
| CheckoutPage | Card, InputText, Button |
| SignupPage | InputText, Password, Button, Dropdown, Calendar, Checkbox |
| AccountPage | Avatar, Button |
| ProfilePage | InputText, Button, Dropdown, Checkbox, Toast |
| SettingsPage | Button, Password, Checkbox, Dropdown, Toast, ConfirmDialog, InputText |
| OrdersPage | DataTable, Column, Tag, Button, ConfirmDialog, Toast |
| OrderDetailPage | DataTable, Column, Tag, Button, ConfirmDialog, Toast |
| AdminDashboard | DataTable, Column, Button, Dropdown |
| ManageProducts | DataTable, Column, Button, InputText |
| ProductDialog | Dialog, InputText, InputTextarea, InputNumber, Button |
| ProductAiDialog | Dialog, InputNumber, Button |
| ManageOrders | DataTable, Column, InputText, Dropdown, Calendar, Button |
| OrderEditDialog | Dialog, Dropdown, Button, DataTable, Column |
| ManageUsers | DataTable, Column, Button, Dropdown, InputText |
| UserEditDialog | Dialog, InputText, Dropdown, InputNumber, Checkbox, Button |

Ohne PrimeReact (vollständig migriert oder nie genutzt): `ProductListPage`, `ProductGrid`, `ProductCard`, `ProductListToolbar`, `LoginPage`, `Footer`, alle `components/ui/*`, `lib/utils.ts`.
