import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseServerConfig, privateHost, validateRequestHost } from '../src/cli.mjs';
import { openStore } from '../src/db.mjs';
import { seedDemo } from '../src/demo.mjs';

const env={};
test('port flag overrides environment; localhost is default',()=>{
  const config=parseServerConfig(['--port','4567'],{PORT:'3000'});
  assert.equal(config.port,4567);assert.equal(config.host,'127.0.0.1');
  assert.equal(config.exposed,false);
  assert.throws(()=>parseServerConfig(['--port','0'],env),/port/);
  assert.throws(()=>parseServerConfig(['--port','99999'],env),/port/);
  assert.throws(()=>parseServerConfig(['--port'],env),/port/);
});
test('LAN requires password; explicit port + host bind supported',()=>{
  assert.throws(()=>parseServerConfig(['--public','--port','3088'],env),/APP_PASSWORD/);
  const config=parseServerConfig(['--public','--port','3089'],{APP_PASSWORD:'a-unique-password-with-20-chars'});
  assert.equal(config.host,'0.0.0.0');assert.equal(config.port,3089);
  const specific=parseServerConfig(['--public','--host','192.168.1.20','--port','4567'],{APP_PASSWORD:'a-unique-password-with-20-chars'});
  assert.equal(specific.host,'192.168.1.20');
  assert.throws(()=>parseServerConfig(['--host','0.0.0.0'],env),/APP_PASSWORD/);
});
test('Host/origin network restrictions are bounded to private addresses',()=>{
  const config=parseServerConfig(['--public','--port','3088'],{APP_PASSWORD:'a-unique-password-with-20-chars'});
  assert.equal(validateRequestHost('192.168.1.12:3088',config),'http://192.168.1.12:3088');
  assert.equal(validateRequestHost('localhost:3088',config),'http://localhost:3088');
  assert.equal(privateHost('10.0.0.1'),true);
  assert.equal(privateHost('8.8.8.8'),false);
  assert.throws(()=>validateRequestHost('evil.example:3088',config),/private/);
  assert.throws(()=>validateRequestHost('192.168.1.12:8000',config),/port/);
  assert.throws(()=>validateRequestHost('example.org@192.168.1.12:3088',config),/Host/);
});
test('demo forbids Meta and seeds five ideas and mixed statuses only once',()=>{
  assert.throws(()=>parseServerConfig(['--demo'],{PUBLISHER:'meta'}),/mock/);
  const folder=mkdtempSync(join(tmpdir(),'pagefleet-demo-'));
  const store=openStore(folder);
  try {
    const first=seedDemo(store);
    assert.equal(first.seeded,true);assert.equal(first.pages,10);assert.equal(first.ideas,5);
    assert.ok(first.scheduled>0);
    const state=store.snapshot();
    assert.equal(state.pages.length,10);
    assert.equal(state.ideas.length,5);
    assert.ok(state.variants.some(x=>x.status==='draft'));
    assert.ok(state.variants.some(x=>x.status==='approved'));
    assert.ok(state.variants.some(x=>x.status==='scheduled'));
    assert.ok(state.deliveries.every(x=>x.provider==='mock'));
    assert.equal(seedDemo(store).seeded,false);
    assert.equal(store.snapshot().ideas.length,5);
  } finally { store.close();rmSync(folder,{recursive:true,force:true}); }
});
