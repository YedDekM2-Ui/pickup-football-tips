/* app.js — router แบบ hash + แถบล่าง + ตัวเปิดหน้า
   ไม่มี framework ไม่มี build — โหลดด้วย <script> ตามลำดับใน index.html */
'use strict';

var ROUTES = ['forebet', 'mybet', 'ledger'];
var NAV_LABEL = { forebet: 'FOREBET', mybet: 'MY BET', ledger: 'LEDGER' };

function routeOf(hash) {
  var h = String(hash || '').replace(/^#/, '');
  return ROUTES.indexOf(h) >= 0 ? h : 'forebet';
}

function renderNav(active) {
  var items = ROUTES.map(function (r) {
    var cls = 'nav-item' + (r === active ? ' nav-on' : '');
    return '<a class="' + cls + '" href="#' + r + '">' + NAV_LABEL[r] + '</a>';
  });
  return '<nav class="nav">' + items.join('') + '</nav>';
}

/** เลือกตัวปั้นหน้าตาม route — ฟังก์ชันพวกนี้มาจาก page-*.js */
function renderPage(route, data, nowMs) {
  if (route === 'mybet') return renderMyBet(data, nowMs);
  if (route === 'ledger') return renderLedger(data);
  return renderForebet(data, nowMs);
}

var STATE = { data: MOCK, source: 'ตัวอย่าง', at: Date.now() };

/** ผูกกับ DOM — ส่วนนี้ไม่มีเทสต์ เพราะมันแค่เอา string ไปแปะ */
function mount_() {
  if (typeof document === 'undefined') return;
  var route = routeOf(location.hash);
  document.body.className = 'page-' + route;
  document.getElementById('note').textContent = staleNote(STATE.source, STATE.at);
  document.getElementById('app').innerHTML = renderPage(route, STATE.data, Date.now());
  document.getElementById('nav').innerHTML = renderNav(route);
}

/** ขึ้นจอจากแคชก่อน ไม่รอเน็ต แล้วค่อยทับด้วยของสดเมื่อมันมาถึง */
function boot_() {
  bootKey_();
  var picked = pickData(null, loadCache());
  STATE.data = picked.data; STATE.source = picked.source;
  mount_();

  fetchAll_().then(function (fresh) {
    var p = pickData(fresh, loadCache());
    if (fresh && fresh.ok === true) saveCache(fresh);
    STATE.data = p.data; STATE.source = p.source; STATE.at = Date.now();
    mount_();
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('hashchange', mount_);
  window.addEventListener('DOMContentLoaded', boot_);
}
