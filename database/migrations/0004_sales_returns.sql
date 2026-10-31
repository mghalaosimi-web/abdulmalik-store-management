CREATE TABLE IF NOT EXISTS sale_returns (
  id TEXT PRIMARY KEY NOT NULL,
  return_number TEXT NOT NULL UNIQUE,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  refund_amount REAL NOT NULL CHECK (refund_amount > 0),
  tax_refund_amount REAL NOT NULL DEFAULT 0 CHECK (tax_refund_amount >= 0),
  cost_returned REAL NOT NULL DEFAULT 0 CHECK (cost_returned >= 0),
  refund_method TEXT NOT NULL CHECK (refund_method IN ('cash', 'card', 'transfer', 'mobile_wallet', 'other', 'customer_credit')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id TEXT PRIMARY KEY NOT NULL,
  return_id TEXT NOT NULL REFERENCES sale_returns(id) ON DELETE RESTRICT,
  sale_item_id TEXT NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  refund_amount REAL NOT NULL CHECK (refund_amount >= 0),
  cost_returned REAL NOT NULL CHECK (cost_returned >= 0),
  UNIQUE(return_id, sale_item_id)
);

CREATE INDEX IF NOT EXISTS idx_sale_returns_sale ON sale_returns(sale_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_sale_item ON sale_return_items(sale_item_id);

INSERT OR IGNORE INTO accounts(id, code, name, account_type, normal_balance)
VALUES ('10000000-0000-4000-8000-000000000012', '4100', 'مرتجعات المبيعات', 'revenue', 'debit');

CREATE TRIGGER IF NOT EXISTS trg_sale_returns_no_update
BEFORE UPDATE ON sale_returns
BEGIN
  SELECT RAISE(ABORT, 'posted sale returns are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_sale_returns_no_delete
BEFORE DELETE ON sale_returns
BEGIN
  SELECT RAISE(ABORT, 'posted sale returns are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_sale_return_items_no_update
BEFORE UPDATE ON sale_return_items
BEGIN
  SELECT RAISE(ABORT, 'posted sale return items are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_sale_return_items_no_delete
BEFORE DELETE ON sale_return_items
BEGIN
  SELECT RAISE(ABORT, 'posted sale return items are immutable');
END;
