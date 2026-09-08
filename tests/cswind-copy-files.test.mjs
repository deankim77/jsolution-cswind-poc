import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { adminConnection, config, copyFiles } from '../scripts/prepare-cswind.mjs';

test('temporary admin credentials preserve server settings and handle reserved password characters', () => {
  const original = 'postgresql://app:old@localhost:5433/jsolution_cswind_poc?sslmode=disable&user=app&password=old&dbname=other';
  const secret = 'a@:/?#% 한국어';
  const client = new pg.Client({ connectionString: adminConnection(original, 'copy admin', secret) });
  assert.equal(client.connectionParameters.user, 'copy admin');
  assert.equal(client.connectionParameters.password, secret);
  assert.equal(client.connectionParameters.database, 'postgres');
  assert.equal(client.connectionParameters.host, 'localhost');
  assert.equal(client.connectionParameters.port, 5433);
  assert.equal(client.connectionParameters.ssl, false);
  assert.equal(new URL(original).username, 'app');
});

test('CS WIND config matches .dev.vars precedence without exposing credentials', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'cswind-config-test-'));
  try {
    await fs.writeFile(path.join(root,'.dev.vars'),'DATABASE_URL="postgresql://example/source"\nSTORAGE_ROOT="./storage"');
    await fs.writeFile(path.join(root,'.env'),'DATABASE_URL="postgresql://example/other"\nSTORAGE_PROVIDER=local');
    const result = await config(root);
    assert.equal(result.DATABASE_URL,'postgresql://example/source');
    assert.equal(result.STORAGE_PROVIDER,'local');
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
test('file copy preserves source, verifies bytes and refuses conflicts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'cswind-file-test-'));
  const source = path.join(root,'main'), target = path.join(root,'cswind');
  try {
    await fs.mkdir(source); await fs.writeFile(path.join(source,'drawing.pdf'),'original bytes');
    assert.equal(await copyFiles(source,target),1);
    assert.equal(await copyFiles(source,target),1);
    await fs.writeFile(path.join(target,'drawing.pdf'),'existing different file');
    await assert.rejects(copyFiles(source,target),/conflict/);
    assert.equal(await fs.readFile(path.join(source,'drawing.pdf'),'utf8'),'original bytes');
    assert.equal(await fs.readFile(path.join(target,'drawing.pdf'),'utf8'),'existing different file');
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
