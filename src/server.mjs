import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { timingSafeEqual, createHash, randomBytes } from 'node:crypto';
import { openStore } from './db.mjs';
import { parseServerConfig, validateRequestHost } from './cli.mjs';
import { seedDemo } from './demo.mjs';
import { mustText, verifyImage, validateSchedule, apiError } from './logic.mjs';
import { importIdeas, csvRows, xlsxRows } from './import.mjs';
import { generate, preflightGeneration, mockSchedule } from './providers.mjs';
import { metaConfig, authorizeUrl, connectPages, sealToken, openToken, scheduleOnMeta, MetaError } from './meta.mjs';

const config=parseServerConfig(process.argv.slice(2));
if (config.help) { console.log(config.usage); process.exit(0); }
const root=dirname(fileURLToPath(import.meta.url));
const { port, host, publicBase }=config;
const directory=config.demo ? join(process.env.DATA_DIR||'./data','demo') : (process.env.DATA_DIR||'./data');
const meta=config.demo ? null : metaConfig();
if(process.env.PUBLISHER==='meta' && !config.demo && !meta)
  throw new Error('PUBLISHER=meta requires META_APP_ID, META_APP_SECRET and TOKEN_ENCRYPTION_KEY (see .env.example)');
const store=openStore(directory);
store.recoverInterrupted();
if (config.demo) seedDemo(store, console.log);
const live=process.env.APP_PASSWORD||'';
const sessions=new Set();
// One-time OAuth states created by an authenticated /oauth/start; they authorize the matching callback.
const oauthStates=new Map();
const pendingAI=new Set();
let busyAI=false;
const maxReq=Number(process.env.AI_MONTHLY_REQUEST_LIMIT||200);
const maxCost=Number(process.env.AI_MONTHLY_CAP_USD||5);
if(!Number.isFinite(maxReq)||maxReq<0||!Number.isFinite(maxCost)||maxCost<0)throw new Error('Invalid AI budget limits');

function json(res,status,data,headers={}) {
  const body=Buffer.from(JSON.stringify(data));
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(body);
}
function parseBody(req,limit=6_000_000) {
  return new Promise((resolve,reject)=>{
    const list=[];let n=0;
    req.on('data',chunk=>{n+=chunk.length;if(n>limit){reject(apiError('Request too large',413));req.destroy();}else list.push(chunk);});
    req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(list).toString('utf8')||'{}'));}catch{reject(apiError('Invalid JSON'));}});
    req.on('error',reject);
  });
}
const equal=(a,b)=>{const x=Buffer.from(String(a));const y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);};
const sessionFrom=req=>((req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('pf_session='))||'').split('=')[1]||'';
function authenticated(req){
  if(!live)return true;
  const session=sessionFrom(req);
  return !!session && sessions.has(createHash('sha256').update(session).digest('hex'));
}
function checkOrigin(req){
  const origin=req.headers.origin;
  if(!origin) {
    // Browser form POSTs with missing Origin can be cross-site. Require JSON + custom header.
    if(req.headers['x-pagefleet-request']!=='1')throw apiError('Missing application request header',403);
    return;
  }
  const expected=publicBase ? new URL(publicBase).origin : validateRequestHost(req.headers.host,config);
  if(origin!==expected)throw apiError('Request origin mismatch',403);
}
function requireAuth(req){
  if(!authenticated(req))throw apiError('Login required',401);
}
// Meta allows plain-HTTP redirects only to localhost (Development mode); otherwise HTTPS via PUBLIC_BASE_URL.
function connectOrigin(){return publicBase?new URL(publicBase).origin:'http://localhost:'+port;}
function oauthRedirect(req){
  const origin=connectOrigin();
  if(new URL(origin).host!==req.headers.host)
    throw apiError('Open '+origin+' on the computer running PageFleet to connect Facebook',400);
  return origin+'/oauth/callback';
}
const limitRoutes=new Map();
function attemptLimit(req,route,limit=30){
  const key=String(req.socket.remoteAddress||'?')+':'+route;
  const now=Date.now(), previous=limitRoutes.get(key)||{start:now,count:0};
  const state=now-previous.start>60_000?{start:now,count:1}:{...previous,count:previous.count+1};
  limitRoutes.set(key,state);
  if(limitRoutes.size>5000)limitRoutes.clear();
  if(state.count>limit)throw apiError('Too many requests; retry after a minute',429);
}
async function route(req,res) {
  // Prevent Host-header rebinding attacks on the local/LAN HTTP endpoint.
  if (publicBase) {
    const wanted=new URL(publicBase).host;
    if (req.headers.host!==wanted) throw apiError('Unexpected Host header',403);
  } else {
    try { validateRequestHost(req.headers.host,config); }
    catch { throw apiError('Host is not an allowed local/private-network address',403); }
  }
  const path=new URL(req.url||'/', 'http://local').pathname;
  if(req.method==='GET'&&(path==='/'||path==='/app.js'||path==='/style.css')){
    const p=path==='/'?'index.html':path.slice(1);
    const data=readFileSync(join(root,'public',p));
    const type=p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':'text/css';
    res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Content-Length':data.length,'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    res.end(data);return;
  }
  if(path==='/api/session' && req.method==='GET'){json(res,200,{authenticated:authenticated(req),passwordRequired:!!live});return;}
  if(path==='/api/login' && req.method==='POST'){
    checkOrigin(req);attemptLimit(req,'login',5);
    const body=await parseBody(req);
    if(!live||!equal(body.password||'',live))throw apiError('Invalid password',401);
    const id=randomBytes(32).toString('hex');
    sessions.add(createHash('sha256').update(id).digest('hex'));
    json(res,200,{ok:true},{'Set-Cookie':'pf_session='+id+'; HttpOnly; SameSite=Strict; Path=/'+(publicBase?'; Secure':'')});return;
  }
  if(path==='/api/logout'&&req.method==='POST'){
    checkOrigin(req);sessions.delete(createHash('sha256').update(sessionFrom(req)).digest('hex'));
    json(res,200,{ok:true},{'Set-Cookie':'pf_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(publicBase?'; Secure':'')});return;
  }
  if(req.method==='GET'&&path==='/oauth/start'){
    if(!authenticated(req)){
      res.writeHead(302,{Location:'/?'+new URLSearchParams({oauth_error:'Log in on this address first, then click Connect Facebook again.'}),'Cache-Control':'no-store'});
      res.end();return;
    }
    if(!meta)throw apiError('Facebook Login is not configured (META_APP_ID, META_APP_SECRET, TOKEN_ENCRYPTION_KEY)',409);
    const redirectUri=oauthRedirect(req);
    for(const [k,v] of oauthStates)if(v.expires<Date.now())oauthStates.delete(k);
    if(oauthStates.size>20)throw apiError('Too many pending Facebook connections; retry in a few minutes',429);
    const stateId=randomBytes(24).toString('hex');
    oauthStates.set(stateId,{redirectUri,expires:Date.now()+10*60_000});
    res.writeHead(302,{Location:authorizeUrl(meta,redirectUri,stateId),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    res.end();return;
  }
  if(req.method==='GET'&&path==='/oauth/callback'){
    const params=new URL(req.url,'http://local').searchParams;
    const pending=oauthStates.get(params.get('state')||'');
    oauthStates.delete(params.get('state')||'');
    const back=message=>{res.writeHead(302,{Location:'/?'+new URLSearchParams(message),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();};
    if(!meta||!pending||pending.expires<Date.now())return back({oauth_error:'Facebook connection expired or was not started here; try Connect Facebook again.'});
    if(params.get('error'))return back({oauth_error:'Facebook connection cancelled: '+String(params.get('error_description')||params.get('error')).slice(0,160)});
    try{
      const pages=await connectPages(meta,pending.redirectUri,String(params.get('code')||''));
      store.saveConnections(pages.map(p=>({id:p.id,name:p.name,tasks:p.tasks,sealed:sealToken(meta.key,p.id,p.token)})));
      return back({connected:String(pages.length)});
    }catch(error){
      return back({oauth_error:'Facebook connection failed: '+String(error.message).slice(0,200)});
    }
  }
  if(!path.startsWith('/api/'))throw apiError('Not found',404);
  requireAuth(req);
  if(req.method==='GET'&&path==='/api/state'){
    const snapshot=store.snapshot();
    json(res,200,{...snapshot,demo:config.demo,ai:config.demo?{template:true,openai:false,anthropic:false}:snapshot.ai,
      facebook:{configured:!!meta,connectUrl:meta?connectOrigin()+'/oauth/start':null}});return;
  }
  if(req.method==='GET'&&path.startsWith('/api/media/')){
    const media=store.media(path.slice('/api/media/'.length));
    if(!media)throw apiError('Media not found',404);
    const data=readFileSync(media.filepath);
    res.writeHead(200,{'Content-Type':media.mime,'Content-Length':data.length,
      'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"});
    res.end(data);return;
  }
  if(req.method!=='POST')throw apiError('Unsupported method',405);
  checkOrigin(req);attemptLimit(req,path,60);
  const body=await parseBody(req);
  if(path==='/api/page'){
    const updated=store.updatePage(mustText(body.id,'Page id',40),body);
    json(res,200,{page:updated});return;
  }
  if(path==='/api/idea'){
    const id=store.createIdea(body);
    json(res,201,{id});return;
  }
  if(path==='/api/import'){
    if(!['csv','xlsx'].includes(body.format)||typeof body.data!=='string')throw apiError('Expected CSV or XLSX import');
    const bytes=Buffer.from(body.data,'base64');
    if(bytes.length>3_000_000)throw apiError('Import exceeds 3 MB');
    const rows=body.format==='csv'?csvRows(bytes.toString('utf8')):xlsxRows(bytes);
    const pages=store.q('SELECT id FROM pages').map(p=>p.id);
    const {results,errors}=importIdeas(rows,pages);
    if(results.length>200)throw apiError('Limit 200 ideas per import; split large files');
    const created=[];
    for(const item of results){
      try{created.push(store.createIdea(item));}
      catch(error){errors.push({title:item.title,error:String(error.message)});}
    }
    json(res,200,{created:created.length,errors});return;
  }
  if(path==='/api/media'){
    if(typeof body.filename!=='string'||body.filename.length>120||typeof body.data!=='string')throw apiError('Invalid image upload');
    const bytes=Buffer.from(body.data,'base64');
    const mime=verifyImage(bytes,body.mime);
    const media=store.saveMedia(body.filename,mime,bytes);
    json(res,201,{id:media.id,size:media.size});return;
  }
  if(path==='/api/attach'){
    store.addImage(mustText(body.idea_id,'Idea id',80),mustText(body.image_id,'Image id',80));
    json(res,200,{ok:true});return;
  }
  if(path==='/api/images/clear'){
    store.clearImages(mustText(body.idea_id,'Idea id',80));
    json(res,200,{ok:true});return;
  }
  if(path==='/api/facebook/disconnect'){
    store.disconnectAll();
    json(res,200,{ok:true});return;
  }
  if(path==='/api/variant'){
    const v=store.updateVariant(mustText(body.id,'Variant id',80),body.text,body.revision);
    json(res,200,{id:v.id,revision:v.revision});return;
  }
  if(path==='/api/approve'){
    const v=store.approve(mustText(body.id,'Variant id',80),body.revision);
    json(res,200,{id:v.id,revision:v.revision,status:v.status});return;
  }
  if(path==='/api/generate'){
    if(busyAI)throw apiError('Another AI generation is in progress',409);
    busyAI=true;
    try{
      const v=store.variant(mustText(body.id,'Variant id',80));
      if(!['draft','approved'].includes(v.status))throw apiError('Cannot regenerate submitted post',409);
      const provider=body.provider||'template',expected=body.revision;
      if (config.demo && provider !== 'template') throw apiError('Demo uses free offline drafts only; paid AI is disabled',409);
      if(expected!==v.revision)throw apiError('Stale revision; reload',409);
      const potential=preflightGeneration(provider);
      if(provider!=='template'){
        const a=store.allowance();
        if(a.calls>=maxReq || a.unpriced>0 || a.spent+potential>maxCost)
          throw apiError('Monthly AI usage or spend limit reached',409);
      }
      const generated=await generate(v,provider);
      const fresh=store.variant(v.id);
      if(fresh.revision!==expected)throw apiError('Variant changed during AI request; generation discarded',409);
      const edited=store.updateVariant(v.id,generated.text,expected);
      store.recordUsage(v.id,generated.provider,generated.model,generated.inputTokens,generated.outputTokens,generated.cost);
      json(res,200,{id:v.id,revision:edited.revision,cost_usd:generated.cost});return;
    }finally{busyAI=false;}
  }
  if(path==='/api/schedule'){
    const id=mustText(body.id,'Variant id',80),date=validateSchedule(body.scheduled_at);
    const provider=config.demo?'mock':process.env.PUBLISHER==='meta'?'meta':'mock';
    let token=null,photos=[];
    if(provider==='meta'){
      if(process.env.META_PUBLISH_ENABLED!=='1')throw apiError('Meta publishing must be explicitly enabled',409);
      const target=store.variant(id);
      const link=target.meta_page_id?store.connection(target.meta_page_id):null;
      if(!link)throw apiError('Link this Page to a connected Facebook Page first',409);
      if(link.status!=='connected')throw apiError('Facebook Page needs reconnect; use Connect Facebook again',409);
      token=openToken(meta.key,link.meta_page_id,link.token_sealed);
      // Read local files before reserving: a local failure here must not leave an "unknown" delivery.
      photos=store.ideaImages(target.idea_id).map(m=>({bytes:readFileSync(m.filepath),mime:m.mime,filename:m.filename}));
    }
    // Reserve before network calls, so retries never silently double-publish.
    const {deliveryId,variant:v}=store.reserve(id,date,provider,body.revision);
    try{
      const result=provider==='meta'
        ? await scheduleOnMeta(meta,{pageId:v.meta_page_id,token,message:v.body,when:date,photos})
        : mockSchedule();
      store.finish(deliveryId,result.state,result.remoteId);
      json(res,200,{deliveryId,state:result.state,provider,remoteId:result.remoteId});return;
    }catch(error){
      // Meta answered with an error: nothing was created, so the delivery failed. Anything else
      // (timeout, network, unreadable reply, local crash) may have reached Meta: unknown, never retried blindly.
      const definitive=provider!=='meta'||(error instanceof MetaError&&error.definitive);
      if(error instanceof MetaError&&error.needsReconnect)store.markNeedsReconnect(v.meta_page_id);
      store.finish(deliveryId,definitive?'failed':'unknown',null,String(error.message||'Submission failed').slice(0,350));
      throw error;
    }
  }
  throw apiError('Unknown API route',404);
}
const server=http.createServer((req,res)=>{
  Promise.resolve(route(req,res)).catch(e=>{
    if(!res.headersSent&&!res.destroyed)json(res,e.httpStatus||500,{error:e.httpStatus?e.message:'Unexpected server error'});
    if(!e.httpStatus)console.error('[pagefleet]',e.message);
  });
});
server.listen(port,host,()=>{
  const address=config.lan ? 'http://<YOUR-LAN-IP>:'+port : (publicBase || 'http://'+(host==='::1'?'[::1]':host)+':'+port);
  console.log('PageFleet: '+address+' (publisher '+(config.demo?'mock demo':(process.env.PUBLISHER==='meta'?'meta':'mock'))+')');
  if(config.lan && !publicBase) console.warn('LAN HTTP is unencrypted; use only on a trusted private network, never port-forward.');
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
