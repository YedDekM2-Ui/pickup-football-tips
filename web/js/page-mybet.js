/* page-mybet.js — หน้า 2: สลิปของเราเอง ธีมดอสเขียว
   กฎเหล็ก (สเปกข้อ 10): หน้านี้ห้ามโชว์ Bet ID / เปอร์เซ็นต์ / สกอร์ที่ Forebet เดา /
   บทวิเคราะห์ / อะไรที่พูดถึง OCR-เทเลแกรม-ชีต
   + ห้ามโชว์ยอดเงินที่แทง — เรื่องเงินอยู่หน้า 3 ที่เดียว (โชว์ได้แค่กำไร/ขาดทุน)
   วิธีกัน: ปั้น HTML จากช่องที่ระบุชื่อทีละช่องเท่านั้น ห้ามวนลูปทั้ง object */
'use strict';

var RESULT_MAP = {
  WIN_FULL:  { t: '✓ ชนะเต็ม',  c: 'r-winfull' },
  WIN_HALF:  { t: '✓ ชนะครึ่ง', c: 'r-winhalf' },
  PUSH:      { t: '= คืนทุน',   c: 'r-push' },
  LOSS_HALF: { t: '✗ แพ้ครึ่ง', c: 'r-losshalf' },
  LOSS_FULL: { t: '✗ แพ้เต็ม',  c: 'r-lossfull' }
};

function resultBadge(code) {
  var r = RESULT_MAP[code] || { t: '⏳ รอผล', c: 'r-pending' };
  return '<span class="badge ' + r.c + '">' + r.t + '</span>';
}

function marketLine(b) {
  var m = b['ตลาด'];
  if (m === 'AH') {
    return teamTh(b['ทีมที่เลือก'], b['ทีมที่เลือกไทย']) + ' ' + fmtHandicap(b['แฮนดิแคป']);
  }
  if (m === 'OVER_UNDER') {
    var v = Number(b['เส้น']);
    if (isNaN(v)) return 'สูง/ต่ำ';
    return (v >= 0 ? 'สูง ' : 'ต่ำ ') + Math.abs(v);
  }
  if (m === 'DRAW') return 'เสมอ';
  if (m === 'CORRECT_SCORE') return 'สกอร์ตรง ' + String(b['ทายสกอร์'] || '');
  return String(m || '');
}

function subLine_(s) {
  return '<div class="sub">' +
    '<span class="sub-m">' + esc_(marketLine(s)) + '</span> ' +
    '<span class="sub-o">@' + esc_(fmtOdds(s['ราคา'])) + '</span> ' +
    resultBadge(s['ผล']) +
    '<span class="sub-p">' + esc_(fmtSigned(s['กำไร'])) + '</span>' +
  '</div>';
}

/* ---------- ใส่สกอร์จบเกม ----------
   ตัวไล่คิดผลอัตโนมัติมันหาสกอร์เองได้ แต่ "หาไม่เจอ" เกิดได้เสมอ (ชื่อทีมไม่ตรงฟีด /
   ลีกเล็กไม่มีในฟีด) ถ้าไม่มีทางพิมพ์เอง บิลจะค้างรอผลตลอดกาลแบบเดิม
   ดังนั้นทางพิมพ์เองคือทางหลัก ตัวอัตโนมัติเป็นแค่ตัวช่วย
   หมายเหตุกฎข้อ 10: รหัสบิลอยู่ใน onclick เท่านั้น ไม่มีวันขึ้นเป็นตัวหนังสือบนจอ */
var SCOREFORM = { id: '', h: '', a: '', busy: false, msg: '' };

function scoreBox_(b) {
  if (String(b['ผล'] || '') !== '') return '';       /* มีผลแล้ว ไม่ต้องถามซ้ำ */
  var id = String(b['ID'] || '');
  if (!id) return '';
  if (SCOREFORM.id !== id) {
    return '<button class="sc-open" onclick="scoreOpen(\'' + esc_(id) + '\')">ใส่สกอร์จบเกม</button>';
  }
  return '<div class="sc-box">' +
      '<div class="sc-row">' +
        '<input class="sc-in" type="tel" inputmode="numeric" value="' + esc_(SCOREFORM.h) + '"' +
          ' oninput="scoreSet(\'h\', this.value)">' +
        '<span class="sc-dash">-</span>' +
        '<input class="sc-in" type="tel" inputmode="numeric" value="' + esc_(SCOREFORM.a) + '"' +
          ' oninput="scoreSet(\'a\', this.value)">' +
      '</div>' +
      (SCOREFORM.msg ? '<div class="sc-msg">' + esc_(SCOREFORM.msg) + '</div>' : '') +
      '<div class="sc-btns">' +
        '<button class="sc-ok" onclick="scoreSave()">' +
          (SCOREFORM.busy ? 'กำลังลง…' : 'ลงผล') + '</button>' +
        '<button class="sc-cancel" onclick="scoreClose()">ยกเลิก</button>' +
      '</div>' +
    '</div>';
}

function betSlip(b, nowMs) {
  var home = esc_(teamTh(b['เหย้า'], b['เหย้าไทย']));
  var away = esc_(teamTh(b['เยือน'], b['เยือนไทย']));
  var subs = (b.subs || []).map(subLine_).join('');
  var score = (String(b['สกอร์เหย้า']) !== '' && b['สกอร์เหย้า'] !== undefined &&
               b['สกอร์เหย้า'] !== null)
    ? '<div class="slip-score">' + esc_(b['สกอร์เหย้า']) + ' - ' + esc_(b['สกอร์เยือน']) + '</div>'
    : '';
  var sum = (b.subs && b.subs.length)
    ? '<div class="slip-sum">รวมทั้งคู่ <b>' + esc_(fmtSigned(b['รวมกำไร'])) + '</b></div>'
    : '';

  /* เรียงทีละบรรทัด: วันเวลา → ลีก → คู่แข่งขัน
     ตัวหนังสือคนละขนาด/คนละน้ำหนักทุกบรรทัด กันอ่านสลับบรรทัดกัน */
  return '' +
    '<div class="slip">' +
      '<div class="slip-when">' + esc_(thDate(b['เวลาเตะ'])) + ' · ' +
        esc_(thTime(b['เวลาเตะ'])) + '</div>' +
      '<div class="slip-league">' + esc_(b['ลีก']) + '</div>' +
      '<div class="slip-teams">' + home + ' VS ' + away + '</div>' +
      score +
      '<div class="slip-kick">' + esc_(countdownText(b['เวลาเตะ'], b['สถานะ'], nowMs)) + '</div>' +
      '<div class="main">' +
        '<span class="main-m">' + esc_(marketLine(b)) + '</span> ' +
        '<span class="main-o">@' + esc_(fmtOdds(b['ราคา'])) + '</span> ' +
        resultBadge(b['ผล']) +
        '<span class="main-p">' + esc_(fmtSigned(b['กำไร'])) + '</span>' +
      '</div>' +
      subs +
      sum +
      scoreBox_(b) +
    '</div>';
}

function dosBox_(inner) {
  return '<div class="dos-wrap"><div class="dos-mark">Pickup</div>' + inner + '</div>';
}


/* ---------- ฟอร์มลงบิล ----------
   ทางเข้าของบิลอยู่ตรงนี้ที่เดียว: ถ่ายรูปสลิป → OCR อ่านมากรอกให้ → ตรวจ → กดบันทึก
   OCR แค่กรอกให้ ไม่ได้ลงชีตเอง อ่านผิดก็แก้ในช่องได้ก่อนกด
   ค่าที่พิมพ์เก็บไว้ใน BETFORM ไม่ได้อยู่ใน DOM เพราะหน้านี้ถูกวาดใหม่ได้ตลอด (mount_)
   ถ้าเก็บใน DOM อย่างเดียว ของสดมาถึงเมื่อไหร่ที่พิมพ์ไว้หายทันที */
var BETFORM = { open: false, busy: false, msg: '', v: {}, picks: [] };

var BET_FIELDS = [
  { k: 'ลีก',        t: 'text',   ph: 'Champions League Women' },
  { k: 'ทีมเหย้า',   t: 'text',   ph: 'Czarni Sosnowiec W' },
  { k: 'ทีมเยือน',   t: 'text',   ph: 'OH Leuven W' },
  { k: 'วันที่',      t: 'date',   ph: '' },
  { k: 'เวลา',       t: 'time',   ph: '' },
  { k: 'ทีมที่เลือก', t: 'text',   ph: 'ทีมที่แทง (ถ้าเป็นแฮนดิแคป)' },
  { k: 'แฮนดิแคป',   t: 'text',   ph: '-0.5' },
  { k: 'เส้น',       t: 'text',   ph: 'สูงใส่ 2.5 · ต่ำใส่ -2.5' },
  { k: 'ทายสกอร์',   t: 'text',   ph: '1-0' },
  { k: 'ราคา',       t: 'text',   ph: '1.90' },
  { k: 'เงิน',       t: 'text',   ph: '100' }
];

var BET_MARKETS = [
  { v: 'AH',            t: 'แฮนดิแคป' },
  { v: 'OVER_UNDER',    t: 'สูง/ต่ำ' },
  { v: 'DRAW',          t: 'เสมอ' },
  { v: 'CORRECT_SCORE', t: 'สกอร์ตรง' }
];

/* ---------- เลือกคู่จากหน้าแรก แทนการนั่งพิมพ์ ----------
   ลีก/ทีมเหย้า/ทีมเยือน/วันที่/เวลา แอปมันรู้อยู่แล้วจากหน้าแรก ไม่มีเหตุผลให้พิมพ์เอง
   เลือกคู่ทีเดียว 5 ช่องนี้เต็ม เหลือแค่ ตลาด/ราคา/เงิน ที่มีแต่ในบิลเท่านั้น */

function betPickKey_(p) {
  return s_(p['เหย้า']) + '|' + s_(p['เยือน']) + '|' + s_(p['วันที่']);
}

/** คู่ที่เลือกได้ = คู่ปักหมุดขึ้นก่อน แล้วต่อด้วยคู่ในตาราง · คู่ซ้ำเอาตัวแรกพอ */
function betPickList_(data) {
  var src = [], out = [], seen = {}, i, p, k;
  if (data && data.pinned && data.pinned.length) src = src.concat(data.pinned);
  if (data && data.picks && data.picks.length) src = src.concat(data.picks);
  for (i = 0; i < src.length; i++) {
    p = src[i];
    if (!p || !s_(p['เหย้า']) || !s_(p['เยือน'])) continue;
    k = betPickKey_(p);
    if (seen[k]) continue;
    seen[k] = 1;
    out.push(p);
  }
  return out;
}

function betPickLabel_(p) {
  var s = teamTh(p['เหย้า'], p['เหย้าไทย']) + ' VS ' + teamTh(p['เยือน'], p['เยือนไทย']);
  var t = s_(p['เวลาเตะ']);
  return t ? (s + ' · ' + t) : s;
}

/** เลือกคู่แล้วกรอกให้เลย — ทับของเดิมได้ เพราะการกดเลือกคู่ใหม่คือตั้งใจเปลี่ยนคู่ */
function betFormPick(i) {
  var p = BETFORM.picks[Number(i)];
  if (!p) return;
  BETFORM.v['ลีก'] = s_(p['ลีก']);
  BETFORM.v['ทีมเหย้า'] = s_(p['เหย้า']);
  BETFORM.v['ทีมเยือน'] = s_(p['เยือน']);
  BETFORM.v['วันที่'] = s_(p['วันที่']);
  BETFORM.v['เวลา'] = s_(p['เวลาเตะ']);
  BETFORM.msg = 'กรอกคู่ให้แล้ว เหลือ ตลาด/ราคา/เงิน';
  betFormRedraw_();
}

function betFormSet(k, v) { BETFORM.v[k] = v; }
function betFormVal_(k) { return BETFORM.v[k] === undefined ? '' : String(BETFORM.v[k]); }

function betFormField_(f) {
  return '<label class="bf-row"><span class="bf-k">' + esc_(f.k) + '</span>' +
    '<input class="bf-i" type="' + f.t + '" value="' + esc_(betFormVal_(f.k)) + '"' +
    (f.ph ? ' placeholder="' + esc_(f.ph) + '"' : '') +
    ' oninput="betFormSet(\'' + f.k + '\', this.value)"></label>';
}

function betFormHtml(data) {
  BETFORM.picks = betPickList_(data);
  if (!BETFORM.open) {
    return '<div class="bf-bar"><button class="bf-open" onclick="betFormToggle()">＋ ลงบิล</button></div>';
  }
  var opts = BET_MARKETS.map(function (m) {
    var on = betFormVal_('ตลาด') === m.v ? ' selected' : '';
    return '<option value="' + m.v + '"' + on + '>' + m.t + '</option>';
  }).join('');

  /* ไม่มีคู่ให้เลือก (ยังไม่ได้ดึง/เตะไปหมดแล้ว) = ไม่ต้องโชว์ช่องนี้ให้รก */
  var pickBox = '';
  if (BETFORM.picks.length) {
    pickBox = '<label class="bf-row"><span class="bf-k">เลือกคู่</span>' +
      '<select class="bf-i" onchange="betFormPick(this.value)">' +
      '<option value="">— เลือกคู่จากหน้าแรก —</option>' +
      BETFORM.picks.map(function (p, i) {
        return '<option value="' + i + '">' + esc_(betPickLabel_(p)) + '</option>';
      }).join('') +
      '</select></label>';
  }

  return '<div class="bf">' +
    '<div class="bf-head">ลงบิลใหม่</div>' +
    '<label class="bf-shot">🖼 เลือกรูปบิลจากอัลบั้ม' +
      '<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" onchange="betFormShot(this)">' +
    '</label>' +
    pickBox +
    '<label class="bf-row"><span class="bf-k">ตลาด</span>' +
      '<select class="bf-i" onchange="betFormSet(\'ตลาด\', this.value)">' +
      '<option value="">— เลือก —</option>' + opts + '</select></label>' +
    BET_FIELDS.map(betFormField_).join('') +
    (BETFORM.msg ? '<div class="bf-msg">' + esc_(BETFORM.msg) + '</div>' : '') +
    '<div class="bf-btns">' +
      '<button class="bf-save" onclick="betFormSave()"' + (BETFORM.busy ? ' disabled' : '') + '>' +
        (BETFORM.busy ? 'กำลังส่ง…' : 'บันทึกบิล') + '</button>' +
      '<button class="bf-close" onclick="betFormToggle()">ปิด</button>' +
    '</div>' +
  '</div>';
}

/** 1 คู่ = 1 กรอบ แยกกันชัดๆ (บิลย่อยยังอยู่ในกรอบเดียวกับคู่ของมัน)
    ตัดรูปทีละคู่ได้เลย ไม่ต้องมานั่งเล็งเส้นแบ่ง */
function renderMyBet(data, nowMs) {
  var bets = (data && data.bets ? data.bets : []);
  var form = betFormHtml(data);
  if (!bets.length) {
    return form + dosBox_('<div class="slip"><div class="slip-teams">ยังไม่มีบิล</div>' +
      '<div class="slip-kick">กด ＋ ลงบิล แล้วถ่ายรูปสลิปได้เลย</div></div>');
  }
  return form + bets.map(function (b) { return dosBox_(betSlip(b, nowMs)); }).join('');
}

/* ---------- ปุ่มของฟอร์ม ----------
   ส่วนนี้แตะ DOM กับเน็ต เลยไม่มีเทสต์ (เหมือน mount_ ใน app.js) */
function betFormRedraw_() { if (typeof mount_ === 'function') mount_(); }

function betFormToggle() {
  BETFORM.open = !BETFORM.open;
  BETFORM.msg = '';
  betFormRedraw_();
}

/** ถ่ายรูป/เลือกรูป → ส่งให้ Vision อ่าน → เอาที่อ่านได้มากรอกให้ล่วงหน้า
    ของที่อ่านมาได้ทับเฉพาะช่องที่ยังว่าง ที่พิมพ์เองไว้แล้วห้ามทับ */
function betFormShot(input) {
  var f = input && input.files ? input.files[0] : null;
  if (!f) return;
  BETFORM.busy = true; BETFORM.msg = 'กำลังอ่านสลิป…'; betFormRedraw_();
  var rd = new FileReader();
  rd.onload = function () {
    apiPost_('ocr', { image: String(rd.result || '') }).then(function (r) {
      BETFORM.busy = false;
      if (!r || !r.ok) { BETFORM.msg = 'อ่านสลิปไม่ได้: ' + ((r && r.error) || 'ไม่รู้สาเหตุ'); }
      else {
        var got = 0, fl = r.fields || {};
        for (var k in fl) {
          if (!Object.prototype.hasOwnProperty.call(fl, k)) continue;
          if (String(fl[k]) === '') continue;
          if (betFormVal_(k) !== '') continue;
          BETFORM.v[k] = fl[k]; got++;
        }
        BETFORM.msg = got ? ('อ่านมาให้ ' + got + ' ช่อง — ตรวจก่อนกดบันทึก')
                          : 'อ่านสลิปแล้วแต่จับอะไรไม่ได้ กรอกเองได้เลย';
      }
      betFormRedraw_();
    });
  };
  rd.onerror = function () {
    BETFORM.busy = false; BETFORM.msg = 'เปิดไฟล์รูปไม่ได้'; betFormRedraw_();
  };
  rd.readAsDataURL(f);
}

function betFormSave() {
  if (BETFORM.busy) return;
  BETFORM.busy = true; BETFORM.msg = 'กำลังบันทึก…'; betFormRedraw_();
  apiPost_('bet', { bet: BETFORM.v }).then(function (r) {
    BETFORM.busy = false;
    if (!r || !r.ok) { BETFORM.msg = (r && r.error) || 'บันทึกไม่สำเร็จ'; betFormRedraw_(); return; }
    if (r.dup) { BETFORM.msg = r.error || 'บิลนี้ลงไปแล้ว'; betFormRedraw_(); return; }
    BETFORM.open = false; BETFORM.v = {}; BETFORM.msg = '';
    /* ลงแล้วต้องเห็นบิลบนจอทันที ไม่ใช่ให้ไปกดรีเฟรชเอง */
    if (typeof fetchAll_ === 'function') {
      fetchAll_().then(function (fresh) {
        if (fresh && fresh.ok === true) {
          saveCache(fresh);
          if (typeof STATE !== 'undefined') { STATE.data = fresh; STATE.source = 'สด'; STATE.at = Date.now(); }
        }
        betFormRedraw_();
      });
    } else { betFormRedraw_(); }
  });
}


/* ---------- ปุ่มใส่สกอร์ ----------
   ส่วนนี้แตะ DOM กับเน็ต เลยไม่มีเทสต์ (เหมือน betFormSave) */
function scoreOpen(id) {
  SCOREFORM = { id: String(id || ''), h: '', a: '', busy: false, msg: '' };
  betFormRedraw_();
}
function scoreClose() {
  SCOREFORM = { id: '', h: '', a: '', busy: false, msg: '' };
  betFormRedraw_();
}
function scoreSet(k, v) { SCOREFORM[k] = String(v || '').replace(/[^0-9]/g, ''); }

function scoreSave() {
  if (SCOREFORM.busy) return;
  if (SCOREFORM.h === '' || SCOREFORM.a === '') {
    SCOREFORM.msg = 'ใส่สกอร์ทั้งสองฝั่งก่อน'; betFormRedraw_(); return;
  }
  SCOREFORM.busy = true; SCOREFORM.msg = 'กำลังลง…'; betFormRedraw_();
  apiPost_('score', { id: SCOREFORM.id, h: SCOREFORM.h, a: SCOREFORM.a }).then(function (r) {
    SCOREFORM.busy = false;
    if (!r || !r.ok) { SCOREFORM.msg = (r && r.error) || 'ลงผลไม่สำเร็จ'; betFormRedraw_(); return; }
    if (!r['ลง']) {
      SCOREFORM.msg = 'ลงไม่ได้ — ' + ((r['ข้าม'] || []).join(' · ') || 'คิดผลจากบิลนี้ไม่ได้');
      betFormRedraw_(); return;
    }
    scoreClose();
    if (typeof fetchAll_ === 'function') {
      fetchAll_().then(function (fresh) {
        if (fresh && fresh.ok === true) {
          saveCache(fresh);
          if (typeof STATE !== 'undefined') { STATE.data = fresh; STATE.source = 'สด'; STATE.at = Date.now(); }
        }
        betFormRedraw_();
      });
    }
  });
}
