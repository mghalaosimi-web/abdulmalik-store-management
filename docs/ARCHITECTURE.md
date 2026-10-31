# Architecture

## Architectural direction

The application is a local-first desktop system. The initial release must not depend on a remote API for core store operations.

- **Presentation:** React screens and reusable components.
- **Application services:** use-case functions that validate input and coordinate domain operations.
- **Persistence adapter:** Tauri SQL plugin backed by SQLite.
- **Native host:** Tauri 2 / Rust.
- **Database evolution:** ordered SQL migrations embedded in the Rust host.

The UI must not scatter SQL statements across components. As the project grows, move persistence calls behind typed repositories and business use cases.

## Data rules

1. Use generated UUIDs for durable identifiers.
2. Use parameterized SQL only.
3. Wrap multi-record financial and stock operations in database transactions.
4. Record immutable stock movements and audit events.
5. Treat product quantity as a cached balance that must reconcile with the stock ledger.
6. Never silently discard a posted financial operation.
7. Use explicit decimal/currency handling before implementing production accounting. JavaScript floating-point values are not an accounting ledger.

## Offline and future synchronization

The local SQLite database is the source of truth for the first single-device release. Future synchronization must introduce an explicit outbox, conflict policy, stable IDs, idempotency keys, and server-side authorization. Do not add ad-hoc background sync.

## Security boundaries

The desktop app must expose only required Tauri capabilities. Do not enable arbitrary shell, filesystem, or network access for convenience. Credentials and payment-provider secrets must never be embedded in the client.
