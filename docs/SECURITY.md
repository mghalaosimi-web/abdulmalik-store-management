# Security and data safety

- Repository secrets must be stored in GitHub Actions secrets or a secure local secret store, never committed.
- Local database files are private business data and must remain excluded from Git.
- Establish a tested backup and restore workflow before production use.
- Restrict destructive actions and preserve audit trails.
- Validate all user input in the application layer and enforce critical invariants in SQLite.
- Use least-privilege Tauri capabilities.
- Add authentication, session locking, password hashing, and role-based authorization before multiple employees use the application.
- Do not claim compliance with Saudi tax, ZATCA, payment, or telecom requirements until requirements are verified and implemented.


## Current release warning

The current build is a development/pilot artifact, not approved for real store operations. Authentication, role-based permissions, actor attribution, backup/restore, return controls, and complete accounting are not yet implemented. Use synthetic data only until the release gates in `IMPLEMENTATION-STATUS.md` pass.
