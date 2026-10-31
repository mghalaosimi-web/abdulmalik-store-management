PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax_amount REAL NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total REAL NOT NULL CHECK (total >= 0),
  paid_amount REAL NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'voided', 'returned')),
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
  line_total REAL NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_created ON purchase_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

CREATE TABLE IF NOT EXISTS repair_status_history (
  id TEXT PRIMARY KEY NOT NULL,
  repair_id TEXT NOT NULL REFERENCES repairs(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (to_status IN ('received', 'diagnosing', 'waiting_parts', 'in_progress', 'completed', 'delivered', 'cancelled')),
  note TEXT,
  changed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_repair_history_repair ON repair_status_history(repair_id, created_at);

CREATE TABLE IF NOT EXISTS cash_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  opened_by TEXT,
  opening_amount REAL NOT NULL CHECK (opening_amount >= 0),
  closing_amount REAL CHECK (closing_amount IS NULL OR closing_amount >= 0),
  expected_amount REAL CHECK (expected_amount IS NULL OR expected_amount >= 0),
  variance REAL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_single_open
ON cash_sessions(status) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT REFERENCES expense_categories(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'mobile_wallet', 'other')),
  reference_number TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_created ON expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

INSERT OR IGNORE INTO app_settings(key, value) VALUES
  ('currency_code', 'SAR'),
  ('currency_minor_units', '2'),
  ('store_name', 'عبدالملك للاتصالات والإلكترونيات'),
  ('tax_enabled', 'false'),
  ('tax_rate_basis_points', '0');

-- Posted ledgers are append-only. Corrections must be compensating entries.
CREATE TRIGGER IF NOT EXISTS trg_stock_movements_no_update
BEFORE UPDATE ON stock_movements
BEGIN
  SELECT RAISE(ABORT, 'stock movements are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_stock_movements_no_delete
BEFORE DELETE ON stock_movements
BEGIN
  SELECT RAISE(ABORT, 'stock movements are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update
BEFORE UPDATE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit logs are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_delete
BEFORE DELETE ON audit_logs
BEGIN
  SELECT RAISE(ABORT, 'audit logs are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_payments_no_update
BEFORE UPDATE ON payments
BEGIN
  SELECT RAISE(ABORT, 'payments are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_payments_no_delete
BEFORE DELETE ON payments
BEGIN
  SELECT RAISE(ABORT, 'payments are immutable');
END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku_nocase ON products(sku COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_nocase ON categories(name COLLATE NOCASE);

ALTER TABLE payments ADD COLUMN cash_session_id TEXT REFERENCES cash_sessions(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_payments_cash_session ON payments(cash_session_id, method, direction);
