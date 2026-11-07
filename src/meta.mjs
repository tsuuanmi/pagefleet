// Meta (Facebook) Page connection and Graph API publishing.
// Decision: docs/decisions/ADR-0001-oauth-page-connection.md
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { apiError } from './logic.mjs';

export const SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'];
const TIMEOUT_MS = 30_000;

/** Meta settings from the environment, or null when Facebook Login is not configured. */
export function metaConfig(env = process.env) {
  const version = env.META_GRAPH_VERSION || 'v26.0';
  if (!/^v\d+\.\d+$/.test(version)) throw new Error('META_GRAPH_VERSION must look like v26.0');
  const appId = env.META_APP_ID || '';
  const appSecret = env.META_APP_SECRET || '';
  const rawKey = env.TOKEN_ENCRYPTION_KEY || '';
  if (!appId && !appSecret && !rawKey) return null;
  if (!/^\d{5,30}$/.test(appId)) throw new Error('META_APP_ID must be the numeric Meta app ID');
  if (appSecret.length < 16) throw new Error('META_APP_SECRET is missing or too short');
  return { appId, appSecret, version, key: tokenKey(rawKey) };
}

/** 32-byte key given as 64 hex characters or base64. */
export function tokenKey(raw) {
  const value = String(raw || '').trim();
  const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64); generate with: openssl rand -hex 32');
  return key;
}

/** AES-256-GCM; the Meta Page ID is bound as associated data so a token cannot be moved to another Page row. */
export function sealToken(key, pageId, token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(String(pageId)));
  const body = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.');
}

export function openToken(key, pageId, sealed) {
  const [version, iv, tag, body] = String(sealed || '').split('.');
  if (version !== 'v1' || !iv || !tag || !body) throw apiError('Stored Page token is unreadable; reconnect Facebook', 409);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(String(pageId)));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw apiError('Stored Page token cannot be decrypted (wrong TOKEN_ENCRYPTION_KEY?); reconnect Facebook', 409);
  }
}

export const appSecretProof = (appSecret, token) => createHmac('sha256', appSecret).update(token).digest('hex');

export function authorizeUrl(cfg, redirectUri, state) {
  const url = new URL('https://www.facebook.com/' + cfg.version + '/dialog/oauth');
  url.search = new URLSearchParams({ client_id: cfg.appId, redirect_uri: redirectUri, state,
    response_type: 'code', scope: SCOPES.join(',') }).toString();
  return url.toString();
}

/**
 * A failed Graph call. `definitive` means Meta answered with an error, so the request did not take effect;
 * otherwise (network, timeout, 5xx, unreadable reply) the outcome is unknown and must be reconciled.
 */
export class MetaError extends Error {
  constructor(message, { definitive = false, code = null } = {}) {
    super(message);
    this.httpStatus = 502;
    this.definitive = definitive;
    this.code = code;
  }
  get needsReconnect() { return this.code === 190; }
}

async function graph(cfg, fetchImpl, method, path, params, body) {
  const url = new URL('https://graph.facebook.com/' + cfg.version + '/' + path);
  if (params) url.search = new URLSearchParams(params).toString();
  let response, text;
  try {
    response = await fetchImpl(url, { method, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    text = await response.text();
  } catch (error) {
    throw new MetaError('Meta request did not complete (' + String(error.name || 'network error') + '); outcome unknown');
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new MetaError('Meta returned an unreadable reply (HTTP ' + response.status + '); outcome unknown'); }
  if (!response.ok || data?.error) {
    const err = data?.error || {};
    const definitive = response.status >= 400 && response.status < 500 && !!data?.error;
    throw new MetaError('Meta HTTP ' + response.status + (err.code ? ' code ' + err.code : '') + ': ' +
      String(err.message || 'request rejected').slice(0, 240), { definitive, code: err.code ?? null });
  }
  return data;
}

/** Exchange an OAuth code for the Operator's Pages with long-lived Page tokens. */
export async function connectPages(cfg, redirectUri, code, fetchImpl = globalThis.fetch) {
  const short = await graph(cfg, fetchImpl, 'GET', 'oauth/access_token',
    { client_id: cfg.appId, redirect_uri: redirectUri, client_secret: cfg.appSecret, code });
  if (!short.access_token) throw new MetaError('Meta did not return a user token', { definitive: true });
  const long = await graph(cfg, fetchImpl, 'GET', 'oauth/access_token',
    { grant_type: 'fb_exchange_token', client_id: cfg.appId, client_secret: cfg.appSecret, fb_exchange_token: short.access_token });
  const userToken = long.access_token;
  if (!userToken) throw new MetaError('Meta did not return a long-lived user token', { definitive: true });
  const accounts = await graph(cfg, fetchImpl, 'GET', 'me/accounts',
    { fields: 'id,name,access_token,tasks', limit: '100', access_token: userToken,
      appsecret_proof: appSecretProof(cfg.appSecret, userToken) });
  return (accounts.data || [])
    .filter(p => /^\d+$/.test(String(p.id)) && p.access_token)
    .map(p => ({ id: String(p.id), name: String(p.name || p.id).slice(0, 200),
      tasks: Array.isArray(p.tasks) ? p.tasks.map(String) : [], token: String(p.access_token) }));
}

/**
 * Submit one Meta-native scheduled post. Photos are uploaded unpublished and temporary, then attached
 * in order to a scheduled /feed post, as Meta's Page photos reference requires for scheduled multi-photo posts.
 */
export async function scheduleOnMeta(cfg, { pageId, token, message, when, photos = [] }, fetchImpl = globalThis.fetch) {
  const auth = { access_token: token, appsecret_proof: appSecretProof(cfg.appSecret, token) };
  const scheduled = String(Math.floor(Date.parse(when) / 1000));
  const ids = [];
  for (const photo of photos) {
    const form = new FormData();
    for (const [k, v] of Object.entries({ ...auth, published: 'false', temporary: 'true' })) form.set(k, v);
    form.set('source', new Blob([photo.bytes], { type: photo.mime }), photo.filename || 'image');
    const uploaded = await graph(cfg, fetchImpl, 'POST', encodeURIComponent(pageId) + '/photos', null, form);
    if (!uploaded.id) throw new MetaError('Meta photo upload returned no ID; outcome unknown');
    ids.push(String(uploaded.id));
  }
  const fields = { ...auth, message, published: 'false', scheduled_publish_time: scheduled,
    unpublished_content_type: 'SCHEDULED' };
  ids.forEach((id, i) => { fields['attached_media[' + i + ']'] = JSON.stringify({ media_fbid: id }); });
  const post = await graph(cfg, fetchImpl, 'POST', encodeURIComponent(pageId) + '/feed', null, new URLSearchParams(fields));
  const remoteId = post.id || post.post_id;
  if (!remoteId) throw new MetaError('Meta response lacks a post ID; outcome unknown');
  return { remoteId: String(remoteId), state: 'scheduled' };
}
