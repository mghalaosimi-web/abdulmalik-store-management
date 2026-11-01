ALTER TABLE products ADD COLUMN image_data TEXT;
ALTER TABLE products ADD COLUMN image_mime_type TEXT;
CREATE INDEX IF NOT EXISTS idx_sales_created_status ON sales(created_at, status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
