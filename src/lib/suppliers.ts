import { getDatabase } from "./database";
import type { PartyInput } from "./customers";

export interface Supplier extends PartyInput {
  id: string;
  taxNumber: string;
  createdAt: string;
}

interface SupplierRow {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; tax_number: string | null; notes: string | null; created_at: string;
}

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id, name: row.name, phone: row.phone ?? "", email: row.email ?? "",
    address: row.address ?? "", taxNumber: row.tax_number ?? "",
    notes: row.notes ?? "", createdAt: row.created_at,
  };
}

function validate(input: PartyInput): PartyInput {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 160) throw new Error("اسم المورد يجب أن يكون بين حرفين و160 حرفاً.");
  const email = input.email?.trim() ?? "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("البريد الإلكتروني غير صالح.");
  return { name, phone: input.phone?.trim() ?? "", email, address: input.address?.trim() ?? "", notes: input.notes?.trim() ?? "" };
}

export async function listSuppliers(search = ""): Promise<Supplier[]> {
  const db = await getDatabase();
  const term = `%${search.trim()}%`;
  const rows = await db.select<SupplierRow[]>(
    `SELECT id, name, phone, email, address, tax_number, notes, created_at
     FROM suppliers WHERE (? = '%%' OR name LIKE ? OR COALESCE(phone, '') LIKE ?)
     ORDER BY name COLLATE NOCASE LIMIT 500`,
    [term, term, term],
  );
  return rows.map(mapSupplier);
}

export async function createSupplier(input: PartyInput & { taxNumber?: string }): Promise<string> {
  const value = validate(input);
  const db = await getDatabase();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO suppliers(id, name, phone, email, address, tax_number, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, value.name, value.phone || null, value.email || null, value.address || null, input.taxNumber?.trim() || null, value.notes || null],
  );
  return id;
}
