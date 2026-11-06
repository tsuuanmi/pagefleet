const THEME_KEY='pagefleet.theme';
function setTheme(value) {
  const next=value==='dark'?'dark':'light';
  document.documentElement.dataset.theme=next;
  try { localStorage.setItem(THEME_KEY,next); } catch { /* private browsing may disable storage */ }
  const b=document.querySelector('#themeToggle');
  if(b){b.innerHTML=next==='dark'?'☀ <span>Light</span>':'☾ <span>Dark</span>';b.setAttribute('aria-label',next==='dark'?'Bật giao diện sáng':'Bật giao diện tối');b.setAttribute('aria-pressed',String(next==='dark'));}
}
let initialTheme='light';
try { initialTheme=localStorage.getItem(THEME_KEY)|| (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'); } catch { /* use default */ }
setTheme(initialTheme);
document.querySelector('#themeToggle').addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
const $=selector=>document.querySelector(selector);
const e=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let state,tab='overview',modalSubmit=null;
const tabs={overview:['Tổng quan','Quản lý nội dung cho nhiều Fanpage trong một nơi.'],ideas:['Nội dung','Tạo ý tưởng, biên tập biến thể và duyệt bài đăng.'],pages:['Fanpages','Giọng văn và đối tượng riêng cho từng Page.'],calendar:['Lịch đăng','Các bài đã gửi vào lịch publisher.']};
const badge=s=>'<span class="pill '+e(s)+'">'+e(({draft:'Bản nháp',approved:'Đã duyệt',submitting:'Đang gửi',scheduled:'Đã lên lịch',unknown:'Cần đối soát',failed:'Lỗi',published:'Đã đăng'})[s]||s)+'</span>';
async function request(path,body) {
  const resp=await fetch('/api'+path,{method:'POST',headers:{'Content-Type':'application/json','X-PageFleet-Request':'1'},body:JSON.stringify(body)});
  const payload=await resp.json();
  if(!resp.ok)throw Error(payload.error||'HTTP '+resp.status);
  return payload;
}
async function load() {
  const response=await fetch('/api/state');
  if(!response.ok)throw Error('Không thể tải workspace');
  state=await response.json();
  $('#publisherLabel').textContent=state.demo?'Demo · Mock Publisher (SAFE)':state.publisher==='meta'?'Meta Graph API (LIVE)':'Mock Publisher (SAFE)';
  $('#demoChip').textContent=state.demo?'DEMO · 10 PAGES':state.pages.length+' FANPAGES';
  render();
}
function announce(message,error=false) {
  const node=$('#notice');node.textContent=message;node.className='notice'+(error?' error':'');node.hidden=false;
}
function render() {
  if(state.demo && !sessionStorage.getItem('pagefleet.demoHelp')){
    const banner=$('#notice');banner.hidden=false;banner.className='notice';
    banner.textContent='DEMO MODE: 10 Page mẫu, 5 ý tưởng, nhiều bản nháp/đã duyệt/đã lên lịch. Hãy vào Nội dung → AI → Sửa → Duyệt → Lên lịch. Không có bài nào đăng thật.';
    sessionStorage.setItem('pagefleet.demoHelp','1');
  }
  for(const name of Object.keys(tabs))$('#'+name).hidden=name!==tab;
  $('#heading').textContent=tabs[tab][0];$('#subtitle').textContent=tabs[tab][1];
  $('#breadcrumb').textContent='WORKSPACE / '+tabs[tab][0].toUpperCase();
  document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.tab===tab));
  const drafts=state.variants.filter(x=>x.status==='draft').length;
  const approved=state.variants.filter(x=>x.status==='approved').length;
  const scheduled=state.deliveries.filter(x=>x.state==='scheduled').length;
  const cost=state.usage.cost_usd===null?0:state.usage.cost_usd;
  $('#overview').innerHTML=`
    <div class="cards"><div class="card"><small>Fanpages</small><div class="number">${state.pages.length}</div><div class="foot">Đang cấu hình</div></div>
    <div class="card"><small>Ý tưởng nội dung</small><div class="number">${state.ideas.length}</div><div class="foot">${drafts} biến thể nháp</div></div>
    <div class="card"><small>Bài đã duyệt</small><div class="number">${approved}</div><div class="foot">Sẵn sàng lên lịch</div></div>
    <div class="card"><small>Đã lên lịch</small><div class="number">${scheduled}</div><div class="foot">Publisher: ${e(state.publisher)}</div></div></div>
    <div class="grid2"><div class="panel"><div class="section-head"><h2>Nội dung gần đây</h2><button class="small" data-nav="ideas">Xem tất cả</button></div>
    <div class="list">${state.ideas.slice(0,5).map(i=>`<div class="entry"><div><strong>${e(i.title)}</strong><div class="muted">${e(new Date(i.created_at).toLocaleDateString('vi-VN'))} · ${state.variants.filter(v=>v.idea_id===i.id).length} Fanpages</div></div><button class="small" data-nav="ideas">Chi tiết</button></div>`).join('')||'<div class="empty">Chưa có ý tưởng. Bắt đầu bằng nội dung mới.</div>'}</div></div>
    <div class="panel"><div class="section-head"><h2>Chi phí AI tháng này</h2><span class="pill">Ước tính</span></div>
    <div class="number" style="font-size:32px;font-weight:750;margin:12px 0">$${Number(cost).toFixed(4)}</div><div class="muted">${e(state.usage.calls)} lượt tạo · ${e(state.usage.input_tokens)} input tokens · ${e(state.usage.output_tokens)} output tokens</div>
    <p class="hint">Giá hiện tại theo cấu hình server; ${e(state.usage.unpriced)} lượt chưa có đơn giá. Chưa gồm hosting, ảnh, hỗ trợ.</p>
    <hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><strong>Cách bắt đầu</strong><p class="muted">1. Cập nhật Page Profiles.<br>2. Import hoặc nhập ý tưởng.<br>3. Tạo nội dung → duyệt → lên lịch.</p></div></div>`;
  $('#pages').innerHTML=`<div class="section-head"><h2>10 Fanpages</h2><span class="muted">Lưu cấu hình phong cách riêng</span></div><div class="page-grid">${state.pages.map((p,i)=>`<div class="page-card"><span class="page-icon">${i+1}</span><h3>${e(p.name)}</h3><div class="muted">${e(p.topic)}</div><p>${e(p.voice||'Chưa có hướng dẫn giọng văn')} · ${e(p.audience||'Chưa có đối tượng')}</p><div class="section-head"><span class="pill">${p.meta_page_id?'Meta ID đã đặt':'Chưa kết nối Meta'}</span><button class="small outline" data-action="page" data-id="${e(p.id)}">Cấu hình</button></div></div>`).join('')}</div>`;
  $('#ideas').innerHTML=`<div class="toolbar"><h2>${state.ideas.length} ý tưởng · ${state.variants.length} biến thể</h2><div class="btn-group"><button data-action="import">↑ Import CSV / Excel</button><button class="primary" data-action="new">+ Tạo mới</button></div></div>
    <div class="table-wrap"><table><thead><tr><th>Ý tưởng / Fanpage</th><th>Nội dung</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
    ${state.variants.map(v=>`<tr><td><strong>${e(v.idea_title)}</strong><br><span class="muted">${e(v.page_name)}</span></td><td style="max-width:250px"><span title="${e(v.body)}">${e((v.body||'Chưa tạo nội dung').slice(0,90))}</span></td><td>${badge(v.status)}</td><td><div class="btn-group">
      ${['draft','approved'].includes(v.status)?`<button class="small" data-action="generate" data-id="${e(v.id)}">✨ AI</button><button class="small" data-action="edit" data-id="${e(v.id)}">Sửa</button><button class="small" data-action="image" data-id="${e(v.id)}">Ảnh</button><button class="small" data-action="approve" data-id="${e(v.id)}">Duyệt</button>`:''}
      ${v.status==='approved'? `<button class="small primary" data-action="schedule" data-id="${e(v.id)}">Lên lịch</button>`:''}</div></td></tr>`).join('')||'<tr><td colspan="4" class="empty">Chưa có biến thể nào. Import Excel hoặc tạo ý tưởng mới.</td></tr>'}
    </tbody></table></div>`;
  $('#calendar').innerHTML=`<div class="section-head"><h2>Scheduled delivery records</h2><span class="muted">Các bài Meta cần kiểm tra trạng thái sau khi đến giờ</span></div>
    <div class="table-wrap"><table><thead><tr><th>Thời gian (local)</th><th>Bài đăng</th><th>Publisher</th><th>Trạng thái</th><th>Remote ID</th></tr></thead><tbody>
      ${state.deliveries.map(d=>{const v=state.variants.find(x=>x.id===d.variant_id);return `<tr><td>${e(new Date(d.scheduled_at).toLocaleString('vi-VN'))}</td><td>${e(v?.idea_title||'')}<br><span class="muted">${e(v?.page_name||'')}</span></td><td>${e(d.provider)}</td><td>${badge(d.state)}${d.error?'<div class="hint">'+e(d.error)+'</div>':''}</td><td>${e(d.remote_id||'—')}</td></tr>`}).join('')||'<tr><td colspan="5" class="empty">Chưa có lịch đăng nào.</td></tr>'}</tbody></table></div>`;
}
function modal(title,subtitle,html,button,fn) {
  $('#dialogContent').innerHTML='<h2>'+e(title)+'</h2><p>'+e(subtitle)+'</p>'+html;
  $('#submit').textContent=button;
  modalSubmit=fn;
  $('#dialog').showModal();
}
function input(name,label,value='',type='text',required=false) {
  return '<label for="f-'+e(name)+'">'+e(label)+'</label><input id="f-'+e(name)+'" name="'+e(name)+'" type="'+type+'" value="'+e(value)+'" '+(required?'required':'')+'>';
}
function field(name){return $('#form').elements.namedItem(name)?.value??'';}
function newIdea(){
  modal('Ý tưởng mới','Một ý tưởng có thể được triển khai cho nhiều Fanpage.',
    input('title','Tiêu đề ý tưởng','', 'text',true)+
    '<label for="f-brief">Mô tả, thông tin gợi ý</label><textarea id="f-brief" name="brief" maxlength="5000"></textarea>'+
    input('image_hint','Gợi ý hình ảnh')+
    '<label>Chọn Fanpages</label><div class="check-grid">'+state.pages.map(p=>'<label><input type="checkbox" name="page" value="'+e(p.id)+'" checked> '+e(p.name)+'</label>').join('')+'</div>',
    'Tạo biến thể',async()=>{
      const ids=[...document.querySelectorAll('#dialog input[name=page]:checked')].map(x=>x.value);
      await request('/idea',{title:field('title'),brief:field('brief'),image_hint:field('image_hint'),page_ids:ids});
      tab='ideas';return 'Đã tạo ý tưởng và '+ids.length+' biến thể bản nháp.';
    });
}
function pageForm(id){
  const p=state.pages.find(x=>x.id===id);
  modal('Cấu hình '+p.name,'Page ID và tên biến môi trường token chỉ dùng khi bật Meta Publisher.',
    input('name','Tên Page',p.name,'text',true)+input('topic','Lĩnh vực',p.topic)+
    input('audience','Nhóm độc giả',p.audience)+input('voice','Giọng văn / góc nhìn',p.voice)+
    input('cta','Call to action',p.cta)+input('meta_page_id','Facebook Page ID',p.meta_page_id)+
    input('token_env','Tên biến môi trường chứa Page token',p.token_env),
    'Lưu cấu hình',async()=>{await request('/page',{id,...Object.fromEntries(['name','topic','audience','voice','cta','meta_page_id','token_env'].map(k=>[k,field(k)]))});return 'Đã cập nhật Page.'});
}
function editVariant(id) {
  const v=state.variants.find(x=>x.id===id);
  modal('Chỉnh sửa nội dung',v.page_name+' · Revision '+v.revision,
    '<label for="f-text">Caption</label><textarea name="text" id="f-text" maxlength="5000" style="min-height:220px">'+e(v.body)+'</textarea>'+
    '<div class="hint">Chỉnh sửa sẽ huỷ trạng thái duyệt cũ.</div>',
    'Lưu bản nháp',async()=>{await request('/variant',{id,text:field('text'),revision:v.revision});return 'Đã lưu bản nháp mới.'});
}
function generateVariant(id){
  const v=state.variants.find(x=>x.id===id);
  const providers=[['template','Mẫu offline · $0'],...(state.ai.openai?[['openai','OpenAI API']]:[]),...(state.ai.anthropic?[['anthropic','Claude API']]:[])];
  modal('Tạo nội dung bằng AI',v.idea_title+' · '+v.page_name,
    '<label for="f-provider">Model</label><select name="provider" id="f-provider">'+providers.map(p=>'<option value="'+p[0]+'">'+e(p[1])+'</option>').join('')+'</select>'+
    '<p class="hint">API cần key và đơn giá token cấu hình ở server. Nội dung AI luôn được đưa về nháp để kiểm tra.</p>',
    'Tạo nội dung',async()=>{const result=await request('/generate',{id,revision:v.revision,provider:field('provider')});return 'Đã tạo nội dung. Chi phí text: $'+Number(result.cost_usd).toFixed(5)});
}
function scheduleVariant(id){
  const v=state.variants.find(x=>x.id===id);
  const soon=new Date(Date.now()+60*60_000);
  const local=new Date(soon.getTime()-soon.getTimezoneOffset()*60_000).toISOString().slice(0,16);
  modal('Lên lịch xuất bản',v.idea_title+' · '+v.page_name,
    '<div class="pill">Publisher: '+e(state.publisher)+'</div><label for="f-when">Giờ đăng (local)</label><input required type="datetime-local" id="f-when" name="when" value="'+e(local)+'">'+
    '<p class="hint">Meta: dự kiến lịch 11 phút đến 29 ngày tới. Nếu gửi lỗi không rõ kết quả, hệ thống đánh dấu Cần đối soát, KHÔNG tự gửi lại.</p>',
    state.publisher==='meta'?'Gửi lên Meta':'Lên lịch (mock)',async()=>{
      const when=new Date(field('when'));
      if(!Number.isFinite(when.getTime()))throw Error('Thời gian không hợp lệ');
      const result=await request('/schedule',{id,revision:v.revision,scheduled_at:when.toISOString()});
      tab='calendar';return 'Đã gửi lịch: '+result.provider+' / '+result.state;
    });
}
function attachImageDialog(variantId) {
  const v=state.variants.find(x=>x.id===variantId);
  const idea=state.ideas.find(x=>x.id===v.idea_id);
  modal('Ảnh đính kèm','Ảnh thuộc ý tưởng và áp dụng cho tất cả Page; thay ảnh sẽ huỷ duyệt cũ.',
    '<label for="f-attachment">JPEG / PNG / WebP · tối đa 4 MB</label><input id="f-attachment" type="file" accept="image/jpeg,image/png,image/webp" required>' +
    (idea.image_id?'<p class="hint">Đã có ảnh. Tải ảnh mới để thay thế.</p>':''),
    'Lưu ảnh', async()=>{
      const file=$('#f-attachment').files[0];
      if(!file)throw Error('Chọn ảnh trước.');
      if(file.size>4*1024*1024)throw Error('Ảnh lớn hơn 4 MB.');
      if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Chỉ hỗ trợ JPEG, PNG, WebP.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
      const result=await request('/media',{filename:file.name,mime:file.type,data:btoa(binary)});
      await request('/attach',{idea_id:v.idea_id,image_id:result.id});
      return 'Đã lưu ảnh; các phiên bản cần được duyệt lại.';
    });
}
function importDialog(){
  modal('Import Excel / CSV','Cột bắt buộc: title. Tuỳ chọn: brief, hint, image, pages (page-1,page-2).',
    '<label for="f-file">Chọn file .csv hoặc .xlsx</label><input type="file" id="f-file" name="file" accept=".csv,.xlsx" required>'+
    '<p class="hint">Tối đa 3 MB, 200 ý tưởng mỗi lần. XLSX đọc worksheet đầu tiên. Ảnh trong Excel được giữ dưới dạng gợi ý đường dẫn; upload ảnh riêng ở bản MVP.</p>',
    'Import',async()=>{
      const file=$('#f-file').files[0];
      if(!file)throw Error('Hãy chọn file.');
      if(file.size>3_000_000)throw Error('File quá lớn.');
      const format=file.name.toLowerCase().endsWith('.xlsx')?'xlsx':file.name.toLowerCase().endsWith('.csv')?'csv':null;
      if(!format)throw Error('Chỉ hỗ trợ CSV/XLSX.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
      const result=await request('/import',{format,data:btoa(binary)});
      tab='ideas';
      return 'Đã import '+result.created+' ý tưởng. '+result.errors.length+' lỗi: '+result.errors.slice(0,3).map(x=>'Dòng '+(x.row??'?')+': '+x.error).join('; ');
    });
}
async function runAction(action,id){
  if(action==='new')return newIdea();
  if(action==='import')return importDialog();
  if(action==='page')return pageForm(id);
  if(action==='edit')return editVariant(id);
  if(action==='generate')return generateVariant(id);
  if(action==='image')return attachImageDialog(id);
  if(action==='schedule')return scheduleVariant(id);
  if(action==='approve'){
    const v=state.variants.find(x=>x.id===id);
    if(!confirm('Duyệt bản '+v.revision+' cho '+v.page_name+'?'))return;
    await request('/approve',{id,revision:v.revision});
    await load();announce('Đã duyệt '+v.page_name+'.');
  }
}
$('#app').addEventListener('click',async ev=>{
  const nav=ev.target.closest('[data-nav]');
  if(nav){tab=nav.dataset.nav;render();return;}
  const button=ev.target.closest('[data-action]');
  if(button)try{await runAction(button.dataset.action,button.dataset.id);}catch(err){announce(err.message,true);}
});
$('#newIdea').addEventListener('click',newIdea);
document.querySelectorAll('button[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;render();}));
$('#cancel').addEventListener('click',()=>$('#dialog').close());
$('#form').addEventListener('submit',async ev=>{
  ev.preventDefault();const btn=$('#submit');btn.disabled=true;
  try{const message=await modalSubmit?.();$('#dialog').close();await load();if(message)announce(message);}
  catch(err){announce(err.message,true);}
  finally{btn.disabled=false;}
});
$('#loginForm').addEventListener('submit',async ev=>{
  ev.preventDefault();
  try{await request('/login',{password:$('#password').value});$('#login').hidden=true;$('#app').hidden=false;await load();}
  catch(err){alert(err.message);}
});
$('#logout').addEventListener('click',async()=>{await request('/logout',{});location.reload();});
(async()=>{
  try{
    const r=await (await fetch('/api/session')).json();
    $('#login').hidden=r.authenticated;
    $('#app').hidden=!r.authenticated;
    $('#logout').hidden=!r.passwordRequired;
    if(r.authenticated)await load();
  }catch(err){announce(err.message,true);}
})();
