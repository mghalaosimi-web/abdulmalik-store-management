import { getDatabase } from "./database";
import type { Product } from "../types";

interface ProductRow {
  id: string;
  sku: string;
  barcode: string | null;
  image_data: string | null;
  name: string;
  category: string;
  brand: string | null;
  cost_price: number;
  sale_price: number;
  quantity: number;
  min_quantity: number;
  status: "active" | "inactive";
  created_at: string;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id, sku: row.sku, barcode: row.barcode, imageData: row.image_data, name: row.name,
    category: row.category, brand: row.brand, costPrice: row.cost_price,
    salePrice: row.sale_price, quantity: row.quantity,
    minQuantity: row.min_quantity, status: row.status, createdAt: row.created_at,
  };
}

const SELECT_PRODUCT = `SELECT id, sku, barcode, image_data, name, category, brand, cost_price, sale_price,
  quantity, min_quantity, status, created_at FROM products`;

export async function listProducts(search = ""): Promise<Product[]> {
  const db = await getDatabase();
  const term = `%${search.trim()}%`;
  const rows = await db.select<ProductRow[]>(
    `${SELECT_PRODUCT} WHERE ($1 = '%%' OR name LIKE $2 OR sku LIKE $3 OR COALESCE(brand, '') LIKE $4 OR COALESCE(barcode, '') LIKE $5) ORDER BY created_at DESC`,
    [term, term, term, term, term],
  );
  return rows.map(mapProduct);
}

/** Exact barcode lookup: scanner input resolves to one catalog item immediately. */
export async function findProductByBarcode(rawBarcode: string): Promise<Product | null> {
  const barcode = rawBarcode.trim();
  if (!barcode) return null;
  const db = await getDatabase();
  const rows = await db.select<ProductRow[]>(`${SELECT_PRODUCT} WHERE barcode = $1 AND status = 'active' LIMIT 1`, [barcode]);
  return rows.length ? mapProduct(rows[0]) : null;
}

export async function createProduct(input: {
  sku: string; barcode?: string; name: string; category: string; brand?: string;
  costPrice: number; salePrice: number; quantity: number; minQuantity: number;
}): Promise<void> {
  const db = await getDatabase();
  const values = [input.sku.trim(), input.barcode?.trim() || null, input.name.trim(),
    input.category.trim(), input.brand?.trim() || null, input.costPrice,
    input.salePrice, input.quantity, input.minQuantity];
  if (!values[0] || !values[2] || !values[3]) throw new Error("الرمز والاسم والتصنيف حقول مطلوبة.");
  if (values.slice(5).some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0)) {
    throw new Error("الأسعار والكميات يجب أن تكون أرقاماً صحيحة غير سالبة.");
  }
  await db.execute(
    `INSERT INTO products (id, sku, barcode, name, category, brand, cost_price, sale_price, quantity, min_quantity, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')`,
    [crypto.randomUUID(), ...values],
  );
}
