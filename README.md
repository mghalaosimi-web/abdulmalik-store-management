# Abdulmalik Store Management System

Arabic-first, offline-first Windows desktop management system for a telecommunications and electronics store.

## Project status

**Foundation phase — not production-ready.** The repository is being initialized. No real store, customer, supplier, or financial data is included.

## Product goals

- Windows desktop application with Tauri 2.
- React + TypeScript user interface.
- Local SQLite database with versioned migrations.
- Arabic-first RTL experience with English-ready architecture.
- Inventory, IMEI/serial tracking, purchasing, POS, accounting, repairs, warranty, customers, suppliers, staff, reporting, and audit history.
- Offline operation for core store workflows.
- Future-ready boundaries for optional synchronization, multi-branch support, and mobile/e-commerce products.

## Initial technology decisions

| Area | Choice |
|---|---|
| Desktop shell | Tauri 2 |
| UI | React + TypeScript + Vite |
| Styling | CSS design tokens and component styles |
| Local persistence | SQLite through the official Tauri SQL plugin |
| Native layer | Rust |
| Tests | Vitest |
| CI | GitHub Actions |

Technology versions are pinned in `package.json` and `src-tauri/Cargo.toml`. Review dependency updates before adopting them.

## Getting started

Prerequisites:
- Node.js LTS
- pnpm
- Rust stable toolchain
- Tauri platform prerequisites for Windows

Install dependencies:

```bash
pnpm install
```

Run the UI in a browser for development:

```bash
pnpm dev
```

Run the desktop application:

```bash
pnpm tauri dev
```

Run checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Build the Windows installer from a Windows runner:

```bash
pnpm tauri build
```

## Data safety

- Never use real customer or financial data in tests.
- Backups must be tested by restoring them, not merely by creating files.
- Financial and stock movements must be recorded transactionally.
- Do not hard-delete posted sales, payments, stock movements, or audit events.
- Do not store credentials or payment secrets in the repository.

## Ownership and contributors

The repository is owned by `mghalaosimi-web`. Contributor access is managed in GitHub repository settings. Repository ownership must not be transferred without the owner's explicit decision.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Domain model](docs/DOMAIN-MODEL.md)
- [Security and data safety](docs/SECURITY.md)
- [Delivery roadmap](docs/ROADMAP.md)
