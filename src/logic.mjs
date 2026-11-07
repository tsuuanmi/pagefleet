import { randomUUID } from 'node:crypto';

export const uuid = () => randomUUID();
export const now = () => new Date().toISOString();
export function mustText(value, field, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(field + ' is required (max ' + max + ' characters)');
  }
  return value.trim();
}
export function optionalText(value, max = 2000) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || value.length > max) throw new Error('Text exceeds ' + max + ' characters');
  return value.trim();
}
export function validateSchedule(input, currentMs = Date.now()) {
  if (typeof input !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(input)) {
    throw new Error('Use a timestamp with timezone (ISO 8601)');
  }
  const ms = Date.parse(input);
  if (!Number.isFinite(ms) || ms < currentMs + 11 * 60_000 || ms > currentMs + 29 * 86400_000) {
    throw new Error('Schedule 11 minutes to 29 days ahead (conservative Meta native window)');
  }
  return new Date(ms).toISOString();
}
export function verifyImage(bytes, mime) {
  const b = Buffer.from(bytes);
  if (b.length < 12 || b.length > 4 * 1024 * 1024) throw new Error('Image size must be 12 bytes–4 MB');
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  const webp = b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  const expected = jpg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : null;
  if (!expected || expected !== mime) throw new Error('Only authentic JPEG, PNG or WebP files are allowed');
  return expected;
}
export function variantPrompt(idea, page) {
  return [
    'Write ONE original Facebook Page post in Vietnamese. Return only the ready-to-publish post text.',
    'Do not invent facts, prices, testimonials, results or links. Ask no follow-up questions.',
    'Make this variant meaningfully distinct in angle, value and language from generic duplicates.',
    'Content idea: ' + idea.title,
    'Notes (may be incomplete): ' + (idea.brief || '(none)'),
    'Image note: ' + (idea.image_hint || '(none)'),
    'Page name: ' + page.name,
    'Topic: ' + page.topic,
    'Audience: ' + page.audience,
    'Tone: ' + page.voice,
    'Call to action: ' + page.cta,
    'Aim for a concise, useful post. No fabricated hashtags or promotional claims.'
  ].join('\n');
}
export function freeDraft(idea, page) {
  const intro = page.audience ? 'Dành cho ' + page.audience.toLowerCase() + ': ' : '';
  const note = idea.brief ? '\n\n' + idea.brief : '';
  const cta = page.cta ? '\n\n' + page.cta : '';
  return intro + idea.title + note + cta;
}
export function apiError(message, status = 400) {
  const error = new Error(message);
  error.httpStatus = status;
  return error;
}
