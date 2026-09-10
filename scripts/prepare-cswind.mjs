import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import pg from 'pg';

const TARGET = 'jsolution_cswind_poc';
const SOURCE = 'jsolution_ai_plm';
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const invariant = (ok, message) => { if (!ok) throw new Error(message); };
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
export async function config(root) {
  const result = {};
  for (const name of ['.dev.vars', '.env']) {
    if (await exists(path.join(root, name))) {
      for (const [key, value] of Object.entries(parseEnv(await fs.readFile(path.join(root, name), 'utf8')))) {
        if (!(key in result)) result[key] = value;
      }
    }
  }
  return result;
}
function connection(url, database) { const result = new URL(url); result.pathname = '/' + database; return result.toString(); }
export function adminConnection(url, username, password) {
  const result = new URL(connection(url, 'postgres'));
  // Credentials in URL query parameters would override the prompted credentials in pg.
  for (const key of ['user', 'password', 'dbname']) result.searchParams.delete(key);
  result.username = encodeURIComponent(username);
  result.password = encodeURIComponent(password);
  return result.toString();
}
async function promptAdmin(url) {
  invariant(process.stdin.isTTY && process.stdout.isTTY, 'Run --admin in an interactive terminal. Do not put the password in a command or config file.');
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk, encoding); callback(); } });
  const input = createInterface({ input: process.stdin, output, terminal: true });
  const controller = new AbortController();
  input.on('SIGINT', () => controller.abort());
  try {
    console.log('Use an EXISTING PostgreSQL administrator account for this copy only. No role permissions will be changed.');
    const username = (await input.question('PostgreSQL administrator [postgres]: ', { signal: controller.signal })).trim() || 'postgres';
    process.stdout.write('Password (hidden, not saved): ');
    hidden = true;
    const password = await input.question('', { signal: controller.signal });
    invariant(password.length > 0, 'An administrator password is required.');
    return adminConnection(url, username, password);
  } finally { input.close(); output.end(); process.stdout.write('\n'); }
}
async function connect(url) { const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 }); await client.connect(); return client; }
export function postgresToolEnv(value, inherited = process.env) {
  const env = { ...inherited, PGDATABASE: value, PGAPPNAME: 'cswind-copy', PGCONNECT_TIMEOUT: '10', LC_ALL: 'C', LC_MESSAGES: 'C', LANGUAGE: 'C' };
  // An empty PGSERVICE still requests a service named "" in libpq.
  // Omit service settings altogether when using the explicit connection URL.
  for (const key of Object.keys(env)) if (['PGSERVICE', 'PGSERVICEFILE'].includes(key.toUpperCase())) delete env[key];
  return env;
}
async function tools() {
  const roots = [];
  if (process.env.PG_BIN) roots.push(process.env.PG_BIN);
  roots.push(...(process.env.PATH || '').split(path.delimiter));
  if (process.platform === 'win32') {
    const base = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL');
    if (await exists(base)) for (const name of (await fs.readdir(base)).sort((a,b) => b.localeCompare(a, undefined, { numeric: true }))) roots.push(path.join(base, name, 'bin'));
  }
  const suffix = process.platform === 'win32' ? '.exe' : '';
  for (const root of roots) {
    const dump = path.join(root, 'pg_dump' + suffix), restore = path.join(root, 'pg_restore' + suffix);
    if (await exists(dump) && await exists(restore)) return { dump, restore };
  }
  throw new Error('PostgreSQL pg_dump/pg_restore not found. No software was installed. Send this result to Leo.');
}
async function run(binary, args, env, log) {
  let output = '';
  await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const capture = chunk => { output += chunk.toString(); if (output.length > 200000) output = output.slice(-200000); };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    child.on('error', () => reject(new Error('Could not start ' + path.basename(binary))));
    child.on('close', code => code === 0 ? resolve() : reject(new Error(path.basename(binary) + ' failed; see the local recovery log.')));
  }).finally(async () => {
    for (const value of [env.PGDATABASE, env.DATABASE_URL]) {
      if (!value) continue;
      output = output.replaceAll(value, '[connection redacted]');
      try { const password = decodeURIComponent(new URL(value).password); if (password) output = output.replaceAll(password, '[redacted]'); } catch {}
    }
    await fs.writeFile(log, output);
  });
}
async function counts(client) {
  const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const result = {};
  for (const { tablename } of rows) result[tablename] = (await client.query(`SELECT count(*)::text AS n FROM public.${quote(tablename)}`)).rows[0].n;
  return result;
}
async function hash(file) { const digest = createHash('sha256'); for await (const chunk of createReadStream(file)) digest.update(chunk); return digest.digest('hex'); }
export async function copyFiles(source, target) {
  let count = 0;
  if (await exists(target)) invariant(!(await fs.lstat(target)).isSymbolicLink(), 'Target storage must not contain symbolic links.');
  await fs.mkdir(target, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    invariant(!entry.isSymbolicLink(), 'Storage contains a symbolic link; manual review required.');
    const from = path.join(source, entry.name), to = path.join(target, entry.name);
    if (entry.isDirectory()) count += await copyFiles(from, to);
    else if (entry.isFile()) {
      if (await exists(to)) invariant(!(await fs.lstat(to)).isSymbolicLink(), 'Target file must not be a symbolic link.');
      const expected = await hash(from);
      if (!await exists(to)) await fs.copyFile(from, to, 1); // COPYFILE_EXCL: never overwrite existing files.
      invariant(await hash(to) === expected, 'Storage file conflict/change detected; databases have not been switched.');
      count++;
    }
  }
  return count;
}
async function checkEmpty(client) {
  const current = await counts(client);
  invariant(Object.values(current).every(value => value === '0'), 'CS WIND already contains data. Stopped without replacing it.');
}

export async function prepare() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  invariant(path.basename(root).toLowerCase() === 'jsolution-cswind-poc', 'Run only from the CS WIND repository.');
  invariant(!(await fs.lstat(root)).isSymbolicLink(), 'CS WIND root must not be a symbolic link.');
  for (const name of ['.env','.dev.vars']) if (await exists(path.join(root,name))) invariant(!(await fs.lstat(path.join(root,name))).isSymbolicLink(), 'CS WIND environment files must not be shared symbolic links.');
  const settings = await config(root);
  invariant(settings.DATABASE_URL, 'CS WIND DATABASE_URL is missing.');
  invariant(decodeURIComponent(new URL(settings.DATABASE_URL).pathname.slice(1)) === TARGET, 'CS WIND config must point to jsolution_cswind_poc.');
  invariant(!process.env.DATABASE_URL || process.env.DATABASE_URL === settings.DATABASE_URL, 'Shell DATABASE_URL differs from the CS WIND configuration.');
  const mainRoot = path.resolve(root, '..', 'jsolution-ai-plm-postgres');
  const mainSettings = await config(mainRoot);
  invariant((mainSettings.STORAGE_PROVIDER || 'local').toLowerCase() === 'local', 'Source storage is not local. No provider was changed.');
  const sourceStorage = await fs.realpath(path.resolve(mainRoot, mainSettings.STORAGE_ROOT || 'storage'));
  const targetStorage = path.join(root, 'storage-cswind');
  await fs.mkdir(targetStorage, { recursive: true });
  const targetReal = await fs.realpath(targetStorage);
  const within = (a,b) => { const relative = path.relative(a,b); return !relative || (!relative.startsWith('..') && !path.isAbsolute(relative)); };
  invariant(!within(sourceStorage,targetReal) && !within(targetReal,sourceStorage), 'Source and target storage must be physically separate.');
  const binaries = await tools();
  const id = new Date().toISOString().replace(/\D/g, '') + '_' + process.pid;
  const stageName = TARGET + '_stage_' + id, backupName = TARGET + '_before_' + id;
  const recovery = path.join(root, '.cswind-recovery', id);
  await fs.mkdir(recovery, { recursive: true });
  const dumpFile = path.join(recovery, 'source.dump');
  const url = settings.DATABASE_URL;
  const sourceUrl = connection(url, SOURCE), stageUrl = connection(url, stageName);
  const envFor = postgresToolEnv;
  let source, target, stage, admin, switched = false;
  try {
    console.log('[1/6] Checking databases and permissions (AI PLM is read-only).');
    source = await connect(sourceUrl); target = await connect(url);
    await checkEmpty(target);
    const openSessions = await target.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()');
    invariant(openSessions.rows[0].n === 0, 'Stop the CS WIND server before running this copy.');
    const owner = (await target.query('SELECT current_user AS app_user, pg_get_userbyid(datdba)=current_user AS owned FROM pg_database WHERE datname=current_database()')).rows[0];
    admin = await connect(process.argv.includes('--admin') ? await promptAdmin(url) : connection(url, 'postgres'));
    const role = (await admin.query('SELECT current_user AS admin_user,rolcreatedb,rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0];
    invariant(role.rolcreatedb || role.rolsuper, 'Current PostgreSQL account cannot create an isolated copy. Use --admin with an existing PostgreSQL administrator. No permissions were changed.');
    invariant(role.rolsuper || (owner.owned && role.admin_user === owner.app_user), 'Use an existing PostgreSQL superuser with --admin, or the owning application account with CREATEDB. No permissions were changed.');
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const expected = await counts(source);
    invariant(Number(expected.companies) > 0 && Number(expected.users) > 0 && Number(expected.projects) > 0, 'Source database has no expected business data.');
    const snapshot = (await source.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    console.log('[2/6] Creating a consistent source backup.');
    await run(binaries.dump, ['--format=custom', '--no-owner', '--no-privileges', '--snapshot=' + snapshot, '--file=' + dumpFile], envFor(sourceUrl), path.join(recovery, 'dump.log'));
    await source.query('COMMIT'); await source.end(); source = null;
    console.log('[3/6] Restoring to a NEW staging database.');
    await admin.query(`CREATE DATABASE ${quote(stageName)} OWNER ${quote(owner.app_user)} TEMPLATE template0`);
    await run(binaries.restore, ['--dbname=' + stageName, '--no-owner', '--no-privileges', '--exit-on-error', dumpFile], { ...envFor(stageUrl), PGHOST: new URL(stageUrl).hostname, PGPORT: new URL(stageUrl).port || '5432', PGUSER: decodeURIComponent(new URL(stageUrl).username), PGPASSWORD: decodeURIComponent(new URL(stageUrl).password) }, path.join(recovery, 'restore.log'));
    stage = await connect(stageUrl);
    const copied = await counts(stage);
    for (const [table,n] of Object.entries(expected)) invariant(copied[table] === n, 'Copied row count differs: ' + table);
    await stage.end(); stage = null;
    console.log('[4/6] Applying CS WIND migrations to the isolated copy.');
    await run(process.execPath, [path.join(root, 'scripts', 'migrate-postgres.mjs')], { ...process.env, DATABASE_URL: stageUrl }, path.join(recovery, 'migration.log'));
    console.log('[5/6] Copying and hashing source files without overwriting existing files.');
    const files = await copyFiles(sourceStorage, targetStorage);
    stage = await connect(stageUrl);
    const keyColumns = (await stage.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND column_name LIKE '%file_key' AND data_type IN ('text','character varying')")).rows;
    const missing = [];
    for (const column of keyColumns) {
      const { rows } = await stage.query(`SELECT DISTINCT ${quote(column.column_name)} AS key FROM public.${quote(column.table_name)} WHERE ${quote(column.column_name)} IS NOT NULL AND ${quote(column.column_name)} <> ''`);
      for (const { key } of rows) {
        const file = path.resolve(targetStorage, String(key).replaceAll('\\','/'));
        if (!within(targetStorage,file) || !await exists(file)) missing.push({ table:column.table_name, key });
      }
    }
    await stage.end(); stage = null;
    await fs.writeFile(path.join(recovery,'missing-files.json'),JSON.stringify(missing,null,2));
    if (missing.length) console.log('NOTE: Missing source file references:', missing.length, '(recorded in recovery/missing-files.json; original missing files cannot be recreated by copying).');
    // Prepare environment replacements before the database switch. Source config is never written.
    for (const name of ['.dev.vars', '.env']) {
      const file = path.join(root, name), original = await exists(file) ? await fs.readFile(file,'utf8') : '';
      await fs.writeFile(path.join(recovery, name + '.before'), original, { mode: 0o600 });
      let next = original;
      for (const [key,value] of Object.entries({ DATABASE_URL: url, STORAGE_PROVIDER: 'local', STORAGE_ROOT: './storage-cswind' })) {
        const pattern = new RegExp('^[ \\t]*(?:export[ \\t]+)?' + key + '[ \\t]*=.*$', 'gm');
        const line = key + '=' + JSON.stringify(value);
        next = pattern.test(next) ? next.replace(pattern, () => line) : next + '\n' + line + '\n';
      }
      await fs.writeFile(path.join(recovery, name + '.next'), next, { mode: 0o600 });
    }
    console.log('[6/6] Switching CS WIND only; the previous empty database is retained.');
    await checkEmpty(target); await target.end(); target = null;
    const sessions = await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname IN ($1,$2)', [TARGET,stageName]);
    invariant(sessions.rows[0].n === 0, 'Stop the CS WIND server, then retry. No database was replaced.');
    await admin.query('BEGIN');
    try {
      await admin.query(`ALTER DATABASE ${quote(TARGET)} RENAME TO ${quote(backupName)}`);
      await admin.query(`ALTER DATABASE ${quote(stageName)} RENAME TO ${quote(TARGET)}`);
      await admin.query('COMMIT'); switched = true;
    } catch (error) { await admin.query('ROLLBACK'); throw error; }
    for (const name of ['.dev.vars','.env']) await fs.copyFile(path.join(recovery,name+'.next'),path.join(root,name));
    target = await connect(url);
    const verified = await counts(target);
    for (const table of ['companies','users','projects','deliverables']) invariant(verified[table] === expected[table], 'Final verification failed: '+table);
    const report = { database: TARGET, companies: verified.companies, users: verified.users, projects: verified.projects, deliverables: verified.deliverables, verifiedFiles: files, missingFileReferences: missing.length, previousDatabase: backupName, sourceModified: false };
    await fs.writeFile(path.join(recovery,'result.json'),JSON.stringify(report,null,2));
    console.table([report]);
    console.log('DONE. Start CS WIND with: npm.cmd run dev:cswind');
  } catch (error) {
    console.error('STOPPED:', error.code || (error instanceof Error && !('severity' in error) ? error.message : 'PostgreSQL operation failed'));
    console.error(switched ? 'The copied DB is active. Configuration/final verification needs review. Do not rerun the copy.' : 'AI PLM was not changed. Existing CS WIND DB was not replaced. Staging files are retained.');
    console.error('Recovery directory:', recovery);
    process.exitCode = 1;
  } finally { for (const client of [source,target,stage,admin]) if (client) await client.end().catch(()=>undefined); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepare().catch(error => { console.error('STOPPED:', error.code || error.message); process.exitCode = 1; });
