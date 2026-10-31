# Abdulmalik Store Management System

Arabic-first, offline-first Windows desktop management system for a telecommunications and electronics store.

## Current implementation status

**Active development — not production-ready.** The repository contains an initial operational vertical slice for catalog, customers, suppliers, purchasing, POS checkout, cash sessions, expenses, repair intake/status history, inventory adjustments, serialized-device registration, and an initial operational report. Full receivables/payables settlement, returns, user authorization, backup/restore, and production release controls remain incomplete.

Do not enter live commercial data until the release gates in `docs/SECURITY.md` and `docs/IMPLEMENTATION-STATUS.md` are satisfied.

## Technology

- Tauri 2 / Rust desktop host.
- React 19 + TypeScript + Vite.
- SQLite through the Tauri SQL plugin.
- pnpm 10.12.1 package manager.
- Vitest unit tests and Python SQLite migration verification.
- GitHub Actions frontend and Windows installer workflows.

## Implemented operational workflows (initial)

- Product catalog create/list, validation, opening stock ledger entry, stock adjustments, ledger reconciliation, and low-stock indicators.
- IMEI validation using the Luhn checksum and serial/IMEI unit registration.
- Customer and supplier records.
- POS checkout with stock checks, immutable stock movements, payment recording, invoice references, and a single database transaction.
- Purchase receiving with stock increases and weighted-average cost updates.
- Cash drawer opening/closing with payments attributed to a specific cash session.
- Expense vouchers with linked payment movements.
- Repair intake and validated status transitions with status history.
- Initial double-entry journal posting for sales, purchases, and expenses, plus a trial-balance screen.
- Basic sales, cost-of-goods, expenses, and inventory valuation report.

These are first operational implementations, not yet fully accepted commercial modules. See `docs/IMPLEMENTATION-STATUS.md` for limitations and remaining work.

## Getting started

Prerequisites: Node.js 22 LTS, pnpm 10.12.1, Rust stable, and Tauri platform prerequisites for Windows.

```bash
pnpm install
pnpm dev       # UI preview; database writes are disabled outside Tauri
pnpm tauri dev # desktop app
```

Run verification:

```bash
python scripts/verify-migrations.py
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Build the Windows installer on a Windows runner:

```bash
pnpm tauri build
```

## Data and financial rules

- Core workflows use local SQLite; the UI no longer depends on a remote font CDN.
- Financial calculations use integer minor units in application logic, then persist to legacy SQLite `REAL` columns. A future schema revision must migrate monetary storage to integer minor units before accounting acceptance.
- The initial currency setting is SAR and must be confirmed in store settings before live operation. Tax is disabled by default; tax and invoice rules must be reviewed against the store's jurisdiction and current requirements.
- Cash payments require an open cash session and are linked to that exact session.
- Stock movements, audit events, and payment rows are append-only at database level; corrections require compensating transactions.
- Backups must be tested by restoring them, not merely by creating files.
- Never use real customer or financial data in tests.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Domain model](docs/DOMAIN-MODEL.md)
- [Security and data safety](docs/SECURITY.md)
- [Delivery roadmap](docs/ROADMAP.md)
- [Implementation status and release gates](docs/IMPLEMENTATION-STATUS.md)
- [Execution agenda](docs/EXECUTION-AGENDA.md)
