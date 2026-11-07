import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { metaConfig, tokenKey, sealToken, openToken, authorizeUrl, connectPages, scheduleOnMeta,
  appSecretProof, MetaError } from '../src/meta.mjs';
import { openStore } from '../src/db.mjs';

const key = randomBytes(32);
const cfg = { appId: '123456789', appSecret: 'secret-0123456789abcdef', version: 'v26.0', key };

/** Fake fetch that records calls and answers from a queue of [status, body] replies. */
function fakeFetch(replies) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: new URL(url), method: init.method, body: init.body });
    const next = replies.shift();
    if (next instanceof Error) throw next;
    const [status, body] = next;
    return { ok: status >= 200 && status < 300, status, text: async () => typeof body === 'string' ? body : JSON.stringify(body) };
  };
  fn.calls = calls;
  return fn;
}

test('config is optional, but partial or weak settings are rejected', () => {
  assert.equal(metaConfig({}), null);
  assert.throws(() => metaConfig({ META_APP_ID: '123456789' }), /META_APP_SECRET/);
  assert.throws(() => metaConfig({ META_APP_ID: '123456789', META_APP_SECRET: 'x'.repeat(20), TOKEN_ENCRYPTION_KEY: 'short' }), /32 bytes/);
  const ok = metaConfig({ META_APP_ID: '123456789', META_APP_SECRET: 'x'.repeat(20), TOKEN_ENCRYPTION_KEY: 'ab'.repeat(32) });
  assert.equal(ok.key.length, 32);
  assert.equal(tokenKey(key.toString('base64')).length, 32);
});

test('sealed tokens are not plaintext, round-trip, and are bound to their Page', () => {
  const sealed = sealToken(key, '111', 'EAAB-secret-token');
  assert.ok(!sealed.includes('EAAB'));
  assert.equal(openToken(key, '111', sealed), 'EAAB-secret-token');
  assert.throws(() => openToken(key, '222', sealed), /decrypt/);
  assert.throws(() => openToken(randomBytes(32), '111', sealed), /decrypt/);
  const parts = sealed.split('.'); parts[3] = Buffer.from('tampered').toString('base64');
  assert.throws(() => openToken(key, '111', parts.join('.')), /decrypt/);
});

test('authorize URL asks only for the Page publishing scopes', () => {
  const url = new URL(authorizeUrl(cfg, 'http://localhost:3088/oauth/callback', 'state123'));
  assert.equal(url.origin, 'https://www.facebook.com');
  assert.equal(url.searchParams.get('scope'), 'pages_show_list,pages_read_engagement,pages_manage_posts');
  assert.equal(url.searchParams.get('state'), 'state123');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3088/oauth/callback');
});

test('connect exchanges code for long-lived token and lists Pages with tasks', async () => {
  const f = fakeFetch([
    [200, { access_token: 'short' }],
    [200, { access_token: 'long-user' }],
    [200, { data: [{ id: '111', name: 'Test A', access_token: 'page-a', tasks: ['CREATE_CONTENT', 'MANAGE'] }, { id: 'bad', name: 'X', access_token: 'x' }] }]
  ]);
  const pages = await connectPages(cfg, 'http://localhost:3088/oauth/callback', 'code1', f);
  assert.deepEqual(pages, [{ id: '111', name: 'Test A', tasks: ['CREATE_CONTENT', 'MANAGE'], token: 'page-a' }]);
  assert.equal(f.calls[1].url.searchParams.get('grant_type'), 'fb_exchange_token');
  assert.equal(f.calls[2].url.searchParams.get('appsecret_proof'), appSecretProof(cfg.appSecret, 'long-user'));
});

test('scheduled multi-photo post uploads temporary photos and attaches them in order', async () => {
  const f = fakeFetch([[200, { id: 'p1' }], [200, { id: 'p2' }], [200, { id: '111_999' }]]);
  const when = new Date(Date.now() + 3600_000).toISOString();
  const photos = [1, 2].map(n => ({ bytes: Buffer.from('img' + n), mime: 'image/png', filename: n + '.png' }));
  const result = await scheduleOnMeta(cfg, { pageId: '111', token: 'page-a', message: 'Hello', when, photos }, f);
  assert.deepEqual(result, { remoteId: '111_999', state: 'scheduled' });
  for (const call of f.calls.slice(0, 2)) {
    assert.equal(call.url.pathname, '/v26.0/111/photos');
    assert.equal(call.body.get('published'), 'false');
    assert.equal(call.body.get('temporary'), 'true');
    assert.equal(call.body.get('appsecret_proof'), appSecretProof(cfg.appSecret, 'page-a'));
  }
  const feed = f.calls[2];
  assert.equal(feed.url.pathname, '/v26.0/111/feed');
  assert.equal(feed.body.get('published'), 'false');
  assert.equal(feed.body.get('unpublished_content_type'), 'SCHEDULED');
  assert.equal(feed.body.get('scheduled_publish_time'), String(Math.floor(Date.parse(when) / 1000)));
  assert.equal(feed.body.get('attached_media[0]'), '{"media_fbid":"p1"}');
  assert.equal(feed.body.get('attached_media[1]'), '{"media_fbid":"p2"}');
  assert.ok(!feed.url.search.includes('page-a'), 'token must not be in the URL');
});

test('Meta error replies are definitive; network failures and 5xx are unknown; 190 needs reconnect', async () => {
  const args = { pageId: '111', token: 't', message: 'm', when: new Date(Date.now() + 3600_000).toISOString() };
  const rejected = await scheduleOnMeta(cfg, args, fakeFetch([[400, { error: { code: 100, message: 'Invalid parameter' } }]])).catch(e => e);
  assert.ok(rejected instanceof MetaError); assert.equal(rejected.definitive, true); assert.equal(rejected.needsReconnect, false);
  const expired = await scheduleOnMeta(cfg, args, fakeFetch([[400, { error: { code: 190, message: 'Session expired' } }]])).catch(e => e);
  assert.equal(expired.definitive, true); assert.equal(expired.needsReconnect, true);
  const timeout = await scheduleOnMeta(cfg, args, fakeFetch([new Error('timeout')])).catch(e => e);
  assert.equal(timeout.definitive, false);
  const server = await scheduleOnMeta(cfg, args, fakeFetch([[500, { error: { code: 2, message: 'Service' } }]])).catch(e => e);
  assert.equal(server.definitive, false);
  const garbled = await scheduleOnMeta(cfg, args, fakeFetch([[200, '<html>']])).catch(e => e);
  assert.equal(garbled.definitive, false);
});

function withDB(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'pagefleet-meta-'));
  const store = openStore(dir);
  try { fn(store); } finally { store.close(); rmSync(dir, { force: true, recursive: true }); }
}

test('connections never expose tokens, lost Pages need reconnect, links require CREATE_CONTENT', () => {
  withDB(s => {
    s.saveConnections([
      { id: '111', name: 'A', tasks: ['CREATE_CONTENT'], sealed: sealToken(key, '111', 'tok-a') },
      { id: '222', name: 'B', tasks: ['ANALYZE'], sealed: sealToken(key, '222', 'tok-b') }]);
    const snap = JSON.stringify(s.snapshot());
    assert.ok(!snap.includes('token_sealed') && !snap.includes('tok-a'));
    assert.equal(s.updatePage('page-1', { name: 'P1', meta_page_id: '111' }).meta_page_id, '111');
    assert.throws(() => s.updatePage('page-2', { name: 'P2', meta_page_id: '111' }), /already linked/);
    assert.throws(() => s.updatePage('page-2', { name: 'P2', meta_page_id: '222' }), /cannot create content/);
    assert.throws(() => s.updatePage('page-2', { name: 'P2', meta_page_id: '999' }), /connected Pages/);
    s.saveConnections([{ id: '222', name: 'B', tasks: ['ANALYZE'], sealed: sealToken(key, '222', 'tok-b') }]);
    assert.equal(s.connection('111').status, 'needs_reconnect');
    assert.equal(openToken(key, '111', s.connection('111').token_sealed), 'tok-a');
  });
});

test('images keep their order, are capped at ten, and changes invalidate approval', () => {
  withDB(s => {
    const png = n => Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from([n, 0, 0, 0])]);
    const ids = [1, 2, 3].map(n => s.saveMedia(n + '.png', 'image/png', png(n)).id);
    const idea = s.createIdea({ title: 'Granite', page_ids: ['page-1'], image_ids: [ids[1], ids[0]] });
    assert.deepEqual(s.ideaImages(idea).map(m => m.id), [ids[1], ids[0]]);
    const v = s.q('SELECT * FROM variants WHERE idea_id=?', idea)[0];
    s.updateVariant(v.id, 'Text', 1); s.approve(v.id, 2);
    s.addImage(idea, ids[2]);
    assert.deepEqual(s.ideaImages(idea).map(m => m.id), [ids[1], ids[0], ids[2]]);
    assert.equal(s.variant(v.id).status, 'draft');
    assert.throws(() => s.addImage(idea, ids[2]), /already attached/);
    const more = Array.from({ length: 7 }, (_, i) => s.saveMedia('x.png', 'image/png', png(10 + i)).id);
    for (const id of more) s.addImage(idea, id);
    assert.throws(() => s.addImage(idea, s.saveMedia('y.png', 'image/png', png(99)).id), /At most 10/);
    s.clearImages(idea);
    assert.equal(s.ideaImages(idea).length, 0);
  });
});
