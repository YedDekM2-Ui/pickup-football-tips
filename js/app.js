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

/** แผ่นใส่กุญแจ — โผล่เมื่อเครื่องนี้ยังไม่มีกุญแจ
    ทำไมต้องมี: แอปที่ยิงจากหน้าโฮมเก็บ localStorage คนละถังกับเบราว์เซอร์
    คั่นหน้าที่บันทึกไว้ก่อนหน้านี้ไม่มี ?k= ติดไป เปิดมาจะว่างเปล่าตลอด
    มีช่องนี้แล้วพิมพ์กุญแจใส่ตรงนี้ได้เลย ไม่ต้องลบคั่นหน้าทำใหม่ (เคสเดียวกับ TimeTrack) */
function renderNeedKey() {
  return '<div class="card keybox">' +
         '<div class="big">ยังไม่มีกุญแจ</div>' +
         '<div class="muted">เครื่องนี้ยังไม่ได้ใส่กุญแจ เลยยังดึงของจริงไม่ได้</div>' +
         '<input id="keyin" class="keyin" type="password" inputmode="text" ' +
         'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ' +
         'placeholder="วางกุญแจตรงนี้">' +
         '<button id="keygo" class="btn">ใส่กุญแจ</button>' +
         '</div>';
}

/** เลือกตัวปั้นหน้าตาม route — ฟังก์ชันพวกนี้มาจาก page-*.js */
function renderPage(route, data, nowMs, source) {
  if (source === 'ต้องใส่กุญแจ') return renderNeedKey();
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
  document.getElementById('note').innerHTML = statusPill(STATE.source, STATE.at);
  document.getElementById('app').innerHTML = renderPage(route, STATE.data, Date.now(), STATE.source);
  document.getElementById('nav').innerHTML = renderNav(route);
  bindKeyForm_();
}

/** ผูกปุ่มใส่กุญแจ — เก็บลงเครื่องแล้วโหลดใหม่รอบเดียว ง่ายกว่าไล่วาดเอง */
function bindKeyForm_() {
  var go = document.getElementById('keygo');
  var inp = document.getElementById('keyin');
  if (!go || !inp) return;
  var submit = function () {
    var v = String(inp.value || '').trim();
    if (!v) return;
    saveKey_(v);
    location.reload();
  };
  go.addEventListener('click', submit);
  inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') submit(); });
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
