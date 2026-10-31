# Implementation status and production gates

Last updated: 2026-11-01

## What currently exists

| Area | Implemented now | Not yet complete |
|---|---|---|
| Desktop/UI | Tauri 2 shell, Arabic RTL, responsive React screens | Windows install/launch verification, signed release, accessibility review |
| Database | SQLite migrations v1-v6, foreign keys, WAL, operational tables | Windows runtime migration test, upgrade/restore compatibility tests |
| Products | Create/list, validation, low-stock display | Edit/archive workflow, categories/brands, import/export |
| Inventory | Opening movement, adjustment ledger, stock reconciliation, stock checks in sales/purchases | Reconciliation, approvals, stock takes, transfers, barcode printing |
| Serialized devices | IMEI Luhn validation, unique IMEI/serial registration, serial selection at POS, serial status update on sale/return | Reservation, warranty claim/history, and serialized-unit purchase receiving lifecycle |
| Customers/suppliers | Create/list, customer/supplier balances, payment allocation to oldest open invoices | Edit/archive, statements, aging reports, advance balances |
| Sales | POS checkout, transactional stock decrement, payment/journal posting, partial returns/refunds, customer-credit returns, receipt allocation | Voids, printed invoice, tax invoice review, full return UI acceptance tests |
| Purchasing | Purchase receiving, stock increment, weighted-average cost, supplier payment allocation, partial purchase returns with stock reduction and supplier credit/refund journal | Supplier statement, attachment handling, invoice matching |
| Cash/expenses | Open/close cash session, cash movement attribution, expenses | Multi-register support, approvals, expense categories, reconciliation reports |
| Repairs | Intake, validated status transitions, immutable status history | Technician workflow, parts consumption, labor, warranty, customer notifications |
| Accounting | Seeded chart of accounts, balanced immutable journal posting for sales/purchases/expenses/returns and customer/supplier settlements, trial balance | Manual journal UI, subledger-to-control-account reconciliation, aging, period close, reconciled tax reports |
| Reports | Initial ledger-derived profit summary covering sales returns, COGS, purchase-return variance, expenses, and inventory value | Full financial statements, aging, audited exports, depreciation/accruals |
| Security | Parameterized SQL, constrained Tauri capabilities, append-only ledgers | Login, password hashing, RBAC, actor identity, session timeout, threat review |
| Operations | CI workflow, lockfile, SQLite migration verifier, in-app development/support contact | Backup/restore, disaster recovery, update/signing, release monitoring |

## Financial/data caveats

1. The first schema stores money in SQLite `REAL` columns. Application calculations use integer minor units, but this is not sufficient for final accounting acceptance. Migrate financial columns to integer minor units in a versioned migration before production.
2. The initial currency setting is SAR for this Saudi-project scope. The owner must confirm the store's legal operating country, currency, tax registration, and invoice requirements before live data is entered.
3. Sales, purchases, expenses, sales returns, purchase returns, and customer/supplier settlements create balanced double-entry journal entries using seeded account codes. Manual journal UI, full subledger reconciliation, and period closing are still missing.
4. Tax is disabled by default. No ZATCA, e-invoicing, telecom, payment, or other regulatory compliance is claimed.
5. The initial profit report derives sales, returns, COGS, purchase-return variance, and operating expenses from selected posted ledger accounts. It is not a complete set of financial statements and does not yet cover full tax treatment, depreciation, or all accruals.
6. Cash payments are linked to a cash session. Card/transfer/wallet transactions are not part of physical cash reconciliation.
7. A registered IMEI/serial unit is currently attached to an existing product balance; registering a unit does not increment stock. Avoid double-counting units and aggregate stock.
8. Posted sales, purchases, expenses, stock movements, payments, and audit events need compensating operations for corrections. Partial sales/purchase returns are implemented; sale voids and full end-to-end return acceptance tests remain outstanding.

## Required release gates — do not skip

- [ ] Windows CI build passes for the exact release commit.
- [ ] Install and launch the NSIS installer on a clean supported Windows machine.
- [ ] Verify SQLite migrations from a fresh database and from the previous released version.
- [ ] Test sales rollback for insufficient stock, invalid customer, invalid payment, and SQL failure.
- [ ] Test purchase rollback and weighted-average cost reconciliation.
- [ ] Test partial purchase returns, stock guards, supplier credits, and refund accounting.
- [ ] Test cash session attribution, cash count variance, and non-cash exclusions.
- [ ] Test repair transition rules and audit/status history.
- [x] Implement initial partial sales/purchase returns, stock movements, supplier/customer credits, refunds, and compensating journal entries.
- [ ] Complete sale voids and end-to-end acceptance tests for return workflows.
- [ ] Migrate money columns from REAL to integer minor units.
- [x] Add initial receivables/payables payment allocations and calculated customer/supplier balances.
- [ ] Reconcile subledger balances to accounts 1100/2000 and add aging/advance handling.
- [ ] Implement authentication/RBAC and actor attribution before multi-employee operation.
- [ ] Implement backup/restore and successfully restore a backup on a separate machine.
- [ ] Complete security review, privacy review, and jurisdiction-specific accounting/tax review.
- [ ] Owner signs off on user acceptance and operating procedures.

Until all P0 release gates pass, label the software **pre-release / pilot only** and use synthetic test data.


## Development and commercial extensions

- The current application exposes contact details for **العصيمي للبرمجيات والحلول التقنية المتطورة** in the navigation and dashboard so the store owner can request custom features and support by agreement.
- No in-app subscription, payment, or license enforcement flow has been implemented or is implied. Custom work must be scoped and agreed separately.
- Current contact: `00967776778675`; WhatsApp: `https://wa.me/message/NEVZVG5DC5CEA1`.
