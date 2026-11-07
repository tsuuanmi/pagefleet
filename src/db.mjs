import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { uuid, now, mustText, optionalText, apiError } from './logic.mjs';

export const MAX_IMAGES = 10;

export function openStore(root = process.env.DATA_DIR || './data') {
  const folder = resolve(root);
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(folder, 'pagefleet.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, topic TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT '', voice TEXT NOT NULL DEFAULT '',
      cta TEXT NOT NULL DEFAULT '', meta_page_id TEXT NOT NULL DEFAULT '',
      token_env TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY, filename TEXT NOT NULL, mime TEXT NOT NULL,
      filepath TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, brief TEXT NOT NULL DEFAULT '',
      image_hint TEXT NOT NULL DEFAULT '', image_id TEXT REFERENCES media(id),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY, idea_id TEXT NOT NULL REFERENCES ideas(id),
      page_id TEXT NOT NULL REFERENCES pages(id), body TEXT NOT NULL DEFAULT '',
      revision INTEGER NOT NULL DEFAULT 1, approved_revision INTEGER,
      status TEXT NOT NULL DEFAULT 'draft', approved_at TEXT, updated_at TEXT NOT NULL,
      UNIQUE(idea_id, page_id)
    );
    CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY, variant_id TEXT NOT NULL REFERENCES variants(id),
      revision INTEGER NOT NULL, provider TEXT NOT NULL, state TEXT NOT NULL,
      scheduled_at TEXT NOT NULL, remote_id TEXT, remote_url TEXT, error TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_delivery ON deliveries(variant_id)
      WHERE state IN ('submitting','scheduled','unknown','published');
    CREATE TABLE IF NOT EXISTS usage (
      id TEXT PRIMARY KEY, variant_id TEXT NOT NULL REFERENCES variants(id),
      provider TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL, cost_usd REAL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS idea_media (
      idea_id TEXT NOT NULL REFERENCES ideas(id), media_id TEXT NOT NULL REFERENCES media(id),
      position INTEGER NOT NULL, PRIMARY KEY(idea_id, position), UNIQUE(idea_id, media_id)
    );
    -- Page connections from Facebook Login (ADR-0001). token_sealed is AES-256-GCM ciphertext, never plaintext.
    CREATE TABLE IF NOT EXISTS meta_pages (
      meta_page_id TEXT PRIMARY KEY, name TEXT NOT NULL, tasks TEXT NOT NULL DEFAULT '',
      token_sealed TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('connected','needs_reconnect')),
      connected_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  // One-time move of the earlier single image per idea into the ordered list.
  db.exec(`INSERT OR IGNORE INTO idea_media(idea_id,media_id,position)
    SELECT id,image_id,0 FROM ideas WHERE image_id IS NOT NULL AND id NOT IN (SELECT idea_id FROM idea_media)`);
  const count = db.prepare('SELECT count(*) AS n FROM pages').get().n;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO pages(id,name,topic,audience,voice,cta) VALUES(?,?,?,?,?,?)');
    for (let i = 1; i <= 10; i++) {
      const same = i <= 7;
      insert.run('page-' + i, 'Fanpage ' + i,
        same ? 'Chủ đề chung (chưa cấu hình)' : 'Lĩnh vực ' + (i - 7) + ' (chưa cấu hình)',
        '', same ? ['Chuyên gia','Thân thiện','Giải thích','Tư vấn','Ví dụ thực tế','Tổng hợp','Ngắn gọn'][i - 1] : 'Tự cấu hình',
        '');
    }
  }

  const q = (sql, ...args) => db.prepare(sql).all(...args);
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);

  function snapshot() {
    const pages = q('SELECT * FROM pages ORDER BY CAST(substr(id,6) AS INTEGER)');
    const ideas = q('SELECT * FROM ideas ORDER BY created_at DESC');
    const variants = q(`SELECT v.*, p.name AS page_name, i.title AS idea_title
      FROM variants v JOIN pages p ON v.page_id=p.id JOIN ideas i ON v.idea_id=i.id
      ORDER BY i.created_at DESC, p.id`);
    const deliveries = q('SELECT * FROM deliveries ORDER BY created_at DESC');
    const images = q('SELECT idea_id, media_id, position FROM idea_media ORDER BY idea_id, position');
    const connections = q(`SELECT meta_page_id, name, tasks, status, connected_at, updated_at FROM meta_pages ORDER BY name`);
    const usage = one(`SELECT count(*) AS calls, COALESCE(sum(input_tokens),0) AS input_tokens,
      COALESCE(sum(output_tokens),0) AS output_tokens, sum(cost_usd) AS cost_usd,
      sum(CASE WHEN cost_usd IS NULL THEN 1 ELSE 0 END) AS unpriced
      FROM usage WHERE created_at>=?`, new Date().toISOString().slice(0, 7) + '-01');
    return { pages, ideas, variants, deliveries, images, connections, usage, publisher: process.env.PUBLISHER === 'meta' ? 'meta' : 'mock',
      ai: { template: true, openai: !!process.env.OPENAI_API_KEY, anthropic: !!process.env.ANTHROPIC_API_KEY } };
  }

  function updatePage(id, fields) {
    if (!one('SELECT id FROM pages WHERE id=?', id)) throw apiError('Page not found', 404);
    const name = mustText(fields.name, 'Page name', 120);
    const topic = optionalText(fields.topic, 300);
    const audience = optionalText(fields.audience, 300);
    const voice = optionalText(fields.voice, 300);
    const cta = optionalText(fields.cta, 300);
    const metaId = optionalText(fields.meta_page_id, 40);
    if (metaId) {
      const link = one('SELECT tasks FROM meta_pages WHERE meta_page_id=?', metaId);
      if (!link) throw apiError('Choose a Facebook Page from your connected Pages');
      if (!link.tasks.split(',').includes('CREATE_CONTENT')) throw apiError('Your Facebook role on that Page cannot create content');
      if (one('SELECT id FROM pages WHERE meta_page_id=? AND id<>?', metaId, id)) throw apiError('That Facebook Page is already linked to another Page', 409);
    }
    run("UPDATE pages SET name=?,topic=?,audience=?,voice=?,cta=?,meta_page_id=?,token_env='' WHERE id=?",
      name,topic,audience,voice,cta,metaId,id);
    return one('SELECT * FROM pages WHERE id=?', id);
  }

  function createIdea(input) {
    const title = mustText(input.title, 'Title', 300);
    const brief = optionalText(input.brief, 5000);
    const imageHint = optionalText(input.image_hint, 400);
    const ids = [...new Set(input.page_ids || [])];
    if (!Array.isArray(input.page_ids) || ids.length < 1 || ids.length > 10) throw apiError('Choose 1–10 Pages');
    for (const id of ids) if (!one('SELECT id FROM pages WHERE id=?', id)) throw apiError('Unknown Page: ' + id);
    const imageIds = [...new Set(input.image_ids || (input.image_id ? [input.image_id] : []))];
    if (imageIds.length > MAX_IMAGES) throw apiError('At most ' + MAX_IMAGES + ' images per post');
    for (const mediaId of imageIds) if (!one('SELECT id FROM media WHERE id=?', mediaId)) throw apiError('Unknown image');
    const id=uuid(), time=now();
    db.exec('BEGIN IMMEDIATE');
    try {
      run('INSERT INTO ideas(id,title,brief,image_hint,image_id,created_at) VALUES(?,?,?,?,?,?)',
        id,title,brief,imageHint,null,time);
      imageIds.forEach((mediaId, position) => run('INSERT INTO idea_media(idea_id,media_id,position) VALUES(?,?,?)', id, mediaId, position));
      for(const pageId of ids)run('INSERT INTO variants(id,idea_id,page_id,updated_at) VALUES(?,?,?,?)',uuid(),id,pageId,time);
      db.exec('COMMIT');
    } catch(e){db.exec('ROLLBACK');throw e;}
    return id;
  }

  function variant(id) {
    const item = one(`SELECT v.*,i.title,i.brief,i.image_id,i.image_hint,p.name,p.topic,p.audience,
      p.voice,p.cta,p.meta_page_id FROM variants v
      JOIN ideas i ON v.idea_id=i.id JOIN pages p ON v.page_id=p.id WHERE v.id=?`,id);
    if(!item) throw apiError('Variant not found',404);
    return item;
  }
  function updateVariant(id, body, expectedRevision) {
    const v=variant(id);
    if (v.status === 'scheduled' || v.status === 'submitting' || v.status === 'unknown' || v.status === 'published') {
      throw apiError('Already submitted or awaiting reconciliation; cannot edit this variant',409);
    }
    if (expectedRevision !== v.revision) throw apiError('Stale revision; reload before editing',409);
    const content=optionalText(body, 5000);
    run(`UPDATE variants SET body=?,revision=revision+1,approved_revision=NULL,status='draft',approved_at=NULL,updated_at=?
      WHERE id=?`,content,now(),id);
    return variant(id);
  }
  function approve(id, expectedRevision) {
    const v=variant(id);
    if (v.revision !== expectedRevision) throw apiError('Stale revision; reload before approving',409);
    if (v.status !== 'draft' && v.status !== 'approved') throw apiError('Variant is not editable',409);
    mustText(v.body,'Post content',5000);
    run("UPDATE variants SET status='approved',approved_revision=revision,approved_at=?,updated_at=? WHERE id=?",now(),now(),id);
    return variant(id);
  }
  function reserve(id, scheduledAt, provider, expectedRevision) {
    const v=variant(id);
    if(v.status !== 'approved' || v.approved_revision !== v.revision || v.revision !== expectedRevision)
      throw apiError('Only the approved current revision can be submitted',409);
    if (one("SELECT id FROM deliveries WHERE variant_id=? AND state IN ('submitting','scheduled','unknown','published')",id))
      throw apiError('Delivery already exists; reconcile first',409);
    const deliveryId=uuid(),time=now();
    db.exec('BEGIN IMMEDIATE');
    try {
      run('INSERT INTO deliveries(id,variant_id,revision,provider,state,scheduled_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)',
        deliveryId,id,v.revision,provider,'submitting',scheduledAt,time,time);
      run("UPDATE variants SET status='submitting',updated_at=? WHERE id=?",time,id);
      db.exec('COMMIT');
    } catch(e){db.exec('ROLLBACK');throw e;}
    return { deliveryId, variant:v };
  }
  function finish(id, state, remoteId=null, error=null) {
    if(!['scheduled','unknown','failed','published'].includes(state))throw new Error('Invalid state');
    const d=one('SELECT * FROM deliveries WHERE id=?',id);
    if (!d || d.state !== 'submitting') throw apiError('Delivery is no longer submitting',409);
    db.exec('BEGIN IMMEDIATE');
    try {
      run('UPDATE deliveries SET state=?,remote_id=?,remote_url=?,error=?,updated_at=? WHERE id=?',
        state,remoteId,remoteId && state==='published'?'https://www.facebook.com/'+encodeURIComponent(remoteId):null,error,now(),id);
      run('UPDATE variants SET status=?,updated_at=? WHERE id=?',state,now(),d.variant_id);
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  function recoverInterrupted() {
    // A process may die after Meta accepted the request. Never retry automatically.
    const list=q("SELECT id FROM deliveries WHERE state='submitting'");
    for(const item of list){
      run("UPDATE deliveries SET state='unknown',error='Process interrupted: remote outcome unknown; verify manually',updated_at=? WHERE id=?",now(),item.id);
      run("UPDATE variants SET status='unknown',updated_at=? WHERE id=(SELECT variant_id FROM deliveries WHERE id=?)",now(),item.id);
    }
  }
  function recordUsage(variantId, provider, model, inputTokens, outputTokens, cost) {
    run('INSERT INTO usage VALUES (?,?,?,?,?,?,?)',uuid(),variantId,provider,model,inputTokens,outputTokens,cost,now());
  }
  function allowance() {
    const month = new Date().toISOString().slice(0,7)+'-01';
    return one('SELECT count(*) AS calls, COALESCE(sum(cost_usd),0) AS spent, sum(CASE WHEN cost_usd IS NULL THEN 1 ELSE 0 END) AS unpriced FROM usage WHERE created_at>=?',month);
  }
  function saveMedia(filename,mime,bytes) {
    const sha=createHash('sha256').update(bytes).digest('hex');
    const existing=one('SELECT * FROM media WHERE sha256=?',sha);
    if(existing)return existing;
    const id=uuid(),ext=mime==='image/png'?'.png':mime==='image/webp'?'.webp':'.jpg';
    const mediaDir=join(folder,'media');mkdirSync(mediaDir,{recursive:true,mode:0o700});
    const file=join(mediaDir,id+ext);
    writeFileSync(file,bytes,{flag:'wx',mode:0o600});
    run('INSERT INTO media VALUES(?,?,?,?,?,?)',id,filename,mime,file,bytes.length,sha);
    return one('SELECT * FROM media WHERE id=?',id);
  }
  function media(id) {return one('SELECT * FROM media WHERE id=?',id);}
  function ideaImages(ideaId) {
    return q(`SELECT m.* FROM idea_media im JOIN media m ON m.id=im.media_id WHERE im.idea_id=? ORDER BY im.position`, ideaId);
  }
  function changeImages(ideaId, change) {
    if(!one('SELECT id FROM ideas WHERE id=?',ideaId))throw apiError('Idea not found',404);
    if(one(`SELECT id FROM variants WHERE idea_id=? AND status IN ('submitting','scheduled','unknown','published') LIMIT 1`,ideaId))
      throw apiError('Cannot change images after a variant is submitted',409);
    db.exec('BEGIN IMMEDIATE');
    try {
      change();
      // Images are part of what gets approved: any change invalidates every approval of this idea.
      run("UPDATE variants SET approved_revision=NULL,status='draft',approved_at=NULL,revision=revision+1,updated_at=? WHERE idea_id=?",now(),ideaId);
      db.exec('COMMIT');
    } catch(e){db.exec('ROLLBACK');throw e;}
  }
  /** Append an image at the end of the idea's ordered list. */
  function addImage(ideaId,imageId) {
    if(!media(imageId))throw apiError('Image not found',404);
    changeImages(ideaId,()=>{
      const {n,last}=one('SELECT count(*) AS n, max(position) AS last FROM idea_media WHERE idea_id=?',ideaId);
      if(n>=MAX_IMAGES)throw apiError('At most '+MAX_IMAGES+' images per post');
      if(one('SELECT 1 AS x FROM idea_media WHERE idea_id=? AND media_id=?',ideaId,imageId))throw apiError('That image is already attached');
      run('INSERT INTO idea_media(idea_id,media_id,position) VALUES(?,?,?)',ideaId,imageId,last==null?0:last+1);
    });
  }
  function clearImages(ideaId) {
    changeImages(ideaId,()=>run('DELETE FROM idea_media WHERE idea_id=?',ideaId));
  }

  /** Store Pages returned by Facebook Login; previously connected Pages missing from the list need reconnect. */
  function saveConnections(list) {
    const time=now();
    db.exec('BEGIN IMMEDIATE');
    try {
      run("UPDATE meta_pages SET status='needs_reconnect',updated_at=?",time);
      for(const p of list){
        run(`INSERT INTO meta_pages(meta_page_id,name,tasks,token_sealed,status,connected_at,updated_at) VALUES(?,?,?,?,'connected',?,?)
          ON CONFLICT(meta_page_id) DO UPDATE SET name=excluded.name,tasks=excluded.tasks,token_sealed=excluded.token_sealed,
          status='connected',connected_at=excluded.connected_at,updated_at=excluded.updated_at`,
          p.id,p.name,p.tasks.join(','),p.sealed,time,time);
      }
      db.exec('COMMIT');
    } catch(e){db.exec('ROLLBACK');throw e;}
  }
  function connection(metaPageId) { return one('SELECT * FROM meta_pages WHERE meta_page_id=?',metaPageId); }
  function markNeedsReconnect(metaPageId) {
    run("UPDATE meta_pages SET status='needs_reconnect',updated_at=? WHERE meta_page_id=?",now(),metaPageId);
  }
  function disconnectAll() { run('DELETE FROM meta_pages'); }

  return { db, snapshot, q, one, run, updatePage, createIdea, variant, updateVariant, approve, reserve,
    finish, recoverInterrupted, recordUsage, allowance, saveMedia, media, ideaImages, addImage, clearImages,
    saveConnections, connection, markNeedsReconnect, disconnectAll, close:()=>db.close() };
}
