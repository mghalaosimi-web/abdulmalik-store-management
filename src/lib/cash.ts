import { getDatabase } from "./database";
import { fromMinorUnits, toMinorUnits } from "./money";
import { postJournalEntryInTransaction } from "./accounting";

export interface CashSession {
  id: string; openingAmount: number; status: "open" | "closed"; openedAt: string;
  closingAmount: number | null; expectedAmount: number | null; variance: number | null;
}

export async function getOpenCashSession(): Promise<CashSession | null> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    id: string; opening_amount: number; status: "open" | "closed"; opened_at: string;
    closing_amount: number | null; expected_amount: number | null; variance: number | null;
  }>>("SELECT * FROM cash_sessions WHERE status = 'open' LIMIT 1");
  const row = rows[0];
  return row ? { id: row.id, openingAmount: row.opening_amount, status: row.status, openedAt: row.opened_at, closingAmount: row.closing_amount, expectedAmount: row.expected_amount, variance: row.variance } : null;
}

export async function openCashSession(openingAmount: number, openedBy?: string): Promise<string> {
  const amount = toMinorUnits(openingAmount);
  const db = await getDatabase();
  const id = crypto.randomUUID();
  await db.execute("BEGIN IMMEDIATE");
  try {
    const open = await db.select<Array<{ id: string }>>("SELECT id FROM cash_sessions WHERE status = 'open' LIMIT 1");
    if (open[0]) throw new Error("يوجد وردية صندوق مفتوحة بالفعل.");
    await db.execute(
      "INSERT INTO cash_sessions(id, opened_by, opening_amount, status) VALUES (?, ?, ?, 'open')",
      [id, openedBy ?? null, fromMinorUnits(amount)],
    );
    await db.execute("INSERT INTO audit_logs(id, action, entity_type, entity_id) VALUES (?, 'cash_session.opened', 'cash_session', ?)", [crypto.randomUUID(), id]);
    await db.execute("COMMIT");
    return id;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export async function closeCashSession(closingAmount: number): Promise<{ expected: number; variance: number }> {
  const countedMinor = toMinorUnits(closingAmount);
  const db = await getDatabase();
  await db.execute("BEGIN IMMEDIATE");
  try {
    const sessions = await db.select<Array<{ id: string; opening_amount: number; opened_at: string }>>(
      "SELECT id, opening_amount, opened_at FROM cash_sessions WHERE status = 'open' LIMIT 1",
    );
    const session = sessions[0];
    if (!session) throw new Error("لا توجد وردية صندوق مفتوحة.");
    const flows = await db.select<Array<{ direction: "in" | "out"; amount: number }>>(
      `SELECT direction, COALESCE(SUM(amount), 0) AS amount FROM payments
       WHERE method = 'cash' AND cash_session_id = ? GROUP BY direction`,
      [session.id],
    );
    let expectedMinor = toMinorUnits(session.opening_amount);
    for (const flow of flows) {
      const amount = toMinorUnits(flow.amount);
      expectedMinor += flow.direction === "in" ? amount : -amount;
    }
    if (expectedMinor < 0) throw new Error("الرصيد النقدي المتوقع سالب؛ راجع حركات الصندوق قبل الإغلاق.");
    const varianceMinor = countedMinor - expectedMinor;
    await db.execute(
      `UPDATE cash_sessions SET closing_amount = ?, expected_amount = ?, variance = ?,
       status = 'closed', closed_at = datetime('now') WHERE id = ? AND status = 'open'`,
      [fromMinorUnits(countedMinor), fromMinorUnits(expectedMinor), fromMinorUnits(varianceMinor), session.id],
    );
    await db.execute(
      "INSERT INTO audit_logs(id, action, entity_type, entity_id, after_json) VALUES (?, 'cash_session.closed', 'cash_session', ?, ?)",
      [crypto.randomUUID(), session.id, JSON.stringify({ expected: fromMinorUnits(expectedMinor), counted: fromMinorUnits(countedMinor), variance: fromMinorUnits(varianceMinor) })],
    );
    await db.execute("COMMIT");
    return { expected: fromMinorUnits(expectedMinor), variance: fromMinorUnits(varianceMinor) };
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export async function recordExpense(input: {
  description: string; amount: number; paymentMethod: "cash" | "card" | "transfer" | "mobile_wallet" | "other";
  categoryId?: string; referenceNumber?: string; notes?: string;
}): Promise<string> {
  const description = input.description.trim();
  if (description.length < 3) throw new Error("وصف المصروف مطلوب.");
  const amountMinor = toMinorUnits(input.amount);
  if (amountMinor <= 0) throw new Error("قيمة المصروف يجب أن تكون أكبر من صفر.");
  const db = await getDatabase();
  const id = crypto.randomUUID();
  await db.execute("BEGIN IMMEDIATE");
  try {
    let cashSessionId: string | null = null;
    if (input.paymentMethod === "cash") {
      const sessions = await db.select<Array<{ id: string; balance: number }>>(
        `SELECT cs.id, cs.opening_amount + COALESCE((SELECT SUM(CASE WHEN p.direction = 'in' THEN p.amount ELSE -p.amount END) FROM payments p WHERE p.cash_session_id = cs.id), 0) AS balance
         FROM cash_sessions cs WHERE cs.status = 'open' LIMIT 1`,
      );
      cashSessionId = sessions[0]?.id ?? null;
      if (!cashSessionId) throw new Error("افتح وردية الصندوق قبل تسجيل مصروف نقدي.");
      if (toMinorUnits(sessions[0].balance) < amountMinor) throw new Error("رصيد الصندوق غير كافٍ لتسجيل المصروف النقدي.");
    }
    await db.execute(
      `INSERT INTO expenses(id, category_id, description, amount, payment_method, reference_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.categoryId ?? null, description, fromMinorUnits(amountMinor), input.paymentMethod, input.referenceNumber?.trim() || null, input.notes?.trim() || null],
    );
    await db.execute(
      `INSERT INTO payments(id, direction, method, amount, reference_type, reference_id, note, cash_session_id)
       VALUES (?, 'out', ?, ?, 'expense', ?, ?, ?)`,
      [crypto.randomUUID(), input.paymentMethod, fromMinorUnits(amountMinor), id, description, cashSessionId],
    );
    await postJournalEntryInTransaction(db, {
      sourceType: "expense", sourceId: id,
      description: "إثبات المصروف: " + description,
      lines: [
        { accountCode: "6000", debitMinor: amountMinor, memo: description },
        { accountCode: input.paymentMethod === "cash" ? "1000" : "1010", creditMinor: amountMinor, memo: "سداد المصروف" },
      ],
    });
    await db.execute("INSERT INTO audit_logs(id, action, entity_type, entity_id) VALUES (?, 'expense.created', 'expense', ?)", [crypto.randomUUID(), id]);
    await db.execute("COMMIT");
    return id;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}
