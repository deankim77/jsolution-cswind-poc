# CS WIND initial data copy

This command copies the existing AI PLM database and local storage into the empty CS WIND environment. Existing CS WIND source and its Git repository are retained. No new database engine or package is installed.

Stop the CS WIND development server with Ctrl+C, then run in PowerShell:

```powershell
cd C:\Projects\jsolution-cswind-poc
git pull cswind main
node scripts/prepare-cswind.mjs
```

Only after `DONE`:

```powershell
npm.cmd run dev:cswind
```

The script uses the existing `pg` package and PostgreSQL's installed `pg_dump`/`pg_restore`. It searches PATH and `C:\Program Files\PostgreSQL\<version>\bin`. If these are absent or account permissions are insufficient, it stops; it does not install software or grant permissions. `PG_BIN` can point to an existing PostgreSQL bin folder if needed.

The configured target must be `jsolution_cswind_poc`. Source is `jsolution_ai_plm` on the same server, as confirmed in this session. All public target tables must be empty. Stop CS WIND before running; the script does not terminate AI PLM connections.

1. Check target emptiness, ownership, CREATE DATABASE permission and local storage separation.
2. Export a repeatable-read snapshot and custom-format backup of the source using a read-only source connection.
3. Restore to a new staging database and compare every public table's row count with the source snapshot.
4. Apply the current CS WIND migrations to that staging database, including Production master records after company data exists.
5. Copy local files, compare SHA-256, reject symlinks/conflicting existing files, report missing DB file references.
6. Retain the previous empty DB under a backup name and switch the verified staging DB to the canonical CS WIND name in a transaction. Update only CS WIND `.dev.vars` and `.env`, then verify final counts.

The source database, source config and source files are not modified. Existing files in `storage-cswind` are not overwritten. The recovery directory `.cswind-recovery/<run>/` contains the source dump, environment backups, logs, missing file references and final summary. It contains private data and is excluded from Git. Original missing source files cannot be recovered by copying; these are counted separately in the result.

If a check fails, do not reset or delete databases. Send the STOPPED message. Staging DBs and recovery files are retained for inspection. If a failure occurs after switching the DB, the script reports that state and must not be rerun as an initial copy.

Validation: Node syntax check, built-in Node tests for environment precedence and non-overwriting/hash-verified file copy, repository architecture/UI checks. The actual Windows PostgreSQL dump/restore/switch cannot be executed from this workspace; the script performs the above checks on Z440 during execution. Rename requirements follow the [PostgreSQL ALTER DATABASE documentation](https://www.postgresql.org/docs/current/sql-alterdatabase.html).

The previously added PGlite and direct tsx dev dependencies and their test script were removed. Transitive dependencies already present in the original lockfile are retained. Tests in `tests/cswind-copy-files.test.mjs` use only Node's built-in test runner and the existing application dependencies.
