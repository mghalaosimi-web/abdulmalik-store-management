# Initial domain model

## Core aggregates

- Product and Product Unit: sellable catalog item and individually tracked physical device.
- Stock Movement: immutable quantity change with a reason and optional source reference.
- Customer and Supplier: trading parties.
- Sale and Sale Item: posted sales document and its lines.
- Payment: cash movement associated with a business reference.
- Repair Job: device intake, diagnosis, work, and delivery lifecycle.
- Audit Log: append-only record of sensitive business changes.

## Important invariants

- IMEI and serial numbers must be unique when present.
- A serialized unit cannot be sold twice.
- Stock cannot become negative unless an explicitly approved backorder policy is implemented.
- Posted sale lines and payment totals must reconcile with the sale header.
- Returns must reference the original sale and create compensating stock/payment records.
- A repair job must retain its intake condition and status history.
- Product deletion is restricted when referenced by operational records.

## Currency

Store monetary amounts in integer minor units (for example, halalas) once the store's operating currency and rounding rules are confirmed. The first schema is a foundation only; the accounting module must formalize currency precision, tax configuration, and rounding before live use.


## Operational and accounting additions

- Purchase Order and Purchase Item: supplier receipt, received quantities, and cost snapshots.
- Cash Session: one active drawer session with opening/counting balances; cash payments reference the session explicitly.
- Expense: a posted expense voucher with a corresponding payment movement.
- Account, Journal Entry, and Journal Line: seeded chart of accounts and balanced double-entry postings. Posted journal entries and their lines are immutable; corrections require compensating entries.
- Repair Status History: append-only state transition history for each repair job.

Sales, purchase receipts, and expense vouchers now post corresponding journal entries inside the same SQLite transaction as their operational records. Manual journal entry screens, customer/supplier settlement allocations, returns, and period closing are not implemented yet.
