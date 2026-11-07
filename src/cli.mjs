import { isIP } from 'node:net';

const usage = [
  'PageFleet local web server',
  'Usage: node src/server.mjs [--port N] [--public] [--demo] [--host IP]',
  '',
  '  --port N      Port to listen on (default: PORT or 3088)',
  '  --public      Listen on the network (0.0.0.0); requires APP_PASSWORD',
  '  --lan         Alias for --public',
  '  --host IP     Bind to a specific interface (with --public for LAN)',
  '  --demo        Load isolated sample data, force mock-only operation',
  '  --help        Print this message',
  '',
  'On a trusted LAN, use APP_PASSWORD="at-least-16-characters" npm start -- --public --port 3088',
  'Without HTTPS the password and data travel unencrypted. Never port-forward to the Internet.',
  'Use PUBLIC_BASE_URL=https://your-domain with a TLS reverse proxy for Internet/VPS hosting.'
].join('\n');

export function privateHost(hostname) {
  const host = String(hostname).replace(/^\[|\]$/g,'').toLowerCase();
  if (host === 'localhost') return true;
  if (isIP(host) === 4) {
    const n = host.split('.').map(Number);
    return n[0] === 10 || n[0] === 127 || (n[0] === 192 && n[1] === 168) ||
      (n[0] === 172 && n[1] >= 16 && n[1] <= 31) ||
      (n[0] === 169 && n[1] === 254);
  }
  if (isIP(host) === 6) {
    return host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host);
  }
  return false;
}

export function parseServerConfig(args = [], env = process.env) {
  let host = env.HOST || '127.0.0.1';
  let portRaw = env.PORT || '3088';
  let lan = false, demo = false, help = false, hostGiven = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { help = true; continue; }
    if (arg === '--public' || arg === '--lan') { lan = true; continue; }
    if (arg === '--demo') { demo = true; continue; }
    if (arg === '--port' || arg.startsWith('--port=')) {
      portRaw = arg === '--port' ? args[++i] : arg.slice(7);
      continue;
    }
    if (arg === '--host' || arg.startsWith('--host=')) {
      host = arg === '--host' ? args[++i] : arg.slice(7);
      hostGiven = true;
      continue;
    }
    throw new Error('Unknown argument: ' + arg + '\n' + usage);
  }
  if (help) return { help: true, usage };
  if (!/^[0-9]{1,5}$/.test(String(portRaw || ''))) throw new Error('Invalid --port: expected 1–65535');
  const port = Number(portRaw);
  if (port < 1 || port > 65535) throw new Error('Invalid --port: expected 1–65535');
  if (!host || (host !== 'localhost' && isIP(host) === 0)) throw new Error('Invalid --host: use an IP address or localhost');
  if (lan && !hostGiven) host = '0.0.0.0';
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
  const exposed = !loopback;
  const publicBase = env.PUBLIC_BASE_URL || '';
  if (publicBase && !/^https:\/\/[^/?#]+\/?$/.test(publicBase)) {
    throw new Error('PUBLIC_BASE_URL must be a single HTTPS origin');
  }
  if (exposed && (!env.APP_PASSWORD || env.APP_PASSWORD.length < 16)) {
    throw new Error('Network access requires APP_PASSWORD with at least 16 characters');
  }
  if (exposed && !lan && !publicBase) {
    throw new Error('Network binding requires --public for trusted LAN HTTP or PUBLIC_BASE_URL with HTTPS');
  }
  if (lan && !publicBase && !privateHost(host) && host !== '0.0.0.0' && host !== '::') {
    throw new Error('--public without HTTPS is only for private network interfaces');
  }
  if (demo && env.PUBLISHER === 'meta') {
    throw new Error('--demo cannot run with PUBLISHER=meta; use PUBLISHER=mock');
  }
  return { port, host, lan, demo, exposed, publicBase, usage };
}

export function validateRequestHost(rawHost, config) {
  if (typeof rawHost !== 'string' || !rawHost || /[/@,\\\s]/.test(rawHost)) {
    throw new Error('Invalid request Host header');
  }
  let url;
  try { url = new URL('http://' + rawHost); } catch { throw new Error('Invalid request Host header'); }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Invalid request Host header');
  }
  if (Number(url.port || 80) !== config.port) throw new Error('Unexpected request port');
  if (!privateHost(url.hostname)) throw new Error('Only literal private IPs or localhost are accepted over HTTP');
  return 'http://' + url.host;
}
