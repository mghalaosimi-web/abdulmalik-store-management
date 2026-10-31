import { getDatabase } from "./database";

export interface FinancialSummary {
  invoiceCount: number;
  grossSales: number;
  netSales: number;
  costOfGoods: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  inventoryValue: number;
}

export async function getFinancialSummary(fromDate: string, toDate: string): Promise<FinancialSummary> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) {
    throw new Error("الفترة الزمنية للتقرير غير صالحة.");
  }
  const db = await getDatabase();
  const sales = await db.select<Array<{ count: number; gross_sales: number; net_sales: number }>>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS gross_sales,
            COALESCE(SUM(subtotal - discount), 0) AS net_sales
     FROM sales WHERE status = 'posted' AND date(created_at) BETWEEN date(?) AND date(?)`,
    [fromDate, toDate],
  );
  const costs = await db.select<Array<{ cost: number }>>(
    `SELECT COALESCE(SUM(si.quantity * si.unit_cost), 0) AS cost
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.status = 'posted' AND date(s.created_at) BETWEEN date(?) AND date(?)`,
    [fromDate, toDate],
  );
  const expenses = await db.select<Array<{ amount: number }>>(
    "SELECT COALESCE(SUM(amount), 0) AS amount FROM expenses WHERE date(created_at) BETWEEN date(?) AND date(?)",
    [fromDate, toDate],
  );
  const inventory = await db.select<Array<{ value: number }>>(
    "SELECT COALESCE(SUM(quantity * cost_price), 0) AS value FROM products WHERE status = 'active'",
  );
  const invoiceCount = sales[0]?.count ?? 0;
  const grossSales = sales[0]?.gross_sales ?? 0;
  const netSales = sales[0]?.net_sales ?? 0;
  const costOfGoods = costs[0]?.cost ?? 0;
  const expenseTotal = expenses[0]?.amount ?? 0;
  const grossProfit = netSales - costOfGoods;
  return {
    invoiceCount, grossSales, netSales, costOfGoods, grossProfit,
    expenses: expenseTotal, netProfit: grossProfit - expenseTotal,
    inventoryValue: inventory[0]?.value ?? 0,
  };
}
