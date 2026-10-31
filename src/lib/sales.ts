import { getDatabase } from "./database";
import { calculateLineTotal, fromMinorUnits, toMinorUnits } from "./money";
import { postJournalEntryInTransaction, type JournalLineInput } from "./accounting";

export interface SaleLineInput {
  productId: string;
  quantity: number;
  discount?: number;
}

export interface CheckoutInput {
  customerId?: string | null;
  lines: SaleLineInput[];
  invoiceDiscount?: number;
  taxRateBasisPoints?: number;
  paidAmount: number;
  paymentMethod?: "cash" | "card" | "transfer" | "mobile_wallet" | "other";
  notes?: string;
}

export interface CheckoutResult {
  saleId: string;
  invoiceNumber: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
}

interface ProductForSale {
  id: string;
  sku: string;
  name: string;
  cost_price: number;
  sale_price: number;
  quantity: number;
  status: "active" | "inactive";
}

function makeInvoiceNumber(): string {
  const date = new Date();
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  return `INV-${day}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function checkoutSale(input: CheckoutInput): Promise<CheckoutResult> {
  if (!input.lines.length) throw new Error("أضف منتجاً واحداً على الأقل إلى الفاتورة.");
  if (!Number.isInteger(input.taxRateBasisPoints ?? 0) || (input.taxRateBasisPoints ?? 0) < 0 || (input.taxRateBasisPoints ?? 0) > 10000) {
    throw new Error("نسبة الضريبة غير صالحة.");
  }

  const grouped = new Map<string, number>();
  for (const line of input.lines) {
    if (!line.productId || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("تأكد من صحة المنتجات والكميات في الفاتورة.");
    }
    grouped.set(line.productId, (grouped.get(line.productId) ?? 0) + line.quantity);
  }

  const db = await getDatabase();
  const saleId = crypto.randomUUID();
  const invoiceNumber = makeInvoiceNumber();
  const paymentAmount = toMinorUnits(input.paidAmount);
  const invoiceDiscount = toMinorUnits(input.invoiceDiscount ?? 0);
  let subtotalMinor = 0;
  let costOfGoodsMinor = 0;
  const rows: Array<{ product: ProductForSale; quantity: number; lineTotalMinor: number }> = [];

  await db.execute("BEGIN IMMEDIATE");
  try {
    for (const [productId, quantity] of grouped) {
      const products = await db.select<ProductForSale[]>(
        `SELECT id, sku, name, cost_price, sale_price, quantity, status
         FROM products WHERE id = ? LIMIT 1`,
        [productId],
      );
      const product = products[0];
      if (!product || product.status !== "active") throw new Error("أحد المنتجات غير موجود أو غير نشط.");
      if (product.quantity < quantity) throw new Error(`الكمية غير كافية للمنتج: ${product.name}.`);
      const lineTotalMinor = calculateLineTotal(product.sale_price, quantity, 0);
      subtotalMinor += lineTotalMinor;
      costOfGoodsMinor += toMinorUnits(product.cost_price) * quantity;
      if (!Number.isSafeInteger(subtotalMinor) || !Number.isSafeInteger(costOfGoodsMinor)) throw new Error("إجمالي الفاتورة أو التكلفة أكبر من النطاق المسموح.");
      rows.push({ product, quantity, lineTotalMinor });
    }

    if (invoiceDiscount > subtotalMinor) throw new Error("خصم الفاتورة يتجاوز قيمة المنتجات.");
    const taxableMinor = subtotalMinor - invoiceDiscount;
    const taxMinor = Math.round((taxableMinor * (input.taxRateBasisPoints ?? 0)) / 10000);
    const totalMinor = taxableMinor + taxMinor;
    if (!Number.isSafeInteger(totalMinor)) throw new Error("إجمالي الفاتورة أكبر من النطاق المسموح.");
    if (paymentAmount > totalMinor) throw new Error("المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الفاتورة.");

    await db.execute(
      `INSERT INTO sales(id, invoice_number, customer_id, subtotal, discount, tax_amount, total, paid_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?)`,
      [saleId, invoiceNumber, input.customerId || null, fromMinorUnits(subtotalMinor), fromMinorUnits(invoiceDiscount), fromMinorUnits(taxMinor), fromMinorUnits(totalMinor), fromMinorUnits(paymentAmount), input.notes?.trim() || null],
    );

    for (const row of rows) {
      await db.execute(
        `INSERT INTO sale_items(id, sale_id, product_id, quantity, unit_price, unit_cost, discount, line_total)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        [crypto.randomUUID(), saleId, row.product.id, row.quantity, fromMinorUnits(toMinorUnits(row.product.sale_price)), fromMinorUnits(toMinorUnits(row.product.cost_price)), fromMinorUnits(row.lineTotalMinor)],
      );
      const updated = await db.execute(
        "UPDATE products SET quantity = quantity - ?, updated_at = datetime('now') WHERE id = ? AND quantity >= ?",
        [row.quantity, row.product.id, row.quantity],
      );
      if (updated.rowsAffected !== 1) throw new Error(`تعذر خصم مخزون المنتج: ${row.product.name}.`);
      await db.execute(
        `INSERT INTO stock_movements(id, product_id, movement_type, quantity_delta, reference_type, reference_id, note)
         VALUES (?, ?, 'sale', ?, 'sale', ?, ?)`,
        [crypto.randomUUID(), row.product.id, -row.quantity, saleId, `فاتورة ${invoiceNumber}`],
      );
    }

    if (paymentAmount > 0) {
      let cashSessionId: string | null = null;
      if ((input.paymentMethod ?? "cash") === "cash") {
        const sessions = await db.select<Array<{ id: string }>>("SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1");
        cashSessionId = sessions[0]?.id ?? null;
        if (!cashSessionId) throw new Error("افتح وردية الصندوق قبل تسجيل تحصيل نقدي.");
      }
      await db.execute(
        `INSERT INTO payments(id, direction, method, amount, reference_type, reference_id, note, cash_session_id)
         VALUES (?, 'in', ?, ?, 'sale', ?, ?, ?)`,
        [crypto.randomUUID(), input.paymentMethod ?? "cash", fromMinorUnits(paymentAmount), saleId, `تحصيل فاتورة ${invoiceNumber}`, cashSessionId],
      );
    }

    const journalLines: JournalLineInput[] = [];
    if (paymentAmount > 0) journalLines.push({ accountCode: (input.paymentMethod ?? "cash") === "cash" ? "1000" : "1010", debitMinor: paymentAmount, memo: "تحصيل الفاتورة" });
    if (totalMinor - paymentAmount > 0) journalLines.push({ accountCode: "1100", debitMinor: totalMinor - paymentAmount, memo: "ذمم العميل" });
    const netRevenueMinor = subtotalMinor - invoiceDiscount;
    if (netRevenueMinor > 0) journalLines.push({ accountCode: "4000", creditMinor: netRevenueMinor, memo: "إيراد المبيعات" });
    if (taxMinor > 0) journalLines.push({ accountCode: "2100", creditMinor: taxMinor, memo: "ضريبة المخرجات" });
    if (costOfGoodsMinor > 0) {
      journalLines.push({ accountCode: "5000", debitMinor: costOfGoodsMinor, memo: "تكلفة البضاعة المباعة" });
      journalLines.push({ accountCode: "1200", creditMinor: costOfGoodsMinor, memo: "تخفيض المخزون" });
    }
    if (journalLines.length >= 2) {
      await postJournalEntryInTransaction(db, {
        sourceType: "sale", sourceId: saleId,
        description: "ترحيل القيد المحاسبي للفاتورة " + invoiceNumber,
        lines: journalLines,
      });
    }

    await db.execute(
      `INSERT INTO audit_logs(id, action, entity_type, entity_id, after_json)
       VALUES (?, 'sale.posted', 'sale', ?, ?)`,
      [crypto.randomUUID(), saleId, JSON.stringify({ invoiceNumber, total: fromMinorUnits(totalMinor), paid: fromMinorUnits(paymentAmount), itemCount: rows.length })],
    );

    await db.execute("COMMIT");
    return {
      saleId, invoiceNumber,
      subtotal: fromMinorUnits(subtotalMinor),
      discount: fromMinorUnits(invoiceDiscount),
      taxAmount: fromMinorUnits(taxMinor),
      total: fromMinorUnits(totalMinor),
      paidAmount: fromMinorUnits(paymentAmount),
      balanceDue: fromMinorUnits(totalMinor - paymentAmount),
    };
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export interface RecentSale {
  id: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  paidAmount: number;
  status: string;
  createdAt: string;
}

export async function listRecentSales(): Promise<RecentSale[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    id: string; invoice_number: string; customer_name: string | null;
    total: number; paid_amount: number; status: string; created_at: string;
  }>>(
    `SELECT s.id, s.invoice_number, COALESCE(c.name, 'عميل نقدي') AS customer_name,
            s.total, s.paid_amount, s.status, s.created_at
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id
     ORDER BY s.created_at DESC LIMIT 100`,
  );
  return rows.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name ?? "عميل نقدي",
    total: row.total,
    paidAmount: row.paid_amount,
    status: row.status,
    createdAt: row.created_at,
  }));
}
