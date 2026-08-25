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

/** ผูกกับ DOM — ส่วนนี้ไม่มีเทสต์ เพราะมันแค่เอา string ไปแปะ
    Task 8 จะมาแทนที่ mount_ ด้วยตัวที่ดึงของจริง */
function mount_() {
  if (typeof document === 'undefined') return;
  var route = routeOf(location.hash);
  document.body.className = 'page-' + route;
  document.getElementById('app').innerHTML = renderPage(route, MOCK, Date.now());
  document.getElementById('nav').innerHTML = renderNav(route);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('hashchange', mount_);
  window.addEventListener('DOMContentLoaded', mount_);
}
