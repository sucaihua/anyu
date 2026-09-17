/* ============================================================ */
/* Anyu Admin · 后台独立脚本（自包含，不依赖用户端 app.js）      */
/* ============================================================ */

// ---------- 认证与会话 ----------
const Auth = (() => {
  const K_ACCESS = 'anyu_access';
  const K_REFRESH = 'anyu_refresh';
  const K_USER = 'anyu_user';
  const lsGet = (k) => localStorage.getItem(k);
  const lsSet = (k, v) => localStorage.setItem(k, v);
  const lsDel = (k) => localStorage.removeItem(k);

  function getToken() { return lsGet(K_ACCESS); }
  function getUser() { try { return JSON.parse(lsGet(K_USER) || 'null'); } catch { return null; } }
  function setSession(d) {
    lsSet(K_ACCESS, d.accessToken);
    lsSet(K_REFRESH, d.refreshToken);
    lsSet(K_USER, JSON.stringify(d.user));
  }
  function clearSession() { lsDel(K_ACCESS); lsDel(K_REFRESH); lsDel(K_USER); }

  let refreshLock = null;
  async function doRefresh() {
    if (refreshLock) return refreshLock;
    const rt = lsGet(K_REFRESH);
    if (!rt) { refreshLock = Promise.reject(new Error('NO_REFRESH')); return refreshLock; }
    refreshLock = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt })
        });
        const j = await res.json();
        if (j.code !== 0) throw new Error('REFRESH_FAIL');
        lsSet(K_ACCESS, j.data.accessToken);
        lsSet(K_REFRESH, j.data.refreshToken);
        return j.data.accessToken;
      } finally { refreshLock = null; }
    })();
    return refreshLock;
  }

  async function request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const make = () => fetch(url, opts).then((r) => r.json());
    let j = await make();
    if (j.code === 1002) {
      try {
        await doRefresh();
        headers['Authorization'] = `Bearer ${getToken()}`;
        j = await make();
      } catch (e) { clearSession(); return { code: 1002, message: '登录已失效', data: null }; }
    }
    // 账号被禁用：强制清会话退出并提示
    if (j.code === 1010) {
      clearSession();
      Toast.error(j.message || '账号已被禁用');
      setTimeout(() => location.replace('/login'), 900);
    }
    return j;
  }

  return {
    get: (u) => request('GET', u),
    post: (u, b) => request('POST', u, b),
    put: (u, b) => request('PUT', u, b),
    del: (u) => request('DELETE', u),
    getToken, getUser, setSession, clearSession
  };
})();

// ---------- Toast ----------
const Toast = (() => {
  let host = null;
  function ensure() { if (!host) { host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host); } }
  function show(msg, type = 'info', ms = 2600) {
    ensure();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 300); }, ms);
  }
  return {
    success: (m, s) => show(m, 'success', s),
    error: (m, s) => show(m, 'error', s),
    warn: (m, s) => show(m, 'warn', s),
    info: (m, s) => show(m, 'info', s)
  };
})();

// ---------- Modal ----------
const Modal = (() => {
  function open({ title = '', body = '', footer = '', size = '' }) {
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    const md = document.createElement('div');
    md.className = 'modal' + (size === 'lg' ? ' lg' : '');
    md.innerHTML = `
      <div class="modal-header"><span>${title}</span><button class="modal-close" aria-label="关闭">&times;</button></div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}`;
    bd.appendChild(md);
    document.body.appendChild(bd);
    const close = () => { bd.classList.add('closing'); md.classList.add('closing'); setTimeout(() => bd.remove(), 200); };
    bd.addEventListener('click', (e) => { if (e.target === bd) close(); });
    md.querySelector('.modal-close').addEventListener('click', close);
    return { el: md, bd, close };
  }
  function confirm({ title = '确认操作', content = '', okText = '确定', okClass = 'btn-primary' }) {
    return new Promise((resolve) => {
      const m = open({
        title, body: `<div style="color:var(--c-text);font-size:14px;">${content}</div>`,
        footer: `<button class="btn btn-ghost" data-act="cancel">取消</button>
                 <button class="btn ${okClass}" data-act="ok">${okText}</button>`
      });
      m.el.querySelector('[data-act=cancel]').addEventListener('click', () => { m.close(); resolve(false); });
      m.el.querySelector('[data-act=ok]').addEventListener('click', () => { m.close(); resolve(true); });
    });
  }
  return { open, confirm };
})();

// ---------- 工具 ----------
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
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function renderLoading(target, rows = 5, cols = 6) {
  const tbody = `<tbody>${Array.from({ length: rows }).map(() =>
    `<tr>${Array.from({ length: cols }).map(() =>
      '<td><div class="skeleton" style="height:18px;width:80%;"></div></td>').join('')}</tr>`).join('')}</tbody>`;
  target.innerHTML = `<thead><tr><th>加载中...</th></tr></thead>${tbody}`;
}
function renderEmpty(target, icon, text, cols = 99) {
  target.innerHTML = `<tbody><tr><td colspan="${cols}"><div class="admin-empty">
    <div class="admin-empty-icon">${icon}</div><div class="admin-empty-text">${text}</div></div></td></tr></tbody>`;
}

// ---------- 鉴权守卫：需管理员 ----------
async function requireAdmin() {
  if (!Auth.getToken()) {
    location.replace('/login?redirect=admin');
    return false;
  }
  const u = Auth.getUser();
  if (!u || u.role !== 1) {
    Toast.warn('无管理员权限');
    setTimeout(() => location.replace('/'), 900);
    return false;
  }
  return true;
}

// ============================================================
// 后台业务逻辑
// ============================================================
(async () => {
  if (!(await requireAdmin())) return;

  const user = Auth.getUser();
  // 侧边栏底部展示当前管理员；填充用户名（头像为固定 logo 图片）
  const avaEl = document.getElementById('sideUser');
  if (avaEl && user) {
    avaEl.querySelector('.uname').textContent = user.username;
    avaEl.querySelector('.uemail').textContent = user.email || '';
  }

  let userPage = 1, prodPage = 1, ordPage = 1;
  const SIZE = 10;

  // 侧边栏
  const side = document.getElementById('side');
  const mask = document.getElementById('sideMask');
  const closeSide = () => { side.classList.remove('open'); mask.classList.remove('open'); };
  document.querySelectorAll('.admin-mobile-toggle').forEach((b) => {
    b.addEventListener('click', () => { side.classList.add('open'); mask.classList.add('open'); });
  });
  if (mask) mask.addEventListener('click', closeSide);

  // tab 切换
  document.querySelectorAll('.admin-side-item').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.admin-side-item').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const tab = b.dataset.tab;
      ['dashboard', 'users', 'products', 'categories', 'recharges', 'orders', 'popup', 'mail'].forEach((t) => {
        document.getElementById(t + 'View').style.display = tab === t ? '' : 'none';
      });
      if (window.innerWidth <= 960) closeSide();
      if (tab === 'dashboard') loadDashboard();
      if (tab === 'users') loadUsers();
      if (tab === 'products') { fillProdCatFilter(); loadProducts(); }
      if (tab === 'categories') loadCategories();
      if (tab === 'recharges') loadRecharges();
      if (tab === 'orders') loadOrders();
      if (tab === 'popup') loadPopup();
      if (tab === 'mail') loadMail();
    });
  });
  document.querySelectorAll('[data-jump]').forEach((b) => {
    b.addEventListener('click', () => { document.querySelector(`.admin-side-item[data-tab="${b.dataset.jump}"]`).click(); });
  });

  // 退出
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    const rt = localStorage.getItem('anyu_refresh');
    try { await Auth.post('/api/auth/logout', { refreshToken: rt }); } catch (e) {}
    Auth.clearSession();
    Toast.success('已退出');
    setTimeout(() => location.replace('/login'), 600);
  });

  // 分页
  function renderPager(id, page, total, onChange) {
    const host = document.getElementById(id);
    const pages = Math.ceil(total / SIZE) || 1;
    const from = total === 0 ? 0 : (page - 1) * SIZE + 1;
    const to = Math.min(page * SIZE, total);
    host.innerHTML = `<div class="admin-pagination-info">显示第 ${from}-${to} 条 / 共 ${total} 条</div>
      <div class="admin-pagination-btns">
        <button ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}">‹</button>
        <button class="active">${page}</button>
        <button ${page >= pages ? 'disabled' : ''} data-p="${page + 1}">›</button>
      </div>`;
    host.querySelectorAll('button[data-p]').forEach((b) => {
      b.addEventListener('click', () => onChange(Number(b.dataset.p)));
    });
  }

  // ============ 概览 ============
  async function loadDashboard() {
    try {
      const [u, p, o] = await Promise.all([
        Auth.get('/api/admin/users?page=1&size=1'),
        Auth.get('/api/products/admin/list?page=1&size=1'),
        Auth.get('/api/orders/admin/list?page=1&size=1000')
      ]);
      if (u.code === 0) {
        document.getElementById('statUsers').textContent = u.data.total;
        document.getElementById('sideUserBadge').textContent = u.data.total;
      }
      if (p.code === 0) {
        document.getElementById('statProducts').textContent = p.data.total;
        document.getElementById('sideProdBadge').textContent = p.data.total;
        const allP = await Auth.get('/api/products');
        if (allP.code === 0) document.getElementById('statOnSale').textContent = (allP.data || []).length;
      }
      if (o.code === 0) {
        const orders = o.data.list || [];
        const paid = orders.filter((x) => x.status === 1);
        const revenue = paid.reduce((s, x) => s + Number(x.amount), 0);
        document.getElementById('statOrders').textContent = o.data.total;
        document.getElementById('sideOrdBadge').textContent = o.data.total;
        document.getElementById('statRevenue').textContent = '$' + fmt.money(revenue);
      }
    } catch (e) { Toast.error('加载概览失败'); }
  }

  // ============ 用户管理 ============
  async function loadUsers() {
    const kw = document.getElementById('userKw').value.trim();
    const tbl = document.getElementById('userTable');
    renderLoading(tbl, 5, 8);
    const r = await Auth.get(`/api/admin/users?keyword=${encodeURIComponent(kw)}&page=${userPage}&size=${SIZE}`);
    if (r.code !== 0) return Toast.error(r.message);
    const list = r.data.list || [];
    if (!list.length) renderEmpty(tbl, '👥', '暂无用户', 8);
    else {
      tbl.innerHTML = `<thead><tr><th>ID</th><th>用户名</th><th>邮箱</th><th>角色</th>
        <th>余额</th><th>状态</th><th>注册时间</th><th style="text-align:right;">操作</th></tr></thead><tbody>
        ${list.map((u) => `<tr>
          <td class="mono">${u.id}</td>
          <td class="strong">${escapeHtml(u.username)}</td>
          <td style="color:var(--c-muted);">${escapeHtml(u.email)}</td>
          <td>${u.role === 1 ? '<span class="badge badge-primary">管理员</span>' : '<span class="badge badge-muted">用户</span>'}</td>
          <td class="num">$${fmt.money(u.balance)}</td>
          <td>${u.status === 1 ? '<span class="badge badge-success">正常</span>' : '<span class="badge badge-danger">禁用</span>'}</td>
          <td style="color:var(--c-muted);font-size:13px;">${fmt.date(u.created_at)}</td>
          <td><div class="row-actions" style="justify-content:flex-end;">
            <button class="btn btn-primary" data-bal="${u.id}" data-name="${escapeHtml(u.username)}" ${u.role === 1 ? 'disabled title="管理员不可充值"' : ''}>+ 余额</button>
            <button class="btn ${u.status === 1 ? 'btn-outline' : 'btn-ghost'}" data-status="${u.id}" data-st="${u.status}">${u.status === 1 ? '禁用' : '启用'}</button>
            <button class="btn btn-ghost" data-rec="${u.id}" data-name="${escapeHtml(u.username)}">流水</button>
          </div></td></tr>`).join('')}</tbody>`;
    }
    renderPager('userPager', userPage, r.data.total, (p) => { userPage = p; loadUsers(); });
  }
  document.getElementById('userTable').addEventListener('click', async (e) => {
    const t = e.target;
    if (t.dataset.bal) openAddBalance(Number(t.dataset.bal), t.dataset.name);
    else if (t.dataset.status) {
      const id = Number(t.dataset.status), cur = Number(t.dataset.st), next = cur === 1 ? 0 : 1;
      const ok = await Modal.confirm({
        title: next === 0 ? '禁用用户' : '启用用户',
        content: `确定要${next === 0 ? '<b style="color:var(--c-danger)">禁用</b>' : '<b style="color:var(--c-success)">启用</b>'}该账号吗？`,
        okText: '确定', okClass: next === 0 ? 'btn-danger' : 'btn-primary'
      });
      if (!ok) return;
      const r = await Auth.put(`/api/admin/users/${id}/status`, { status: next });
      if (r.code === 0) { Toast.success('操作成功'); loadUsers(); } else Toast.error(r.message);
    } else if (t.dataset.rec) openUserRecords(Number(t.dataset.rec), t.dataset.name);
  });

  function openAddBalance(userId, name) {
    const m = Modal.open({
      title: `充值 · ${escapeHtml(name)}`,
      body: `<div style="margin-bottom:16px;padding:12px;background:var(--c-primary-soft);border-radius:8px;font-size:13px;color:var(--c-primary-700);">
        💡 此操作将直接增加用户余额，请确认线下已收到付款</div>
        <div class="field"><label class="field-label">充值金额（元）<span style="color:var(--c-danger);">*</span></label>
        <input class="input" id="balAmt" type="number" min="0.01" step="0.01" placeholder="如 100.00" style="width:100%;" autofocus></div>
        <div class="field"><label class="field-label">备注</label>
        <input class="input" id="balRemark" placeholder="可选，如：银行卡转账" style="width:100%;"></div>`,
      footer: `<button class="btn btn-ghost" data-act="cancel">取消</button>
                <button class="btn btn-primary" data-act="ok">确认充值</button>`
    });
    m.el.querySelector('[data-act=cancel]').addEventListener('click', m.close);
    m.el.querySelector('[data-act=ok]').addEventListener('click', async () => {
      const amt = Number(m.el.querySelector('#balAmt').value);
      const remark = m.el.querySelector('#balRemark').value.trim();
      if (!(amt > 0)) return Toast.error('金额必须为正数');
      const r = await Auth.post('/api/admin/users/balance', { userId, amount: amt, remark });
      if (r.code === 0) {
        Toast.success(`充值成功，当前余额 $${fmt.money(r.data.balanceAfter)}`);
        m.close(); loadUsers();
      } else Toast.error(r.message);
    });
  }

  function openUserRecords(userId, name) {
    let page = 1;
    const m = Modal.open({
      title: `${escapeHtml(name)} · 余额流水`, size: 'lg',
      body: `<div id="recList" style="min-height:200px;"></div><div class="admin-pagination" id="recModalPager"></div>`,
      footer: `<button class="btn btn-ghost" data-act="close">关闭</button>`
    });
    m.el.querySelector('[data-act=close]').addEventListener('click', m.close);
    const REC_TYPE = { 1: '充值', 2: '消费', 3: '退款' };
    async function load() {
      const box = m.el.querySelector('#recList');
      box.innerHTML = `<div class="skeleton" style="height:200px;"></div>`;
      const r = await Auth.get(`/api/admin/users/${userId}/records?page=${page}&size=10`);
      if (r.code !== 0) return Toast.error(r.message);
      const list = r.data.list || [];
      if (!list.length) box.innerHTML = `<div class="admin-empty"><div class="admin-empty-icon">📭</div><div class="admin-empty-text">暂无流水</div></div>`;
      else {
        box.innerHTML = `<div style="overflow-x:auto;border:1px solid var(--c-border);border-radius:var(--radius-sm);">
          <table class="admin-table"><thead><tr><th>类型</th><th>金额</th><th>变动后余额</th><th>备注</th><th>时间</th></tr></thead><tbody>
          ${list.map((x) => `<tr>
            <td><span class="badge ${x.type === 1 ? 'badge-success' : x.type === 2 ? 'badge-danger' : 'badge-warn'}">${REC_TYPE[x.type]}</span></td>
            <td class="num">${x.type === 1 ? '+' : '-'}$${fmt.money(x.amount)}</td>
            <td class="num">$${fmt.money(x.balance_after)}</td>
            <td style="color:var(--c-muted);">${escapeHtml(x.remark || '-')}</td>
            <td style="color:var(--c-muted);font-size:13px;">${fmt.date(x.created_at)}</td></tr>`).join('')}
          </tbody></table></div>`;
      }
      const pager = m.el.querySelector('#recModalPager');
      const pages = Math.ceil(r.data.total / 10) || 1;
      pager.innerHTML = `<div class="admin-pagination-info">共 ${r.data.total} 条</div>
        <div class="admin-pagination-btns">
          <button ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}">‹</button>
          <button class="active">${page}</button>
          <button ${page >= pages ? 'disabled' : ''} data-p="${page + 1}">›</button>
        </div>`;
      pager.querySelectorAll('button[data-p]').forEach((b) => { b.addEventListener('click', () => { page = Number(b.dataset.p); load(); }); });
    }
    load();
  }

  // ============ 分类管理 ============
  async function loadCategories() {
    const tbl = document.getElementById('catTable');
    renderLoading(tbl, 4, 6);
    const r = await Auth.get('/api/admin/categories');
    if (r.code !== 0) return Toast.error(r.message);
    renderCategories(tbl, r.data || []);
  }

  function renderCategories(tbl, list) {
    if (!list.length) return renderEmpty(tbl, '🏷️', '暂无分类', 6);
    tbl.innerHTML = `<thead><tr><th>ID</th><th>分类名称</th><th>排序</th><th>状态</th><th>商品数量</th><th style="text-align:right;">操作</th></tr></thead><tbody>
      ${list.map((c) => `<tr>
        <td class="mono">${c.id}</td>
        <td class="strong">${escapeHtml(c.name)}</td>
        <td class="num">${c.sort_order}</td>
        <td>${c.status === 1 ? '<span class="badge badge-success">启用</span>' : '<span class="badge badge-danger">停用</span>'}</td>
        <td class="num">${c.product_count}</td>
        <td><div class="row-actions" style="justify-content:flex-end;">
          <button class="btn btn-outline" data-edit="${c.id}">✏️ 编辑</button>
          <button class="btn btn-danger" data-del="${c.id}" ${c.name === '未分类' ? 'disabled title="系统默认分类不可删除"' : ''}>🗑️ 删除</button>
        </div></td></tr>`).join('')}
      </tbody>`;
    tbl.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openCategoryEditor(Number(b.dataset.edit))));
    tbl.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => onDeleteCategory(Number(b.dataset.del))));
  }

  async function openCategoryEditor(id) {
    let c = null;
    if (id) {
      const r = await Auth.get('/api/admin/categories');
      if (r.code !== 0) return Toast.error(r.message);
      c = (r.data || []).find((x) => x.id === id);
      if (!c) return Toast.error('分类不存在');
    }
    const m = Modal.open({
      title: id ? `编辑分类 · #${id}` : '新增分类',
      body: `<form class="admin-form" onsubmit="return false;">
        <div class="field"><label class="field-label">分类名称 <span style="color:var(--c-danger);">*</span></label>
          <input class="input" id="catName" value="${escapeHtml(c?.name || '')}" style="width:100%;" autofocus></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="field"><label class="field-label">排序（越小越靠前）</label>
            <input class="input" id="catSort" type="number" min="0" value="${c?.sort_order ?? 0}" style="width:100%;"></div>
          <div class="field"><label class="field-label">状态</label>
            <select class="select" id="catStatus" style="width:100%;">
              <option value="1" ${(!c || c.status === 1) ? 'selected' : ''}>启用</option>
              <option value="0" ${c && c.status === 0 ? 'selected' : ''}>停用</option>
            </select></div>
        </div>
      </form>`,
      footer: `<button class="btn btn-ghost" data-act="cancel">取消</button>
                <button class="btn btn-primary" data-act="ok">${id ? '保存修改' : '创建分类'}</button>`
    });
    m.el.querySelector('[data-act=cancel]').addEventListener('click', m.close);
    m.el.querySelector('[data-act=ok]').addEventListener('click', async () => {
      const body = {
        name: m.el.querySelector('#catName').value.trim(),
        sortOrder: Number(m.el.querySelector('#catSort').value) || 0,
        status: Number(m.el.querySelector('#catStatus').value)
      };
      if (!body.name) return Toast.error('名称必填');
      const r = id ? await Auth.put(`/api/admin/categories/${id}`, body) : await Auth.post('/api/admin/categories', body);
      if (r.code === 0) { Toast.success(id ? '修改成功' : '创建成功'); m.close(); loadCategories(); }
      else Toast.error(r.message);
    });
  }

  async function onDeleteCategory(id) {
    const ok = await Modal.confirm({
      title: '删除分类',
      content: '确定删除该分类吗？<span style="color:var(--c-danger);">该分类下的商品将自动移出，但商品不会被删除。</span>',
      okText: '确定删除', okClass: 'btn-danger'
    });
    if (!ok) return;
    const r = await Auth.del(`/api/admin/categories/${id}`);
    if (r.code === 0) { Toast.success(r.message || '删除成功'); loadCategories(); } else Toast.error(r.message);
  }
  document.getElementById('catNew').addEventListener('click', () => openCategoryEditor(null));

  // ============ 商品管理 ============
  // 填充分类筛选下拉
  async function fillProdCatFilter(selected = '') {
    const sel = document.getElementById('prodCat');
    const cur = selected || sel.dataset.cur || '';
    const r = await Auth.get('/api/admin/categories');
    const list = (r && r.code === 0) ? (r.data || []) : [];
    sel.innerHTML = `<option value="">全部分类</option>` +
      list.map((c) => `<option value="${c.id}" ${Number(cur) === Number(c.id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
    sel.dataset.cur = cur;
  }

  async function loadProducts() {
    const kw = document.getElementById('prodKw').value.trim();
    const cat = document.getElementById('prodCat').value;
    const tbl = document.getElementById('prodTable');
    renderLoading(tbl, 4, 8);
    const r = await Auth.get(`/api/products/admin/list?keyword=${encodeURIComponent(kw)}&categoryId=${cat}&page=${prodPage}&size=${SIZE}`);
    if (r.code !== 0) return Toast.error(r.message);
    const list = r.data.list || [];
    if (!list.length) renderEmpty(tbl, '📦', '暂无商品', 8);
    else {
      tbl.innerHTML = `<thead><tr><th>ID</th><th>商品信息</th><th>分类</th><th>价格</th><th>库存</th><th>上架状态</th><th>更新时间</th><th style="text-align:right;">操作</th></tr></thead><tbody>
        ${list.map((p) => `<tr>
          <td class="mono">${p.id}</td>
          <td><div class="strong">${escapeHtml(p.name)}</div>
            ${p.description ? `<div style="font-size:12px;color:var(--c-muted);margin-top:2px;">${escapeHtml(p.description).slice(0, 40)}${p.description.length > 40 ? '...' : ''}</div>` : ''}</td>
          <td>${p.category_name ? `<span class="badge badge-muted">${escapeHtml(p.category_name)}</span>` : '<span style="color:var(--c-muted);">-</span>'}</td>
          <td class="num">$${fmt.money(p.price)}</td>
          <td class="num">${p.stock}</td>
          <td><label class="switch"><input type="checkbox" data-toggle="${p.id}" ${p.status === 1 ? 'checked' : ''}><span class="switch-slider"></span></label></td>
          <td style="color:var(--c-muted);font-size:13px;">${fmt.date(p.updated_at)}</td>
          <td><div class="row-actions" style="justify-content:flex-end;"><button class="btn btn-outline" data-edit="${p.id}">✏️ 编辑</button></div></td></tr>`).join('')}
        </tbody>`;
    }
    renderPager('prodPager', prodPage, r.data.total, (p) => { prodPage = p; loadProducts(); });
  }
  document.getElementById('prodTable').addEventListener('click', (e) => { if (e.target.dataset.edit) openProductEditor(Number(e.target.dataset.edit)); });
  document.getElementById('prodTable').addEventListener('change', async (e) => {
    if (e.target.dataset.toggle) {
      const id = Number(e.target.dataset.toggle);
      const status = e.target.checked ? 1 : 0;
      const r = await Auth.get(`/api/products/${id}`);
      if (r.code !== 0) return Toast.error(r.message);
      const p = r.data;
      const up = await Auth.put(`/api/products/admin/${id}`, {
        name: p.name, price: Number(p.price), stock: p.stock,
        cover: p.cover, description: p.description, status,
        categoryId: p.category_id ? Number(p.category_id) : null
      });
      if (up.code === 0) Toast.success(status === 1 ? '已上架' : '已下架'); else { Toast.error(up.message); loadProducts(); }
    }
  });

  // ===== 规格辅助 =====
  // 解析规格文本：每行 "维度: 值1, 值2" → { 颜色: [红,蓝], 尺码: [S,M] }
  function parseSpecTextToObject(text) {
    const out = {};
    String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
      const idx = line.indexOf(':');
      if (idx < 0) return;
      const name = line.slice(0, idx).trim();
      const values = line.slice(idx + 1).split(/[，,、]/).map((s) => s.trim()).filter(Boolean);
      if (name && values.length) out[name] = values;
    });
    return Object.keys(out).length ? out : null;
  }
  // 把 specJson 对象转回文本（编辑时回填）
  function specJsonToText(specJson) {
    if (!specJson || typeof specJson !== 'object') return '';
    return Object.entries(specJson).map(([k, vs]) => `${k}: ${Array.isArray(vs) ? vs.join(', ') : vs}`).join('\n');
  }

  async function openProductEditor(id) {
    let p = null;
    // 加载分类列表（仅启用中的可作为可选分类）
    const catRes = await Auth.get('/api/admin/categories');
    const cats = (catRes && catRes.code === 0) ? (catRes.data || []).filter((c) => c.status === 1) : [];
    if (id) {
      const r = await Auth.get(`/api/products/${id}`);
      if (r.code !== 0) return Toast.error(r.message);
      p = r.data;
    }
    const initSpecText = p && p.specJson ? specJsonToText(p.specJson) : '';
    const m = Modal.open({
      title: id ? `编辑商品 · #${id}` : '新增商品', size: 'lg',
      body: `<form class="admin-form" onsubmit="return false;">
        <div class="field"><label class="field-label">商品名称 <span style="color:var(--c-danger);">*</span></label>
          <input class="input" id="pName" value="${escapeHtml(p?.name || '')}" style="width:100%;" autofocus></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="field"><label class="field-label">所属分类</label>
            <select class="select" id="pCategory" style="width:100%;">
              <option value="">-- 未分类 --</option>
              ${cats.map((c) => `<option value="${c.id}" ${p && Number(p.category_id) === Number(c.id) ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select></div>
          <div class="field"><label class="field-label">价格（元）<span style="color:var(--c-danger);">*</span></label>
            <input class="input" id="pPrice" type="number" min="0" step="0.01" value="${p ? p.price : ''}" style="width:100%;"></div>
        </div>
        <div class="field"><label class="field-label">库存 <span style="color:var(--c-danger);">*</span></label>
          <input class="input" id="pStock" type="number" min="0" step="1" value="${p ? p.stock : 0}" style="width:100%;"></div>
        <div class="field"><label class="field-label">封面图 URL</label>
          <input class="input" id="pCover" value="${escapeHtml(p?.cover || '')}" placeholder="可选" style="width:100%;"></div>
        <div class="field"><label class="field-label">商品描述</label>
          <textarea class="textarea" id="pDesc">${escapeHtml(p?.description || '')}</textarea></div>

        <div class="field" style="border-top:1px dashed var(--c-border);padding-top:16px;">
          <label class="field-label">商品规格（可选）</label>
          <div class="field-hint" style="margin-bottom:8px;">每行一个维度，格式：<b>维度名: 值1, 值2</b>。留空表示无规格（普通商品）。示例：<br><code>颜色: 红, 蓝<br>尺码: S, M, L</code></div>
          <textarea class="textarea" id="pSpecs" placeholder="颜色: 红, 蓝&#10;尺码: S, M, L" style="min-height:80px;font-family:monospace;">${escapeHtml(initSpecText)}</textarea>
          <div class="field-hint" style="margin-top:6px;">用户下单时按维度选择，规格仅做记录与展示，不影响价格与库存。</div>
        </div>

        <div class="field"><label class="field-label">上架状态</label>
          <select class="select" id="pStatus" style="width:auto;">
            <option value="1" ${p?.status === 1 ? 'selected' : ''}>上架</option>
            <option value="0" ${p && p.status === 0 ? 'selected' : ''}>下架</option>
          </select></div>
      </form>`,
      footer: `<button class="btn btn-ghost" data-act="cancel">取消</button>
                <button class="btn btn-primary" data-act="ok">${id ? '保存修改' : '创建商品'}</button>`
    });

    m.el.querySelector('[data-act=cancel]').addEventListener('click', m.close);
    m.el.querySelector('[data-act=ok]').addEventListener('click', async () => {
      const body = {
        name: m.el.querySelector('#pName').value.trim(),
        categoryId: m.el.querySelector('#pCategory').value ? Number(m.el.querySelector('#pCategory').value) : null,
        price: Number(m.el.querySelector('#pPrice').value),
        stock: Number(m.el.querySelector('#pStock').value),
        cover: m.el.querySelector('#pCover').value.trim() || null,
        description: m.el.querySelector('#pDesc').value.trim(),
        status: Number(m.el.querySelector('#pStatus').value),
        specJson: parseSpecTextToObject(m.el.querySelector('#pSpecs').value)
      };
      if (!body.name) return Toast.error('名称必填');
      if (!(body.price >= 0)) return Toast.error('价格不合法');
      if (!(body.stock >= 0)) return Toast.error('库存不合法');

      const r = id ? await Auth.put(`/api/products/admin/${id}`, body) : await Auth.post('/api/products/admin', body);
      if (r.code === 0) { Toast.success(id ? '修改成功' : '创建成功'); m.close(); loadProducts(); }
      else Toast.error(r.message);
    });
  }

  // ============ 订单管理 ============
  async function loadOrders() {
    const kw = document.getElementById('ordKw').value.trim();
    const status = document.getElementById('ordStatus').value;
    const tbl = document.getElementById('ordTable');
    renderLoading(tbl, 4, 7);
    const r = await Auth.get(`/api/orders/admin/list?keyword=${encodeURIComponent(kw)}&status=${status}&page=${ordPage}&size=${SIZE}`);
    if (r.code !== 0) return Toast.error(r.message);
    const list = r.data.list || [];
    if (!list.length) renderEmpty(tbl, '🧾', '暂无订单', 7);
    else {
      const STATUS = { 0: ['待支付', 'badge-warn'], 1: ['已支付', 'badge-success'], 2: ['已退款', 'badge-muted'] };
      tbl.innerHTML = `<thead><tr><th>订单号</th><th>用户</th><th>商品</th><th>金额</th><th>状态</th><th>下单时间</th><th style="text-align:right;">操作</th></tr></thead><tbody>
        ${list.map((o) => `<tr>
          <td class="mono">${escapeHtml(o.order_no)}</td>
          <td>${escapeHtml(o.username || ('#' + o.user_id))}</td>
          <td class="strong">${escapeHtml(o.product_name)}${o.spec_desc ? `<div style="font-size:12px;color:var(--c-muted);margin-top:2px;">${escapeHtml(o.spec_desc)}</div>` : ''}</td>
          <td class="num">$${fmt.money(o.amount)}</td>
          <td><span class="badge ${STATUS[o.status][1]}">${STATUS[o.status][0]}</span></td>
          <td style="color:var(--c-muted);font-size:13px;">${fmt.date(o.paid_at || o.created_at)}</td>
          <td><div class="row-actions" style="justify-content:flex-end;">
            ${o.status === 1 ? `<button class="btn btn-danger" data-refund="${o.id}">退款</button>` : `<span style="color:var(--c-muted);font-size:13px;">-</span>`}
          </div></td></tr>`).join('')}
        </tbody>`;
    }
    renderPager('ordPager', ordPage, r.data.total, (p) => { ordPage = p; loadOrders(); });
  }
  document.getElementById('ordTable').addEventListener('click', async (e) => {
    if (e.target.dataset.refund) {
      const id = Number(e.target.dataset.refund);
      const ok = await Modal.confirm({
        title: '订单退款',
        content: `<div style="line-height:1.8;">确定要对该订单发起退款吗？<br><span style="color:var(--c-danger);">订单金额将立即退回到用户余额，并写入退款流水。</span></div>`,
        okText: '确认退款', okClass: 'btn-danger'
      });
      if (!ok) return;
      const r = await Auth.post(`/api/orders/admin/${id}/refund`);
      if (r.code === 0) { Toast.success('退款成功'); loadOrders(); } else Toast.error(r.message);
    }
  });

  // ============ 充值申请 ============
  let rcPage = 1;
  const RC_STATUS = { 0: ['待确认', 'badge-warn'], 1: ['已到账', 'badge-success'], 2: ['已拒绝', 'badge-danger'] };
  async function loadRecharges() {
    const kw = document.getElementById('rcKw').value.trim();
    const status = document.getElementById('rcStatus').value;
    const tbl = document.getElementById('rcTable');
    renderLoading(tbl, 4, 7);
    const r = await Auth.get(`/api/admin/recharges?keyword=${encodeURIComponent(kw)}&status=${status}&page=${rcPage}&size=${SIZE}`);
    if (r.code !== 0) return Toast.error(r.message);
    const list = r.data.list || [];
    if (!list.length) renderEmpty(tbl, '💰', '暂无充值申请', 7);
    else {
      tbl.innerHTML = `<thead><tr><th>单号</th><th>用户</th><th>金额</th><th>状态</th><th>备注</th><th>提交时间</th><th style="text-align:right;">操作</th></tr></thead><tbody>
        ${list.map((x) => `<tr>
          <td class="mono">#${x.id}</td>
          <td><div class="strong">${escapeHtml(x.username || ('#' + x.user_id))}</div>
            ${x.email ? `<div style="font-size:12px;color:var(--c-muted);">${escapeHtml(x.email)}</div>` : ''}</td>
          <td class="num">$${fmt.money(x.amount)}</td>
          <td><span class="badge ${RC_STATUS[x.status][1]}">${RC_STATUS[x.status][0]}</span></td>
          <td style="color:var(--c-muted);font-size:13px;">${escapeHtml(x.remark || '-')}</td>
          <td style="color:var(--c-muted);font-size:13px;">${fmt.date(x.created_at)}</td>
          <td><div class="row-actions" style="justify-content:flex-end;">
            ${x.status === 0
              ? `<button class="btn btn-primary" data-confirm="${x.id}" data-amt="${x.amount}" data-name="${escapeHtml(x.username || '')}">确认到账</button>
                 <button class="btn btn-ghost" data-reject="${x.id}">拒绝</button>`
              : `<span style="color:var(--c-muted);font-size:13px;">-</span>`}
          </div></td></tr>`).join('')}
        </tbody>`;
    }
    renderPager('rcPager', rcPage, r.data.total, (p) => { rcPage = p; loadRecharges(); });
  }
  document.getElementById('rcTable').addEventListener('click', async (e) => {
    const t = e.target;
    if (t.dataset.confirm) {
      const id = Number(t.dataset.confirm);
      const ok = await Modal.confirm({
        title: '确认到账',
        content: `<div style="line-height:1.8;">确定【${escapeHtml(t.dataset.name || '#' + id)}】充值 <b style="color:var(--c-primary);">$${fmt.money(Number(t.dataset.amt))}</b> 已到账？<br><span style="color:var(--c-danger);">确认后金额将立即加到该用户余额。</span></div>`,
        okText: '确认到账', okClass: 'btn-primary'
      });
      if (!ok) return;
      const r = await Auth.put(`/api/admin/recharges/${id}/confirm`);
      if (r.code === 0) { Toast.success('已到账，余额已加'); loadRecharges(); refreshStatBadges(); } else Toast.error(r.message);
    } else if (t.dataset.reject) {
      const id = Number(t.dataset.reject);
      const ok = await Modal.confirm({
        title: '拒绝申请',
        content: '确定拒绝该充值申请吗？将不会给用户加余额。',
        okText: '确定拒绝', okClass: 'btn-danger'
      });
      if (!ok) return;
      const r = await Auth.put(`/api/admin/recharges/${id}/reject`);
      if (r.code === 0) { Toast.success('已拒绝'); loadRecharges(); refreshStatBadges(); } else Toast.error(r.message);
    }
  });
  function refreshStatBadges() {
    Auth.get('/api/admin/recharges?status=0&page=1&size=1').then((r) => {
      if (r.code === 0) document.getElementById('sideRcBadge').textContent = r.data.total;
    }).catch(() => {});
  }

  // ============ 弹窗配置 ============
  function bankPreviewHtml() {
    const name = document.getElementById('popAccountName').value.trim();
    const card = document.getElementById('popBankCard').value.trim();
    const bank = document.getElementById('popBankName').value.trim();
    if (!name && !card && !bank) return '';
    return `
      <div class="preview-bank">
        ${name ? `<div class="preview-bank-row"><span>收款户名</span><b>${escapeHtml(name)}</b></div>` : ''}
        ${card ? `<div class="preview-bank-row"><span>银行卡号</span><b>${escapeHtml(card)}</b><button type="button" class="copy-btn" data-copy="${escapeHtml(card)}">复制</button></div>` : ''}
        ${bank ? `<div class="preview-bank-row"><span>开户行</span><b>${escapeHtml(bank)}</b></div>` : ''}
      </div>`;
  }
  async function loadPopup() {
    const r = await Auth.get('/api/orders/popup');
    if (r.code !== 0) return Toast.error(r.message);
    const c = r.data;
    document.getElementById('popEnabled').checked = c.enabled === 1;
    document.getElementById('popTitle').value = c.title || '';
    document.getElementById('popContent').value = c.content || '';
    document.getElementById('popAccountName').value = c.account_name || '';
    document.getElementById('popBankCard').value = c.bank_card || '';
    document.getElementById('popBankName').value = c.bank_name || '';
    updatePreview();
  }
  function updatePreview() {
    const en = document.getElementById('popEnabled').checked;
    const title = document.getElementById('popTitle').value || '充值提示';
    const content = document.getElementById('popContent').value || '请确认转账信息无误后再确认付款。';
    document.getElementById('popEnabledText').textContent = en ? '已开启' : '已关闭';
    document.getElementById('previewTitle').textContent = title;
    document.getElementById('previewContent').textContent = content;
    document.getElementById('previewBank').innerHTML = bankPreviewHtml();
    // 绑定预览区复制
    document.querySelectorAll('.copy-btn[data-copy]').forEach((b) => {
      b.addEventListener('click', () => { copyText(b.getAttribute('data-copy')); Toast.success('已复制'); });
    });
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
  }
  document.getElementById('popEnabled').addEventListener('change', updatePreview);
  document.getElementById('popTitle').addEventListener('input', updatePreview);
  document.getElementById('popContent').addEventListener('input', updatePreview);
  document.getElementById('popAccountName').addEventListener('input', updatePreview);
  document.getElementById('popBankCard').addEventListener('input', updatePreview);
  document.getElementById('popBankName').addEventListener('input', updatePreview);
  document.getElementById('popSave').addEventListener('click', async () => {
    const body = {
      enabled: document.getElementById('popEnabled').checked ? 1 : 0,
      title: document.getElementById('popTitle').value.trim(),
      content: document.getElementById('popContent').value.trim(),
      accountName: document.getElementById('popAccountName').value.trim(),
      bankCard: document.getElementById('popBankCard').value.trim(),
      bankName: document.getElementById('popBankName').value.trim()
    };
    if (!body.title || !body.content) return Toast.error('标题和内容不能为空');
    const r = await Auth.put('/api/orders/admin/popup', body);
    if (r.code === 0) Toast.success('保存成功'); else Toast.error(r.message);
  });

  // ============ 邮件提醒配置 ============
  let mailCfg = null;
  async function loadMail() {
    const r = await Auth.get('/api/admin/mail-config');
    if (r.code !== 0) return Toast.error(r.message);
    mailCfg = r.data || {};
    document.getElementById('mailEnabled').checked = mailCfg.enabled === 1;
    document.getElementById('mailHost').value = mailCfg.host || '';
    document.getElementById('mailPort').value = mailCfg.port || 465;
    document.getElementById('mailUser').value = mailCfg.mail_user || '';
    document.getElementById('mailFromName').value = mailCfg.from_name || 'Anyu';
    document.getElementById('mailFromEmail').value = mailCfg.from_email || '';
    document.getElementById('mailNotifyUser').checked = mailCfg.notify_user !== 0;
    document.getElementById('mailNotifyRecharge').checked = mailCfg.notify_recharge !== 0;
    document.getElementById('mailAdminTo').value = mailCfg.admin_to || '';
    updateMailPreview();
  }
  function updateMailPreview() {
    const en = document.getElementById('mailEnabled').checked;
    document.getElementById('mailEnabledText').textContent = en ? '已开启' : '已关闭';
  }
  document.getElementById('mailEnabled').addEventListener('change', updateMailPreview);
  document.getElementById('mailRefresh').addEventListener('click', loadMail);
  document.getElementById('mailSave').addEventListener('click', async () => {
    const body = {
      enabled: document.getElementById('mailEnabled').checked ? 1 : 0,
      host: document.getElementById('mailHost').value.trim(),
      port: Number(document.getElementById('mailPort').value) || 465,
      secure: 1,
      mailUser: document.getElementById('mailUser').value.trim(),
      mailPass: document.getElementById('mailPass').value.trim(),
      fromName: document.getElementById('mailFromName').value.trim() || 'Anyu',
      fromEmail: document.getElementById('mailFromEmail').value.trim(),
      notifyUser: document.getElementById('mailNotifyUser').checked ? 1 : 0,
      notifyRecharge: document.getElementById('mailNotifyRecharge').checked ? 1 : 0,
      adminTo: document.getElementById('mailAdminTo').value.trim()
    };
    if (body.enabled && !body.host) return Toast.error('启用邮件提醒前，请先填写 SMTP 主机');
    if (!/^\d+$/.test(body.port) || body.port < 1 || body.port > 65535) return Toast.error('端口不合法');
    const r = await Auth.put('/api/admin/mail-config', body);
    if (r.code === 0) {
      Toast.success('邮件配置已保存');
      document.getElementById('mailPass').value = '';
      loadMail();
    } else Toast.error(r.message);
  });
  document.getElementById('mailTest').addEventListener('click', async () => {
    const to = document.getElementById('mailFromEmail').value.trim()
      || document.getElementById('mailUser').value.trim();
    if (!to) return Toast.error('请先填写发件邮箱或 SMTP 账号作为收件地址');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return Toast.error('收件邮箱格式不正确');
    const r = await Auth.post('/api/admin/mail-config/test', { to });
    if (r.code === 0) Toast.success('测试邮件已发送，请注意查收'); else Toast.error(r.message || '发送失败');
  });

  // ============ 事件绑定：搜索/刷新 ============
  document.getElementById('userSearch').addEventListener('click', () => { userPage = 1; loadUsers(); });
  document.getElementById('userRefresh').addEventListener('click', loadUsers);
  document.getElementById('userKw').addEventListener('keypress', (e) => { if (e.key === 'Enter') { userPage = 1; loadUsers(); } });
  document.getElementById('prodSearch').addEventListener('click', () => { prodPage = 1; loadProducts(); });
  document.getElementById('prodNew').addEventListener('click', () => openProductEditor(null));
  document.getElementById('prodRefresh').addEventListener('click', loadProducts);
  document.getElementById('prodCat').addEventListener('change', () => { prodPage = 1; loadProducts(); });
  document.getElementById('prodKw').addEventListener('keypress', (e) => { if (e.key === 'Enter') { prodPage = 1; loadProducts(); } });
  document.getElementById('ordSearch').addEventListener('click', () => { ordPage = 1; loadOrders(); });
  document.getElementById('ordRefresh').addEventListener('click', loadOrders);
  document.getElementById('ordStatus').addEventListener('change', () => { ordPage = 1; loadOrders(); });
  document.getElementById('rcSearch').addEventListener('click', () => { rcPage = 1; loadRecharges(); });
  document.getElementById('rcRefresh').addEventListener('click', loadRecharges);
  document.getElementById('rcStatus').addEventListener('change', () => { rcPage = 1; loadRecharges(); });
  document.getElementById('rcKw').addEventListener('keypress', (e) => { if (e.key === 'Enter') { rcPage = 1; loadRecharges(); } });
  document.getElementById('ordKw').addEventListener('keypress', (e) => { if (e.key === 'Enter') { ordPage = 1; loadOrders(); } });
  document.getElementById('dashRefresh').addEventListener('click', loadDashboard);

  // 默认加载概览
  loadDashboard();
  refreshStatBadges();
})();