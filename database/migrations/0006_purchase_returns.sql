CREATE TABLE IF NOT EXISTS purchase_returns (
  id TEXT PRIMARY KEY NOT NULL,
  return_number TEXT NOT NULL UNIQUE,
  purchase_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  refund_amount REAL NOT NULL CHECK (refund_amount > 0),
  tax_refund_amount REAL NOT NULL DEFAULT 0 CHECK (tax_refund_amount >= 0),
  inventory_value_returned REAL NOT NULL DEFAULT 0 CHECK (inventory_value_returned >= 0),
  refund_method TEXT NOT NULL CHECK (refund_method IN ('supplier_credit', 'cash', 'card', 'transfer', 'mobile_wallet', 'other')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id TEXT PRIMARY KEY NOT NULL,
  return_id TEXT NOT NULL REFERENCES purchase_returns(id) ON DELETE RESTRICT,
  purchase_item_id TEXT NOT NULL REFERENCES purchase_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  refund_amount REAL NOT NULL CHECK (refund_amount >= 0),
  inventory_value_returned REAL NOT NULL CHECK (inventory_value_returned >= 0),
  UNIQUE(return_id, purchase_item_id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_purchase ON purchase_returns(purchase_id, created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_purchase_item ON purchase_return_items(purchase_item_id);

INSERT OR IGNORE INTO accounts(id, code, name, account_type, normal_balance)
VALUES ('10000000-0000-4000-8000-000000000013', '5100', 'فروقات مردودات المشتريات', 'expense', 'credit');

CREATE TRIGGER IF NOT EXISTS trg_purchase_returns_no_update
BEFORE UPDATE ON purchase_returns
BEGIN SELECT RAISE(ABORT, 'posted purchase returns are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_returns_no_delete
BEFORE DELETE ON purchase_returns
BEGIN SELECT RAISE(ABORT, 'posted purchase returns are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_return_items_no_update
BEFORE UPDATE ON purchase_return_items
BEGIN SELECT RAISE(ABORT, 'posted purchase return items are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_return_items_no_delete
BEFORE DELETE ON purchase_return_items
BEGIN SELECT RAISE(ABORT, 'posted purchase return items are immutable'); END;
