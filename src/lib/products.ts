import { getDatabase } from "./database";
import type { Product } from "../types";

interface ProductRow {
  id: string;
  sku: string;
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
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    brand: row.brand,
    costPrice: row.cost_price,
    salePrice: row.sale_price,
    quantity: row.quantity,
    minQuantity: row.min_quantity,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listProducts(search = ""): Promise<Product[]> {
  const db = await getDatabase();
  const term = `%${search.trim()}%`;
  const rows = await db.select<ProductRow[]>(
    `SELECT id, sku, name, category, brand, cost_price, sale_price,
            quantity, min_quantity, status, created_at
     FROM products
     WHERE ($1 = '%%' OR name LIKE $2 OR sku LIKE $3 OR COALESCE(brand, '') LIKE $4)
     ORDER BY created_at DESC`,
    [term, term, term, term],
  );
  return rows.map(mapProduct);
}

export async function createProduct(input: {
  sku: string;
  name: string;
  category: string;
  brand?: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  minQuantity: number;
}): Promise<void> {
  const db = await getDatabase();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO products
      (id, sku, name, category, brand, cost_price, sale_price, quantity, min_quantity, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')`,
    [
      id, input.sku.trim(), input.name.trim(), input.category.trim(),
      input.brand?.trim() || null, input.costPrice, input.salePrice,
      input.quantity, input.minQuantity,
    ],
  );
}
