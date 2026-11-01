import { getDatabase } from "./database";
import { fromMinorUnits } from "./money";

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

export interface ProfitLedgerBalance { code: string; debitMinor: number; creditMinor: number }
export interface ProfitLedgerSummary {
  netSalesMinor: number;
  costOfGoodsMinor: number;
  purchaseReturnVarianceMinor: number;
  expensesMinor: number;
  grossProfitMinor: number;
  netProfitMinor: number;
}

/** Calculate operating profit from posted double-entry ledger balances. */
export function calculateProfitFromLedger(rows: ProfitLedgerBalance[]): ProfitLedgerSummary {
  const balances = new Map<string, { debit: number; credit: number }>();
  for (const row of rows) {
    if (!/^\d{4}$/.test(row.code) || !Number.isSafeInteger(row.debitMinor) || !Number.isSafeInteger(row.creditMinor) ||
        row.debitMinor < 0 || row.creditMinor < 0) {
      throw new Error("بيانات ميزان الأرباح والخسائر غير صالحة.");
    }
    const current = balances.get(row.code) ?? { debit: 0, credit: 0 };
    current.debit += row.debitMinor;
    current.credit += row.creditMinor;
    if (!Number.isSafeInteger(current.debit) || !Number.isSafeInteger(current.credit)) {
      throw new Error("إجمالي أرصدة دفتر الأستاذ أكبر من النطاق المسموح.");
    }
    balances.set(row.code, current);
  }
  const balance = (code: string) => balances.get(code) ?? { debit: 0, credit: 0 };
  const revenue = balance("4000");
  const salesReturns = balance("4100");
  const cogs = balance("5000");
  const purchaseReturnVariance = balance("5100");
  const expenses = balance("6000");
  const netSalesMinor = revenue.credit - revenue.debit - (salesReturns.debit - salesReturns.credit);
  const costOfGoodsMinor = cogs.debit - cogs.credit;
  const purchaseReturnVarianceMinor = purchaseReturnVariance.credit - purchaseReturnVariance.debit;
  const expensesMinor = expenses.debit - expenses.credit;
  const grossProfitMinor = netSalesMinor - costOfGoodsMinor + purchaseReturnVarianceMinor;
  const netProfitMinor = grossProfitMinor - expensesMinor;
  const result = [netSalesMinor, costOfGoodsMinor, purchaseReturnVarianceMinor, expensesMinor, grossProfitMinor, netProfitMinor];
  if (result.some((value) => !Number.isSafeInteger(value))) throw new Error("نتيجة التقرير المالي أكبر من النطاق المسموح.");
  return { netSalesMinor, costOfGoodsMinor, purchaseReturnVarianceMinor, expensesMinor, grossProfitMinor, netProfitMinor };
}

export async function getFinancialSummary(fromDate: string, toDate: string): Promise<FinancialSummary> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) {
    throw new Error("الفترة الزمنية للتقرير غير صالحة.");
  }
  const db = await getDatabase();
  const sales = await db.select<Array<{ count: number; gross_sales: number }>>(
    `SELECT
       (SELECT COUNT(*) FROM sales WHERE status = 'posted' AND date(created_at) BETWEEN date(?) AND date(?)) AS count,
       (SELECT COALESCE(SUM(total), 0) FROM sales WHERE status = 'posted' AND date(created_at) BETWEEN date(?) AND date(?))
         - (SELECT COALESCE(SUM(refund_amount), 0) FROM sale_returns WHERE date(created_at) BETWEEN date(?) AND date(?)) AS gross_sales`,
    [fromDate, toDate, fromDate, toDate, fromDate, toDate],
  );
  const ledgerRows = await db.select<Array<{ code: string; debit_minor: number; credit_minor: number }>>(
    `SELECT a.code, COALESCE(t.debit_minor, 0) AS debit_minor,
            COALESCE(t.credit_minor, 0) AS credit_minor
     FROM accounts a
     LEFT JOIN (
       SELECT jl.account_id, SUM(jl.debit_minor) AS debit_minor, SUM(jl.credit_minor) AS credit_minor
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.status = 'posted' AND date(je.posted_at) BETWEEN date(?) AND date(?)
       GROUP BY jl.account_id
     ) t ON t.account_id = a.id
     WHERE a.code IN ('4000', '4100', '5000', '5100', '6000')
     ORDER BY a.code`,
    [fromDate, toDate],
  );
  const profit = calculateProfitFromLedger(ledgerRows.map((row) => ({
    code: row.code, debitMinor: row.debit_minor, creditMinor: row.credit_minor,
  })));
  const inventory = await db.select<Array<{ value: number }>>(
    "SELECT COALESCE(SUM(quantity * cost_price), 0) AS value FROM products WHERE status = 'active'",
  );
  return {
    invoiceCount: sales[0]?.count ?? 0,
    grossSales: sales[0]?.gross_sales ?? 0,
    netSales: fromMinorUnits(profit.netSalesMinor),
    costOfGoods: fromMinorUnits(profit.costOfGoodsMinor),
    grossProfit: fromMinorUnits(profit.grossProfitMinor),
    expenses: fromMinorUnits(profit.expensesMinor),
    netProfit: fromMinorUnits(profit.netProfitMinor),
    inventoryValue: inventory[0]?.value ?? 0,
  };
}
