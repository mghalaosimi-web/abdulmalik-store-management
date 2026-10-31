import { getDatabase } from "./database";

export interface DashboardMetrics {
  productCount: number;
  lowStockCount: number;
  customerCount: number;
  salesToday: number;
  revenueToday: number;
  repairsOpen: number;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    product_count: number; low_stock_count: number; customer_count: number;
    sales_today: number; revenue_today: number; repairs_open: number;
  }>>(
    `SELECT
      (SELECT COUNT(*) FROM products WHERE status = 'active') AS product_count,
      (SELECT COUNT(*) FROM products WHERE status = 'active' AND quantity <= min_quantity) AS low_stock_count,
      (SELECT COUNT(*) FROM customers) AS customer_count,
      (SELECT COUNT(*) FROM sales WHERE status = 'posted' AND date(created_at) = date('now','localtime')) AS sales_today,
      (SELECT COALESCE(SUM(total), 0) FROM sales WHERE status = 'posted' AND date(created_at) = date('now','localtime')) AS revenue_today,
      (SELECT COUNT(*) FROM repairs WHERE status NOT IN ('delivered','cancelled')) AS repairs_open`
  );
  const row = rows[0];
  return row ? {
    productCount: row.product_count, lowStockCount: row.low_stock_count,
    customerCount: row.customer_count, salesToday: row.sales_today,
    revenueToday: row.revenue_today, repairsOpen: row.repairs_open,
  } : { productCount: 0, lowStockCount: 0, customerCount: 0, salesToday: 0, revenueToday: 0, repairsOpen: 0 };
}
