#!/usr/bin/env node
// Live Meta scheduling check (REQ-0007). NOT part of `npm test`: it schedules REAL posts.
// For every PageFleet Page linked to a connected Facebook Page it creates three mock posts
// (text only, one image, three numbered images), approves them and schedules them
// 5 minutes apart, starting 12 minutes from now (Meta needs at least 10 minutes).
//
//   node test/live-schedule.mjs            # dry run: print the plan only
//   node test/live-schedule.mjs --yes      # really schedule on Facebook
// Options: --base http://localhost:3088  --gap 5  --start 12  --mock (allow the mock publisher)
// Set APP_PASSWORD in the environment if the app requires a password.
import { deflateSync, crc32 } from 'node:zlib';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const base = option('--base', 'http://localhost:3088').replace(/\/$/, '');
const gapMin = Number(option('--gap', '5'));
const startMin = Number(option('--start', '12'));
if (!(gapMin >= 1) || !(startMin >= 11)) throw new Error('--gap must be >= 1 and --start >= 11 minutes');
const really = flag('--yes');
let cookie = '';

async function call(path, body) {
  const response = await fetch(base + '/api' + path, body === undefined ? { headers: { cookie } } : {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', 'X-PageFleet-Request': '1', cookie } });
  const data = await response.json();
  if (!response.ok) throw new Error(path + ': ' + (data.error || 'HTTP ' + response.status));
  const set = response.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  return data;
}

// ---- Numbered test images: 800x800 PNG, a coloured square with a large white digit.
const DIGITS = { 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'] };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}
function numberedPng(digit, rgb, size = 800) {
  const glyph = DIGITS[digit], cell = Math.floor(size / 12), left = (size - 5 * cell) / 2, top = (size - 7 * cell) / 2;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - left) / cell), gy = Math.floor((y - top) / cell);
      const on = gx >= 0 && gx < 5 && gy >= 0 && gy < 7 && glyph[gy][gx] === '1';
      (on ? [255, 255, 255] : rgb).forEach((v, i) => { row[1 + x * 3 + i] = v; });
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
const COLORS = [[37, 99, 235], [22, 163, 74], [220, 38, 38], [147, 51, 234], [234, 88, 12], [8, 145, 178]];

// ---- Mock post text (Vietnamese, like a real Page post) with a visible test marker.
function mockPost(n, page, kind, when) {
  const time = when.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const bodies = {
    text: 'Một công trình bền đẹp bắt đầu từ việc chọn đúng vật liệu ngay từ khâu thiết kế. ' +
      'Trước khi thi công, hãy cùng kỹ sư kiểm tra bản vẽ, khối lượng và tiến độ để tránh phát sinh.',
    one: 'Bề mặt hoàn thiện quyết định cảm nhận đầu tiên về không gian. ' +
      'Ảnh minh hoạ dưới đây dùng để kiểm tra bài đăng có 1 ảnh.',
    three: 'Ba bước kiểm tra trước khi nghiệm thu: (1) kích thước, (2) độ phẳng, (3) mạch ghép. ' +
      'Ba ảnh được đánh số 1-2-3 để kiểm tra thứ tự ảnh trên Facebook.' };
  return [`[PageFleet test #${n}] ${bodies[kind]}`, '',
    `Trang: ${page.name}. Giờ hẹn: ${time}.`,
    'Đây là bài thử nghiệm tự động, sẽ được xoá sau khi kiểm tra.', '', '#PageFleetTest'].join('\n');
}

const state = await call('/state').catch(async error => {
  if (!/Login required/.test(error.message)) throw error;
  if (!process.env.APP_PASSWORD) throw new Error('The app needs a password: set APP_PASSWORD');
  await call('/login', { password: process.env.APP_PASSWORD });
  return call('/state');
});
if (state.demo) throw new Error('This is the demo workspace; start the app without --demo');
if (state.publisher !== 'meta' && !flag('--mock')) throw new Error('Publisher is "' + state.publisher + '", not meta. Start with PUBLISHER=meta META_PUBLISH_ENABLED=1, or pass --mock to rehearse.');
const pages = state.pages.filter(p => state.connections.some(c => c.meta_page_id === p.meta_page_id && c.status === 'connected'));
if (!pages.length) throw new Error('No Page is linked to a connected Facebook Page (Fanpages → Cấu hình)');

const start = Date.now() + startMin * 60_000;
const plan = [];
for (const page of pages) for (const [kind, images] of [['text', 0], ['one', 1], ['three', 3]]) {
  const n = plan.length + 1;
  plan.push({ n, page, kind, images, when: new Date(start + (n - 1) * gapMin * 60_000) });
}
console.log(`${really ? 'Scheduling' : 'DRY RUN (add --yes to schedule)'} ${plan.length} posts on ${base} via ${state.publisher}:`);
for (const p of plan) console.log(`  #${p.n}  ${p.when.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}  ${p.page.name.padEnd(14)} ${p.images} image(s)`);
if (!really) process.exit(0);

for (const p of plan) {
  if (p.when.getTime() < Date.now() + 11 * 60_000) throw new Error(`#${p.n}: start time has passed; rerun the script`);
  const { id: ideaId } = await call('/idea', { title: `PageFleet test #${p.n} (${p.images} ảnh)`, brief: 'Mock live test', page_ids: [p.page.id] });
  for (let i = 1; i <= p.images; i++) {
    const png = numberedPng(i, COLORS[(p.n + i) % COLORS.length]);
    const media = await call('/media', { filename: `test-${p.n}-${i}.png`, mime: 'image/png', data: png.toString('base64') });
    await call('/attach', { idea_id: ideaId, image_id: media.id });
  }
  const variant = (await call('/state')).variants.find(v => v.idea_id === ideaId);
  const edited = await call('/variant', { id: variant.id, text: mockPost(p.n, p.page, p.kind, p.when), revision: variant.revision });
  await call('/approve', { id: variant.id, revision: edited.revision });
  try {
    const result = await call('/schedule', { id: variant.id, revision: edited.revision, scheduled_at: p.when.toISOString() });
    console.log(`  #${p.n} ${result.state}  remote ID ${result.remoteId}`);
  } catch (error) {
    // Never retry: an unknown outcome must be checked in Meta Business Suite first.
    console.error(`  #${p.n} FAILED: ${error.message}\nStopped. Check the Lịch đăng tab and Meta Business Suite before running again.`);
    process.exit(1);
  }
}
console.log('Done. Check Meta Business Suite → Planner. You may stop PageFleet now: Meta publishes scheduled posts on its own.');
