/* page-forebet.js — หน้า 1: คู่ที่ Forebet คัดมา
   ทุกฟังก์ชันคืนเป็น string ไม่แตะ DOM เพื่อให้เทสต์ใน Node ได้ */
'use strict';

var MAX_CARDS = 4;

/** แปลไม่เจอ = โชว์ชื่ออังกฤษเดิม (สเปกข้อ 11 — ห้ามทับศัพท์เอง) */
function teamTh(en, th) {
  var t = (th === null || th === undefined) ? '' : String(th).trim();
  return t !== '' ? t : String(en === null || en === undefined ? '' : en);
}

function esc_(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 1X2 ที่ Forebet เดา — แปลงเป็นชื่อทีมเลย จะได้ไม่ต้องแปลในหัว
    ไม่มีค่ามา = คืนค่าว่าง ให้คนเรียกตัดบรรทัดทิ้ง */
function wdlText_(p) {
  var w = String(p['เดาผล'] || '').trim().toUpperCase();
  if (w === '1') return 'เต็ง ' + teamTh(p['เหย้า'], p['เหย้าไทย']);
  if (w === '2') return 'เต็ง ' + teamTh(p['เยือน'], p['เยือนไทย']);
  if (w === 'X') return 'เสมอ';
  return '';
}

function predictLine_(p) {
  var parts = [];
  var w = wdlText_(p);
  if (w) parts.push(w);
  var sc = String(p['เดาสกอร์'] || '').trim();
  if (sc) parts.push('เดาสกอร์ ' + sc);
  if (!parts.length) return '';
  return '<div class="pick-pred">' + esc_(parts.join(' · ')) + '</div>';
}

/** ไส้ในของใบ — แยกออกมาเพราะใบปักหมุดใช้ไส้เดียวกัน ต่างแค่กรอบกับป้าย */
function pickBody_(p, nowMs) {
  var home = esc_(teamTh(p['เหย้า'], p['เหย้าไทย']));
  var away = esc_(teamTh(p['เยือน'], p['เยือนไทย']));
  var pct = Number(p['เปอร์เซ็นต์']);
  var when = String(p['เวลาเตะ'] || '').trim();
  var cd = when ? countdownText(p['เวลาเตะ'], 'รอเตะ', nowMs) : '';
  return '' +
    '<div class="row"><span class="muted">' + esc_(p['ลีก']) + '</span>' +
      '<span class="muted">' + (when ? esc_(thDate(when)) + ' ' + esc_(thTime(when)) : '') + '</span></div>' +
    '<div class="big">' + home + ' <span class="muted">VS</span> ' + away + '</div>' +
    predictLine_(p) +
    '<div class="row">' +
      '<span class="pick-pct">' + (isNaN(pct) ? '' : pct + '%') + '</span>' +
      '<span class="pick-odds">' + esc_(fmtOdds(p['ราคา'])) + '</span>' +
    '</div>' +
    (cd ? '<div class="muted">' + esc_(cd) + '</div>' : '');
}

function pickCard(p, nowMs) {
  return '<div class="card pick">' + pickBody_(p, nowMs) + '</div>';
}

/** ชื่อช่องบน Forebet — ไม่รู้จักช่องไหน ก็โชว์รหัสดิบไปตรงๆ ดีกว่าเงียบ */
var PIN_LABEL = { FEATURED: 'FEATURED MATCH', POTD: 'PICK OF THE DAY' };

/** ใบปักหมุด: ภาพนิ่งของตอนที่ไปดึงมา ไม่ใช่ของสด จึงต้องบอกเวลาที่ดึงเสมอ */
function pinCard(p, nowMs) {
  var kind = String(p['ช่อง'] || '').trim().toUpperCase();
  var got = String(p['ดึงเมื่อ'] || '').trim();
  return '' +
    '<div class="card pick pin">' +
      '<div class="pin-cap">' + esc_(PIN_LABEL[kind] || kind) + '</div>' +
      pickBody_(p, nowMs) +
      (got ? '<div class="pin-when">ดึงมาเมื่อ ' + esc_(thDate(got)) + ' ' + esc_(thTime(got)) + '</div>' : '') +
    '</div>';
}

function renderForebet(data, nowMs) {
  var pinned = (data && data.pinned ? data.pinned : []).slice();

  /* คู่ปักหมุดติดมาในลิสต์ picks ด้วย ต้องคัดออก ไม่งั้นเห็นซ้ำ 2 ใบ */
  var seen = {}, i;
  for (i = 0; i < pinned.length; i++) seen[String(pinned[i].id || '')] = 1;

  var picks = [], all = (data && data.picks ? data.picks : []);
  for (i = 0; i < all.length; i++) {
    if (!seen[String(all[i].id || '')]) picks.push(all[i]);
  }
  picks.sort(function (a, b) { return Number(b['เปอร์เซ็นต์']) - Number(a['เปอร์เซ็นต์']); });
  picks = picks.slice(0, MAX_CARDS);

  var head = '<div class="muted">ข้อมูลรอบ ' + esc_(thTime(data && data.at)) + '</div>';
  var pin = pinned.map(function (p) { return pinCard(p, nowMs); }).join('');
  var body = picks.map(function (p) { return pickCard(p, nowMs); }).join('');
  if (!pin && !body) {
    body = '<div class="card"><div class="big">ยังไม่มีคู่ของรอบนี้</div>' +
      '<div class="muted">รอบถัดไปอีกไม่นาน หรือกรอกเองได้เลย</div></div>';
  }

  return head + pin + body + '<a class="btn" href="#mybet">กรอกเอง</a>';
}
