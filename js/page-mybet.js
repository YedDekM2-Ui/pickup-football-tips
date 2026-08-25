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
    '</div>';
}

function dosBox_(inner) {
  return '<div class="dos-wrap"><div class="dos-mark">Pickup</div>' + inner + '</div>';
}

/** 1 คู่ = 1 กรอบ แยกกันชัดๆ (บิลย่อยยังอยู่ในกรอบเดียวกับคู่ของมัน)
    ตัดรูปทีละคู่ได้เลย ไม่ต้องมานั่งเล็งเส้นแบ่ง */
function renderMyBet(data, nowMs) {
  var bets = (data && data.bets ? data.bets : []);
  if (!bets.length) {
    return dosBox_('<div class="slip"><div class="slip-teams">ยังไม่มีบิล</div>' +
      '<div class="slip-kick">ส่งสลิปเข้าบอทหรือกรอกเองได้เลย</div></div>');
  }
  return bets.map(function (b) { return dosBox_(betSlip(b, nowMs)); }).join('');
}
