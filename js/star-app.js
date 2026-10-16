/* star-app.js — หน้าแกะดาว: ทำนาย / ส่งดวง / สถิติ / บันทึก
   ข้อมูล: ?p=star (ดวงทั้งหมด + ผลลาว/ไทยจากชีตบอท) · เขียน: POST starsave/stardel/starresult
   คำนวณทั้งหมดในเครื่อง (star-calc.js) — เปิดแอปเห็นของจากแคชทันที ไม่ต้องรอเน็ต */
'use strict';

var ST_CACHE = 'star.data.v1', ST_UI = 'star.ui.v1';
var S = { data: null, src: '', tab: 'predict', kind: 'lao', sel: -1, statN: 30, draft: null };
var TH_DIG = '๐๑๒๓๔๕๖๗๘๙';
var TH_MON = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var TH_WD = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
var PL_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function thDate(iso) { var a = iso.split('-'); return TH_WD[scWd_(iso)] + ' ' + (+a[2]) + ' ' + TH_MON[+a[1]] + ' ' + String(+a[0] + 543).slice(2); }
function thNum(s) { return String(s).replace(/[0-9]/g, function (d) { return TH_DIG[+d]; }); }
function toast(t) { var e = $('toast'); e.textContent = t; e.className = 'show'; clearTimeout(toast._t); toast._t = setTimeout(function () { e.className = ''; }, 2600); }
function todayIso() { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); }

/* ---------------- ข้อมูล ---------------- */
function loadCache_() { try { var o = JSON.parse(localStorage.getItem(ST_CACHE) || 'null'); return o && o.ok ? o : null; } catch (e) { return null; } }
function saveCache_(d) { try { localStorage.setItem(ST_CACHE, JSON.stringify(d)); } catch (e) { /* ไม่มีที่ก็แค่ไม่จำ */ } }
function loadUi_() { try { var o = JSON.parse(localStorage.getItem(ST_UI) || '{}'); if (o.kind) S.kind = o.kind; if (o.statN) S.statN = o.statN; } catch (e) { /* ค่าเริ่มต้น */ } }
function saveUi_() { try { localStorage.setItem(ST_UI, JSON.stringify({ kind: S.kind, statN: S.statN })); } catch (e) { /* เหมือนกัน */ } }

function fetchStar_() {
  var k = bootKey_();
  if (!k) return Promise.resolve({ ok: false, needKey: true });
  return fetch(API_URL + '?p=star&k=' + encodeURIComponent(k)).then(function (r) { return r.json(); })
    .catch(function () { return null; });
}

function refresh_() {
  return fetchStar_().then(function (d) {
    if (d && d.ok) { S.data = d; S.src = 'สด'; saveCache_(d); }
    else if (d && d.needKey) S.src = 'กุญแจ';
    else S.src = S.data ? 'แคช' : 'ไม่มีเน็ต';
    note_(); render_();
  });
}

function note_() {
  var t = S.src === 'สด' ? '<span class="pill live">LIVE</span> ล่าสุด ' + esc((S.data.at || '').slice(11, 16)) :
          S.src === 'กุญแจ' ? '<span class="pill off">NO KEY</span> เปิดลิงก์ที่ลงท้าย ?k=... ครั้งแรกครั้งเดียว' :
          S.src === 'แคช' ? '<span class="pill off">OFFLINE</span> ของที่จำไว้ล่าสุด' :
          '<span class="pill off">…</span> กำลังโหลด';
  $('note').innerHTML = t;
}

function charts_() { return (S.data && S.data.charts) || []; }
function results_(kind) { return scResultMap_(kind, (S.data && S.data[kind]) || []); }

/* ---------------- วาดดวง (SVG แบบเดียวกับแอปต้นทาง) ---------------- */
var CH_POS = [[0, -78], [-44, -71], [-74, -42], [-72, 0], [-74, 42], [-44, 74], [0, 78], [44, 74], [74, 42], [72, 0], [74, -42], [44, -71]];
function chartSvg_(c, opt) {
  opt = opt || {};
  var R = 100, h = 22.3, o = [];
  var yc = Math.sqrt(R * R - h * h);
  o.push('<svg viewBox="-128 -124 256 248" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,sans-serif">');
  o.push('<circle r="' + R + '" fill="#0a0d17" stroke="#c9ccd6" stroke-width="1.4"/>');
  [-h, h].forEach(function (v) {
    o.push('<line x1="' + v + '" y1="' + (-yc) + '" x2="' + v + '" y2="' + yc + '" stroke="#c9ccd6" stroke-width="1.2"/>');
    o.push('<line y1="' + v + '" x1="' + (-yc) + '" y2="' + v + '" x2="' + yc + '" stroke="#c9ccd6" stroke-width="1.2"/>');
  });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
    var x0 = s[0] * h, y0 = s[1] * h, u = 0.7071, b = x0 * s[0] * u + y0 * s[1] * u;
    var t = -b + Math.sqrt(b * b - (x0 * x0 + y0 * y0 - R * R));
    o.push('<line x1="' + x0 + '" y1="' + y0 + '" x2="' + (x0 + s[0] * u * t) + '" y2="' + (y0 + s[1] * u * t) + '" stroke="#c9ccd6" stroke-width="1.2"/>');
  });
  SC_RASI.forEach(function (nm, i) {
    var a = (-90 - 30 * i) * Math.PI / 180;
    o.push('<text x="' + (Math.cos(a) * 113).toFixed(1) + '" y="' + (Math.sin(a) * 113 + 4).toFixed(1) + '" fill="#8d95ad" font-size="10" text-anchor="middle">' + nm + '</text>');
  });
  (c.rasi || []).forEach(function (cell, i) {
    var list = cell.slice();
    if (c.lagna === i) list.unshift('ล');
    var vert = (i === 0 || i === 6), n = list.length, p = CH_POS[i];
    list.forEach(function (d, k) {
      var off = (k - (n - 1) / 2) * (vert ? 17 : 15);
      var x = p[0] + (vert ? 0 : off), y = p[1] + (vert ? off : 0) + 6;
      var col = d === 'ล' ? '#e6c063' : (d === opt.day ? '#6fb7ff' : '#eef0f6');
      if (d === opt.day) o.push('<circle cx="' + x + '" cy="' + (y - 6) + '" r="9" fill="none" stroke="#6fb7ff" stroke-width="1"/>');
      o.push('<text x="' + x + '" y="' + y + '" fill="' + col + '" font-size="16" font-weight="700" text-anchor="middle">' + (d === 'ล' ? 'ล' : thNum(d)) + '</text>');
    });
  });
  var cm = /^(\d+)\/(\d+)$/.exec(String(c.center || ''));
  if (cm) o.push('<text x="-4" y="-2" fill="#eef0f6" font-size="12" text-anchor="middle">' + cm[1] + '</text><text x="8" y="14" fill="#eef0f6" font-size="12" text-anchor="middle">' + cm[2] + '</text><line x1="-6" y1="10" x2="8" y2="-6" stroke="#eef0f6" stroke-width=".8"/>');
  o.push('</svg>');
  return o.join('');
}

/* ---------------- แท็บ: ทำนาย ---------------- */
function viewPredict_() {
  var kind = S.kind, K = SC_KIND[kind], iso = scNextDraw_(kind), charts = charts_();
  var chart = scPickChart_(charts, iso);
  if (!chart) return '<div class="card hero"><div class="d">ยังไม่มีดวง</div><div class="muted">ไปแท็บ "ส่งดวง" แล้วเลือกรูปจากอัลบั้ม</div></div>';
  var res = results_(kind), w = scWeights_(kind, charts, res, iso);
  var pr = scPredict_(kind, chart, iso, res, w);
  var h = [];
  h.push('<div class="card hero"><div class="k">' + esc(K.name) + ' · งวดถัดไป</div><div class="d">' + esc(thDate(iso)) + '</div>' +
         '<div class="meta">ดาวประจำวัน ' + esc(SC_PL[pr.dayStar]) + ' (' + pr.dayStar + ') · ' + esc(scLunarText_(pr.lunar)) + '</div>' +
         (chart.date !== iso ? '<div class="warn" style="margin-top:6px">ใช้ดวงวันที่ ' + esc(thDate(chart.date)) + ' — ยังไม่ได้ส่งดวงวันออก</div>' : '') +
         '</div>');

  /* ช่องเลขแยกหลัก */
  h.push('<div class="card"><h3>เลขแยกหลัก<span class="sub">แตะช่องเพื่อดูเหตุผล</span></h3>');
  h.push('<div class="slots ' + (pr.pos.length > 4 ? 'n6' : 'n4') + '">');
  pr.pos.forEach(function (p, i) {
    if (i === 4) h.push('<div class="lowtag">2 ตัวล่าง →</div>');
    h.push('<div class="slot' + (S.sel === i ? ' sel' : '') + (i >= 4 ? ' low' : '') + '" data-pos="' + i + '"><div class="nm">' + esc(p.name) + '</div>' +
           '<div class="big">' + p.top[0].d + '</div><div class="alt">' + p.top[1].d + p.top[2].d + '</div>' +
           '<div class="cl">ปิด <s>' + p.closed.join(' ') + '</s></div></div>');
  });
  h.push('</div>');
  if (S.sel >= 0 && pr.pos[S.sel]) h.push(whyBox_(pr.pos[S.sel]));
  h.push('</div>');

  /* เลขชุด */
  var deadSet = {}; pr.dead.forEach(function (x) { if (x.kal) deadSet[x.d] = 1; });
  h.push('<div class="card"><h3>เลขชุด</h3>');
  pr.sets.forEach(function (st) {
    var lbl = st.name;
    if (kind === 'lao' && st.name === '2 ตัวล่าง') lbl += ' · เลขเด่นหลักพัน-ร้อย';
    h.push('<div class="set"><div class="lbl">' + esc(lbl) + '</div><div class="chips">' +
      st.list.map(function (n, k) { return '<span class="chip' + (k === 0 ? ' first' : '') + '">' + n + '</span>'; }).join('') + '</div></div>');
  });
  h.push('<div class="set"><div class="lbl">เลขวิ่ง</div><div class="chips">' + pr.run.map(function (d, k) { return '<span class="chip' + (k === 0 ? ' first' : '') + '">' + d + '</span>'; }).join('') + '</div></div>');
  h.push('</div>');

  /* เลขเสีย + แนวโน้ม */
  h.push('<div class="card"><h3>เลขเสีย / เลขดับ</h3><ul class="list">' +
    pr.dead.map(function (x) { return '<li><span class="n bad">' + x.d + '</span><span>' + esc(x.why) + (x.kal ? ' <span class="muted">— ดับแรงหลักสิบ-หน่วย</span>' : '') + '</span></li>'; }).join('') +
    '</ul></div>');
  h.push('<div class="card"><h3>แนวโน้มงวดนี้</h3><ul class="list">' +
    '<li><span class="n">' + esc(pr.parity.kind) + '</span><span>' + esc(pr.parity.text) + ' (' + pr.parity.fav.join(' ') + ')</span></li>' +
    '<li><span class="n">' + esc(pr.dbl.level) + '</span><span>โอกาสเบิ้ล' + (pr.dbl.why.length ? ' — ' + esc(pr.dbl.why.join(' · ')) : '') +
      '<br><span class="muted">เบิ้ลที่น่าจับ: ' + pr.dbl.list.join(' ') + (pr.dbl.tong ? ' · ตอง ' + pr.dbl.tong : '') + '</span></span></li>' +
    (pr.hams.length ? '<li><span class="n">หาม</span><span>' + pr.hams.join(' ') + '<br><span class="muted">ดาวเล็งกันไว้หัว-ท้าย ดาวประจำวันกดกลาง</span></span></li>' : '') +
    '</ul></div>');

  /* แยกวิธีค้น */
  h.push('<div class="card"><h3>แยกวิธีค้น<span class="sub">น้ำหนักวัดจากดวง ' + w.n + ' วันที่มีผลจริง</span></h3>');
  SC_METHODS.forEach(function (m) {
    var bags = pr.methods[m[0]], digs = {};
    bags.forEach(function (b) { Object.keys(b).forEach(function (d) { digs[d] = Math.max(digs[d] || 0, b[d].s); }); });
    var list = Object.keys(digs).sort(function (a, b) { return digs[b] - digs[a]; });
    var acc = w.w[m[0]].map(function (x, i) { return K.pos[i] + ' ' + (x.k ? x.top + '/' + x.k : '-') + ' ×' + x.w.toFixed(2); }).join(' · ');
    var reasons = [];
    bags.forEach(function (b) { Object.keys(b).forEach(function (d) { b[d].why.forEach(function (y) { var t = d + ' — ' + y; if (reasons.indexOf(t) < 0) reasons.push(t); }); }); });
    h.push('<details class="acc"><summary><span>' + esc(m[1]) + '</span><span class="tag">' + (list.length ? list.slice(0, 5).join(' ') : 'ไม่มี') + '</span></summary>' +
      '<div class="body"><div class="muted" style="margin-bottom:6px">เข้าอันดับ 1 ตรงหลัก (ครั้ง/ดวง) · น้ำหนัก: ' + esc(acc) + '</div>' +
      (reasons.length ? reasons.slice(0, 14).map(function (r) { return '<div>• ' + esc(r) + '</div>'; }).join('') : '<div class="muted">วิธีนี้ไม่มีเลขสำหรับดวงนี้</div>') +
      '</div></details>');
  });
  h.push('</div>');

  h.push('<div class="card"><h3>ดวงที่ใช้<span class="sub">' + esc(thDate(chart.date)) + ' · วงฟ้า = ดาวประจำวัน</span></h3><div class="chartbox">' + chartSvg_(chart, { day: pr.dayStar }) + '</div>' +
         (chart.moved || chart.special ? '<div class="muted" style="text-align:center">' + esc([chart.moved, chart.special].filter(String).join(' · ')) + '</div>' : '') + '</div>');
  h.push('<div class="foot">คำนวณตามสูตรแกะดาว + สถิติจริง · ใช้ประกอบการตัดสินใจ ไม่ใช่การันตี</div>');
  return h.join('');
}

function whyBox_(p) {
  var h = ['<div class="why">'];
  p.top.forEach(function (t, k) {
    h.push('<div style="margin:' + (k ? '10px' : '0') + ' 0 4px;font-weight:800">หลัก' + esc(p.name) + ' · ' + (k + 1) + ') เลข ' + t.d + ' <span class="muted">คะแนน ' + t.s.toFixed(2) + '</span></div>');
    t.plus.slice().sort(function (a, b) { return b.v - a.v; }).forEach(function (x) {
      h.push('<div class="ln"><span class="v">+' + x.v.toFixed(2) + '</span><span><span class="m">' + esc(x.m) + '</span> ' + esc(x.why.join(' · ')) + '</span></div>');
    });
    t.minus.forEach(function (x) { h.push('<div class="ln"><span class="v neg">−' + x.v.toFixed(2) + '</span><span>' + esc(x.why) + '</span></div>'); });
  });
  h.push('</div>');
  return h.join('');
}

/* ---------------- แท็บ: ส่งดวง ---------------- */
function blankDraft_(iso) {
  var r = []; for (var i = 0; i < 12; i++) r.push([]);
  var lu = scLunarGuess_(iso);
  return { date: iso, rasi: r, lagna: -1, center: '', lunar: scLunarText_(lu), moved: '', special: '', note: '', read: null };
}

function viewUpload_() {
  var d = S.draft, h = [];
  h.push('<div class="card"><h3>ส่งรูปดวงวันนี้</h3>' +
    '<label class="drop"><input type="file" accept="image/*" id="pic"><b>เลือกรูปจากอัลบั้ม</b>' +
    '<span class="muted">รูปหน้าจอ "ปฏิทินโหร 100 ปี รายวัน" · อ่านในเครื่อง ไม่ส่งรูปออก</span></label>' +
    '<div id="readmsg" class="muted" style="margin-top:8px"></div></div>');
  if (!d) return h.join('') + '<div class="foot">หรือ <a href="#" id="manual" style="color:var(--gold)">กรอกเองไม่ใช้รูป</a></div>';
  var loc = scLocOf_(d);
  var missing = PL_ORDER.filter(function (x) { return loc[x] === undefined; });
  h.push('<div class="card"><h3>ตรวจดวงก่อนบันทึก<span class="sub">แก้ราศีของดาวได้ทุกดวง</span></h3>' +
    '<div class="chartbox">' + chartSvg_(d, {}) + '</div>');
  if (d.read && d.read.unsure) h.push('<div class="warn">มี ' + d.read.unsure + ' ตัวที่อ่านไม่ชัด — เทียบกับรูปจริงอีกที</div>');
  if (missing.length) h.push('<div class="warn">ยังขาดดาว: ' + missing.map(function (x) { return SC_PL[x] + '(' + x + ')'; }).join(' ') + '</div>');
  var opts = function (sel) {
    var s = '<option value="-1"' + (sel < 0 ? ' selected' : '') + '>—</option>';
    SC_RASI.forEach(function (nm, i) { s += '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>' + nm + '</option>'; });
    return s;
  };
  h.push('<div class="pl" style="margin-top:10px">');
  PL_ORDER.forEach(function (x) {
    var r = loc[x] === undefined ? -1 : loc[x];
    h.push('<label class="' + (r < 0 ? 'miss' : '') + '"><b>' + thNum(x) + ' ' + SC_PL[x] + '</b><select data-pl="' + x + '">' + opts(r) + '</select></label>');
  });
  h.push('<label><b>ล ลัคนา</b><select data-pl="L">' + opts(d.lagna) + '</select></label>');
  h.push('</div>');
  h.push('<div class="grid2" style="margin-top:10px">' +
    '<label class="fld">วันที่ของดวง<input type="date" id="f_date" value="' + esc(d.date) + '"></label>' +
    '<label class="fld">เลขกลางดวง (เช่น 27/24)<input id="f_center" inputmode="numeric" value="' + esc(d.center) + '"></label>' +
    '<label class="fld">จันทรคติ<input id="f_lunar" value="' + esc(d.lunar) + '"></label>' +
    '<label class="fld">ดาวย้ายวันนี้<select id="f_moved"><option value="">ไม่มีดาวย้าย</option>' +
      PL_ORDER.map(function (x) { var v = SC_PL[x] + ' ย้าย'; return '<option' + (d.moved.indexOf(SC_PL[x]) === 0 ? ' selected' : '') + ' value="' + esc(v) + '">' + esc(SC_PL[x]) + ' ย้าย</option>'; }).join('') + '</select></label>' +
    '</div>' +
    '<label class="fld" style="margin-top:8px">สถานะในแอป (เช่น ดาวเกษตร มี)<input id="f_special" value="' + esc(d.special) + '"></label>' +
    '<label class="fld" style="margin-top:8px">หมายเหตุ<input id="f_note" value="' + esc(d.note) + '"></label>' +
    '<button class="btn" id="save"' + (missing.length ? ' disabled' : '') + '>บันทึกดวง</button>' +
    '<button class="btn ghost" id="cancel">ยกเลิก</button></div>');
  return h.join('');
}

function scLocOf_(d) {
  var loc = {};
  d.rasi.forEach(function (cell, i) { cell.forEach(function (x) { loc[x] = i; }); });
  return loc;
}

function readPic_(file) {
  var msg = $('readmsg');
  msg.textContent = 'กำลังอ่านรูป…';
  var url = URL.createObjectURL(file), im = new Image();
  im.onload = function () {
    /* ปรับให้กว้าง 870 เท่ารูปที่ใช้ฝึกแม่แบบเสมอ (ทั้งย่อและขยาย)
       วัดแล้ว: ปล่อยขนาดเดิม 1.35 เท่า อ่าน 4 เป็น 5 · ปรับกลับ 870 ก่อน อ่านถูก */
    var sc = 870 / im.naturalWidth;
    var cv = document.createElement('canvas');
    cv.width = Math.round(im.naturalWidth * sc); cv.height = Math.round(im.naturalHeight * sc);
    var cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    var r;
    try { r = starRead(cx.getImageData(0, 0, cv.width, cv.height), STAR_TPL); }
    catch (e) { r = { ok: false, error: 'อ่านรูปพัง: ' + e.message }; }
    var iso = (S.draft && S.draft.date) || defaultChartDate_();
    var d = blankDraft_(iso);
    if (r.ok) {
      d.rasi = r.rasi; d.lagna = r.lagna;
      if (r.center.a && r.center.b) d.center = r.center.a + '/' + r.center.b;
      d.read = { unsure: r.unsure };
      var n = 0; r.rasi.forEach(function (c) { n += c.length; });
      toast('อ่านได้ ' + n + '/10 ดวง' + (r.lagna >= 0 ? ' + ลัคนา' : ''));
    } else toast(r.error);
    S.draft = d; render_();
    if (!r.ok) $('readmsg').textContent = r.error;
  };
  im.onerror = function () { msg.textContent = 'เปิดรูปไม่ได้'; };
  im.src = url;
}

function defaultChartDate_() {
  var t = todayIso(), have = {};
  charts_().forEach(function (c) { have[c.date] = 1; });
  return t;
}

function bindUpload_() {
  var pic = $('pic');
  if (pic) pic.onchange = function () { if (pic.files && pic.files[0]) readPic_(pic.files[0]); };
  var man = $('manual');
  if (man) man.onclick = function (e) { e.preventDefault(); S.draft = blankDraft_(defaultChartDate_()); render_(); };
  if (!S.draft) return;
  Array.prototype.forEach.call(document.querySelectorAll('select[data-pl]'), function (el) {
    el.onchange = function () {
      syncFields_();
      var x = el.getAttribute('data-pl'), r = +el.value, d = S.draft;
      if (x === 'L') d.lagna = r;
      else {
        d.rasi = d.rasi.map(function (c) { return c.filter(function (y) { return y !== x; }); });
        if (r >= 0) d.rasi[r].push(x);
      }
      render_();
    };
  });
  $('f_date').onchange = function () {
    syncFields_();
    var g = scLunarGuess_(S.draft.date); S.draft.lunar = scLunarText_(g); render_();
  };
  $('save').onclick = saveDraft_;
  $('cancel').onclick = function () { S.draft = null; render_(); };
}

function syncFields_() {
  var d = S.draft; if (!d || !$('f_date')) return;
  d.date = $('f_date').value || d.date; d.center = $('f_center').value.trim();
  d.lunar = $('f_lunar').value.trim(); d.moved = $('f_moved').value;
  d.special = $('f_special').value.trim(); d.note = $('f_note').value.trim();
}

function saveDraft_() {
  syncFields_();
  var d = S.draft, b = $('save');
  b.disabled = true; b.textContent = 'กำลังบันทึก…';
  var chart = { date: d.date, rasi: d.rasi, lagna: d.lagna, center: d.center, lunar: d.lunar, moved: d.moved, special: d.special, note: d.note };
  apiPost_('starsave', { chart: chart }).then(function (r) {
    if (r && r.ok) {
      toast(r['ทับของเดิม'] ? 'แก้ดวงวันนี้แล้ว' : 'บันทึกดวงแล้ว');
      /* ใส่ในแคชทันที เปิดแท็บทำนายไม่ต้องรอโหลดใหม่ */
      if (S.data) { S.data.charts = charts_().filter(function (c) { return c.date !== chart.date; }).concat([chart]).sort(function (a, c) { return a.date < c.date ? -1 : 1; }); saveCache_(S.data); }
      S.draft = null; S.tab = 'predict'; render_(); refresh_();
    } else { b.disabled = false; b.textContent = 'บันทึกดวง'; toast((r && r.error) || 'บันทึกไม่สำเร็จ'); }
  });
}

/* ---------------- แท็บ: สถิติ ---------------- */
function viewStats_() {
  var kind = S.kind, K = SC_KIND[kind], res = results_(kind), h = [];
  var st = scStats_(kind, res, S.statN || 0);
  if (!st.total) return '<div class="card">ยังไม่มีผล' + esc(K.name) + 'ในชีต</div>';
  h.push('<div class="card"><h3>สถิติผลจริงแยกหลัก<span class="sub">' + esc(K.name) + ' ' + st.n + ' งวด (' + esc(thDate(st.from)) + ' – ' + esc(thDate(st.to)) + ')</span></h3>');
  h.push('<div class="seg" id="segN">' + [[10, '10 งวด'], [30, '30 งวด'], [100, '100 งวด'], [0, 'ทั้งหมด ' + st.total]].map(function (x) {
    return '<button data-n="' + x[0] + '" class="' + ((S.statN || 0) === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>');
  var max = 1; st.pos.forEach(function (p) { p.cnt.forEach(function (c) { if (c > max) max = c; }); });
  h.push('<div class="scroll"><table class="heat"><tr><th></th>' + st.pos.map(function (p) { return '<th>' + esc(p.name) + '</th>'; }).join('') + '</tr>');
  for (var d = 0; d < 10; d++) {
    h.push('<tr><td class="d">' + d + '</td>');
    st.pos.forEach(function (p) {
      var a = p.cnt[d] / max, hot = p.hot.indexOf(d) >= 0, cold = p.cold.indexOf(d) >= 0;
      var bg = 'rgba(230,192,99,' + (0.06 + a * 0.6).toFixed(2) + ')';
      h.push('<td style="background:' + bg + ';color:' + (a > 0.6 ? '#1a1406' : 'var(--ink)') + (cold ? ';outline:1px dashed rgba(111,183,255,.6)' : '') + '">' + p.cnt[d] +
             '<span class="g">' + (hot ? '🔥' : '') + 'ค้าง ' + p.gap[d] + '</span></td>');
    });
    h.push('</tr>');
  }
  h.push('</table></div><div class="muted" style="margin-top:6px">ตัวเลข = ออกกี่ครั้ง · ค้าง = ไม่ออกมากี่งวดแล้ว · 🔥 ร้อนสุด 3 ตัว · กรอบฟ้า = เย็นสุด</div></div>');

  h.push('<div class="card"><h3>คู่/คี่ และเบิ้ล</h3><table class="tbl"><tr><th>หลัก</th><th>คู่</th><th>คี่</th><th>ร้อน</th><th>เย็น</th></tr>' +
    st.pos.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td>' + Math.round(p.even / p.n * 100) + '%</td><td>' + Math.round((p.n - p.even) / p.n * 100) + '%</td><td>' + p.hot.join(' ') + '</td><td>' + p.cold.join(' ') + '</td></tr>'; }).join('') +
    '</table><div class="muted" style="margin-top:8px">' + st.sets.map(function (s) { return esc(s.name) + ' มีเลขซ้ำ ' + s.dbl + '/' + st.n + ' งวด'; }).join(' · ') + '</div></div>');

  /* วัดสูตรกับของจริง */
  var bt = scBacktest_(kind, charts_(), res);
  h.push('<div class="card"><h3>วัดสูตรกับของจริง<span class="sub">ดวงวันไหน ใช้น้ำหนักจากก่อนวันนั้นเท่านั้น</span></h3>');
  if (!bt.rows.length) {
    h.push('<div class="muted">ยังไม่มีดวงวันที่' + esc(K.name) + 'ออก — ' + (kind === 'thai' ? 'ส่งรูปดวงวันที่ 1 และ 16 ด้วย จะเริ่มวัดได้' : 'ส่งรูปวันออกแล้วลงผล จะเริ่มวัดได้') + '</div></div>');
    return h.join('');
  }
  h.push('<div class="kpi"><div><b>' + Math.round(bt.top1 / bt.n * 100) + '%</b><span>อันดับ 1 ตรงหลัก<br>(สุ่ม 10%)</span></div>' +
    '<div><b>' + Math.round(bt.top3 / bt.n * 100) + '%</b><span>ติด 3 อันดับ<br>(สุ่ม 30%)</span></div>' +
    '<div><b>' + bt.rows.filter(function (r) { return r.runHit; }).length + '/' + bt.rows.length + '</b><span>เลขวิ่ง 2 ตัว<br>เข้าในเลขผล</span></div></div>');
  h.push('<div class="scroll" style="margin-top:10px"><table class="tbl"><tr><th>วัน</th><th>ผล</th>' + K.pos.map(function (p) { return '<th>' + esc(p) + '</th>'; }).join('') + '<th>ชุด</th></tr>');
  bt.rows.slice().reverse().forEach(function (r) {
    h.push('<tr><td>' + esc(thDate(r.date)) + '</td><td><b>' + r.real + '</b></td>' +
      r.marks.map(function (m) { return '<td class="mk' + m.m + '">' + m.top.join('') + '</td>'; }).join('') +
      '<td>' + r.sets.filter(function (s) { return s.hit; }).map(function (s) { return esc(s.name); }).join('<br>') + '</td></tr>');
  });
  h.push('</table></div><div class="muted" style="margin-top:6px"><span class="mk1">เขียว</span> = อันดับ 1 ตรง · <span class="mk3">ส้ม</span> = ติด 3 อันดับ</div>');
  var w = scWeights_(kind, charts_(), res);
  h.push('<div class="scroll" style="margin-top:12px"><table class="tbl"><tr><th>วิธีค้น</th>' + K.pos.map(function (p) { return '<th>' + esc(p) + '</th>'; }).join('') + '</tr>' +
    SC_METHODS.map(function (m) {
      return '<tr><td>' + esc(m[1]) + '</td>' + w.w[m[0]].map(function (x) {
        var c = x.w >= 1.3 ? 'mk1' : (x.w <= 0.7 ? 'bad' : '');
        return '<td class="' + c + '">×' + x.w.toFixed(1) + '<br><span class="muted">' + x.top + '/' + x.k + '</span></td>';
      }).join('') + '</tr>';
    }).join('') + '</table></div><div class="muted" style="margin-top:6px">×น้ำหนักที่ใช้คิดงวดหน้า (1 = เท่าสุ่ม) · เขียว = แม่นกว่าสุ่ม · ตัวล่าง = เข้าอันดับ 1 กี่ครั้ง/กี่ดวง</div></div>');
  return h.join('');
}

/* ---------------- แท็บ: บันทึก ---------------- */
function viewLog_() {
  var kind = S.kind, K = SC_KIND[kind], res = results_(kind), h = [], charts = charts_().slice().reverse();
  h.push('<div class="card"><h3>บันทึกปฏิทิน 100 ปี<span class="sub">' + charts.length + ' วัน · ผล' + esc(K.name) + '</span></h3>');
  if (!charts.length) h.push('<div class="muted">ยังไม่มีดวง</div>');
  charts.forEach(function (c) {
    var r = res[c.date], isDraw = kind === 'lao' ? (scWd_(c.date) >= 1 && scWd_(c.date) <= 5) : (+c.date.slice(8) === 1 || +c.date.slice(8) === 16);
    var sum = c.rasi.map(function (cell, i) { return cell.length ? SC_RASI[i] + ' ' + cell.join('') : ''; }).filter(String).join(' · ');
    h.push('<div class="ent"><div><div class="dt">' + esc(thDate(c.date)) + '</div><div class="muted">' + esc(c.lunar) + (c.center ? ' · กลาง ' + esc(c.center) : '') + '</div>' +
      '<div class="muted" style="margin-top:3px">' + esc(sum) + '</div>' +
      '<div class="btns" style="margin-top:8px"><button class="btn ghost" data-edit="' + c.date + '">แก้ดวง</button><button class="btn ghost" data-del="' + c.date + '">ลบ</button></div></div>' +
      '<div style="min-width:110px">' + (r ? '<div class="res">' + r.join('').slice(0, 4) + (kind === 'thai' ? '<br><small>' + r.slice(4).join('') + '</small>' : '') + '</div>'
        : (isDraw ? '<div class="res none">ยังไม่มีผล</div><div class="inl"><input data-res="' + c.date + '" inputmode="numeric" placeholder="' + (kind === 'thai' ? '1234 56' : '1234') + '"><button data-save="' + c.date + '">ลง</button></div>'
                  : '<div class="res none">ไม่ใช่วันออก</div>')) + '</div></div>');
  });
  h.push('</div>');
  return h.join('');
}

function bindLog_() {
  Array.prototype.forEach.call(document.querySelectorAll('[data-edit]'), function (b) {
    b.onclick = function () {
      var c = charts_().filter(function (x) { return x.date === b.getAttribute('data-edit'); })[0];
      if (!c) return;
      S.draft = { date: c.date, rasi: c.rasi.map(function (x) { return x.slice(); }), lagna: c.lagna, center: c.center || '', lunar: c.lunar || '',
                  moved: c.moved || '', special: c.special || '', note: c.note || '', read: null };
      S.tab = 'upload'; render_();
    };
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-del]'), function (b) {
    b.onclick = function () {
      var iso = b.getAttribute('data-del');
      if (!confirm('ลบดวงวันที่ ' + thDate(iso) + ' ?')) return;
      apiPost_('stardel', { date: iso }).then(function (r) {
        if (r && r.ok) { S.data.charts = charts_().filter(function (c) { return c.date !== iso; }); saveCache_(S.data); render_(); toast('ลบแล้ว'); }
        else toast((r && r.error) || 'ลบไม่สำเร็จ');
      });
    };
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-save]'), function (b) {
    b.onclick = function () {
      var iso = b.getAttribute('data-save'), inp = document.querySelector('input[data-res="' + iso + '"]');
      var t = (inp.value || '').replace(/[^0-9 ]/g, ' ').trim().split(/\s+/);
      var body = S.kind === 'thai' ? { kind: 'thai', date: iso, a: t[0] || '', b: t[1] || '' } : { kind: 'lao', date: iso, a: t.join('') };
      b.disabled = true;
      apiPost_('starresult', body).then(function (r) {
        b.disabled = false;
        if (r && r.ok) { toast('ลงผลแล้ว'); refresh_(); } else toast((r && (r['ข้อความ'] || r.error)) || 'ลงผลไม่สำเร็จ');
      });
    };
  });
}

/* ---------------- โครงหลัก ---------------- */
function render_() {
  var v = S.tab === 'upload' ? viewUpload_() : S.tab === 'stats' ? viewStats_() : S.tab === 'log' ? viewLog_() : viewPredict_();
  if (!S.data && S.tab !== 'upload') v = '<div class="card hero"><div class="d">กำลังโหลด…</div><div class="muted">ครั้งแรกต้องต่อเน็ต</div></div>';
  $('app').innerHTML = v;
  Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) { a.className = a.getAttribute('data-t') === S.tab ? 'on' : ''; });
  Array.prototype.forEach.call(document.querySelectorAll('#kind button'), function (b) { b.className = b.getAttribute('data-k') === S.kind ? 'on' : ''; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-pos]'), function (el) {
    el.onclick = function () { var i = +el.getAttribute('data-pos'); S.sel = S.sel === i ? -1 : i; render_(); };
  });
  var seg = $('segN');
  if (seg) Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
    b.onclick = function () { S.statN = +b.getAttribute('data-n'); saveUi_(); render_(); };
  });
  if (S.tab === 'upload') bindUpload_();
  if (S.tab === 'log') bindLog_();
}

function boot_() {
  loadUi_();
  S.data = loadCache_();
  S.src = S.data ? 'แคช' : '';
  Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) {
    a.onclick = function () { S.tab = a.getAttribute('data-t'); S.sel = -1; render_(); window.scrollTo(0, 0); };
  });
  Array.prototype.forEach.call(document.querySelectorAll('#kind button'), function (b) {
    b.onclick = function () { S.kind = b.getAttribute('data-k'); S.sel = -1; saveUi_(); render_(); };
  });
  /* #upload / #stats / #log = เปิดตรงแท็บนั้น (ทำปุ่มลัดบนหน้าโฮมได้) */
  var hs = (typeof location !== 'undefined' && location.hash || '').slice(1);
  if (['predict', 'upload', 'stats', 'log'].indexOf(hs) >= 0) S.tab = hs;
  note_(); render_(); refresh_();
}

if (typeof document !== 'undefined') boot_();
