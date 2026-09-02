/* page-forebet.js — หน้า 1: คู่ที่ Forebet คัดมา
   ทุกฟังก์ชันคืนเป็น string ไม่แตะ DOM เพื่อให้เทสต์ใน Node ได้ */
'use strict';

/* forebet สลับคู่ทั้งวัน ของที่จดไว้มีหลายใบ ตัดเหลือ 4 = ของหาย
   ยังต้องมีเพดานอยู่ กันหน้ายาวจนเลื่อนไม่ไหวตอนวันที่คู่เยอะ */
var MAX_CARDS = 12;

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
  if (sc) parts.push('ทาย (' + sc + ')');
  if (!parts.length) return '';
  return '<div class="pick-pred">' + esc_(parts.join(' · ')) + '</div>';
}

function s_(v) { return String(v === null || v === undefined ? '' : v).trim(); }

/** ตลาดที่โชว์เฉพาะ "เปอร์เซ็นต์" เท่านั้น
    เรทของ forebet เป็นเลขอเมริกัน (-208) เจ้าของสั่งตัดทิ้ง "นอกนั้นไม่เอา"
    เหตุผล: เลขบนการ์ดเยอะแล้ว ดูผิดทีเดียวเสียเงินจริง
    ของเดิมยังอยู่ครบในชีต จะเอากลับมาเมื่อไหร่ก็ได้
    ไม่มีเปอร์เซ็นต์ = ไม่มีท่อนนี้ */
function mktPct_(label, pct) {
  var a = s_(pct);
  return a ? label + ' ' + a : '';
}

/** บรรทัดตลาดรวบเป็นบรรทัดเดียวตามที่เจ้าของเขียนมา:
      1X2 (42/38/20) · Over 77 · BTTS 58 - · HT 1 (41/36/23) · DB 80/1X · HT/FT 17(1/1)
    ช่องไหนไม่มีก็หายไปทั้งท่อน ห้ามโชว์ป้ายเปล่าๆ ให้คนอ่านเดาเอง */
function marketLine_(p) {
  var parts = [], t;

  var x3 = s_(p['1X2เปอร์เซ็นต์']);
  if (x3) parts.push('1X2 (' + x3 + ')');
  else {
    /* ยังไม่ได้เปิดหน้าคู่ = มีแค่ตัวเดียวจากตารางใหญ่ โชว์เท่าที่มี */
    var one = Number(p['เปอร์เซ็นต์']);
    if (!isNaN(one) && one > 0) parts.push('1X2 ' + one + '%');
  }

  t = mktPct_('Over', p['Overเปอร์เซ็นต์']);
  if (t) parts.push(t);
  t = mktPct_('BTTS', p['BTTSเปอร์เซ็นต์']);
  if (t) parts.push(t);

  var hw = s_(p['HTเดาผล']), hp = s_(p['HTเปอร์เซ็นต์']);
  if (hw || hp) {
    var ht = 'HT';
    if (hw) ht += ' ' + hw;
    if (hp) ht += ' (' + hp + ')';
    parts.push(ht);
  }

  /* DB กับ HT/FT ต้องมีครบทั้งเลขและผลที่เดา ขาดอย่างใดอย่างหนึ่ง = ตัดทั้งท่อน
     "DB 80" หรือ "HT/FT 17" เดี่ยวๆ ไม่ได้บอกอะไร นอกจากทำให้อ่านผิด */
  var dp = s_(p['DBเปอร์เซ็นต์']), dw = s_(p['DBเดาผล']);
  if (dp && dw) parts.push('DB ' + dp + '/' + dw);

  var fp = s_(p['HTFTเปอร์เซ็นต์']), fw = s_(p['HTFTเดาผล']);
  if (fp && fw) parts.push('HT/FT ' + fp + '(' + fw + ')');

  if (!parts.length) return '';
  return '<div class="pick-mkt">' + esc_(parts.join(' · ')) + '</div>';
}

/** ผลจริงหลังจบเกม — ว่าง = คู่ยังไม่เตะ/หาผลไม่เจอ ให้หายไปทั้งบรรทัด
    ห้ามโชว์ "FT -" เพราะคนอ่านจะนึกว่า 0-0 */
function ftLine_(p) {
  var sc = s_(p['สกอร์จริง']);
  if (!sc) return '';
  var r = s_(p['ถูกผิด']);
  var mark = r === 'ถูก' ? ' ✅' : (r === 'ผิด' ? ' ❌' : '');
  return '<div class="pick-ft">FT ' + esc_(sc + mark) + '</div>';
}

/** สีทั้งใบตามผล 1X2 — ไม่มีผล = ไม่ทาสี (ใบที่ยังไม่เตะต้องดูเป็นกลาง) */
function resClass_(p) {
  var r = s_(p['ถูกผิด']);
  return r === 'ถูก' ? ' ok' : (r === 'ผิด' ? ' bad' : '');
}

/** ไส้ในของใบ — แยกออกมาเพราะใบปักหมุดใช้ไส้เดียวกัน ต่างแค่กรอบกับป้าย
    เรียงตามที่เจ้าของสั่ง: ลีก / วัน-เวลาเตะ / คู่ / คำเดา / ตลาด
    ไม่มีบรรทัดเปอร์เซ็นต์ลอยกับราคาแล้ว — เปอร์เซ็นต์ไปอยู่ในท่อน 1X2
    และราคาของ forebet เป็นแบบอเมริกัน เราไม่แปลง จึงเป็น 0.00 เสมอ ไม่มีประโยชน์ */
function pickBody_(p) {
  var home = esc_(teamTh(p['เหย้า'], p['เหย้าไทย']));
  var away = esc_(teamTh(p['เยือน'], p['เยือนไทย']));
  var lg = s_(p['ลีก']);
  var kick = kickText(p['วันที่'], p['เวลาเตะ']);
  return '' +
    (lg ? '<div class="muted">' + esc_(lg) + '</div>' : '') +
    (kick ? '<div class="muted">' + esc_(kick) + '</div>' : '') +
    '<div class="big">' + home + ' <span class="muted">VS</span> ' + away + '</div>' +
    predictLine_(p) +
    ftLine_(p) +
    marketLine_(p);
}

function pickCard(p) {
  return '<div class="card pick' + resClass_(p) + '">' + pickBody_(p) + '</div>';
}

/** ชื่อช่องบน Forebet — ไม่รู้จักช่องไหน ก็โชว์รหัสดิบไปตรงๆ ดีกว่าเงียบ */
var PIN_LABEL = { FEATURED: 'FEATURED MATCH', POTD: 'PICK OF THE DAY' };

/** ใบปักหมุด: ภาพนิ่งของตอนที่ไปดึงมา ไม่ใช่ของสด จึงต้องบอกเวลาที่ดึงเสมอ
    ช่องเดียวกันมีได้หลายใบ (forebet สลับคู่ทั้งวัน) — ใบใหม่สุดของช่องเท่านั้นที่พูดว่า
    "ล่าสุด" ใบที่เหลือพูดว่า "อัพเดท" ไม่งั้นทุกใบอ้างว่าตัวเองล่าสุดหมด */
function pinCard(p) {
  var kind = String(p['ช่อง'] || '').trim().toUpperCase();
  var got = String(p['ดึงเมื่อ'] || '').trim();
  var word = p['ล่าสุด'] ? 'ล่าสุด ' : 'อัพเดท ';
  return '' +
    '<div class="card pick pin' + resClass_(p) + '">' +
      '<div class="pin-cap">' + esc_(PIN_LABEL[kind] || kind) + '</div>' +
      pickBody_(p) +
      (got ? '<div class="pin-when">' + word + esc_(thDate(got)) + ' ' + esc_(thTime(got)) + '</div>' : '') +
    '</div>';
}

/** แถบเลือกวัน — ใบแรก "ล่าสุด" คือหน้าปกติ (คู่ที่ยังไม่เตะ) ไม่ใช่วันใดวันหนึ่ง
    ลิงก์เป็น hash ล้วน ตัวจัดหน้าใน app.js พาไปเอง ปุ่มย้อนกลับของเครื่องจึงใช้ได้
    ไม่มีวันย้อนหลังเลย = ไม่ต้องมีแถบมาเกะกะ */
function dayChips_(days, day) {
  var list = days || [], out = [], i;
  for (i = 0; i < list.length; i++) {
    var d = s_(list[i]['วันที่']);
    if (!d) continue;
    var n = Number(list[i]['จำนวน']);
    var lab = thDate(d) || d;
    if (n > 0) lab += ' (' + n + ')';
    out.push('<a class="chip' + (d === day ? ' chip-on' : '') + '" href="#forebet/' + esc_(d) + '">' +
             esc_(lab) + '</a>');
  }
  if (!out.length) return '';
  return '<div class="chips">' +
           '<a class="chip' + (day ? '' : ' chip-on') + '" href="#forebet">ล่าสุด</a>' +
           out.join('') +
         '</div>';
}

/** day = 'YYYY-MM-DD' ที่เลือกจากแถบวัน (ว่าง = หน้าปกติ)
    ต้องรับมาเป็นตัวแปร ห้ามไปอ่าน location เอง เพราะฟังก์ชันนี้ต้องรันในเทสต์ได้ด้วย */
function renderForebet(data, nowMs, day) {
  var pickDay = s_(day);
  var chips = dayChips_(data && data.days, pickDay);
  var head = '<div class="muted">ข้อมูลรอบ ' + esc_(thTime(data && data.at)) + '</div>';
  var foot = '<a class="btn" href="#mybet">กรอกเอง</a>';

  /* เลือกวันไว้ = โหมดย้อนหลัง โชว์ทุกภาพนิ่งของวันนั้น (รวมคู่ที่เตะไปแล้ว)
     คนละชุดกับหน้าปกติ จึงไม่ต้องคัดซ้ำกับ picks */
  if (pickDay) {
    var hist = (data && data.hist) ? data.hist : {};
    var rows = hist[pickDay] || [];
    var old = rows.map(function (p) { return pinCard(p); }).join('');
    if (!old) {
      old = '<div class="card"><div class="big">วันนี้ไม่มีบันทึก</div>' +
            '<div class="muted">ลองวันอื่น หรือกดล่าสุด</div></div>';
    }
    return head + chips + old + foot;
  }

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

  var pin = pinned.map(function (p) { return pinCard(p); }).join('');
  var body = picks.map(function (p) { return pickCard(p); }).join('');
  if (!pin && !body) {
    body = '<div class="card"><div class="big">ยังไม่มีคู่ของรอบนี้</div>' +
      '<div class="muted">รอบถัดไปอีกไม่นาน หรือกรอกเองได้เลย</div></div>';
  }

  return head + chips + pin + body + foot;
}
