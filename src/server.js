// ChargeGuard JSON API — GUI'nin tüketeceği katman.
// Varsayılan: http://127.0.0.1:8731  (CG_PORT / CG_HOST ile değişir)
import http from 'node:http';
import { open } from './core.js';

function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });
}

export function serve(opts = {}) {
  const port = Number(opts.port ?? process.env.CG_PORT ?? 8731);
  const host = opts.host ?? process.env.CG_HOST ?? '127.0.0.1';
  const app = opts.app || open();

  const routes = {
    'GET /device': () => app.device,
    'GET /caps': () => ({ device: app.device, backend: app.backend, capabilities: app.capabilities() }),
    'GET /status': () => app.status(),
    'POST /stop': (b) => app.stopAt(Number(b.pct)),
    'POST /hold': (b) => app.holdRange(Number(b.lo), Number(b.hi)),
    'POST /conserve': (b) => app.conserve(b.on === true || b.on === 'true' || b.on === 1),
    'POST /off': () => app.disable(),
  };

  const server = http.createServer(async (req, res) => {
    let url;
    try { url = new URL(req.url, `http://${host}`); } catch { res.statusCode = 400; res.end('{}'); return; }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) { res.statusCode = 404; res.end(JSON.stringify({ error: 'yol yok', routes: Object.keys(routes) })); return; }
    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      res.end(JSON.stringify(await handler(body) ?? { ok: true }, null, 2));
    } catch (e) {
      res.statusCode = 500; res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    }
  });

  server.listen(port, host, () => { if (!opts.quiet) console.log(`ChargeGuard JSON API: http://${host}:${server.address().port}`); });
  return server;
}
