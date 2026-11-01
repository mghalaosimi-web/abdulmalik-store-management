ALTER TABLE products ADD COLUMN barcode TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL AND barcode <> '';

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE RESTRICT,
  subtotal REAL NOT NULL CHECK(subtotal >= 0),
  discount REAL NOT NULL DEFAULT 0 CHECK(discount >= 0),
  total REAL NOT NULL CHECK(total >= 0),
  paid_amount REAL NOT NULL DEFAULT 0 CHECK(paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('draft','posted','voided')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
  line_total REAL NOT NULL CHECK(line_total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchases(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

CREATE TABLE IF NOT EXISTS sale_returns (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  refund_amount REAL NOT NULL CHECK(refund_amount >= 0),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  opened_by TEXT,
  opening_amount REAL NOT NULL CHECK(opening_amount >= 0),
  closing_amount REAL CHECK(closing_amount IS NULL OR closing_amount >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);
