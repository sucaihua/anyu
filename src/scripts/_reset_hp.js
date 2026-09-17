// 临时：恢复首页弹窗为默认关闭状态，跑完即删
const BASE = 'http://localhost:3000';
async function j(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  return res.json();
}
(async () => {
  const login = await j('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'admin123' } });
  const auth = { Authorization: 'Bearer ' + login.data.accessToken };
  const up = await j('/api/admin/home-popup', {
    method: 'PUT', headers: auth,
    body: { enabled: 0, title: '公告', content: '欢迎光临！', imageUrl: '', triggerMode: 'first', intervalMinutes: 30 }
  });
  console.log('恢复默认:', up.code, up.message);
  const fin = await j('/api/home-popup');
  console.log('当前 enabled=' + fin.data.enabled);
})().catch((e) => { console.error(e.message); process.exit(1); });
