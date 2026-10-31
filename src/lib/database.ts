import Database from "@tauri-apps/plugin-sql";
import { isTauri } from "@tauri-apps/api/core";

let database: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (!isTauri()) {
    throw new Error("قاعدة البيانات المحلية متاحة عند تشغيل تطبيق سطح المكتب فقط.");
  }
  if (!database) {
    database = await Database.load("sqlite:abdulmalik-store.db");
    await database.execute("PRAGMA foreign_keys = ON");
    await database.execute("PRAGMA journal_mode = WAL");
    await database.execute("PRAGMA busy_timeout = 5000");
  }
  return database;
}

export function isDesktopRuntime(): boolean {
  return isTauri();
}
