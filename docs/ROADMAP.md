# Delivery roadmap

## Phase 0 — Repository and desktop foundation
- [x] Initialize repository documentation.
- [x] Add React + TypeScript + Vite application shell.
- [x] Add Tauri 2 host and SQLite plugin wiring.
- [x] Add initial database schema.
- [ ] Run dependency installation and native build in CI.
- [ ] Verify SQL plugin migration and capability configuration on Windows.

## Phase 1 — Catalog and inventory
- [x] Initial product table and create/list path.
- [ ] Categories and brands management.
- [ ] Serialized device intake and IMEI validation.
- [ ] Stock ledger, adjustments, and reconciliation.
- [ ] Barcode generation and label printing.

## Phase 2 — Purchasing and sales
- [ ] Suppliers and purchase documents.
- [ ] POS cart and checkout transaction.
- [ ] Payments, invoices, returns, and void controls.
- [ ] Cash drawer and shift closing.

## Phase 3 — Customers, repairs, warranty
- [ ] Customer accounts and statements.
- [ ] Repair intake and status history.
- [ ] Spare parts consumption.
- [ ] Warranty claims and service history.

## Phase 4 — Accounting and reporting
- [ ] Chart of accounts and journal entries.
- [ ] Expense and income vouchers.
- [ ] Receivables and payables.
- [ ] Profit, cash-flow, and inventory reports.

## Phase 5 — Security and release
- [ ] User authentication and RBAC.
- [ ] Audit review screens.
- [ ] Backup, restore, and recovery drills.
- [ ] Automated integration and end-to-end tests.
- [ ] Windows installer signing and release process.

A checkbox is not a production acceptance claim. Each module requires tests, review, and documented acceptance criteria.
