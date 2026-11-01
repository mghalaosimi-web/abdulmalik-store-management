use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

const INITIAL_SCHEMA: &str = include_str!("../../database/migrations/0001_initial.sql");
const BARCODE_SCHEMA: &str = include_str!("../../database/migrations/0002_barcode_purchasing.sql");
const POS_SCHEMA: &str = include_str!("../../database/migrations/0003_product_images_pos.sql");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaleItemInput {
    product_id: String,
    quantity: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaleInput {
    sale_id: String,
    invoice_number: String,
    items: Vec<SaleItemInput>,
    discount: f64,
    paid_amount: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaleResult {
    sale_id: String,
    invoice_number: String,
    subtotal: f64,
    discount: f64,
    total: f64,
    paid_amount: f64,
}

#[derive(Debug)]
struct ProductForSale {
    id: String,
    name: String,
    sale_price: f64,
    cost_price: f64,
    quantity: i64,
}

#[tauri::command]
async fn create_sale(app: tauri::AppHandle, input: SaleInput) -> Result<SaleResult, String> {
    let mut db_path = app.path().app_config_dir().map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&db_path).map_err(|error| error.to_string())?;
    db_path.push("abdulmalik-store.db");

    tauri::async_runtime::spawn_blocking(move || create_sale_transaction(db_path, input))
        .await
        .map_err(|error| error.to_string())?
}

fn create_sale_transaction(
    db_path: std::path::PathBuf,
    input: SaleInput,
) -> Result<SaleResult, String> {
    if input.items.is_empty() {
        return Err("السلة فارغة.".into());
    }
    if input.sale_id.trim().is_empty()
        || input.invoice_number.trim().is_empty()
        || !input.discount.is_finite()
        || input.discount < 0.0
        || !input.paid_amount.is_finite()
        || input.paid_amount < 0.0
    {
        return Err("بيانات الفاتورة أو المبالغ غير صحيحة.".into());
    }

    let mut quantities = BTreeMap::<String, i64>::new();
    for item in input.items {
        if item.product_id.trim().is_empty() || item.quantity <= 0 {
            return Err("كمية المنتج غير صحيحة.".into());
        }
        let quantity = quantities.entry(item.product_id).or_insert(0);
        *quantity = quantity.checked_add(item.quantity).ok_or("الكمية المطلوبة كبيرة جداً.")?;
    }

    let mut connection = Connection::open(db_path).map_err(|error| error.to_string())?;
    connection.execute_batch("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
        .map_err(|error| error.to_string())?;
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;

    let operation = (|| -> Result<SaleResult, String> {
        let mut lines = Vec::<(ProductForSale, i64)>::new();
        let mut subtotal = 0.0_f64;

        for (product_id, quantity) in quantities {
            let product = transaction
                .query_row(
                    "SELECT id, name, sale_price, cost_price, quantity FROM products WHERE id = ?1 AND status = 'active' LIMIT 1",
                    params![product_id],
                    |row| Ok(ProductForSale {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        sale_price: row.get(2)?,
                        cost_price: row.get(3)?,
                        quantity: row.get(4)?,
                    }),
                )
                .optional()
                .map_err(|error| error.to_string())?
                .ok_or_else(|| "أحد المنتجات غير موجود أو غير نشط.".to_string())?;

            if product.quantity < quantity {
                return Err(format!("المخزون غير كافٍ للمنتج: {}. المتاح: {}", product.name, product.quantity));
            }
            subtotal += product.sale_price * quantity as f64;
            lines.push((product, quantity));
        }

        if !subtotal.is_finite() {
            return Err("إجمالي الفاتورة خارج النطاق المسموح.".into());
        }
        let discount = input.discount.min(subtotal);
        let total = (subtotal - discount).max(0.0);
        if input.paid_amount < total {
            return Err("المبلغ المدفوع أقل من إجمالي الفاتورة.".into());
        }

        transaction.execute(
            "INSERT INTO sales (id, invoice_number, subtotal, discount, tax_amount, total, paid_amount, status) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, 'posted')",
            params![input.sale_id, input.invoice_number, subtotal, discount, total, input.paid_amount],
        ).map_err(|error| error.to_string())?;

        let mut remaining_discount = discount;
        for (product, quantity) in lines {
            let line_subtotal = product.sale_price * quantity as f64;
            let line_discount = remaining_discount.min(line_subtotal);
            remaining_discount -= line_discount;
            transaction.execute(
                "INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price, unit_cost, discount, line_total) VALUES (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![input.sale_id, product.id, quantity, product.sale_price, product.cost_price, line_discount, line_subtotal - line_discount],
            ).map_err(|error| error.to_string())?;

            let changed = transaction.execute(
                "UPDATE products SET quantity = quantity - ?1, updated_at = datetime('now') WHERE id = ?2 AND quantity >= ?1",
                params![quantity, product.id],
            ).map_err(|error| error.to_string())?;
            if changed != 1 {
                return Err(format!("تعذر تحديث مخزون المنتج: {}", product.name));
            }

            transaction.execute(
                "INSERT INTO stock_movements (id, product_id, movement_type, quantity_delta, reference_type, reference_id, note) VALUES (lower(hex(randomblob(16))), ?1, 'sale', ?2, 'sale', ?3, ?4)",
                params![product.id, -quantity, input.sale_id, input.invoice_number],
            ).map_err(|error| error.to_string())?;
        }

        if input.paid_amount > 0.0 {
            transaction.execute(
                "INSERT INTO payments (id, direction, method, amount, reference_type, reference_id, note) VALUES (lower(hex(randomblob(16))), 'in', 'cash', ?1, 'sale', ?2, ?3)",
                params![input.paid_amount, input.sale_id, format!("Payment for {}", input.invoice_number)],
            ).map_err(|error| error.to_string())?;
        }

        let audit_json = serde_json::json!({
            "invoiceNumber": input.invoice_number,
            "subtotal": subtotal,
            "discount": discount,
            "total": total,
            "paidAmount": input.paid_amount
        }).to_string();
        transaction.execute(
            "INSERT INTO audit_logs (id, action, entity_type, entity_id, after_json) VALUES (lower(hex(randomblob(16))), 'create', 'sale', ?1, ?2)",
            params![input.sale_id, audit_json],
        ).map_err(|error| error.to_string())?;

        Ok(SaleResult {
            sale_id: input.sale_id.clone(),
            invoice_number: input.invoice_number.clone(),
            subtotal,
            discount,
            total,
            paid_amount: input.paid_amount,
        })
    })();

    match operation {
        Ok(result) => {
            transaction.commit().map_err(|error| error.to_string())?;
            Ok(result)
        }
        Err(error) => {
            drop(transaction);
            Err(error)
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration { version: 1, description: "initial_store_schema", sql: INITIAL_SCHEMA, kind: MigrationKind::Up },
        Migration { version: 2, description: "barcode_and_purchasing", sql: BARCODE_SCHEMA, kind: MigrationKind::Up },
        Migration { version: 3, description: "product_images_and_pos_indexes", sql: POS_SCHEMA, kind: MigrationKind::Up },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:abdulmalik-store.db", migrations).build())
        .invoke_handler(tauri::generate_handler![create_sale])
        .run(tauri::generate_context!())
        .expect("error while running Abdulmalik Store Management");
}
