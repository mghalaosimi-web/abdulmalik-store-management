use tauri_plugin_sql::{Migration, MigrationKind};

const INITIAL_SCHEMA: &str = include_str!("../../database/migrations/0001_initial.sql");
const OPERATIONAL_SCHEMA: &str = include_str!("../../database/migrations/0002_operational_workflows.sql");
const ACCOUNTING_SCHEMA: &str = include_str!("../../database/migrations/0003_accounting_ledger.sql");
const SALES_RETURNS_SCHEMA: &str = include_str!("../../database/migrations/0004_sales_returns.sql");
const SETTLEMENT_SCHEMA: &str = include_str!("../../database/migrations/0005_settlement_allocations.sql");
const PURCHASE_RETURNS_SCHEMA: &str = include_str!("../../database/migrations/0006_purchase_returns.sql");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial_store_schema",
        sql: INITIAL_SCHEMA,
        kind: MigrationKind::Up,
    }, Migration {
        version: 2,
        description: "operational_workflows",
        sql: OPERATIONAL_SCHEMA,
        kind: MigrationKind::Up,
    }, Migration {
        version: 3,
        description: "accounting_ledger",
        sql: ACCOUNTING_SCHEMA,
        kind: MigrationKind::Up,
    }, Migration {
        version: 4,
        description: "sales_returns",
        sql: SALES_RETURNS_SCHEMA,
        kind: MigrationKind::Up,
    }, Migration {
        version: 5,
        description: "settlement_allocations",
        sql: SETTLEMENT_SCHEMA,
        kind: MigrationKind::Up,
    }, Migration {
        version: 6,
        description: "purchase_returns",
        sql: PURCHASE_RETURNS_SCHEMA,
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:abdulmalik-store.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Abdulmalik Store Management");
}
