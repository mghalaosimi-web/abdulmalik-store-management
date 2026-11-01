CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  entry_number TEXT NOT NULL UNIQUE,
  source_type TEXT,
  source_id TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  posted_at TEXT,
  UNIQUE(source_type, source_id)
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY NOT NULL,
  journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  debit_minor INTEGER NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
  credit_minor INTEGER NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
  memo TEXT,
  CHECK ((debit_minor > 0 AND credit_minor = 0) OR (credit_minor > 0 AND debit_minor = 0))
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(posted_at);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);

INSERT OR IGNORE INTO accounts(id, code, name, account_type, normal_balance) VALUES
('10000000-0000-4000-8000-000000000001', '1000', 'الصندوق النقدي', 'asset', 'debit'),
('10000000-0000-4000-8000-000000000002', '1010', 'البنك ووسائل الدفع', 'asset', 'debit'),
('10000000-0000-4000-8000-000000000003', '1100', 'العملاء / الذمم المدينة', 'asset', 'debit'),
('10000000-0000-4000-8000-000000000004', '1200', 'المخزون', 'asset', 'debit'),
('10000000-0000-4000-8000-000000000005', '1300', 'ضريبة مدخلات قابلة للاسترداد', 'asset', 'debit'),
('10000000-0000-4000-8000-000000000006', '2000', 'الموردون / الذمم الدائنة', 'liability', 'credit'),
('10000000-0000-4000-8000-000000000007', '2100', 'ضريبة مخرجات مستحقة', 'liability', 'credit'),
('10000000-0000-4000-8000-000000000008', '3000', 'رأس المال', 'equity', 'credit'),
('10000000-0000-4000-8000-000000000009', '4000', 'إيرادات المبيعات', 'revenue', 'credit'),
('10000000-0000-4000-8000-000000000010', '5000', 'تكلفة البضاعة المباعة', 'expense', 'debit'),
('10000000-0000-4000-8000-000000000011', '6000', 'المصروفات التشغيلية', 'expense', 'debit');

CREATE TRIGGER IF NOT EXISTS trg_journal_entry_balance_before_post
BEFORE UPDATE OF status ON journal_entries
WHEN OLD.status = 'draft' AND NEW.status = 'posted'
BEGIN
  SELECT CASE
    WHEN (SELECT COALESCE(SUM(debit_minor), 0) FROM journal_lines WHERE journal_entry_id = NEW.id) <= 0
      THEN RAISE(ABORT, 'journal entry must contain a positive debit')
    WHEN (SELECT COALESCE(SUM(debit_minor), 0) FROM journal_lines WHERE journal_entry_id = NEW.id)
       <> (SELECT COALESCE(SUM(credit_minor), 0) FROM journal_lines WHERE journal_entry_id = NEW.id)
      THEN RAISE(ABORT, 'journal entry is not balanced')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_journal_entry_posted_no_update
BEFORE UPDATE ON journal_entries
WHEN OLD.status = 'posted'
BEGIN
  SELECT RAISE(ABORT, 'posted journal entries are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_journal_entry_posted_no_delete
BEFORE DELETE ON journal_entries
WHEN OLD.status = 'posted'
BEGIN
  SELECT RAISE(ABORT, 'posted journal entries are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_journal_lines_posted_no_insert
BEFORE INSERT ON journal_lines
WHEN (SELECT status FROM journal_entries WHERE id = NEW.journal_entry_id) = 'posted'
BEGIN
  SELECT RAISE(ABORT, 'posted journal lines are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_journal_lines_posted_no_update
BEFORE UPDATE ON journal_lines
WHEN (SELECT status FROM journal_entries WHERE id = OLD.journal_entry_id) = 'posted'
BEGIN
  SELECT RAISE(ABORT, 'posted journal lines are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_journal_lines_posted_no_delete
BEFORE DELETE ON journal_lines
WHEN (SELECT status FROM journal_entries WHERE id = OLD.journal_entry_id) = 'posted'
BEGIN
  SELECT RAISE(ABORT, 'posted journal lines are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_journal_entry_must_start_draft
BEFORE INSERT ON journal_entries
WHEN NEW.status <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'journal entries must be created as draft');
END;

CREATE TRIGGER IF NOT EXISTS trg_sales_posted_no_update
BEFORE UPDATE ON sales
WHEN OLD.status IN ('posted', 'returned', 'voided')
BEGIN
  SELECT RAISE(ABORT, 'posted sales are immutable; use a compensating operation');
END;

CREATE TRIGGER IF NOT EXISTS trg_sales_posted_no_delete
BEFORE DELETE ON sales
WHEN OLD.status IN ('posted', 'returned', 'voided')
BEGIN
  SELECT RAISE(ABORT, 'posted sales are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_sale_items_posted_no_update
BEFORE UPDATE ON sale_items
WHEN (SELECT status FROM sales WHERE id = OLD.sale_id) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'posted sale items are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_sale_items_posted_no_delete
BEFORE DELETE ON sale_items
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

CREATE TRIGGER IF NOT EXISTS trg_purchase_orders_posted_no_delete
BEFORE DELETE ON purchase_orders
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

CREATE TRIGGER IF NOT EXISTS trg_purchase_items_posted_no_delete
BEFORE DELETE ON purchase_items
WHEN (SELECT status FROM purchase_orders WHERE id = OLD.purchase_id) <> 'draft'
BEGIN
  SELECT RAISE(ABORT, 'posted purchase items are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_expenses_no_update
BEFORE UPDATE ON expenses
BEGIN
  SELECT RAISE(ABORT, 'posted expenses are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_expenses_no_delete
BEFORE DELETE ON expenses
BEGIN
  SELECT RAISE(ABORT, 'posted expenses are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_repair_history_no_update
BEFORE UPDATE ON repair_status_history
BEGIN
  SELECT RAISE(ABORT, 'repair status history is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_repair_history_no_delete
BEFORE DELETE ON repair_status_history
BEGIN
  SELECT RAISE(ABORT, 'repair status history is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_closed_cash_session_no_update
BEFORE UPDATE ON cash_sessions
WHEN OLD.status = 'closed'
BEGIN
  SELECT RAISE(ABORT, 'closed cash sessions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_closed_cash_session_no_delete
BEFORE DELETE ON cash_sessions
WHEN OLD.status = 'closed'
BEGIN
  SELECT RAISE(ABORT, 'closed cash sessions are immutable');
END;
