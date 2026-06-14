# FIXLOG – Autonome Abarbeitung des Befund-Registers (AUDIT.md)

> Lebendes Ledger für die Bug-Fix-Kampagne. Quelle der Befunde: `AUDIT.md` §6.
> Jeder AUTO-Befund: eigener Branch → Fix der Wurzelursache → Regressionstest → PR →
> Senior-Review (Kommentar) → Squash-Merge → Branch löschen. HUMAN → GitHub-Issue mit
> Vorschlag. SKIP → bereits gefixt / nicht reproduzierbar.

## Rahmen

| Feld | Wert |
|---|---|
| Basisbranch | `refactor/frontend-shadcn-migration` (aktiver Umbau-Branch, 11 Commits vor `main`; `main` ist Ancestor) |
| Repo | `Mechanicel/TvWallauShop` |
| Default-Branch | `main` |
| Merge-Strategie | Squash-Merge + `--delete-branch`; kein force-push auf Basis |
| Start-Commit Basis | wird beim Pre-Flight-Commit gesetzt |

## Baseline der Basis (vor jeder Änderung) – ALLES GRÜN

| Check | Ergebnis |
|---|---|
| `tsc --noEmit` frontend | ✅ 0 Fehler |
| `tsc --noEmit` backend (app + migrations) | ✅ 0 Fehler |
| `tsc --noEmit` contracts | ✅ 0 Fehler |
| `eslint` frontend (`npm run lint`) | ✅ 0 Fehler |
| `vite build` frontend | ✅ baut |
| `node --test` backend | ✅ 3 pass |
| `node --test` frontend | ✅ 2 pass (Platzhalter) |
| `node --test` contracts | ✅ 2 pass (Platzhalter) |

> Folge: **AUD-005** (tsc-Fehler) und **AUD-022** (kaputtes ESLint) sind durch die
> shadcn-Migration bereits behoben → SKIP. PrimeReact/primeicons sind bereits entfernt.
> `jwt-decode` (**AUD-047**) ist bereits aus `frontend/package.json` entfernt → SKIP.

## Definition „grün" (Merge-Gate pro Fix)

1. `tsc --noEmit` der betroffenen TS-Workspaces: 0 Fehler.
2. `eslint` frontend (falls FE betroffen): 0 Fehler.
3. Build der betroffenen Projekte: erfolgreich.
4. `node --test` der betroffenen Workspaces: grün.
5. Gezielter Regressionstest, der **genau diesen Bug** nachweislich schließt.
6. Senior-Review-Fazit explizit „bestanden".

---

## Plan / Ledger

> Lane: **AUTO** = voller Zyklus inkl. Merge · **HUMAN** = GitHub-Issue mit Vorschlag ·
> **SKIP** = bereits behoben / nicht reproduzierbar.
> Status: `geplant` → `in Arbeit` → `PR offen` → `review` → `gemergt` / `issue` / `skip` / `merge-blockiert`.

| ID | Titel | Schweregrad | Lane | Branch | PR | Status | Verifikation | Notiz |
|---|---|---|---|---|---|---|---|---|
| _Triage läuft …_ | | | | | | | | |

---

## Verlauf

- Pre-Flight: gh-Auth ✓ (`Mechanicel`), Repo ✓, Basisbranch festgelegt, Baseline grün, Audit-Doku committet.
