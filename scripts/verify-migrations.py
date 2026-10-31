"""Run every SQLite migration against a fresh database and verify key invariants."""
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
connection = sqlite3.connect(":memory:")
connection.execute("PRAGMA foreign_keys = ON")

for migration in sorted((ROOT / "database" / "migrations").glob("*.sql")):
    connection.executescript(migration.read_text(encoding="utf-8"))

required_tables = {
    "products", "customers", "suppliers", "product_units", "stock_movements",
    "sales", "sale_items", "payments", "repairs", "repair_status_history",
    "purchase_orders", "purchase_items", "cash_sessions", "expenses", "audit_logs",
    "accounts", "journal_entries", "journal_lines",
}
actual_tables = {
    row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
}
missing = required_tables - actual_tables
assert not missing, f"Missing tables: {sorted(missing)}"

connection.execute(
    "INSERT INTO products(id, sku, name, category, cost_price, sale_price, quantity, min_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ("p-1", "SKU-1", "Test phone", "Phones", 100, 120, 5, 1),
)
opening = connection.execute(
    "SELECT movement_type, quantity_delta FROM stock_movements WHERE product_id = ?", ("p-1",)
).fetchone()
assert opening == ("opening", 5), f"Opening stock trigger failed: {opening}"

try:
    connection.execute("UPDATE stock_movements SET quantity_delta = 4 WHERE product_id = 'p-1'")
    raise AssertionError("Stock ledger update should be rejected")
except sqlite3.IntegrityError:
    pass

try:
    connection.execute("INSERT INTO products(id, sku, name, category) VALUES ('p-2', 'sku-1', 'Duplicate', 'Phones')")
    raise AssertionError("Case-insensitive SKU duplicate should be rejected")
except sqlite3.IntegrityError:
    pass

connection.execute("INSERT INTO audit_logs(id, action, entity_type) VALUES ('a-1', 'test', 'test')")
try:
    connection.execute("DELETE FROM audit_logs WHERE id = 'a-1'")
    raise AssertionError("Audit log deletion should be rejected")
except sqlite3.IntegrityError:
    pass

columns = {row[1] for row in connection.execute("PRAGMA table_info(payments)")}
assert "cash_session_id" in columns, "Cash payments must reference their cash session"
connection.execute("INSERT INTO cash_sessions(id, opening_amount) VALUES ('cs-1', 50)")
connection.execute("INSERT INTO payments(id, direction, method, amount, cash_session_id) VALUES ('pay-1', 'in', 'cash', 25, 'cs-1')")
assert connection.execute("SELECT SUM(amount) FROM payments WHERE cash_session_id = 'cs-1'").fetchone()[0] == 25

account_count = connection.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
assert account_count >= 11, f"Expected seeded chart of accounts, got {account_count}"
connection.execute("INSERT INTO journal_entries(id, entry_number, description, status) VALUES ('je-good', 'JE-TEST-1', 'Balanced test', 'draft')")
connection.execute("INSERT INTO journal_lines(id, journal_entry_id, account_id, debit_minor) VALUES ('jl-d1', 'je-good', (SELECT id FROM accounts WHERE code = '1000'), 1000)")
connection.execute("INSERT INTO journal_lines(id, journal_entry_id, account_id, credit_minor) VALUES ('jl-c1', 'je-good', (SELECT id FROM accounts WHERE code = '4000'), 1000)")
connection.execute("UPDATE journal_entries SET status = 'posted', posted_at = datetime('now') WHERE id = 'je-good'")
try:
    connection.execute("UPDATE journal_lines SET debit_minor = 999 WHERE id = 'jl-d1'")
    raise AssertionError("Posted journal line should be immutable")
except sqlite3.IntegrityError:
    pass
connection.execute("INSERT INTO journal_entries(id, entry_number, description, status) VALUES ('je-bad', 'JE-TEST-2', 'Unbalanced test', 'draft')")
connection.execute("INSERT INTO journal_lines(id, journal_entry_id, account_id, debit_minor) VALUES ('jl-d2', 'je-bad', (SELECT id FROM accounts WHERE code = '1000'), 1000)")
connection.execute("INSERT INTO journal_lines(id, journal_entry_id, account_id, credit_minor) VALUES ('jl-c2', 'je-bad', (SELECT id FROM accounts WHERE code = '4000'), 999)")
try:
    connection.execute("UPDATE journal_entries SET status = 'posted' WHERE id = 'je-bad'")
    raise AssertionError("Unbalanced journal must not post")
except sqlite3.IntegrityError:
    pass

try:
    connection.execute("INSERT INTO journal_entries(id, entry_number, description, status) VALUES ('je-direct', 'JE-TEST-3', 'Direct post', 'posted')")
    raise AssertionError("Journal entries must start as drafts")
except sqlite3.IntegrityError:
    pass

connection.execute("INSERT INTO sales(id, invoice_number, subtotal, total, status) VALUES ('sale-1', 'INV-1', 100, 100, 'posted')")
connection.execute("INSERT INTO sale_items(id, sale_id, product_id, quantity, unit_price, unit_cost, line_total) VALUES ('si-1', 'sale-1', 'p-1', 1, 100, 50, 100)")
try:
    connection.execute("UPDATE sales SET total = 1 WHERE id = 'sale-1'")
    raise AssertionError("Posted sales must be immutable")
except sqlite3.IntegrityError:
    pass
try:
    connection.execute("DELETE FROM sale_items WHERE id = 'si-1'")
    raise AssertionError("Posted sale items must be immutable")
except sqlite3.IntegrityError:
    pass

connection.execute("INSERT INTO suppliers(id, name) VALUES ('s-1', 'Supplier')")
connection.execute("INSERT INTO purchase_orders(id, invoice_number, supplier_id, subtotal, total) VALUES ('po-1', 'PUR-1', 's-1', 100, 100)")
connection.execute("INSERT INTO purchase_items(id, purchase_id, product_id, quantity, unit_cost, line_total) VALUES ('pi-1', 'po-1', 'p-1', 1, 100, 100)")

print(f"SQLite migrations verified: {len(required_tables)} required tables; opening stock, immutable ledgers, SKU uniqueness, cash-session attribution, seeded chart of accounts, and balanced/immutable journals, posted-sale immutability, and draft-only journal posting passed.")
