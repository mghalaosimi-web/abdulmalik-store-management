CREATE TABLE IF NOT EXISTS sale_payment_allocations (
  id TEXT PRIMARY KEY NOT NULL,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  amount REAL NOT NULL CHECK (amount > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(payment_id, sale_id)
);

CREATE TABLE IF NOT EXISTS purchase_payment_allocations (
  id TEXT PRIMARY KEY NOT NULL,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  purchase_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  amount REAL NOT NULL CHECK (amount > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(payment_id, purchase_id)
);

CREATE INDEX IF NOT EXISTS idx_sale_allocations_sale ON sale_payment_allocations(sale_id, created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_allocations_purchase ON purchase_payment_allocations(purchase_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_sale_allocations_no_update
BEFORE UPDATE ON sale_payment_allocations
BEGIN SELECT RAISE(ABORT, 'payment allocations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_sale_allocations_no_delete
BEFORE DELETE ON sale_payment_allocations
BEGIN SELECT RAISE(ABORT, 'payment allocations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_allocations_no_update
BEFORE UPDATE ON purchase_payment_allocations
BEGIN SELECT RAISE(ABORT, 'payment allocations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_allocations_no_delete
BEFORE DELETE ON purchase_payment_allocations
BEGIN SELECT RAISE(ABORT, 'payment allocations are immutable'); END;
