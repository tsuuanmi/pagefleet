import { inflateRawSync } from 'node:zlib';
import { apiError } from './logic.mjs';

export function csvRows(input) {
  if (typeof input !== 'string' || input.length > 3_000_000) throw apiError('CSV too large');
  const text = input.replace(/^\uFEFF/, '');
  const rows=[]; let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {
      if(c==='"' && text[i+1]==='"'){field+='"';i++;}
      else if(c==='"') quoted=false;
      else field+=c;
    } else if(c==='"' && !field){quoted=true;}
    else if(c===','){row.push(field);field='';}
    else if(c==='\n'||c==='\r'){
      if(c==='\r' && text[i+1]==='\n')i++;
      row.push(field);field='';
      if(row.some(v=>v.trim()))rows.push(row);
      row=[];
    }else field+=c;
  }
  if(quoted) throw apiError('CSV contains an unterminated quote');
  if(field || row.length){row.push(field);if(row.some(v=>v.trim())) rows.push(row);}
  if(rows.length>1001)throw apiError('Maximum 1,000 rows per import');
  return rows;
}
function xmlDecode(s) {
  return s.replace(/&#x([0-9a-f]+);|&#(\d+);|&(?:amp|lt|gt|quot|apos);/gi,m=>{
    const name=m.slice(1,-1);
    if(name==='#')return m;
    if(name.startsWith('#x'))return String.fromCodePoint(parseInt(name.slice(2),16));
    if(name.startsWith('#'))return String.fromCodePoint(parseInt(name.slice(1),10));
    return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[name]??m;
  });
}
function zipEntries(bytes) {
  const b=Buffer.from(bytes);
  if(b.length>3*1024*1024)throw apiError('XLSX file too large (3 MB max)');
  const entries=new Map();
  let eocd=-1;
  for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50){eocd=i;break;}
  if(eocd<0)throw apiError('Not a valid .xlsx ZIP file');
  const count=b.readUInt16LE(eocd+10),cd=b.readUInt32LE(eocd+16);
  if(count>300||cd>=b.length)throw apiError('Unexpected XLSX ZIP directory');
  let offset=cd,total=0;
  for(let i=0;i<count;i++){
    if(offset+46>b.length||b.readUInt32LE(offset)!==0x02014b50)throw apiError('Damaged XLSX ZIP directory');
    const method=b.readUInt16LE(offset+10),size=b.readUInt32LE(offset+20),uncompressed=b.readUInt32LE(offset+24);
    const len=b.readUInt16LE(offset+28),extra=b.readUInt16LE(offset+30),comment=b.readUInt16LE(offset+32);
    const name=b.toString('utf8',offset+46,offset+46+len),local=b.readUInt32LE(offset+42);
    offset+=46+len+extra+comment;
    if(!/^(xl\/worksheets\/sheet1\.xml|xl\/sharedStrings\.xml)$/.test(name))continue;
    if(uncompressed>6*1024*1024 || (total+=uncompressed)>8*1024*1024)throw apiError('XLSX uncompressed data too large');
    if(local+30>b.length||b.readUInt32LE(local)!==0x04034b50)throw apiError('Damaged XLSX member');
    const start=local+30+b.readUInt16LE(local+26)+b.readUInt16LE(local+28);
    if(start+size>b.length)throw apiError('Truncated XLSX member');
    const raw=b.subarray(start,start+size);
    const content=method===0?raw:method===8?inflateRawSync(raw,{maxOutputLength:6*1024*1024}):null;
    if(!content || content.length!==uncompressed)throw apiError('Unsupported XLSX compression');
    entries.set(name,content.toString('utf8'));
  }
  return entries;
}
export function xlsxRows(bytes) {
  const zip=zipEntries(bytes);
  const sheet=zip.get('xl/worksheets/sheet1.xml');
  if(!sheet)throw apiError('XLSX first worksheet not found (sheet1.xml)');
  const shared=[];
  const strings=zip.get('xl/sharedStrings.xml')||'';
  for(const match of strings.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)){
    const parts=[...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>xmlDecode(x[1]));
    shared.push(parts.join(''));
  }
  const rows=[];
  for(const match of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
    const cells=[]; let lastCol=0;
    for(const c of match[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
      const ref=/\br="([A-Z]+)\d+"/.exec(c[1])?.[1];
      if(!ref)continue;
      let column=0;for(const ch of ref)column=column*26+ch.charCodeAt(0)-64;
      if(column>64)throw apiError('XLSX exceeds 64 columns');
      let value=/<v>([\s\S]*?)<\/v>/.exec(c[2])?.[1]??'';
      const type=/\bt="([^"]+)"/.exec(c[1])?.[1]||'';
      if(type==='s')value=shared[Number(value)]??'';
      else if(type==='inlineStr')value=[...c[2].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>xmlDecode(t[1])).join('');
      else value=xmlDecode(value);
      cells[column-1]=String(value);
      lastCol=Math.max(lastCol,column);
    }
    if(cells.some(v=>String(v||'').trim()))rows.push(Array.from({length:lastCol},(_,i)=>cells[i]||''));
    if(rows.length>1001)throw apiError('Maximum 1,000 rows per import');
  }
  return rows;
}
export function importIdeas(rows, pageIds) {
  if(!rows.length)throw apiError('Import is empty');
  const head=rows[0].map(x=>String(x||'').trim().toLowerCase());
  const lookup=k=>head.indexOf(k);
  if(lookup('title')<0)throw apiError('File must contain a title column');
  const results=[],errors=[];
  for(let i=1;i<rows.length;i++){
    const row=rows[i],cell=k=>{const n=lookup(k);return n<0?'':String(row[n]??'').trim();};
    if(!row.some(v=>String(v||'').trim()))continue;
    const title=cell('title');
    const rawPages=cell('pages')||cell('page_ids');
    const ids=rawPages?rawPages.split(/[;,|\s]+/).filter(Boolean):pageIds;
    if(!title || title.length>300){errors.push({row:i+1,error:'Missing/oversized title'});continue;}
    if(!ids.length || ids.some(x=>!pageIds.includes(x))){errors.push({row:i+1,error:'Invalid pages; use page-1,page-2 etc.'});continue;}
    results.push({title,brief:cell('brief')||cell('hint')||cell('notes'),image_hint:cell('image')||cell('image_hint'),page_ids:[...new Set(ids)]});
  }
  return {results,errors};
}
