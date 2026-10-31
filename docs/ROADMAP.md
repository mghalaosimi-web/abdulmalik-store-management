# Delivery roadmap

## Phase 0 — Repository and desktop foundation
- [x] Initialize repository documentation.
- [x] Add React + TypeScript + Vite application shell.
- [x] Add Tauri 2 host and SQLite plugin wiring.
- [x] Add initial database schema and second operational migration.
- [x] Add dependency lockfile and frontend CI checks.
- [ ] Verify SQL plugin migrations and Windows native build on a Windows runner.
- [ ] Install and launch the produced Windows installer on a clean Windows machine.

## Phase 1 — Catalog and inventory
- [x] Product create/list path and input validation.
- [x] Opening stock ledger and manual stock adjustments.
- [x] IMEI Luhn validation and serial/IMEI unit registration service.
- [ ] Category/brand normalized management.
- [ ] Serialized-unit reservation, sale, return, and warranty lifecycle.
- [ ] Stock reconciliation screen and approval controls.
- [ ] Barcode generation and label printing.

## Phase 2 — Purchasing and sales
- [x] Supplier records.
- [x] Purchase receiving, stock updates, and weighted-average cost update.
- [x] POS checkout, stock checks, payments, and transactional posting.
- [x] Cash sessions and shift reconciliation.
- [ ] Supplier statements and purchase returns.
- [ ] Sales returns, void/credit-note controls, invoice printing, and tax invoice review.
- [ ] Price lists, discounts, promotions, and payment allocation.

## Phase 3 — Customers, repairs, warranty
- [x] Customer records.
- [x] Repair intake and status history.
- [ ] Customer account statements and receivables aging.
- [ ] Spare-parts consumption and repair costing.
- [ ] Warranty claims, device handover, and service history.

## Phase 4 — Accounting and reporting
- [x] Initial operational sales/cost/expense/inventory report.
- [x] Expense voucher with payment record.
- [x] Seeded chart of accounts, balanced journal posting for sales/purchases/expenses, immutable posted entries, and trial balance.
- [ ] Manual journal-entry UI, account configuration, and period close.
- [ ] Receivables/payables subledgers and settlement workflows.
- [ ] Tax ledger, cash flow, and reconciled financial statements.
- [ ] Profit reporting with returns, discounts, tax, and accounting adjustments.

## Phase 5 — Security and release
- [ ] Authentication, session lock, and RBAC.
- [ ] Audit review screens and actor attribution.
- [ ] Backup, restore, export, and recovery drills.
- [ ] Automated database integration and end-to-end tests.
- [ ] Multi-user and multi-branch conflict strategy.
- [ ] Windows installer signing, update strategy, and release process.
- [ ] Business acceptance, tax/legal review, and production data migration.

A checked item means an initial implementation exists, not that the module is commercially accepted. Each module requires tests, review, reconciliation, and documented acceptance criteria.
