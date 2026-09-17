// Anyu Gitee Webhook：收到 push 后触发 deploy.sh
const http = require('http');
const { spawn } = require('child_process');

const SECRET = process.env.WEBHOOK_SECRET || 'anyu-deploy-secret';
const PORT = Number(process.env.WEBHOOK_PORT || 9011);
const DEPLOY = '/www/wwwroot/anyu/deploy/deploy.sh';

function end(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(msg);
}

http.createServer((req, res) => {
  if (req.method !== 'POST') return end(res, 405, 'method not allowed');
  const token = req.headers['x-gitee-token'];
  if (!token || token !== SECRET) return end(res, 403, 'forbidden');
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const child = spawn('bash', [DEPLOY], { detached: true, stdio: 'ignore' });
    child.unref();
    console.log('[webhook] deploy triggered +' + new Date().toISOString());
    end(res, 200, 'deploy started');
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log('[webhook] listening on 127.0.0.1:' + PORT);
});