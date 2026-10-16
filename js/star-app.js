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

/* กุญแจแกะดาวเก็บถังของตัวเอง 'star.key.v1' — ห้ามเขียนทับ 'pickup.key.v1' (กุญแจหน้า Pickup คนละใบ)
   ไม่มีของตัวเอง = ยืมของ Pickup ได้ (กุญแจหลักเปิดแกะดาวได้ด้วย) */
var STAR_KEY_STORE = 'star.key.v1';
/* กุญแจจากลิงก์อ่าน "ครั้งเดียวตอนเปิดแอป" แล้วเก็บ — ห้ามอ่านซ้ำทุกครั้ง
   บั๊กจริง 16 ต.ค. 69: ลิงก์ที่มีกุญแจผิดค้างอยู่ ทับกุญแจที่เจ้าของพิมพ์ใหม่ทุกรอบ → ปลดล็อกไม่ได้ตลอด */
var ST_MEM_KEY = '';
function starKeyBoot_() {
  var u = keyFromUrl_();
  if (u) setStarKey_(u);
}
function starKey_() {
  if (ST_MEM_KEY) return ST_MEM_KEY;
  try { return localStorage.getItem(STAR_KEY_STORE) || loadKey_() || ''; } catch (e) { return ''; }
}
function setStarKey_(k) {
  ST_MEM_KEY = k;   /* เครื่องที่ไม่ให้เขียน localStorage ก็ยังใช้ได้ในรอบนี้ */
  try { localStorage.setItem(STAR_KEY_STORE, k); } catch (e) { /* เหมือนกัน */ }
}

function fetchStar_() {
  var k = starKey_();
  if (!k) return Promise.resolve({ ok: false, needKey: true });
  return fetch(API_URL + '?p=star&k=' + encodeURIComponent(k)).then(function (r) { return r.json(); })
    .catch(function () { return null; });
}

function starPost_(p, body) {
  var k = starKey_();
  if (!k) return Promise.resolve({ ok: false, needKey: true, error: 'ยังไม่มีกุญแจในเครื่องนี้' });
  var payload = { p: p, k: k };
  for (var f in body) if (Object.prototype.hasOwnProperty.call(body, f)) payload[f] = body[f];
  return fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(function (r) { return r.json(); })
    .catch(function () { return { ok: false, error: 'ส่งไม่ถึง — เน็ตหลุดหรือเปล่า ลองอีกครั้ง' }; });
}

function refresh_() {
  return fetchStar_().then(function (d) {
    if (S.tab === 'upload' && S.draft) syncFields_();   /* ข้อมูลมาตอนกำลังแก้ดวง = เก็บค่าที่พิมพ์ก่อนวาดใหม่ */
    if (d && d.ok) { S.data = d; S.src = 'สด'; saveCache_(d); }
    else if (d && d.needKey) S.src = 'กุญแจ';
    else S.src = S.data ? 'แคช' : 'ไม่มีเน็ต';
    note_(); render_();
  });
}

function note_() {
  var t = S.src === 'สด' ? '<span class="pill live">สด</span> อัปเดต ' + esc((S.data.at || '').slice(11, 16)) + ' น.' + (ro_() ? ' · <span class="pill off">ดูอย่างเดียว</span>' : '') :
          S.src === 'กุญแจ' ? '<span class="pill off">ล็อกอยู่</span> ใส่กุญแจก่อน แล้วข้อมูลจะมาเอง' :
          S.src === 'แคช' ? '<span class="pill off">ไม่มีเน็ต</span> โชว์ของที่จำไว้ ต่อเน็ตแล้วจะอัปเดตเอง' :
          '<span class="pill off">…</span> กำลังดูดวงดาว';
  $('note').innerHTML = t;
}

/** แผ่นใส่กุญแจในหน้า — แอปหน้าโฮมของไอโฟนเก็บของคนละถังกับ Safari ต้องมีทางใส่กุญแจในตัว */
function keySheet_() {
  return '<div class="card keycard"><h3>ใส่กุญแจแกะดาว</h3>' +
    '<div class="muted" style="margin-bottom:10px">ใส่ครั้งเดียว เครื่องนี้จะจำไว้เอง</div>' +
    '<input id="keyin" class="keyin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="วางกุญแจตรงนี้">' +
    '<button class="btn" id="keygo">ปลดล็อก</button></div>';
}

/** ลิงก์ดูอย่างเดียว (ของแม่) — หลังบ้านบอกมาเองใน payload ห้ามเดาจากหน้าเว็บ */
function ro_() { return !!(S.data && S.data.readOnly); }

/* เวลาหวยออกจริง (เจ้าของบอก 16 ต.ค. 69): ลาว 20:25 · ไทย 2 ตัวล่าง 15:30 · รางวัลที่ 1 15:45
   ไทยใช้ 15:45 เพราะ 4 ใน 6 หลักที่คำนวณ (4 ตัวบน) มาจากรางวัลที่ 1 */
var ST_TIME = { lao: '20:25', thai: '15:45' };
/** เวลาของรูปปฏิทิน — ดวงที่ไม่มีเวลา ใช้เวลามาตรฐานตามชนิด */
function chartTime_(c) { return (c && c.time) || (c && c.kind === 'thai' ? ST_TIME.thai : ST_TIME.lao); }

/* ช่องวันที่แบบไทย (พ.ศ.) — ปฏิทินของไอโฟนโชว์ ค.ศ. และล้นกรอบ เจ้าของสั่งเอาภาษาไทยล้วน */
function dateSelect_(id, list, sel) {
  if (list.indexOf(sel) < 0) list = [sel].concat(list);
  return '<select id="' + id + '">' + list.map(function (d) {
    return '<option value="' + d + '"' + (d === sel ? ' selected' : '') + '>' + esc(thDate(d)) + '</option>';
  }).join('') + '</select>';
}
/** งวดของหวยชนิดนี้ เริ่มจากวันนี้ (ล่าสุดก่อน) — วันออกวันนี้ต้องอยู่ในรายการเสมอ
    แม้ยังไม่ถึงเวลาตัด เจ้าของกรอกผลทันทีที่ประกาศ (scLastDraw_ ใช้แค่ตั้งค่าเริ่มต้น) */
function drawDateList_(kind) {
  var out = [], d = todayIso();
  for (var i = 0; i < 400 && out.length < (kind === 'lao' ? 60 : 36); i++) {
    var x = scAddDays_(d, -i);
    if (scIsDraw_(kind, x)) out.push(x);
  }
  return out;
}
/** วันของดวง: ล่วงหน้า 7 วัน ถึงย้อนหลัง 60 วัน */
function chartDateList_(sel) {
  var out = [], t = todayIso();
  for (var i = -7; i <= 60; i++) out.push(scAddDays_(t, -i));
  return out;
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
    /* เรียงตามแนวโค้งของวง (ตั้งฉากกับรัศมี) — ช่องมุมมีดาว 4 ดวงจะไม่ล้นไปทับช่องข้าง
       เมษ/ตุลย์ แคบซ้ายขวา จึงเรียงแนวตั้งแทน */
    var vert = (i === 0 || i === 6), n = list.length, p = CH_POS[i];
    var grid = !vert && n >= 3, fs = n >= 4 ? 14 : 16;
    list.forEach(function (d, k) {
      var x, y;
      if (grid) {                                   /* 3-4 ดวงในช่องเดียว = ตาราง 2 คอลัมน์ ไม่ล้นช่อง */
        var rows = Math.ceil(n / 2), row = Math.floor(k / 2), inRow = Math.min(2, n - row * 2);
        x = p[0] + ((k % 2) - (inRow - 1) / 2) * 14;
        y = p[1] + (row - (rows - 1) / 2) * 16 + 6;
      } else {
        /* เมษ/ตุลย์ เรียงตั้ง: 3 ดวงขึ้นไปดันเข้าหาจุดกลาง ไม่งั้นตัวท้ายล้นขอบวง (เจอจริง ตุลย์ ๙๖๔) */
        var gapV = n >= 3 ? 15 : 17, cy0 = vert ? p[1] - Math.sign(p[1]) * (n - 1) * 7 : p[1];
        var off = (k - (n - 1) / 2) * (vert ? gapV : 15);
        x = p[0] + (vert ? 0 : off); y = cy0 + (vert ? off : 0) + 6;
      }
      var col = d === 'ล' ? '#e6c063' : (d === opt.day ? '#6fb7ff' : '#eef0f6');
      if (d === opt.day) o.push('<circle cx="' + x + '" cy="' + (y - 6) + '" r="9" fill="none" stroke="#6fb7ff" stroke-width="1"/>');
      o.push('<text x="' + x + '" y="' + y + '" fill="' + col + '" font-size="' + fs + '" font-weight="700" text-anchor="middle">' + (d === 'ล' ? 'ล' : thNum(d)) + '</text>');
    });
  });
  var cm = /^(\d+)\/(\d+)$/.exec(String(c.center || ''));
  if (cm) o.push('<text x="-4" y="-2" fill="#eef0f6" font-size="12" text-anchor="middle">' + cm[1] + '</text><text x="8" y="14" fill="#eef0f6" font-size="12" text-anchor="middle">' + cm[2] + '</text><line x1="-6" y1="10" x2="8" y2="-6" stroke="#eef0f6" stroke-width=".8"/>');
  o.push('</svg>');
  return o.join('');
}

/** วิธีดูทุกส่วน — การ์ดพับได้บนสุดของหน้าทำนาย (เจ้าของขอ 16 ต.ค. 69 ให้แม่อ่านเองได้) */
function helpCard_(kind) {
  var lao = kind === 'lao';
  var pos = lao
    ? '<div>• <b>พัน ร้อย สิบ หน่วย</b> = 4 ตัวของหวยลาว เรียงซ้ายไปขวา เช่น ผล 6261 → พัน 6 · ร้อย 2 · สิบ 6 · หน่วย 1</div>' +
      '<div>• <span class="up">บน</span> = 3 ตัวบน (ร้อย-สิบ-หน่วย) และ 2 ตัวบน (สิบ-หน่วย) · <span class="lo">ล่าง</span> = 3 ตัวล่าง (พัน-ร้อย-สิบ) และ 2 ตัวล่าง (พัน-ร้อย)</div>' +
      '<div>• ป้าย <b>บน·ล่าง</b> = หลักนั้นใช้ทั้งชุดบนและชุดล่าง (ร้อย กับ สิบ)</div>'
    : '<div>• <b>พัน ร้อย สิบ หน่วย</b> = 4 ตัวท้ายของรางวัลที่ 1 (4 ตัวบน) เช่น 402701 → 2 7 0 1</div>' +
      '<div>• <b>ล่างสิบ ล่างหน่วย</b> = 2 ตัวล่าง (ช่องกรอบประ)</div>' +
      '<div>• 3 ตัวบน = ร้อย-สิบ-หน่วย · ไม่คำนวณหน้า 3 / ท้าย 3 (โชว์ไว้ดูในแท็บผลย้อนหลังเท่านั้น)</div>';
  return '<details class="card fold help"><summary><h3>วิธีดูทุกส่วน<span class="sub">แตะเพื่อเปิด</span></h3></summary><div class="howto">' +
    '<b>1. หัวงวด</b>' +
    '<div>• วันที่ = งวดถัดไปที่จะออก · ดาวประจำวัน = ดาวของวันที่หวยออก (ลาววันพุธใช้ราหู 8 เพราะออกกลางคืน)</div>' +
    '<div>• ถ้ามีแถบส้ม "ใช้ดวงวันที่…" = ยังไม่ได้ส่งรูปดวงของวันออก แอปใช้ดวงล่าสุดแทน</div>' +

    '<b>2. เลขแยกหลัก (ช่องสี่เหลี่ยม)</b>' + pos +
    '<div>• <b>ตัวใหญ่สีทอง</b> = เลขที่คะแนนสูงสุดของหลักนั้น (อันดับ 1)</div>' +
    '<div>• <b>2 ตัวเล็กใต้</b> = อันดับ 2 และ 3</div>' +
    '<div>• <span class="bad"><b>ดับ</b></span> = 2 เลขที่คะแนนต่ำสุดของหลักนั้น ตัดทิ้งได้</div>' +
    '<div>• <b>แตะช่อง</b> = ดูเหตุผล: เลขนี้ได้คะแนนบวกจากวิธีไหน (+) และโดนหักเพราะอะไร (−)</div>' +

    '<b>3. เลขชุด</b>' +
    '<div>• เอาอันดับต้นๆ ของแต่ละหลักมาประกอบกัน เรียงจากคะแนนรวมมากไปน้อย · กรอบทอง/ฟ้าตัวแรก = ชุดที่คะแนนสูงสุด</div>' +
    '<div>• กล่อง<span class="up">ทอง = บน</span> · กล่อง<span class="lo">ฟ้า = ล่าง</span> · เลขซ้ำ (เบิ้ล) ถูกลดคะแนน เว้นแต่วันที่ดวงชี้ว่าเบิ้ลแรง</div>' +
    '<div>• <b>เลขวิ่ง</b> = 2 เลขที่รวมคะแนนทุกหลักแล้วสูงสุด (มีโอกาสโผล่ตำแหน่งไหนก็ได้)</div>' +

    '<b>4. เลขเสีย / เลขดับ</b>' +
    '<div>• <b>กาลกิณีวัน</b> = เลขดาวที่ให้โทษวันนั้น ดับแรงที่หลักสิบ-หน่วย หลักร้อย-พันยังโผล่ได้</div>' +
    '<div>• <b>คู่ศัตรู</b> 1-5 · 2-5 · 3-6 · 4-8 อยู่ราศีเดียวกัน = หักทั้งคู่ · <b>ชง</b> = นักษัตรที่ชนกับวันนั้น</div>' +

    '<b>5. แนวโน้มงวดนี้</b>' +
    '<div>• คู่/คี่ ตามวัน · โอกาสเบิ้ล (ต่ำ/กลาง/สูง) พร้อมเหตุผล · เลขหาม = ดาวที่เล็งกันอยู่หัว-ท้าย ดาวประจำวันอยู่กลาง</div>' +

    '<b>6. แยกวิธีค้น</b>' +
    '<div>• 10 วิธีจากสูตรแกะดาว แต่ละวิธีให้เลขอะไร เพราะอะไร</div>' +
    '<div>• <b>×น้ำหนัก</b> = วิธีนี้แม่นแค่ไหนในหลักนั้น วัดจากดวงที่ผ่านมาเทียบผลจริง (×1 = เท่าสุ่ม · มากกว่า 1 = แม่นกว่าสุ่ม) · ยิ่งส่งดวงมาก ตัวเลขยิ่งเชื่อได้</div>' +

    '<b>7. ดาวที่ใช้</b>' +
    '<div>• วงดวงเหมือนแอปปฏิทินโหร: เลขไทย ๑-๙ ๐ = ดาว · <span class="up">ล</span> = ลัคนา · กลางวง = เลขกลางดวง · วงฟ้า = ดาวประจำวัน · เวลา = เวลาที่แคปรูป</div>' +

    '<b>8. แท็บสถิติ</b>' +
    '<div>• ตัวเลขใหญ่ = ออกกี่ครั้งในหลักนั้น · ค้าง = ไม่ออกมากี่งวด · <span class="good">กรอบทอง = เด่น</span> · <span class="bad">กรอบแดง = ดับ</span></div>' +
    '<div>• วัดสูตรกับของจริง: <span class="mk1">เขียว</span> = อันดับ 1 ตรง · <span class="mk3">ส้ม</span> = ติด 3 อันดับ · <span class="mk0">แดง</span> = หลุด · เทียบกับสุ่ม 10% / 30%</div>' +

    '<b>9. แท็บผล</b>' +
    '<div>• ผลย้อนหลังทุกงวด (พับ/เลื่อนได้) · <b>ทายย้อนหลังพร้อมเหตุผล</b> = แตะงวดไหนก็ได้ ดูว่าตอนนั้นทายอะไร เพราะอะไร ออกจริงอะไร</div>' +

    '<div class="muted" style="margin-top:6px">ทุกอย่างคำนวณจากดวง + ผลจริงในชีตเดียวกัน · ใช้ประกอบการตัดสินใจ ไม่ใช่การันตี</div>' +
    '</div></details>';
}

/* ---------------- แท็บ: ทำนาย ---------------- */
function viewPredict_() {
  var kind = S.kind, K = SC_KIND[kind], iso = scNextDraw_(kind), charts = charts_();
  var chart = scPickChart_(charts, iso, kind);
  if (!chart) return '<div class="card hero"><div class="d">ยังไม่มีดวงให้คำนวณ</div><div class="muted">แคปหน้าปฏิทินโหรของวันนี้ แล้วส่งที่แท็บ "ส่งดวง"</div></div>';
  var res = results_(kind), w = scWeights_(kind, charts, res, iso);
  var pr = scPredict_(kind, chart, iso, res, w);
  var h = [helpCard_(kind)];
  h.push('<div class="card hero"><div class="k">' + esc(K.name) + ' · งวดถัดไป</div><div class="d">' + esc(thDate(iso)) + '</div>' +
         '<div class="meta">ดาวประจำวัน ' + esc(SC_PL[pr.dayStar]) + ' (' + pr.dayStar + ') · ' + esc(scLunarText_(pr.lunar)) + '</div>' +
         (chart.date !== iso ? '<div class="warn" style="margin-top:6px">ใช้ดวงวันที่ ' + esc(thDate(chart.date)) + ' — ยังไม่ได้ส่งดวงวันออก</div>' :
          (chart.kind && chart.kind !== kind ? '<div class="warn" style="margin-top:6px">ใช้ดวงของหวย' + (chart.kind === 'lao' ? 'ลาว' : 'ไทย') + 'วันนี้ไปก่อน — ยังไม่ได้ส่งดวงเวลาออกของ' + esc(K.name) + '</div>' : '')) +
         '</div>');

  /* ช่องเลขแยกหลัก */
  h.push('<div class="card"><h3>เลขแยกหลัก<span class="sub">แตะช่องเพื่อดูเหตุผล</span></h3>');
  h.push('<div class="slots ' + (pr.pos.length > 4 ? 'n6' : 'n4') + '">');
  pr.pos.forEach(function (p, i) {
    if (i === 4) h.push('<div class="lowtag">2 ตัวล่าง →</div>');
    h.push('<div class="slot' + (S.sel === i ? ' sel' : '') + (i >= 4 ? ' low' : '') + '" data-pos="' + i + '"><div class="nm">' + esc(p.name) + '</div><div class="tg tg-' + (K.tag[i] === 'ล่าง' ? 'lo' : (K.tag[i] === 'บน' ? 'up' : 'both')) + '">' + esc(K.tag[i]) + '</div>' +
           '<div class="big">' + p.top[0].d + '</div><div class="alt">' + p.top[1].d + p.top[2].d + '</div>' +
           '<div class="cl">ดับ ' + p.closed.join(' ') + '</div></div>');
  });
  h.push('</div>');
  h.push('<div class="muted" style="margin-top:8px">ตัวใหญ่ = เลขเด่นอันดับ 1 ของหลักนั้น · 2 ตัวรอง = อันดับ 2-3 · <span class="bad">ดับ</span> = 2 ตัวที่สูตรให้คะแนนต่ำสุดในหลักนั้น (ตัดทิ้งได้)</div>');
  if (S.sel >= 0 && pr.pos[S.sel]) h.push(whyBox_(pr.pos[S.sel]));
  h.push('</div>');

  /* เลขชุด */
  var deadSet = {}; pr.dead.forEach(function (x) { if (x.kal) deadSet[x.d] = 1; });
  h.push('<div class="card"><h3>เลขชุด<span class="sub">คิดจาก 4 ตัว' + (kind === 'thai' ? ' + 2 ตัวล่าง' : '') + '</span></h3>');
  var chipRow = function (st, cls) {
    var lbl = st.name;
    if (kind === 'lao' && st.name === '2 ตัวล่าง') lbl += ' · หลักพัน-ร้อย';
    if (st.name === '3 ตัวบน') lbl += ' · หลักร้อย-สิบ-หน่วย';
    if (kind === 'lao' && st.name === '3 ตัวล่าง') lbl += ' · หลักพัน-ร้อย-สิบ';
    if (kind === 'lao' && st.name === '2 ตัวบน') lbl += ' · หลักสิบ-หน่วย';
    return '<div class="set"><div class="lbl">' + esc(lbl) + '</div><div class="chips">' +
      st.list.map(function (n, k) { return '<span class="chip ' + cls + (k === 0 ? ' first' : '') + '">' + n + '</span>'; }).join('') + '</div></div>';
  };
  /* ลาว "4 ตัว" ไม่ใช่ทั้งบนและล่าง — แยกไว้บรรทัดของตัวเอง ไม่ยัดลงกล่องบน */
  var full = pr.sets.filter(function (st) { return st.name === '4 ตัว'; });
  var up = pr.sets.filter(function (st) { return st.name !== '4 ตัว' && st.name.indexOf('ล่าง') < 0; });
  var lo = pr.sets.filter(function (st) { return st.name.indexOf('ล่าง') >= 0; });
  if (full.length) h.push(full.map(function (st) { return chipRow(st, ''); }).join(''));
  h.push('<div class="grp up"><div class="gt">บน</div>' + up.map(function (st) { return chipRow(st, ''); }).join('') + '</div>');
  h.push('<div class="grp lo"><div class="gt">ล่าง</div>' + lo.map(function (st) { return chipRow(st, ''); }).join('') + '</div>');
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

  h.push('<div class="card"><h3>ดาวที่ใช้<span class="sub">' + esc(thDate(chart.date)) + ' · ' + esc(chartTime_(chart)) + ' น. · วงฟ้า = ดาวประจำวัน</span></h3><div class="chartbox">' + chartSvg_(chart, { day: pr.dayStar }) + '</div>' +
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
  return { date: iso, kind: S.kind, time: ST_TIME[S.kind], rasi: r, lagna: -1, center: '', lunar: scLunarText_(lu), moved: '', special: '', note: '', read: null, ask: [] };
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
  var asks = (d.ask || []), open = asks.filter(function (q) { return !q.done; }).length;
  if (asks.length) {
    h.push('<div class="card ask"><h3>ช่วยยืนยันตัวเลข<span class="sub">' + (open ? 'เหลือ ' + open + ' ตัว — ตอบครบถึงบันทึกได้' : 'ตอบครบแล้ว') + '</span></h3>');
    asks.forEach(function (q, i) {
      h.push('<div class="q' + (q.done ? ' done' : '') + '"><img src="' + q.img + '" alt=""><div class="qt"><b>ราศี' + esc(SC_RASI[q.r]) + '</b> · แอปเดา ' +
        esc(q.guess) + ' <span class="muted">(' + esc(q.why) + ')</span></div><div class="keys">' +
        '0123456789'.split('').map(function (x) {
          var cls = (q.done && q.cur === x) ? 'on' : (q.alt.indexOf(x) >= 0 ? 'hint' : '');
          return '<button data-ask="' + i + '" data-v="' + x + '" class="' + cls + '">' + thNum(x) + '<small>' + x + '</small></button>';
        }).join('') + '</div></div>');
    });
    h.push('</div>');
  }
  h.push('<div class="card"><h3>ตรวจดวงก่อนบันทึก<span class="sub">แก้ราศีของดาวได้ทุกดวง</span></h3>' +
    '<div class="chartbox">' + chartSvg_(d, {}) + '</div>');
  if (d.read && d.read.unsure && !asks.length) h.push('<div class="warn">มี ' + d.read.unsure + ' ตัวที่อ่านไม่ชัด — เทียบกับรูปจริงอีกที</div>');
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
    '<label class="fld">วันที่ของดวง' + dateSelect_('f_date', chartDateList_(d.date), d.date) + '</label>' +
    '<label class="fld">ดวงนี้ใช้กับ<select id="f_kind"><option value="lao"' + (d.kind === 'lao' ? ' selected' : '') + '>หวยลาว (แคปเวลา 20:25)</option>' +
      '<option value="thai"' + (d.kind === 'thai' ? ' selected' : '') + '>หวยไทย (แคปเวลา 15:45)</option></select></label>' +
    '<label class="fld">เวลาในรูปปฏิทิน<input type="time" id="f_time" value="' + esc(d.time || '') + '"></label>' +
    '<label class="fld">เลขกลางดวง (เช่น 27/24)<input id="f_center" inputmode="numeric" value="' + esc(d.center) + '"></label>' +
    '<label class="fld">จันทรคติ<input id="f_lunar" value="' + esc(d.lunar) + '"></label>' +
    '<label class="fld">ดาวย้ายวันนี้<select id="f_moved"><option value="">ไม่มีดาวย้าย</option>' +
      PL_ORDER.map(function (x) { var v = SC_PL[x] + ' ย้าย'; return '<option' + (d.moved.indexOf(SC_PL[x]) === 0 ? ' selected' : '') + ' value="' + esc(v) + '">' + esc(SC_PL[x]) + ' ย้าย</option>'; }).join('') + '</select></label>' +
    '</div>' +
    '<label class="fld" style="margin-top:8px">สถานะในแอป (เช่น ดาวเกษตร มี)<input id="f_special" value="' + esc(d.special) + '"></label>' +
    '<label class="fld" style="margin-top:8px">หมายเหตุ<input id="f_note" value="' + esc(d.note) + '"></label>' +
    '<button class="btn" id="save"' + (missing.length || open ? ' disabled' : '') + '>' + (open ? 'ตอบตัวเลขด้านบนให้ครบก่อน' : 'เก็บดวงนี้') + '</button>' +
    '<button class="btn ghost" id="cancel">ยกเลิก</button></div>');
  return h.join('');
}

function scLocOf_(d) {
  var loc = {};
  d.rasi.forEach(function (cell, i) { cell.forEach(function (x) { loc[x] = i; }); });
  return loc;
}

/** วาดรูปลงผืนผ้าใบตามขนาดที่สั่ง แล้วนับความสว่าง (ไว้รู้ว่าวาดติดจริงไหม) */
function drawAt_(src, w, h, sc) {
  var cv = document.createElement('canvas');
  cv.width = Math.round(w * sc); cv.height = Math.round(h * sc);
  var cx = cv.getContext('2d');
  cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height);   /* PNG โปร่งใส = พื้นดำเหมือนแอปต้นทาง */
  cx.drawImage(src, 0, 0, cv.width, cv.height);
  var img = cx.getImageData(0, 0, cv.width, cv.height), d = img.data, lit = 0;
  for (var i = 0; i < d.length; i += 64) if (d[i] + d[i + 1] + d[i + 2] > 300) lit++;
  return { cv: cv, img: img, lit: lit / (d.length / 64) };
}

/** อ่านรูปหลายทางจนกว่าจะเจอตาราง — ไอโฟนเคยขึ้น "หาตารางไม่เจอ" กับรูปที่ Chrome อ่านผ่าน (16 ต.ค. 69)
    ทางที่ลอง: ปรับกว้าง 870 (ทางหลัก ตรงกับแม่แบบ) → ขนาดเดิม → ถอดรูปด้วย createImageBitmap
    พลาดทุกทาง = คายตัวเลขวินิจฉัยให้เจ้าของแคปส่งมา ไม่ต้องเดาอีก */
function readTries_(srcs) {
  var diag = [], best = null;
  for (var a = 0; a < srcs.length; a++) {
    var s = srcs[a], scales = [870 / s.w, 1];
    for (var b = 0; b < scales.length; b++) {
      var dr, r;
      try { dr = drawAt_(s.el, s.w, s.h, scales[b]); }
      catch (e) { diag.push(s.name + '×' + scales[b].toFixed(2) + ' วาดไม่ได้: ' + e.message); continue; }
      try { r = starRead(dr.img, STAR_TPL); }
      catch (e) { r = { ok: false, error: 'อ่านพัง: ' + e.message }; }
      var lx = srLines_(dr.img, 'x'), ly = srLines_(dr.img, 'y');
      diag.push(s.name + ' ' + s.w + '×' + s.h + '→' + dr.cv.width + ' สว่าง ' + (dr.lit * 100).toFixed(1) + '% เส้นตั้ง ' +
                lx.lines.map(Math.round).join('/') + ' ยาว ' + lx.len + ' เส้นนอน ' + ly.lines.map(Math.round).join('/') + ' ยาว ' + ly.len);
      if (r.ok) { r.cv = dr.cv; return { r: r, diag: diag }; }
      best = r;
    }
  }
  return { r: best || { ok: false, error: 'เปิดรูปไม่ได้' }, diag: diag };
}

/** สัญญาที่ต้องจบภายใน ms — ค้าง/พัง = คืน null (ห้ามทำให้การอ่านรูปค้างทั้งหน้า) */
function withTimeout_(p, ms) {
  return new Promise(function (ok) {
    var done = false, t = setTimeout(function () { if (!done) { done = true; ok(null); } }, ms);
    Promise.resolve(p).then(function (v) { if (!done) { done = true; clearTimeout(t); ok(v); } },
                            function () { if (!done) { done = true; clearTimeout(t); ok(null); } });
  });
}

function readPic_(file) {
  var msg = $('readmsg');
  msg.textContent = 'กำลังแกะดาวจากรูป…';
  var url = URL.createObjectURL(file), im = new Image();
  im.onload = function () {
    /* Safari บางทีวาดรูปก่อนถอดรูปเสร็จ = ได้ผืนดำ → รอ decode() ให้จบก่อนเสมอ */
    /* ทั้ง decode() และ createImageBitmap ค้างเงียบได้ในบางเบราว์เซอร์ (เจอใน Chrome headless) → จับเวลา 2 วิ ค้างก็ไปต่อ */
    var ready = withTimeout_(im.decode ? im.decode() : Promise.resolve(), 2000);
    var bmp = ready.then(function () {
      return (typeof createImageBitmap === 'function') ? withTimeout_(createImageBitmap(file), 2000) : null;
    });
    bmp.then(function (bm) {
      var srcs = [{ name: 'img', el: im, w: im.naturalWidth, h: im.naturalHeight }];
      if (bm) srcs.push({ name: 'bmp', el: bm, w: bm.width, h: bm.height });
      var out = readTries_(srcs);
      URL.revokeObjectURL(url);
      gotRead_(out.r, out.diag);
    });
  };
  im.onerror = function () { msg.textContent = 'เปิดรูปนี้ไม่ได้ ลองแคปใหม่อีกที'; };
  im.src = url;
}

function gotRead_(r, diag) {
  var iso = (S.draft && S.draft.date) || defaultChartDate_();
  var d = blankDraft_(iso), cv = r.cv;
  /* อ่านรูปใหม่ระหว่างแก้ฟอร์ม = เก็บชนิด/เวลาที่เลือกไว้ ไม่รีเซ็ต */
  if (S.draft) { d.kind = S.draft.kind || d.kind; d.time = S.draft.time || d.time; }
  if (r.ok) {
    d.rasi = r.rasi; d.lagna = r.lagna;
    if (r.center.a && r.center.b) d.center = r.center.a + '/' + r.center.b;
    d.read = { unsure: r.unsure };
    /* ตัวที่ตัวอ่านไม่ชัวร์ → ตัดรูปตัวนั้นมาถามเจ้าของ ต้องตอบครบก่อนบันทึก */
    d.ask = (r.ask || []).map(function (q) {
      var pad = 8, w = q.x1 - q.x0 + 1 + pad * 2, h = q.y1 - q.y0 + 1 + pad * 2, z = 3;
      var c2 = document.createElement('canvas'); c2.width = w * z; c2.height = h * z;
      var x2 = c2.getContext('2d'); x2.imageSmoothingEnabled = false;
      x2.drawImage(cv, q.x0 - pad, q.y0 - pad, w, h, 0, 0, w * z, h * z);
      return { r: q.r, cur: q.ch, guess: q.ch, alt: q.alt, why: q.why, img: c2.toDataURL('image/png'), done: false };
    });
    var n = 0; r.rasi.forEach(function (c) { n += c.length; });
    toast(d.ask.length ? 'แกะได้ ' + n + '/10 ดวง มี ' + d.ask.length + ' ตัวต้องให้ช่วยดู' : 'แกะครบ ' + n + '/10 ดวง' + (r.lagna >= 0 ? ' + ลัคนา' : '') + ' ตรวจแล้วกดเก็บได้เลย');
    S.draft = d; render_();
    return;
  }
  /* อ่านไม่ได้: ไม่เปิดตารางเปล่าให้งง — บอกตรงๆ + ตัวเลขวินิจฉัย + ทางไปต่อ */
  toast('แกะดาวจากรูปนี้ไม่ได้');
  S.draft = null; render_();
  $('readmsg').innerHTML = '<div class="warn">' + esc(r.error) + '</div>' +
    '<div class="diag">แคปข้อความนี้ส่งมาได้เลย:<br>' + diag.map(esc).join('<br>') + '</div>' +
    '<a href="#" id="manual2" class="btn ghost" style="line-height:44px;text-decoration:none;text-align:center">กรอกดวงเองไม่ใช้รูป</a>';
  $('manual2').onclick = function (e) { e.preventDefault(); S.draft = blankDraft_(iso); render_(); };
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
  Array.prototype.forEach.call(document.querySelectorAll('[data-ask]'), function (el) {
    el.onclick = function () {
      syncFields_();
      var q = S.draft.ask[+el.getAttribute('data-ask')], v = el.getAttribute('data-v'), cell = S.draft.rasi[q.r];
      var at = cell.indexOf(q.cur);
      if (at >= 0) cell[at] = v; else cell.push(v);
      q.cur = v; q.done = true;
      render_();
    };
  });
  $('f_kind').onchange = function () {
    var old = S.draft.kind; syncFields_();
    if (!S.draft.time || S.draft.time === ST_TIME[old]) S.draft.time = ST_TIME[S.draft.kind];
    render_();
  };
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
  d.special = $('f_special').value.trim(); d.note = $('f_note').value.trim(); d.kind = $('f_kind').value; d.time = $('f_time').value || ST_TIME[d.kind];
}

function saveDraft_() {
  syncFields_();
  var d = S.draft, b = $('save');
  b.disabled = true; b.textContent = 'กำลังเก็บ…';
  var chart = { date: d.date, kind: d.kind, time: d.time, rasi: d.rasi, lagna: d.lagna, center: d.center, lunar: d.lunar, moved: d.moved, special: d.special, note: d.note };
  starPost_('starsave', { chart: chart }).then(function (r) {
    if (r && r.ok) {
      toast(r['ทับของเดิม'] ? 'แก้ดวงวันที่ ' + thDate(chart.date) + ' แล้ว' : 'เก็บดวงวันที่ ' + thDate(chart.date) + ' แล้ว');
      /* ใส่ในแคชทันที เปิดแท็บทำนายไม่ต้องรอโหลดใหม่ */
      if (S.data) { S.data.charts = charts_().filter(function (c) { return !(c.date === chart.date && (c.kind || '') === chart.kind) && !(c.date === chart.date && !c.kind); }).concat([chart]).sort(function (a, c) { return a.date < c.date ? -1 : 1; }); saveCache_(S.data); }
      S.draft = null; S.tab = 'predict'; render_(); refresh_();
    } else { b.disabled = false; b.textContent = 'เก็บดวงนี้'; toast((r && r.error) || 'เก็บดวงไม่สำเร็จ — ลองอีกครั้ง'); }
  });
}

/* ---------------- แท็บ: สถิติ ---------------- */
/** ไทยมีช่องคั่นระหว่าง "หน่วย" กับ "ล่างสิบ" (เจ้าของขอ: แยกบน/ล่างให้เห็นชัด) */
function sepCell_(kind, i, tag) { return (kind === 'thai' && i === 4) ? '<' + tag + ' class="sep"></' + tag + '>' : ''; }
function groupHead_(kind, lead) {
  if (kind !== 'thai') return '';
  return '<tr class="grp">' + lead + '<th colspan="4" class="gup">4 ตัวบน</th><th class="sep"></th><th colspan="2" class="glo">2 ตัวล่าง</th></tr>';
}

function viewStats_() {
  var kind = S.kind, K = SC_KIND[kind], res = results_(kind), h = [];
  var st = scStats_(kind, res, S.statN || 0);
  if (!st.total) return '<div class="card">ยังไม่มีผล' + esc(K.name) + 'ในชีต</div>';
  h.push('<div class="card"><h3>สถิติผลจริงแยกหลัก<span class="sub">' + esc(K.name) + ' ' + st.n + ' งวด (' + esc(thDate(st.from)) + ' – ' + esc(thDate(st.to)) + ')</span></h3>');
  h.push('<div class="seg" id="segN">' + [[10, '10 งวด'], [30, '30 งวด'], [100, '100 งวด'], [0, 'ทั้งหมด ' + st.total]].map(function (x) {
    return '<button data-n="' + x[0] + '" class="' + ((S.statN || 0) === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>');
  var max = 1; st.pos.forEach(function (p) { p.cnt.forEach(function (c) { if (c > max) max = c; }); });
  h.push('<div class="scroll"><table class="heat">' + groupHead_(kind, '<th></th>') + '<tr><th></th>' +
    st.pos.map(function (p, i) { return sepCell_(kind, i, 'th') + '<th>' + esc(p.name) + '</th>'; }).join('') + '</tr>');
  for (var d = 0; d < 10; d++) {
    h.push('<tr><td class="d">' + d + '</td>');
    st.pos.forEach(function (p, i) {
      h.push(sepCell_(kind, i, 'td'));
      var a = p.cnt[d] / max, hot = p.hot.indexOf(d) >= 0, cold = p.cold.indexOf(d) >= 0;
      var bg = 'rgba(230,192,99,' + (0.06 + a * 0.6).toFixed(2) + ')';
      h.push('<td class="' + (hot ? 'hot' : (cold ? 'dead' : '')) + '" style="background:' + bg + ';color:' + (a > 0.6 ? '#1a1406' : 'var(--ink)') + '">' + p.cnt[d] +
             (hot ? '<span class="g tagh">เด่น</span>' : (cold ? '<span class="g tagd">ดับ</span>' : '')) + '<span class="g">ค้าง ' + p.gap[d] + '</span></td>');
    });
    h.push('</tr>');
  }
  h.push('</table></div><div class="howto"><b>อ่านตารางนี้ยังไง</b>' +
    '<div>• <b>ตัวเลขใหญ่</b> = หลักนี้ออกเลขนั้นกี่ครั้ง ในช่วงที่เลือก</div>' +
    '<div>• <b>ค้าง</b> = เลขนั้นไม่ได้ออกในหลักนี้มากี่งวดแล้ว (ค้าง 0 = เพิ่งออกงวดล่าสุด)</div>' +
    '<div>• <span class="good"><b>กรอบทอง = เด่น</b></span> ออกบ่อยสุดและบ่อยกว่าค่าเฉลี่ย — ใช้เลือกเลขตามกระแส</div>' +
    '<div>• <span class="bad"><b>กรอบแดง = ดับ</b></span> ออกน้อยสุดในช่วงนี้ — ใช้ตัดเลขทิ้ง หรือถ้าเล่นแนว "เลขค้างจะมา" ก็ดูคู่กับค้าง</div>' +
    '<div class="muted">ช่วงสั้น (10 งวด) ตามกระแสไว · ช่วงยาว (100 งวด/ทั้งหมด) นิ่งกว่า · ผลแต่ละงวดไม่ได้ขึ้นกับงวดก่อน ใช้เป็นตัวช่วยคัด ไม่ใช่การันตี</div></div></div>');

  h.push('<div class="card"><h3>คู่/คี่ · เลขเด่น · เลขดับ</h3><table class="tbl"><tr><th>หลัก</th><th>คู่</th><th>คี่</th><th>เด่น</th><th>ดับ</th></tr>' +
    st.pos.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td>' + Math.round(p.even / p.n * 100) + '%</td><td>' + Math.round((p.n - p.even) / p.n * 100) + '%</td><td class="mk1">' + p.hot.join(' ') + '</td><td class="bad">' + p.cold.join(' ') + '</td></tr>'; }).join('') +
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
  h.push('<div class="scroll" style="margin-top:10px"><table class="tbl"><tr><th>วัน</th><th>ผล</th>' + K.pos.map(function (p, i) { return sepCell_(kind, i, 'th') + '<th>' + esc(p) + '</th>'; }).join('') + '<th>ชุด</th></tr>');
  bt.rows.slice().reverse().forEach(function (r) {
    h.push('<tr><td>' + esc(thDate(r.date)) + '</td><td><b>' + r.real + '</b></td>' +
      r.marks.map(function (m, i) { return sepCell_(kind, i, 'td') + '<td class="mk' + m.m + '">' + m.top.join('') + '</td>'; }).join('') +
      '<td>' + r.sets.filter(function (s) { return s.hit; }).map(function (s) { return esc(s.name); }).join('<br>') + '</td></tr>');
  });
  h.push('</table></div><div class="muted" style="margin-top:6px"><span class="mk1">เขียว</span> = อันดับ 1 ตรง · <span class="mk3">ส้ม</span> = ติด 3 อันดับ · <span class="bad">แดง = หลุด</span> (ไม่เข้าทั้ง 3 อันดับ)</div>');
  var w = scWeights_(kind, charts_(), res);
  h.push('<div class="scroll" style="margin-top:12px"><table class="tbl"><tr><th>วิธีค้น</th>' + K.pos.map(function (p, i) { return sepCell_(kind, i, 'th') + '<th>' + esc(p) + '</th>'; }).join('') + '</tr>' +
    SC_METHODS.map(function (m) {
      return '<tr><td>' + esc(m[1]) + '</td>' + w.w[m[0]].map(function (x, i) {
        var c = x.w >= 1.3 ? 'mk1' : (x.w <= 0.7 ? 'bad' : '');
        return sepCell_(kind, i, 'td') + '<td class="' + c + '">×' + x.w.toFixed(1) + '<br><span class="muted">' + x.top + '/' + x.k + '</span></td>';
      }).join('') + '</tr>';
    }).join('') + '</table></div><div class="muted" style="margin-top:6px">×น้ำหนักที่ใช้คิดงวดหน้า (1 = เท่าสุ่ม) · เขียว = แม่นกว่าสุ่ม · ตัวล่าง = เข้าอันดับ 1 กี่ครั้ง/กี่ดวง</div></div>');
  return h.join('');
}

/* ---------------- แท็บ: บันทึก ---------------- */
/** การ์ดกรอกผลหวย — กรอกได้ทุกงวด ไม่ต้องมีดวง · ลงชีตผลเดียวกับบอท = สถิติต่อเนื่อง */
function resultCard_(kind, res) {
  var K = SC_KIND[kind], last = scLastDraw_(kind), miss = scMissingDraws_(kind, res, kind === 'lao' ? 21 : 62);
  var h = ['<div class="card resin"><h3>กรอกผล' + esc(K.name) + '<span class="sub">ลงแล้วเข้าสถิติทันที</span></h3>'];
  /* เรียงตามที่เจ้าของจัดมา: วันที่ / รางวัลที่ 1 / หน้า 3 · 2 ตัวล่าง (ช่องเล็กกลาง) · ท้าย 3 */
  h.push('<label class="fld">งวดวันที่' + dateSelect_('r_date', drawDateList_(kind), last) + '</label>');
  if (kind === 'lao') {
    h.push('<label class="fld" style="margin-top:8px">ผล 4 ตัว<input id="r_a" inputmode="numeric" maxlength="4" placeholder="เช่น 6261"></label>' +
           '<div class="muted" style="margin-top:6px">ระบบแยกให้เอง: 3 ตัวบน = 3 ตัวท้าย · 2 ตัวบน = 2 ตัวท้าย · 3 ตัวล่าง = 3 ตัวหน้า · 2 ตัวล่าง = 2 ตัวหน้า</div>');
  } else {
    h.push('<label class="fld" style="margin-top:8px">รางวัลที่ 1 (6 หลัก)<input id="r_a" inputmode="numeric" maxlength="6" placeholder="เช่น 402701"></label>' +
           '<div class="grid3" style="margin-top:8px">' +
           '<label class="fld">หน้า 3 ตัว<input id="r_f3" inputmode="numeric" placeholder="791 912"></label>' +
           '<label class="fld mid">2 ตัวล่าง<input id="r_b" inputmode="numeric" maxlength="2" placeholder="70"></label>' +
           '<label class="fld">ท้าย 3 ตัว<input id="r_b3" inputmode="numeric" placeholder="058 396"></label></div>' +
           '<div class="muted" style="margin-top:6px">คำนวณใช้แค่ 4 ตัวบน (4 ตัวท้ายของรางวัลที่ 1) กับ 2 ตัวล่าง</div>');
  }
  h.push('<button class="btn" id="r_go">บันทึกผล</button>');
  if (miss.length) {
    h.push('<div class="muted" style="margin-top:12px">งวดที่ยังไม่ได้กรอก — แตะเพื่อเลือก</div><div class="chips" style="margin-top:6px">' +
      miss.map(function (d) { return '<button class="chip miss" data-miss="' + d + '">' + esc(thDate(d)) + '</button>'; }).join('') + '</div>');
  } else h.push('<div class="muted good" style="margin-top:10px">กรอกครบทุกงวดแล้ว</div>');
  h.push('</div>');
  return h.join('');
}

/** แถวผลดิบจากชีต (ไทยมีรางวัลที่ 1 / หน้า 3 / ท้าย 3 ด้วย) */
function rawRow_(kind, iso) {
  var rows = (S.data && S.data[kind]) || [];
  for (var i = rows.length - 1; i >= 0; i--) if (rows[i][0] === iso) return rows[i];
  return null;
}

/** ผลย้อนหลังทุกงวด — พับได้ เลื่อนได้ */
function resultsFold_(kind, res) {
  var all = Object.keys(res).sort().reverse();
  if (!all.length) return '';
  var h = ['<details class="card fold" open><summary><h3>ผล' + esc(SC_KIND[kind].name) + 'ย้อนหลัง<span class="sub">' + all.length + ' งวด · แตะเพื่อพับ</span></h3></summary><div class="scrollbox">'];
  all.forEach(function (d) {
    var r = res[d], raw = rawRow_(kind, d) || [];
    if (kind === 'lao') {
      h.push('<div class="rrow"><div class="rd">' + esc(thDate(d)) + '</div><div class="rn"><b>' + r.join('') + '</b></div>' +
             '<div class="rs"><span class="up">3 บน ' + r.slice(1).join('') + ' · 2 บน ' + r.slice(2).join('') + '</span> · <span class="lo">3 ล่าง ' + r.slice(0, 3).join('') + ' · 2 ล่าง ' + r.slice(0, 2).join('') + '</span></div></div>');
    } else {
      var extra = [];
      if (raw[3]) extra.push('รางวัลที่ 1 <b>' + esc(raw[3]) + '</b>');
      if (raw[4]) extra.push('หน้า 3 ' + esc(String(raw[4]).split('/').join(' ')));
      if (raw[5]) extra.push('ท้าย 3 ' + esc(String(raw[5]).split('/').join(' ')));
      h.push('<div class="rrow"><div class="rd">' + esc(thDate(d)) + '</div><div class="rn"><span class="up"><b>' + r.slice(0, 4).join('') + '</b></span> <span class="lo"><b>' + r.slice(4).join('') + '</b></span></div>' +
             (extra.length ? '<div class="rs">' + extra.join(' · ') + '</div>' : '') + '</div>');
    }
  });
  h.push('</div></details>');
  return h.join('');
}

/** ทายย้อนหลังพร้อมเหตุผล: งวดที่มีดวง — ตอนนั้นสูตรทายอะไร เพราะอะไร ออกจริงอะไร
    คิดใหม่จากดวง+ผลในชีตทุกครั้ง (น้ำหนักใช้แค่ข้อมูลก่อนงวดนั้น = เหมือนที่ทายจริงตอนนั้น) */
function historyFold_(kind, res) {
  /* ใช้แถวของ scBacktest_ (คิดน้ำหนักต่อเนื่องรอบเดียว) — ของเดิมคิดน้ำหนักใหม่ทุกงวด ช้าแบบกำลังสอง */
  var rows = scBacktest_(kind, charts_(), res).rows.slice().reverse();
  var K = SC_KIND[kind];
  var h = ['<details class="card fold"><summary><h3>ทายย้อนหลังพร้อมเหตุผล<span class="sub">' + rows.length + ' งวดที่มีดวง · แตะเพื่อเปิด</span></h3></summary>'];
  if (!rows.length) { h.push('<div class="muted">ยังไม่มีงวดที่มีทั้งดวงและผล</div></details>'); return h.join(''); }
  h.push('<div class="scrollbox">');
  rows.forEach(function (row) {
    var c = row.chart, real = res[c.date], w = row.w, pr = row.pr;
    var marks = pr.pos.map(function (p, i) {
      var t = p.top.map(function (x) { return x.d; }), m = t[0] === real[i] ? 1 : (t.indexOf(real[i]) >= 0 ? 3 : 0);
      return '<span class="mk' + m + '">' + real[i] + '</span>';
    }).join('');
    h.push('<details class="hist"><summary><span class="rd">' + esc(thDate(c.date)) + ' · ' + esc(chartTime_(c)) + '</span><span class="hm">ออก ' + marks + '</span></summary><div class="hb">');
    pr.pos.forEach(function (p, i) {
      var t = p.top.map(function (x) { return x.d; }), m = t[0] === real[i] ? 'mk1' : (t.indexOf(real[i]) >= 0 ? 'mk3' : 'mk0');
      h.push('<div class="hp"><b>' + esc(p.name) + '</b> ทาย ' + t.join(' ') + ' · ดับ ' + p.closed.join(' ') + ' · ออก <span class="' + m + '">' + real[i] + '</span>' +
             (p.closed.indexOf(real[i]) >= 0 ? ' <span class="bad">(ออกเลขที่ทายว่าดับ)</span>' : '') + '</div>');
      var top = p.top[0];
      h.push('<div class="hw">' + top.plus.slice().sort(function (a, b) { return b.v - a.v; }).slice(0, 4)
        .map(function (x) { return esc(top.d + ' ← ' + x.m + ': ' + x.why[0]); }).join('<br>') + '</div>');
    });
    var setTxt = pr.sets.map(function (st) {
      var want = K.sets.filter(function (x) { return x[0] === st.name; })[0][1].map(function (i) { return real[i]; }).join('');
      return esc(st.name) + ' ' + (st.list.indexOf(want) >= 0 ? '<span class="mk1">เข้า ' + want + '</span>' : '<span class="mk0">หลุด (ออก ' + want + ')</span>');
    }).join(' · ');
    h.push('<div class="hp">' + setTxt + '</div><div class="muted">เลขเสียวันนั้น: ' + pr.dead.map(function (x) { return x.d; }).join(' ') + ' · ใช้น้ำหนักจาก ' + w.n + ' ดวงก่อนหน้า</div></div></details>');
  });
  h.push('</div><div class="muted" style="margin-top:6px"><span class="mk1">เขียว</span> = อันดับ 1 ตรง · <span class="mk3">ส้ม</span> = ติด 3 อันดับ · <span class="mk0">แดง</span> = หลุด</div></details>');
  return h.join('');
}

function viewLog_() {
  var kind = S.kind, K = SC_KIND[kind], res = results_(kind), h = [];
  var charts = charts_().filter(function (c) { return scFits_(c, kind); }).slice().reverse();
  if (!ro_()) h.push(resultCard_(kind, res));
  h.push(resultsFold_(kind, res));
  h.push(historyFold_(kind, res));
  h.push('<details class="card fold"><summary><h3>บันทึกปฏิทิน 100 ปี<span class="sub">ดวง' + esc(K.name) + ' ' + charts.length + ' วัน · แตะเพื่อเปิด</span></h3></summary><div class="scrollbox">');
  if (!charts.length) h.push('<div class="muted">ยังไม่มีดวงของ' + esc(K.name) + ' — ส่งรูปที่แท็บ "ส่งดวง"</div>');
  charts.forEach(function (c) {
    var r = res[c.date], key = c.date + '|' + (c.kind || '');
    var sum = c.rasi.map(function (cell, i) { return cell.length ? SC_RASI[i] + ' ' + cell.join('') : ''; }).filter(String).join(' · ');
    var tag = '<span class="ktag">' + (c.kind === 'thai' ? 'ไทย ' : (c.kind === 'lao' ? 'ลาว ' : '')) + esc(chartTime_(c)) + '</span>';
    h.push('<div class="ent"><div><div class="dt">' + esc(thDate(c.date)) + ' ' + tag + '</div><div class="muted">' + esc(c.lunar) + (c.center ? ' · กลาง ' + esc(c.center) : '') + '</div>' +
      '<div class="muted" style="margin-top:3px">' + esc(sum) + '</div>' +
      (ro_() ? '' : '<div class="btns" style="margin-top:8px"><button class="btn ghost" data-edit="' + key + '">แก้ดวง</button><button class="btn ghost" data-del="' + key + '">ลบ</button></div>') + '</div>' +
      '<div style="min-width:96px">' + (r ? '<div class="res">' + r.slice(0, 4).join('') + (kind === 'thai' ? '<br><small>' + r.slice(4).join('') + '</small>' : '') + '</div>'
        : '<div class="res none">' + (scIsDraw_(kind, c.date) ? 'ยังไม่มีผล' + (ro_() ? '' : '<br>กรอกด้านบน') : 'ไม่ใช่วันออก') + '</div>') + '</div></div>');
  });
  h.push('</div></details>');
  return h.join('');
}

function bindLog_() {
  Array.prototype.forEach.call(document.querySelectorAll('[data-miss]'), function (b) {
    b.onclick = function () { $('r_date').value = b.getAttribute('data-miss'); $('r_a').focus(); };
  });
  var go = $('r_go');
  if (go) go.onclick = function () {
    var iso = $('r_date').value, a = ($('r_a').value || '').replace(/\D/g, ''), body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) { toast('เลือกวันที่งวดก่อน'); return; }
    if (S.kind === 'lao') {
      if (a.length !== 4) { toast('หวยลาวต้อง 4 ตัว'); return; }
      body = { kind: 'lao', date: iso, a: a };
    } else {
      var b2 = ($('r_b').value || '').replace(/\D/g, '');
      if (a.length !== 6 && a.length !== 4) { toast('รางวัลที่ 1 ต้อง 6 หลัก (หรือ 4 ตัวบน)'); return; }
      if (b2.length !== 2) { toast('2 ตัวล่างต้อง 2 หลัก'); return; }
      body = { kind: 'thai', date: iso, a: a, b: b2,
               f3: ($('r_f3').value || '').trim().split(/\D+/).filter(String).join('/'),
               b3: ($('r_b3').value || '').trim().split(/\D+/).filter(String).join('/') };
    }
    if (!scIsDraw_(S.kind, iso) && !confirm(thDate(iso) + ' ไม่ใช่วันออกปกติของ' + SC_KIND[S.kind].name + ' — ลงต่อไหม?')) return;
    go.disabled = true; go.textContent = 'กำลังลงผล…';
    starPost_('starresult', body).then(function (r) {
      go.disabled = false; go.textContent = 'บันทึกผล';
      if (r && r.ok) {
        ['r_a', 'r_b', 'r_f3', 'r_b3'].forEach(function (id) { if ($(id)) $(id).value = ''; });
        toast('ลงผลงวด ' + thDate(iso) + ' แล้ว'); refresh_();
      }
      else toast((r && (r['ข้อความ'] || r.error)) || 'ลงผลไม่สำเร็จ — เช็คตัวเลขอีกที');
    });
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-edit]'), function (b) {
    b.onclick = function () {
      var key = b.getAttribute('data-edit').split('|');
      var c = charts_().filter(function (x) { return x.date === key[0] && (x.kind || '') === (key[1] || ''); })[0];
      if (!c) return;
      S.draft = { date: c.date, kind: c.kind || S.kind, time: chartTime_(c), rasi: c.rasi.map(function (x) { return x.slice(); }), lagna: c.lagna, center: c.center || '', lunar: c.lunar || '',
                  moved: c.moved || '', special: c.special || '', note: c.note || '', read: null };
      S.tab = 'upload'; render_();
    };
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-del]'), function (b) {
    b.onclick = function () {
      var key = b.getAttribute('data-del').split('|'), iso = key[0], dk = key[1] || '';
      if (!confirm('ลบดวงวันที่ ' + thDate(iso) + ' ทิ้ง? (ผลหวยไม่หาย ลบแค่ดวง)')) return;
      starPost_('stardel', { date: iso, kind: dk }).then(function (r) {
        if (r && r.ok) { S.data.charts = charts_().filter(function (c) { return !(c.date === iso && (c.kind || '') === dk); }); saveCache_(S.data); render_(); toast('ลบดวงวันที่ ' + thDate(iso) + ' แล้ว'); }
        else toast((r && r.error) || 'ลบไม่สำเร็จ');
      });
    };
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-save]'), function (b) {
    b.onclick = function () {
      var iso = b.getAttribute('data-save'), inp = document.querySelector('input[data-res="' + iso + '"]');
      var t = (inp.value || '').replace(/[^0-9 ]/g, ' ').trim().split(/\s+/);
      /* ไทย: "402701 70" หรือ "2701 70" · ต่อท้ายด้วยหน้า 3 ท้าย 3 ได้ "402701 70 791 912 058 396" */
      var body = S.kind === 'thai' ? { kind: 'thai', date: iso, a: t[0] || '', b: t[1] || '',
                                       f3: t.slice(2, 4).join('/'), b3: t.slice(4, 6).join('/') }
                                   : { kind: 'lao', date: iso, a: t.join('') };
      b.disabled = true;
      starPost_('starresult', body).then(function (r) {
        b.disabled = false;
        if (r && r.ok) { toast('ลงผลวันที่ ' + thDate(iso) + ' แล้ว'); refresh_(); } else toast((r && (r['ข้อความ'] || r.error)) || 'ลงผลไม่สำเร็จ — เช็คตัวเลขอีกที');
      });
    };
  });
}

/* ---------------- โครงหลัก ---------------- */
/** เก็บค่าที่กำลังพิมพ์ไว้ข้ามการวาดหน้าใหม่ (ข้อมูลโหลดเสร็จตอนกำลังกรอก = ช่องเคยหายหมด) */
function keepInputs_() {
  var keep = {};
  Array.prototype.forEach.call(document.querySelectorAll('#app input[id], #app select[id]'), function (el) {
    if (el.type !== 'file') keep[el.id] = el.value;
  });
  return keep;
}
function restoreInputs_(keep) {
  Object.keys(keep).forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.type !== 'file' && keep[id] !== '' && el.value !== keep[id]) el.value = keep[id];
  });
}

function render_() {
  /* แท็บส่งดวงเก็บสถานะใน S.draft อยู่แล้ว (restore ทับจะกลบค่าที่ฟอร์มคำนวณใหม่ เช่น จันทรคติตอนเปลี่ยนวัน) */
  var keep = (render_.tab === S.tab && render_.kind === S.kind && S.tab !== 'upload') ? keepInputs_() : {};
  render_.tab = S.tab; render_.kind = S.kind;
  /* ดูอย่างเดียว: ไม่มีแท็บส่งดวง · แท็บกรอกผลกลายเป็น "ผล" */
  var navUp = document.querySelector('#nav a[data-t="upload"]'), navLog = document.querySelector('#nav a[data-t="log"]');
  if (navUp) navUp.style.display = ro_() ? 'none' : '';
  if (navLog) navLog.innerHTML = '<b>☰</b>' + (ro_() ? 'ผลย้อนหลัง' : 'กรอกผล');
  if (ro_() && S.tab === 'upload') S.tab = 'predict';
  var v = S.tab === 'upload' ? viewUpload_() : S.tab === 'stats' ? viewStats_() : S.tab === 'log' ? viewLog_() : viewPredict_();
  if (S.src === 'กุญแจ') v = keySheet_() + (S.data ? v : '');
  else if (!S.data && S.tab !== 'upload') v = '<div class="card hero"><div class="d">กำลังดูดวงดาว…</div><div class="muted">ครั้งแรกต้องต่อเน็ต ครั้งต่อไปเปิดได้ทันที</div></div>';
  $('app').innerHTML = v;
  restoreInputs_(keep);
  var kg = $('keygo');
  if (kg) kg.onclick = function () {
    var k = ($('keyin').value || '').replace(/\s+/g, '');
    if (!k) { toast('ยังไม่ได้วางกุญแจ'); return; }
    setStarKey_(k); kg.disabled = true; kg.textContent = 'กำลังเช็ค…';
    refresh_().then(function () { toast(S.src === 'สด' ? 'ปลดล็อกแล้ว' : 'กุญแจไม่ถูก ลองวางใหม่'); });
  };
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
  starKeyBoot_();
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
