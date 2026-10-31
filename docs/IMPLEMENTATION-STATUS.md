# Implementation status and production gates

Last updated: 2026-11-01

## What currently exists

| Area | Implemented now | Not yet complete |
|---|---|---|
| Desktop/UI | Tauri 2 shell, Arabic RTL, responsive React screens | Windows install/launch verification, signed release, accessibility review |
| Database | SQLite migrations v1/v2/v3, foreign keys, WAL, operational tables | Windows runtime migration test, upgrade/restore compatibility tests |
| Products | Create/list, validation, low-stock display | Edit/archive workflow, categories/brands, import/export |
| Inventory | Opening movement, adjustment ledger, stock reconciliation, stock checks in sales/purchases | Reconciliation, approvals, stock takes, transfers, barcode printing |
| Serialized devices | IMEI Luhn validation, unique IMEI/serial storage service | Full serialized-device sale/reservation/return/warranty lifecycle and screen |
| Customers/suppliers | Create/list and customer use in POS/repairs | Edit/archive, statements, balances, aging, supplier settlements |
| Sales | POS cart, transactional checkout, stock decrement, invoice ID, payment record | Returns, voids, printed invoice, discounts UI, tax configuration, payment allocation |
| Purchasing | Purchase receiving, stock increment, weighted-average cost | Purchase return, supplier statement, attachment handling, invoice matching |
| Cash/expenses | Open/close cash session, cash movement attribution, expenses | Multi-register support, approvals, expense categories, reconciliation reports |
| Repairs | Intake, validated status transitions, immutable status history | Technician workflow, parts consumption, labor, warranty, customer notifications |
| Accounting | Seeded chart of accounts, balanced immutable journal posting for sales/purchases/expenses, trial balance | Manual journal UI, receivable/payable settlements, period close, reconciled tax reports |
| Reports | Initial sales/COGS/expense/inventory summary | Return-adjusted statements, aging, audited exports |
| Security | Parameterized SQL, constrained Tauri capabilities, append-only ledgers | Login, password hashing, RBAC, actor identity, session timeout, threat review |
| Operations | CI workflow, lockfile, SQLite migration verifier | Backup/restore, disaster recovery, update/signing, release monitoring |

## Financial/data caveats

1. The first schema stores money in SQLite `REAL` columns. Application calculations use integer minor units, but this is not sufficient for final accounting acceptance. Migrate financial columns to integer minor units in a versioned migration before production.
2. The initial currency setting is SAR for this Saudi-project scope. The owner must confirm the store's legal operating country, currency, tax registration, and invoice requirements before live data is entered.
3. Sales, purchases, and expenses now create double-entry journal entries using the seeded account codes. Manual journal UI, settlement allocations, and period closing are still missing.
4. Tax is disabled by default. No ZATCA, e-invoicing, telecom, payment, or other regulatory compliance is claimed.
5. The operational profit report is indicative. It does not yet reconcile journal entries, returns, tax treatment, supplier discounts, depreciation, or all accruals.
6. Cash payments are linked to a cash session. Card/transfer/wallet transactions are not part of physical cash reconciliation.
7. A registered IMEI/serial unit is currently attached to an existing product balance; registering a unit does not increment stock. Avoid double-counting units and aggregate stock.
8. Posted sales, purchases, expenses, stock movements, payments, and audit events need compensating operations for corrections. Full return/void workflows are not implemented yet.

## Required release gates — do not skip

- [ ] Windows CI build passes for the exact release commit.
- [ ] Install and launch the NSIS installer on a clean supported Windows machine.
- [ ] Verify SQLite migrations from a fresh database and from the previous released version.
- [ ] Test sales rollback for insufficient stock, invalid customer, invalid payment, and SQL failure.
- [ ] Test purchase rollback and weighted-average cost reconciliation.
- [ ] Test cash session attribution, cash count variance, and non-cash exclusions.
- [ ] Test repair transition rules and audit/status history.
- [ ] Implement returns, voids, and compensating ledger entries.
- [ ] Migrate money columns from REAL to integer minor units.
- [ ] Add receivables/payables payment allocations and reconcile subledger balances to accounts 1100/2000.
- [ ] Implement authentication/RBAC and actor attribution before multi-employee operation.
- [ ] Implement backup/restore and successfully restore a backup on a separate machine.
- [ ] Complete security review, privacy review, and jurisdiction-specific accounting/tax review.
- [ ] Owner signs off on user acceptance and operating procedures.

Until all P0 release gates pass, label the software **pre-release / pilot only** and use synthetic test data.
