# Execution Agenda — Abdulmalik Store Management

Last reviewed: 2026-11-01
Repository: https://github.com/mghalaosimi-web/abdulmalik-store-management
Default branch: `main`
Baseline commit reviewed: `88a9a18ba886f1ecfa4be4f33ef438dcb132d296`
Coordination branch: `chore/project-execution-agenda`

> This agenda records repository evidence, not assumptions. A module is not complete merely because a screen, table, or file exists. Mark work complete only after implementation, automated tests, and acceptance checks pass.

## Project status

**Current stage: Initial operational vertical slice. Not production-ready.**

The repository currently contains:
- React + TypeScript + Vite application shell with Arabic RTL screens.
- Tauri 2 host and SQLite plugin wiring, with migrations v1, v2, and v3.
- Product catalog, stock adjustments, IMEI/serial registration service.
- Customer and supplier records.
- POS checkout, purchase receiving, cash sessions, and expense recording services.
- Repair intake and status-history workflow.
- Initial operational reports and SQLite migration verification script.
- Vitest tests and GitHub Actions workflow.

This is an initial operational slice, not a production-ready ERP/POS. Do not enter real customer, supplier, inventory, or financial data.

## Work status

| ID | Workstream | Status | Priority | Acceptance evidence |
|---|---|---|---|---|
| FND-01 | Dependency installation and frontend checks | Passed locally in clean cloud box; CI rerun pending | P0 | CI install, typecheck, lint, tests, and build all green |
| FND-02 | Windows Tauri build and installer | Icon asset added; Windows CI rerun pending | P0 | Successful Windows CI job and install/launch smoke test |
| FND-03 | SQLite migration execution and Tauri capabilities | SQLite scripts verified with Python; Windows runtime pending | P0 | Migration runs on a clean local database; least-privilege capabilities verified |
| CAT-01 | Product create/list foundation | Initial implementation + input validation | P1 | Persistence, validation, empty/error states, and integration tests verified |
| CAT-02 | Categories and brands | Pending | P1 | CRUD, validation, uniqueness, and tests |
| INV-01 | Serialized devices and IMEI/serial validation | IMEI validation + registration service; full lifecycle pending | P1 | Unique identifiers, device lifecycle, and tests |
| INV-02 | Inventory ledger, adjustments, reconciliation | Opening ledger + adjustments + immutable movements; stocktake pending | P1 | Transactional movements, immutable history, balance reconciliation |
| INV-03 | Barcode generation and label printing | Pending | P2 | Printable labels and tested barcode payloads |
| PUR-01 | Suppliers and purchasing | Supplier records + receiving + weighted-average cost + supplier settlement allocation + partial purchase returns | P1 | Purchase workflow updates stock and supplier balances transactionally |
| POS-01 | POS cart and checkout | Transactional checkout + stock decrement + invoice reference | P0 | Atomic checkout, stock checks, price snapshots, and failure rollback |
| POS-02 | Payments, invoices, returns, void controls | Partial sales returns/refunds and compensating journal; voids/print/tax invoice pending | P0 | Payment allocation, invoice numbering, return controls, audit trail |
| CASH-01 | Cash drawer and shift closing | Session opening/closing + exact cash-session payment attribution | P1 | Opening/closing balances and variance report |
| CRM-01 | Customers and account statements | Pending | P1 | Customer CRUD, balances, ledger, statement |
| SRV-01 | Repair intake and status history | Intake + allowed transitions + history | P1 | Repair ticket lifecycle and history |
| SRV-02 | Spare-parts consumption and warranty | Pending | P2 | Stock consumption and warranty claim traceability |
| ACC-01 | Chart of accounts and journal entries | Seeded chart + balanced immutable postings for sales/purchases/expenses + trial balance | P1 | Balanced double-entry postings; exact decimal arithmetic |
| ACC-02 | Expenses, income, receivables, payables | Expense journal + initial customer/supplier settlement allocations | P1 | Transactional vouchers and reconciled balances |
| RPT-01 | Profit, cash-flow, inventory reports | Indicative sales/COGS/expense/inventory summary; reconciliation pending | P2 | Reports reconcile to source ledgers |
| SEC-01 | Authentication and RBAC | Pending | P0 before multi-user use | Permission matrix and negative authorization tests |
| SEC-02 | Audit review screens | Pending | P1 | Searchable immutable audit events |
| OPS-01 | Backup, restore, recovery drills | Pending | P0 before real data | Backup validation and successful restore drill |
| QA-01 | Integration and end-to-end tests | Pending | P0 | Critical workflows covered by automated tests |
| REL-01 | Windows installer and release process | Pending | P0 | Signed/reproducible installer and release checklist |

## CI baseline and current verification

The latest observed GitHub Actions run on the baseline commit was:
- Run ID: `41242530238`
- Commit: `88a9a18ba886f1ecfa4be4f33ef438dcb132d296`
- Overall result: `failure`
- Frontend checks: `success` (install, typecheck, lint, tests, build)
- Windows desktop installer: `failure` during the Tauri Rust build.
- Exact logged cause: `src-tauri/icons/icon.ico` is missing; Tauri's Windows resource generation requires this file.

This is a confirmed asset/configuration issue, not a frontend TypeScript, lint, test, or Vite build failure. A valid 32×32 Windows ICO asset has now been added at `src-tauri/icons/icon.ico` on the open draft PR branch. The Windows workflow must pass before this blocker can be closed. Earlier run `41242473430` also failed; inspect its logs separately only if needed.

CI runs:
https://github.com/mghalaosimi-web/abdulmalik-store-management/actions

## Parallel ownership and work allocation

To reduce merge conflicts, use these proposed lanes:

### Owner / product coordination
- Confirm business rules, currency, tax treatment, invoice requirements, store workflows, and role definitions.
- Review acceptance criteria and approve changes to product scope.
- Review and merge pull requests only after CI and code review.
- Do not edit the same files as an active implementation lane without coordination.

### Ramzi / desktop implementation
- Own the desktop runtime, Tauri/Rust integration, Windows build, capability configuration, and native packaging.
- Coordinate changes to `src-tauri/**`, `.github/workflows/**`, and desktop configuration.
- Report actual Windows test results and attach logs.

### Shared engineering lane
- Agree on one owner per feature before implementation.
- Keep feature branches short-lived.
- Pull/rebase from the latest `main` before opening a PR.
- Do not push directly to `main`; do not merge without owner approval.
- Never edit the same migration or shared domain contract concurrently.

## Required workflow

1. Inspect current `main` and open pull requests before starting.
2. Assign one owner to each task.
3. Create a focused branch from the latest `main`.
4. Implement the smallest complete vertical slice.
5. Add tests for success, validation, failure, and rollback cases.
6. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
7. Run the Windows Tauri build on a Windows runner for native changes.
8. Update this agenda with evidence, commit SHA, PR, and test results.
9. Request review; merge only after explicit owner approval.

## Immediate next actions

- [x] FND-01: inspect CI jobs and logs for run `41242530238`; frontend checks passed.
- [ ] FND-02: verify the newly added `src-tauri/icons/icon.ico` asset by rerunning and passing the Windows build.
- [x] FND-03: execute migrations v1/v2 against an in-memory SQLite database and verify key constraints/triggers locally.
- [x] CAT-01: add product input validation, stock adjustment ledger, and IMEI/serial registration service.
- [x] PUR-01: implement supplier records and transactional purchase receiving.
- [x] POS-01: implement transactional checkout, stock checks, payments, and invoice references.
- [x] CASH-01: implement cash-session opening/closing and per-session payment attribution.
- [x] SRV-01: implement repair intake and status history.
- [ ] Windows Tauri migration/build and installer smoke test on a Windows runner.
- [ ] Confirm Ramzi's collaborator permission is `write` or higher before expecting him to push branches.

## Change log

- 2026-11-01: Created this execution agenda on `chore/project-execution-agenda` from the observed `main` baseline. No production deployment, database reset, data migration, or merge was performed.
- 2026-11-01: Inspected CI run `41242530238` and its Windows job logs. Confirmed frontend checks pass; Windows packaging fails because `src-tauri/icons/icon.ico` is missing.
- 2026-11-01: Added a valid 32×32 Windows ICO asset at `src-tauri/icons/icon.ico` on the coordination branch. Windows CI verification is pending.

- 2026-11-01: Added migration v2 for purchases, repair history, cash sessions, expenses, immutable ledger/audit/payment triggers, case-insensitive SKU uniqueness, and cash-session payment attribution.
- 2026-11-01: Implemented customer/supplier repositories, POS checkout, purchase receiving with weighted-average cost, cash sessions/expenses, repair state transitions, inventory adjustments, and IMEI/serial registration.
- 2026-11-01: Expanded the Arabic UI with customer, supplier, POS, purchase, repair, cash, and operational report screens.
- 2026-11-01: Added `scripts/verify-migrations.py`; local verification passed for migration SQL, opening-stock trigger, immutable ledgers, SKU uniqueness, and cash-session attribution.
- 2026-11-01: Local cloud-box verification passed: typecheck, lint, 10 Vitest tests, Vite production build, and SQLite migration verifier. Native Windows build remains unverified because this Linux box has no Rust toolchain.
- 2026-11-01: Added migration v3 with a seeded chart of accounts, balanced journal posting guards, and immutable posted journal entries/lines. Sales, purchases, and expenses now post balanced double-entry journals; an initial trial-balance screen is available.
- 2026-11-01: Added migration v4 and an initial partial sales-return workflow. Returns enforce remaining sold quantities and proportional invoice refund caps, restore stock, attribute cash refunds to an open cash session, and post compensating journal entries.
- 2026-11-01: Added migration v5 and settlement workflows. Customer receipts and supplier payments are allocated oldest-invoice-first, create immutable allocation records and balanced journal entries, and update calculated party balances without editing posted invoices.
- 2026-11-01: Added unit tests for proportional refund allocation (including one-minor-unit rounding cases); dashboard daily revenue now nets same-day returns. Frontend suite: 16 tests passing.
- 2026-11-01: Added migration v6 and partial purchase returns. Returns enforce purchased-quantity and current-stock limits, reverse supplier payable or record incoming refund, reduce inventory at current weighted-average cost, reverse input tax proportionally, and post a balanced compensating journal.
