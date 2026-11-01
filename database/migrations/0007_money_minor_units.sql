-- Temporarily suspend immutable-row UPDATE guards solely for this deterministic schema backfill.
DROP TRIGGER IF EXISTS trg_payments_no_update;
DROP TRIGGER IF EXISTS trg_sales_posted_no_update;
DROP TRIGGER IF EXISTS trg_sale_items_posted_no_update;
DROP TRIGGER IF EXISTS trg_purchase_orders_posted_no_update;
DROP TRIGGER IF EXISTS trg_purchase_items_posted_no_update;
DROP TRIGGER IF EXISTS trg_expenses_no_update;
DROP TRIGGER IF EXISTS trg_closed_cash_session_no_update;
DROP TRIGGER IF EXISTS trg_sale_returns_no_update;
DROP TRIGGER IF EXISTS trg_sale_return_items_no_update;
DROP TRIGGER IF EXISTS trg_sale_allocations_no_update;
DROP TRIGGER IF EXISTS trg_purchase_allocations_no_update;
DROP TRIGGER IF EXISTS trg_purchase_returns_no_update;
DROP TRIGGER IF EXISTS trg_purchase_return_items_no_update;

-- Transitional, non-destructive money migration. Legacy REAL columns remain intact for rollback and compatibility.
-- All amounts are stored as integer minor units (halalas for SAR).
-- Signed cash variance is intentionally allowed; nullable legacy values remain NULL.
PRAGMA foreign_keys = ON;

-- products
ALTER TABLE products ADD COLUMN cost_price_minor INTEGER;
UPDATE products SET cost_price_minor = CASE WHEN cost_price IS NULL THEN NULL ELSE CAST(ROUND(cost_price * 100.0) AS INTEGER) END;
ALTER TABLE products ADD COLUMN sale_price_minor INTEGER;
UPDATE products SET sale_price_minor = CASE WHEN sale_price IS NULL THEN NULL ELSE CAST(ROUND(sale_price * 100.0) AS INTEGER) END;

-- sales
ALTER TABLE sales ADD COLUMN subtotal_minor INTEGER;
UPDATE sales SET subtotal_minor = CASE WHEN subtotal IS NULL THEN NULL ELSE CAST(ROUND(subtotal * 100.0) AS INTEGER) END;
ALTER TABLE sales ADD COLUMN discount_minor INTEGER;
UPDATE sales SET discount_minor = CASE WHEN discount IS NULL THEN NULL ELSE CAST(ROUND(discount * 100.0) AS INTEGER) END;
ALTER TABLE sales ADD COLUMN tax_amount_minor INTEGER;
UPDATE sales SET tax_amount_minor = CASE WHEN tax_amount IS NULL THEN NULL ELSE CAST(ROUND(tax_amount * 100.0) AS INTEGER) END;
ALTER TABLE sales ADD COLUMN total_minor INTEGER;
UPDATE sales SET total_minor = CASE WHEN total IS NULL THEN NULL ELSE CAST(ROUND(total * 100.0) AS INTEGER) END;
ALTER TABLE sales ADD COLUMN paid_amount_minor INTEGER;
UPDATE sales SET paid_amount_minor = CASE WHEN paid_amount IS NULL THEN NULL ELSE CAST(ROUND(paid_amount * 100.0) AS INTEGER) END;

-- sale_items
ALTER TABLE sale_items ADD COLUMN unit_price_minor INTEGER;
UPDATE sale_items SET unit_price_minor = CASE WHEN unit_price IS NULL THEN NULL ELSE CAST(ROUND(unit_price * 100.0) AS INTEGER) END;
ALTER TABLE sale_items ADD COLUMN unit_cost_minor INTEGER;
UPDATE sale_items SET unit_cost_minor = CASE WHEN unit_cost IS NULL THEN NULL ELSE CAST(ROUND(unit_cost * 100.0) AS INTEGER) END;
ALTER TABLE sale_items ADD COLUMN discount_minor INTEGER;
UPDATE sale_items SET discount_minor = CASE WHEN discount IS NULL THEN NULL ELSE CAST(ROUND(discount * 100.0) AS INTEGER) END;
ALTER TABLE sale_items ADD COLUMN line_total_minor INTEGER;
UPDATE sale_items SET line_total_minor = CASE WHEN line_total IS NULL THEN NULL ELSE CAST(ROUND(line_total * 100.0) AS INTEGER) END;

-- payments
ALTER TABLE payments ADD COLUMN amount_minor INTEGER;
UPDATE payments SET amount_minor = CASE WHEN amount IS NULL THEN NULL ELSE CAST(ROUND(amount * 100.0) AS INTEGER) END;

-- repairs
ALTER TABLE repairs ADD COLUMN estimated_cost_minor INTEGER;
UPDATE repairs SET estimated_cost_minor = CASE WHEN estimated_cost IS NULL THEN NULL ELSE CAST(ROUND(estimated_cost * 100.0) AS INTEGER) END;
ALTER TABLE repairs ADD COLUMN final_cost_minor INTEGER;
UPDATE repairs SET final_cost_minor = CASE WHEN final_cost IS NULL THEN NULL ELSE CAST(ROUND(final_cost * 100.0) AS INTEGER) END;

-- purchase_orders
ALTER TABLE purchase_orders ADD COLUMN subtotal_minor INTEGER;
UPDATE purchase_orders SET subtotal_minor = CASE WHEN subtotal IS NULL THEN NULL ELSE CAST(ROUND(subtotal * 100.0) AS INTEGER) END;
ALTER TABLE purchase_orders ADD COLUMN discount_minor INTEGER;
UPDATE purchase_orders SET discount_minor = CASE WHEN discount IS NULL THEN NULL ELSE CAST(ROUND(discount * 100.0) AS INTEGER) END;
ALTER TABLE purchase_orders ADD COLUMN tax_amount_minor INTEGER;
UPDATE purchase_orders SET tax_amount_minor = CASE WHEN tax_amount IS NULL THEN NULL ELSE CAST(ROUND(tax_amount * 100.0) AS INTEGER) END;
ALTER TABLE purchase_orders ADD COLUMN total_minor INTEGER;
UPDATE purchase_orders SET total_minor = CASE WHEN total IS NULL THEN NULL ELSE CAST(ROUND(total * 100.0) AS INTEGER) END;
ALTER TABLE purchase_orders ADD COLUMN paid_amount_minor INTEGER;
UPDATE purchase_orders SET paid_amount_minor = CASE WHEN paid_amount IS NULL THEN NULL ELSE CAST(ROUND(paid_amount * 100.0) AS INTEGER) END;

-- purchase_items
ALTER TABLE purchase_items ADD COLUMN unit_cost_minor INTEGER;
UPDATE purchase_items SET unit_cost_minor = CASE WHEN unit_cost IS NULL THEN NULL ELSE CAST(ROUND(unit_cost * 100.0) AS INTEGER) END;
ALTER TABLE purchase_items ADD COLUMN line_total_minor INTEGER;
UPDATE purchase_items SET line_total_minor = CASE WHEN line_total IS NULL THEN NULL ELSE CAST(ROUND(line_total * 100.0) AS INTEGER) END;

-- cash_sessions
ALTER TABLE cash_sessions ADD COLUMN opening_amount_minor INTEGER;
UPDATE cash_sessions SET opening_amount_minor = CASE WHEN opening_amount IS NULL THEN NULL ELSE CAST(ROUND(opening_amount * 100.0) AS INTEGER) END;
ALTER TABLE cash_sessions ADD COLUMN closing_amount_minor INTEGER;
UPDATE cash_sessions SET closing_amount_minor = CASE WHEN closing_amount IS NULL THEN NULL ELSE CAST(ROUND(closing_amount * 100.0) AS INTEGER) END;
ALTER TABLE cash_sessions ADD COLUMN expected_amount_minor INTEGER;
UPDATE cash_sessions SET expected_amount_minor = CASE WHEN expected_amount IS NULL THEN NULL ELSE CAST(ROUND(expected_amount * 100.0) AS INTEGER) END;
ALTER TABLE cash_sessions ADD COLUMN variance_minor INTEGER;
UPDATE cash_sessions SET variance_minor = CASE WHEN variance IS NULL THEN NULL ELSE CAST(ROUND(variance * 100.0) AS INTEGER) END;

-- expenses
ALTER TABLE expenses ADD COLUMN amount_minor INTEGER;
UPDATE expenses SET amount_minor = CASE WHEN amount IS NULL THEN NULL ELSE CAST(ROUND(amount * 100.0) AS INTEGER) END;

-- sale_returns
ALTER TABLE sale_returns ADD COLUMN refund_amount_minor INTEGER;
UPDATE sale_returns SET refund_amount_minor = CASE WHEN refund_amount IS NULL THEN NULL ELSE CAST(ROUND(refund_amount * 100.0) AS INTEGER) END;
ALTER TABLE sale_returns ADD COLUMN tax_refund_amount_minor INTEGER;
UPDATE sale_returns SET tax_refund_amount_minor = CASE WHEN tax_refund_amount IS NULL THEN NULL ELSE CAST(ROUND(tax_refund_amount * 100.0) AS INTEGER) END;
ALTER TABLE sale_returns ADD COLUMN cost_returned_minor INTEGER;
UPDATE sale_returns SET cost_returned_minor = CASE WHEN cost_returned IS NULL THEN NULL ELSE CAST(ROUND(cost_returned * 100.0) AS INTEGER) END;

-- sale_return_items
ALTER TABLE sale_return_items ADD COLUMN refund_amount_minor INTEGER;
UPDATE sale_return_items SET refund_amount_minor = CASE WHEN refund_amount IS NULL THEN NULL ELSE CAST(ROUND(refund_amount * 100.0) AS INTEGER) END;
ALTER TABLE sale_return_items ADD COLUMN cost_returned_minor INTEGER;
UPDATE sale_return_items SET cost_returned_minor = CASE WHEN cost_returned IS NULL THEN NULL ELSE CAST(ROUND(cost_returned * 100.0) AS INTEGER) END;

-- sale_payment_allocations
ALTER TABLE sale_payment_allocations ADD COLUMN amount_minor INTEGER;
UPDATE sale_payment_allocations SET amount_minor = CASE WHEN amount IS NULL THEN NULL ELSE CAST(ROUND(amount * 100.0) AS INTEGER) END;

-- purchase_returns
ALTER TABLE purchase_returns ADD COLUMN refund_amount_minor INTEGER;
UPDATE purchase_returns SET refund_amount_minor = CASE WHEN refund_amount IS NULL THEN NULL ELSE CAST(ROUND(refund_amount * 100.0) AS INTEGER) END;
ALTER TABLE purchase_returns ADD COLUMN tax_refund_amount_minor INTEGER;
UPDATE purchase_returns SET tax_refund_amount_minor = CASE WHEN tax_refund_amount IS NULL THEN NULL ELSE CAST(ROUND(tax_refund_amount * 100.0) AS INTEGER) END;
ALTER TABLE purchase_returns ADD COLUMN inventory_value_returned_minor INTEGER;
UPDATE purchase_returns SET inventory_value_returned_minor = CASE WHEN inventory_value_returned IS NULL THEN NULL ELSE CAST(ROUND(inventory_value_returned * 100.0) AS INTEGER) END;

-- purchase_return_items
ALTER TABLE purchase_return_items ADD COLUMN refund_amount_minor INTEGER;
UPDATE purchase_return_items SET refund_amount_minor = CASE WHEN refund_amount IS NULL THEN NULL ELSE CAST(ROUND(refund_amount * 100.0) AS INTEGER) END;
ALTER TABLE purchase_return_items ADD COLUMN inventory_value_returned_minor INTEGER;
UPDATE purchase_return_items SET inventory_value_returned_minor = CASE WHEN inventory_value_returned IS NULL THEN NULL ELSE CAST(ROUND(inventory_value_returned * 100.0) AS INTEGER) END;


-- Restore all immutable-row guards after backfill.
CREATE TRIGGER IF NOT EXISTS trg_payments_no_update
BEFORE UPDATE ON payments
BEGIN
  SELECT RAISE(ABORT, 'payments are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_sales_posted_no_update
BEFORE UPDATE ON sales
WHEN OLD.status IN ('posted', 'returned', 'voided')
BEGIN
  SELECT RAISE(ABORT, 'posted sales are immutable; use a compensating operation');
END;

CREATE TRIGGER IF NOT EXISTS trg_sale_items_posted_no_update
BEFORE UPDATE ON sale_items
WHEN (SELECT status FROM sales WHERE id = OLD.sale_id) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'posted sale items are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_purchase_orders_posted_no_update
BEFORE UPDATE ON purchase_orders
WHEN OLD.status IN ('posted', 'returned', 'voided')
BEGIN
  SELECT RAISE(ABORT, 'posted purchase orders are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_purchase_items_posted_no_update
BEFORE UPDATE ON purchase_items
WHEN (SELECT status FROM purchase_orders WHERE id = OLD.purchase_id) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'posted purchase items are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_expenses_no_update
BEFORE UPDATE ON expenses
BEGIN
  SELECT RAISE(ABORT, 'posted expenses are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_closed_cash_session_no_update
BEFORE UPDATE ON cash_sessions
WHEN OLD.status = 'closed'
BEGIN
  SELECT RAISE(ABORT, 'closed cash sessions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_sale_returns_no_update
BEFORE UPDATE ON sale_returns
BEGIN
  SELECT RAISE(ABORT, 'posted sale returns are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_sale_return_items_no_update
BEFORE UPDATE ON sale_return_items
BEGIN
  SELECT RAISE(ABORT, 'posted sale return items are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_sale_allocations_no_update
BEFORE UPDATE ON sale_payment_allocations
BEGIN SELECT RAISE(ABORT, 'payment allocations are immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_purchase_allocations_no_update
BEFORE UPDATE ON purchase_payment_allocations
BEGIN SELECT RAISE(ABORT, 'payment allocations are immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_purchase_returns_no_update
BEFORE UPDATE ON purchase_returns
BEGIN SELECT RAISE(ABORT, 'posted purchase returns are immutable'); END;

CREATE TRIGGER IF NOT EXISTS trg_purchase_return_items_no_update
BEFORE UPDATE ON purchase_return_items
BEGIN SELECT RAISE(ABORT, 'posted purchase return items are immutable'); END;
