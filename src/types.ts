export type ProductStatus = "active" | "inactive";

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  imageData: string | null;
  name: string;
  category: string;
  brand: string | null;
  costPrice: number;
  salePrice: number;
  quantity: number;
  minQuantity: number;
  status: ProductStatus;
  createdAt: string;
}

export interface DashboardSummary {
  productCount: number;
  lowStockCount: number;
  customerCount: number;
  supplierCount: number;
}
