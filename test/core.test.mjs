import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../src/db.mjs';
import { validateSchedule, verifyImage, freeDraft } from '../src/logic.mjs';
import { csvRows, importIdeas, xlsxRows } from '../src/import.mjs';
import { deflateRawSync } from 'node:zlib';

function withDB(fn) {
  const dir=mkdtempSync(join(tmpdir(),'pagefleet-test-'));
  const store=openStore(dir);
  try{fn(store);}finally{store.close();rmSync(dir,{force:true,recursive:true});}
}
test('seeds 10 distinct Page profiles and persists modifications',()=>{
  withDB(s=>{
    assert.equal(s.snapshot().pages.length,10);
    const p=s.updatePage('page-1',{name:'Page A',topic:'Carton',voice:'Short',audience:'Small shops',cta:'Ask us'});
    assert.equal(p.topic,'Carton');
    assert.equal(s.snapshot().pages[0].name,'Page A');
  });
});
test('separate variants, revision approval and no duplicate delivery',()=>{
  withDB(s=>{
    const idea=s.createIdea({title:'Packaging facts',brief:'Only sourced facts',page_ids:['page-1','page-2']});
    const variants=s.q('SELECT * FROM variants WHERE idea_id=?',idea);
    assert.equal(variants.length,2);
    const v=variants[0];
    assert.throws(()=>s.approve(v.id,1),/Post content/);
    const changed=s.updateVariant(v.id,'A useful post',1);
    assert.equal(changed.revision,2);
    s.approve(v.id,2);
    const date=validateSchedule(new Date(Date.now()+60*60_000).toISOString());
    const {deliveryId}=s.reserve(v.id,date,'mock',2);
    assert.throws(()=>s.reserve(v.id,date,'mock',2),/approved|exists/);
    s.finish(deliveryId,'scheduled','mock-test');
    assert.equal(s.variant(v.id).status,'scheduled');
    assert.equal(s.variant(variants[1].id).status,'draft');
    assert.throws(()=>s.updateVariant(v.id,'changed',2),/Already submitted/);
  });
});
test('crash recovery marks uncertain delivery unknown, never retries',()=>{
  withDB(s=>{
    const id=s.createIdea({title:'Post',page_ids:['page-1']});
    const v=s.q('SELECT * FROM variants WHERE idea_id=?',id)[0];
    s.updateVariant(v.id,'Content',1);s.approve(v.id,2);
    const date=validateSchedule(new Date(Date.now()+3600_000).toISOString());
    s.reserve(v.id,date,'meta',2);
    s.recoverInterrupted();
    const delivery=s.snapshot().deliveries[0];
    assert.equal(delivery.state,'unknown');
    assert.equal(s.variant(v.id).status,'unknown');
    assert.throws(()=>s.reserve(v.id,date,'meta',2));
  });
});
test('schedule enforces explicit zone and conservative window',()=>{
  assert.throws(()=>validateSchedule('2026-11-06T10:00'),/timezone/);
  assert.throws(()=>validateSchedule(new Date(Date.now()+120_000).toISOString()),/Schedule/);
  assert.throws(()=>validateSchedule(new Date(Date.now()+40*86400_000).toISOString()),/Schedule/);
  assert.ok(validateSchedule(new Date(Date.now()+86400_000).toISOString()).endsWith('Z'));
});
test('reject spoofed media, accept PNG header',()=>{
  assert.throws(()=>verifyImage(Buffer.from('a'.repeat(32)),'image/png'),/authentic/);
  const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.alloc(8)]);
  assert.equal(verifyImage(png,'image/png'),'image/png');
});
test('CSV handles quoted newlines and per-row validation',()=>{
  const rows=csvRows('title,brief,pages\r\n"Test, yes","line one\nline two","page-1;page-2"\r\nBad,,invalid-page');
  assert.equal(rows.length,3);
  assert.equal(rows[1][0],'Test, yes');
  assert.equal(rows[1][1],'line one\nline two');
  const {results,errors}=importIdeas(rows,['page-1','page-2']);
  assert.equal(results.length,1);assert.equal(errors.length,1);
  assert.deepEqual(results[0].page_ids,['page-1','page-2']);
});
function zipFile(name,data) {
  const filename=Buffer.from(name),value=Buffer.from(data);
  const packed=deflateRawSync(value);
  const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(8,8);lh.writeUInt32LE(packed.length,18);lh.writeUInt32LE(value.length,22);lh.writeUInt16LE(filename.length,26);
  const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(8,10);cd.writeUInt32LE(packed.length,20);cd.writeUInt32LE(value.length,24);cd.writeUInt16LE(filename.length,28);cd.writeUInt32LE(0,42);
  return {local:Buffer.concat([lh,filename,packed]),central:Buffer.concat([cd,filename])};
}
test('XLSX imports a real ZIP worksheet and shared strings',()=>{
  const sheet='<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Example</t></is></c><c r="B2" t="inlineStr"><is><t>Notes</t></is></c></row></sheetData></worksheet>';
  const shared='<sst><si><t>title</t></si><si><t>brief</t></si></sst>';
  const entries=[zipFile('xl/worksheets/sheet1.xml',sheet),zipFile('xl/sharedStrings.xml',shared)];
  const locals=Buffer.concat(entries.map(x=>x.local)),centrals=Buffer.concat(entries.map((x,i)=>{const b=Buffer.from(x.central);b.writeUInt32LE(i===0?0:entries[0].local.length,42);return b;}));
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centrals.length,12);end.writeUInt32LE(locals.length,16);
  const rows=xlsxRows(Buffer.concat([locals,centrals,end]));
  assert.deepEqual(rows,[['title','brief'],['Example','Notes']]);
});
test('template draft uses Page-specific audience and CTA',()=>{
  assert.match(freeDraft({title:'Question',brief:'Tip'},{audience:'shops',cta:'Contact us'}),/shops/);
  assert.match(freeDraft({title:'Question',brief:'Tip'},{audience:'shops',cta:'Contact us'}),/Contact us/);
});
