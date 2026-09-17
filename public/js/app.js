// ===== 全局 API 封装 =====
// 带 token、401 自动刷新一次、统一错误处理、Toast 反馈

const API = (() => {
  const KEY_ACCESS = 'anyu_access';
  const KEY_REFRESH = 'anyu_refresh';
  const KEY_USER = 'anyu_user';

  const lsGet = (k) => localStorage.getItem(k);
  const lsSet = (k, v) => localStorage.setItem(k, v);
  const lsDel = (k) => localStorage.removeItem(k);

  function getToken() { return lsGet(KEY_ACCESS); }
  function getUser() {
    try { return JSON.parse(lsGet(KEY_USER) || 'null'); } catch { return null; }
  }
  function setSession(data) {
    lsSet(KEY_ACCESS, data.accessToken);
    lsSet(KEY_REFRESH, data.refreshToken);
    lsSet(KEY_USER, JSON.stringify(data.user));
  }
  function clearSession() {
    lsDel(KEY_ACCESS); lsDel(KEY_REFRESH); lsDel(KEY_USER);
  }

  // 刷新中锁，避免并发刷新
  let refreshPromise = null;

  async function doRefresh() {
    if (refreshPromise) return refreshPromise;
    const rt = lsGet(KEY_REFRESH);
    if (!rt) { throw new Error('NO_REFRESH'); }
    refreshPromise = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt })
        });
        const json = await res.json();
        if (json.code !== 0) throw new Error('REFRESH_FAIL');
        lsSet(KEY_ACCESS, json.data.accessToken);
        lsSet(KEY_REFRESH, json.data.refreshToken);
        return json.data.accessToken;
      } finally {
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  }

  async function request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const make = () => fetch(url, opts).then((r) => r.json());

    let json = await make();
    // 401 自动刷新一次
    if (json.code === 1002) {
      try {
        await doRefresh();
        headers['Authorization'] = `Bearer ${getToken()}`;
        json = await make();
      } catch (e) {
        clearSession();
        // 不直接跳转，由调用方处理
        return { code: 1002, message: '登录已失效', data: null, __needLogin: true };
      }
    }
    // 账号被禁用：强制清会话退出并提示
    if (json.code === 1010) {
      clearSession();
      Toast.error(json.message || '账号已被禁用');
      setTimeout(() => location.replace('/login'), 900);
    }
    return json;
  }

  const get = (url) => request('GET', url);
  const post = (url, body) => request('POST', url, body);
  const put = (url, body) => request('PUT', url, body);
  const del = (url) => request('DELETE', url);

  return { get, post, put, del, getToken, getUser, setSession, clearSession };
})();

// ===== Toast =====
const Toast = (() => {
  let host = null;
  function ensure() {
    if (host) return;
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  function show(message, type = 'info', ms = 2600) {
    ensure();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 300);
    }, ms);
  }
  return {
    success: (m, ms) => show(m, 'success', ms),
    error: (m, ms) => show(m, 'error', ms),
    warn: (m, ms) => show(m, 'warn', ms),
    info: (m, ms) => show(m, 'info', ms)
  };
})();

// ===== Modal =====
const Modal = (() => {
  function open({ title = '', body = '', footer = '', size = '' }) {
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    const md = document.createElement('div');
    md.className = 'modal' + (size === 'lg' ? ' lg' : '');
    md.innerHTML = `
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close" aria-label="关闭">&times;</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    `;
    bd.appendChild(md);
    document.body.appendChild(bd);

    const close = () => {
      bd.classList.add('closing');
      md.classList.add('closing');
      setTimeout(() => bd.remove(), 200);
    };
    bd.addEventListener('click', (e) => { if (e.target === bd) close(); });
    md.querySelector('.modal-close').addEventListener('click', close);

    return { el: md, bd, close };
  }
  function confirm({ title = '确认操作', content = '', okText = '确定', okClass = 'btn-primary' }) {
    return new Promise((resolve) => {
      const m = open({
        title,
        body: `<div style="color:var(--c-text);font-size:14px;">${content}</div>`,
        footer: `<button class="btn btn-ghost" data-act="cancel">取消</button>
                 <button class="btn ${okClass}" data-act="ok">${okText}</button>`
      });
      m.el.querySelector('[data-act=cancel]').addEventListener('click', () => { m.close(); resolve(false); });
      m.el.querySelector('[data-act=ok]').addEventListener('click', () => { m.close(); resolve(true); });
    });
  }
  return { open, confirm };
})();

// ===== 通用工具 =====
const fmt = {
  money(n) {
    const v = Number(n || 0);
    return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  date(d) {
    if (!d) return '-';
    const x = new Date(d);
    if (isNaN(x)) return '-';
    const pad = (n) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
  }
};

function qs(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name) || '';
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function renderLoading(target, rows = 3) {
  const html = Array.from({ length: rows })
    .map(() => '<div class="skeleton" style="height:60px;margin-bottom:8px;"></div>')
    .join('');
  target.innerHTML = html;
}

// ===== 导航栏注入 =====
function renderNav(active) {
  const user = API.getUser();
  const isAuth = !!API.getToken();
  const isAdmin = user && user.role === 1;
  const links = [
    { href: '/', text: '首页', key: 'home' },
    ...(isAuth ? [{ href: '/user', text: '个人中心', key: 'user' }] : []),
    ...(isAdmin ? [{ href: '/admin', text: '后台管理', key: 'admin' }] : [])
  ];
  return `
    <nav class="nav">
      <div class="nav-inner">
        <a href="/" class="brand">
          <img class="brand-logo" src="/image/logo.jpg?v=1" alt="ZiyuanClub">
          <span>ZiyuanClub</span>
        </a>
        <button class="nav-toggle" id="navToggle" aria-label="菜单"><span></span></button>
        <div class="nav-links" id="navLinks">
          ${links.map((l) => `<a href="${l.href}" class="${active === l.key ? 'active' : ''}">${l.text}</a>`).join('')}
        </div>
        <div class="nav-right" id="navRight">
          ${
            isAuth
              ? `<span class="nav-user">您好，<b>${escapeHtml(user.username)}</b></span>
                 <button class="btn btn-outline btn-sm" id="logoutBtn">退出</button>`
              : `<a href="/login" class="btn btn-ghost btn-sm">登录</a>
                 <a href="/register" class="btn btn-primary btn-sm">注册</a>`
          }
        </div>
      </div>
    </nav>
  `;
}

function mountNav(active) {
  const navHost = document.getElementById('nav-host');
  if (!navHost) return;
  navHost.innerHTML = renderNav(active);

  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  const right = document.getElementById('navRight');
  if (toggle) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
      right.classList.toggle('open');
      toggle.classList.toggle('open');
    });
  }
  const logout = document.getElementById('logoutBtn');
  if (logout) {
    logout.addEventListener('click', async () => {
      const refresh = localStorage.getItem('anyu_refresh');
      try { await API.post('/api/auth/logout', { refreshToken: refresh }); } catch (e) {}
      API.clearSession();
      Toast.success('已退出');
      setTimeout(() => location.href = '/', 600);
    });
  }
}

// ===== 鉴权守卫 =====
async function requireLogin() {
  if (!API.getToken()) {
    Toast.warn('请先登录');
    setTimeout(() => location.href = '/login', 800);
    return false;
  }
  return true;
}
async function requireAdmin() {
  const ok = await requireLogin();
  if (!ok) return false;
  const u = API.getUser();
  if (!u || u.role !== 1) {
    Toast.warn('无管理员权限');
    setTimeout(() => location.href = '/', 800);
    return false;
  }
  return true;
}
