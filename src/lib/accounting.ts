import { getDatabase } from "./database";

export interface JournalLineInput {
  accountCode: string;
  debitMinor?: number;
  creditMinor?: number;
  memo?: string;
}

export interface JournalEntryInput {
  sourceType?: string;
  sourceId?: string;
  description: string;
  lines: JournalLineInput[];
}

export function validateJournalLines(lines: JournalLineInput[]): void {
  if (lines.length < 2) throw new Error("القيد المحاسبي يحتاج إلى طرفين على الأقل.");
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    const d = line.debitMinor ?? 0;
    const c = line.creditMinor ?? 0;
    if (!line.accountCode || !Number.isSafeInteger(d) || !Number.isSafeInteger(c) || d < 0 || c < 0 || (d > 0) === (c > 0)) {
      throw new Error("أحد أسطر القيد المحاسبي غير صالح.");
    }
    debit += d;
    credit += c;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) throw new Error("قيمة القيد أكبر من النطاق المسموح.");
  }
  if (debit <= 0 || debit !== credit) throw new Error("القيد المحاسبي غير متوازن؛ يجب أن يتساوى المدين والدائن.");
}

export async function postJournalEntryInTransaction(
  db: Awaited<ReturnType<typeof getDatabase>>,
  input: JournalEntryInput,
): Promise<string> {
  validateJournalLines(input.lines);
  const description = input.description.trim();
  if (description.length < 3) throw new Error("وصف القيد المحاسبي مطلوب.");

  if (input.sourceType && input.sourceId) {
    const existing = await db.select<Array<{ id: string }>>(
      "SELECT id FROM journal_entries WHERE source_type = ? AND source_id = ? LIMIT 1",
      [input.sourceType, input.sourceId],
    );
    if (existing[0]) throw new Error("يوجد قيد محاسبي مسجل لهذه العملية مسبقاً.");
  }

  const accountIds = new Map<string, string>();
  for (const line of input.lines) {
    if (accountIds.has(line.accountCode)) continue;
    const rows = await db.select<Array<{ id: string }>>(
      "SELECT id FROM accounts WHERE code = ? AND is_active = 1 LIMIT 1",
      [line.accountCode],
    );
    if (!rows[0]) throw new Error(`الحساب المحاسبي ${line.accountCode} غير موجود أو غير نشط.`);
    accountIds.set(line.accountCode, rows[0].id);
  }

  const id = crypto.randomUUID();
  const entryNumber = `JE-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  await db.execute(
    "INSERT INTO journal_entries(id, entry_number, source_type, source_id, description, status) VALUES (?, ?, ?, ?, ?, 'draft')",
    [id, entryNumber, input.sourceType ?? null, input.sourceId ?? null, description],
  );
  for (const line of input.lines) {
    await db.execute(
      "INSERT INTO journal_lines(id, journal_entry_id, account_id, debit_minor, credit_minor, memo) VALUES (?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), id, accountIds.get(line.accountCode), line.debitMinor ?? 0, line.creditMinor ?? 0, line.memo?.trim() || null],
    );
  }
  await db.execute("UPDATE journal_entries SET status = 'posted', posted_at = datetime('now') WHERE id = ?", [id]);
  return id;
}

export async function postManualJournalEntry(input: JournalEntryInput): Promise<string> {
  const db = await getDatabase();
  await db.execute("BEGIN IMMEDIATE");
  try {
    const id = await postJournalEntryInTransaction(db, input);
    await db.execute(
      "INSERT INTO audit_logs(id, action, entity_type, entity_id, after_json) VALUES (?, 'journal.posted', 'journal_entry', ?, ?)",
      [crypto.randomUUID(), id, JSON.stringify({ description: input.description, lines: input.lines.length })],
    );
    await db.execute("COMMIT");
    return id;
  } catch (error) {
    await db.execute("ROLLBACK");
    throw error;
  }
}

export interface TrialBalanceRow {
  code: string; name: string; accountType: string; debit: number; credit: number; netDebit: number;
}

export async function getTrialBalance(fromDate: string, toDate: string): Promise<TrialBalanceRow[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) {
    throw new Error("الفترة الزمنية لميزان المراجعة غير صالحة.");
  }
  const db = await getDatabase();
  const rows = await db.select<Array<{
    code: string; name: string; account_type: string; debit: number; credit: number;
  }>>(
    `SELECT a.code, a.name, a.account_type,
            COALESCE(t.debit, 0) AS debit, COALESCE(t.credit, 0) AS credit
     FROM accounts a
     LEFT JOIN (
       SELECT jl.account_id, SUM(jl.debit_minor) AS debit, SUM(jl.credit_minor) AS credit
       FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.status = 'posted' AND date(je.posted_at) BETWEEN date(?) AND date(?)
       GROUP BY jl.account_id
     ) t ON t.account_id = a.id
     ORDER BY a.code`, 
    [fromDate, toDate],
  );
  return rows.map((row) => ({
    code: row.code, name: row.name, accountType: row.account_type,
    debit: row.debit / 100, credit: row.credit / 100,
    netDebit: (row.debit - row.credit) / 100,
  }));
}

export interface JournalEntrySummary {
  id: string; entryNumber: string; sourceType: string | null; description: string;
  totalDebit: number; totalCredit: number; postedAt: string | null;
}

export async function listRecentJournalEntries(): Promise<JournalEntrySummary[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    id: string; entry_number: string; source_type: string | null; description: string;
    total_debit: number; total_credit: number; posted_at: string | null;
  }>>(
    `SELECT je.id, je.entry_number, je.source_type, je.description,
            COALESCE(SUM(jl.debit_minor), 0) AS total_debit,
            COALESCE(SUM(jl.credit_minor), 0) AS total_credit, je.posted_at
     FROM journal_entries je LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
     WHERE je.status = 'posted'
     GROUP BY je.id ORDER BY je.posted_at DESC LIMIT 100`,
  );
  return rows.map((row) => ({
    id: row.id, entryNumber: row.entry_number, sourceType: row.source_type,
    description: row.description, totalDebit: row.total_debit / 100,
    totalCredit: row.total_credit / 100, postedAt: row.posted_at,
  }));
}
