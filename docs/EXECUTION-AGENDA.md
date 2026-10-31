# Execution Agenda — Abdulmalik Store Management

Last reviewed: 2026-11-01
Repository: https://github.com/mghalaosimi-web/abdulmalik-store-management
Default branch: `main`
Baseline commit reviewed: `88a9a18ba886f1ecfa4be4f33ef438dcb132d296`
Coordination branch: `chore/project-execution-agenda`

> This agenda records repository evidence, not assumptions. A module is not complete merely because a screen, table, or file exists. Mark work complete only after implementation, automated tests, and acceptance checks pass.

## Project status

**Current stage: Foundation / early catalog implementation. Not production-ready.**

The repository currently contains:
- React + TypeScript + Vite application shell.
- Tauri 2 host and SQLite plugin wiring.
- Initial SQL migration.
- Initial product create/list path.
- Validation utilities and Vitest tests.
- Architecture, domain model, security, and roadmap documentation.
- GitHub Actions CI workflow.

The repository does not yet demonstrate a production-ready store workflow. Do not enter real customer, supplier, inventory, or financial data.

## Work status

| ID | Workstream | Status | Priority | Acceptance evidence |
|---|---|---|---|---|
| FND-01 | Dependency installation and frontend checks | Review required | P0 | CI install, typecheck, lint, tests, and build all green |
| FND-02 | Windows Tauri build and installer | Blocked / investigate | P0 | Successful Windows CI job and install/launch smoke test |
| FND-03 | SQLite migration execution and Tauri capabilities | Pending verification | P0 | Migration runs on a clean local database; least-privilege capabilities verified |
| CAT-01 | Product create/list foundation | Implemented, needs review | P1 | Persistence, validation, empty/error states, and integration tests verified |
| CAT-02 | Categories and brands | Pending | P1 | CRUD, validation, uniqueness, and tests |
| INV-01 | Serialized devices and IMEI/serial validation | Pending | P1 | Unique identifiers, device lifecycle, and tests |
| INV-02 | Inventory ledger, adjustments, reconciliation | Partial foundation only | P1 | Transactional movements, immutable history, balance reconciliation |
| INV-03 | Barcode generation and label printing | Pending | P2 | Printable labels and tested barcode payloads |
| PUR-01 | Suppliers and purchasing | Pending | P1 | Purchase workflow updates stock and supplier balances transactionally |
| POS-01 | POS cart and checkout | Pending | P0 | Atomic checkout, stock checks, price snapshots, and failure rollback |
| POS-02 | Payments, invoices, returns, void controls | Pending | P0 | Payment allocation, invoice numbering, return controls, audit trail |
| CASH-01 | Cash drawer and shift closing | Pending | P1 | Opening/closing balances and variance report |
| CRM-01 | Customers and account statements | Pending | P1 | Customer CRUD, balances, ledger, statement |
| SRV-01 | Repair intake and status history | Pending | P1 | Repair ticket lifecycle and history |
| SRV-02 | Spare-parts consumption and warranty | Pending | P2 | Stock consumption and warranty claim traceability |
| ACC-01 | Chart of accounts and journal entries | Pending | P1 | Balanced double-entry postings; exact decimal arithmetic |
| ACC-02 | Expenses, income, receivables, payables | Pending | P1 | Transactional vouchers and reconciled balances |
| RPT-01 | Profit, cash-flow, inventory reports | Pending | P2 | Reports reconcile to source ledgers |
| SEC-01 | Authentication and RBAC | Pending | P0 before multi-user use | Permission matrix and negative authorization tests |
| SEC-02 | Audit review screens | Pending | P1 | Searchable immutable audit events |
| OPS-01 | Backup, restore, recovery drills | Pending | P0 before real data | Backup validation and successful restore drill |
| QA-01 | Integration and end-to-end tests | Pending | P0 | Critical workflows covered by automated tests |
| REL-01 | Windows installer and release process | Pending | P0 | Signed/reproducible installer and release checklist |

## CI baseline to investigate

The latest observed GitHub Actions run on the baseline commit was:
- Run ID: `41242530238`
- Commit: `88a9a18ba886f1ecfa4be4f33ef438dcb132d296`
- Result: `failure`

Earlier run `41242473430` also failed. The precise failing job/step must be read from its logs before assigning a root cause. Do not assume the failure is in frontend checks or the Windows packaging step.

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

- [ ] FND-01: inspect CI jobs and logs for run `41242530238`; identify exact failing step.
- [ ] FND-02: reproduce/fix Windows build failure on a Windows runner.
- [ ] FND-03: verify SQLite migration execution and Tauri SQL plugin permissions on Windows.
- [ ] CAT-01: audit product persistence path and add integration coverage.
- [ ] Confirm Ramzi's collaborator permission is `write` or higher before expecting him to push branches.

## Change log

- 2026-11-01: Created this execution agenda on `chore/project-execution-agenda` from the observed `main` baseline. No production deployment, database reset, data migration, or merge was performed.
