use tauri_plugin_sql::{Migration, MigrationKind};

const INITIAL_SCHEMA: &str = include_str!("../../database/migrations/0001_initial.sql");
const BARCODE_SCHEMA: &str = include_str!("../../database/migrations/0002_barcode_purchasing.sql");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration { version: 1, description: "initial_store_schema", sql: INITIAL_SCHEMA, kind: MigrationKind::Up },
        Migration { version: 2, description: "barcode_and_purchasing", sql: BARCODE_SCHEMA, kind: MigrationKind::Up },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default()
            .add_migrations("sqlite:abdulmalik-store.db", migrations)
            .build())
        .run(tauri::generate_context!())
        .expect("error while running Abdulmalik Store Management");
}
