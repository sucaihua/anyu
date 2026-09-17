const BASE = 'http://localhost:3000';
(async () => {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const j = await r.json();
  if (j.code !== 0) { console.error('登录失败'); process.exit(1); }
  console.log('TOKEN=' + j.data.accessToken);
})().catch((e) => { console.error(e.message); process.exit(1); });
