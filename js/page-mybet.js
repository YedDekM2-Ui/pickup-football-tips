/* page-mybet.js — หน้า 2: สลิปของเราเอง ธีมดอสเขียว
   กฎเหล็ก (สเปกข้อ 10): หน้านี้ห้ามโชว์ Bet ID / เปอร์เซ็นต์ / สกอร์ที่ Forebet เดา /
   บทวิเคราะห์ / อะไรที่พูดถึง OCR-เทเลแกรม-ชีต
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
    '<span class="sub-b">' + esc_(fmtMoney(s['เงิน'])) + '</span> ' +
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
    ? '<div class="slip-sum">รวม ' + esc_(fmtMoney(b['รวมเงิน'])) + ' → ' +
      '<b>' + esc_(fmtSigned(b['รวมกำไร'])) + '</b></div>'
    : '';

  return '' +
    '<div class="slip">' +
      '<div class="slip-top">' + esc_(b['ลีก']) + ' · ' + esc_(thDate(b['เวลาเตะ'])) + '</div>' +
      '<div class="slip-teams">' + home + ' พบ ' + away + '</div>' +
      score +
      '<div class="slip-kick">' + esc_(thTime(b['เวลาเตะ'])) + ' · ' +
        esc_(countdownText(b['เวลาเตะ'], b['สถานะ'], nowMs)) + '</div>' +
      '<div class="main">' +
        '<span class="main-m">' + esc_(marketLine(b)) + '</span> ' +
        '<span class="main-o">@' + esc_(fmtOdds(b['ราคา'])) + '</span> ' +
        '<span class="main-b">' + esc_(fmtMoney(b['เงิน'])) + '</span> ' +
        resultBadge(b['ผล']) +
        '<span class="main-p">' + esc_(fmtSigned(b['กำไร'])) + '</span>' +
      '</div>' +
      subs +
      sum +
    '</div>';
}

function renderMyBet(data, nowMs) {
  var bets = (data && data.bets ? data.bets : []);
  var body = bets.length
    ? bets.map(function (b) { return betSlip(b, nowMs); }).join('')
    : '<div class="slip"><div class="slip-teams">ยังไม่มีบิล</div>' +
      '<div class="slip-kick">ส่งสลิปเข้าบอทหรือกรอกเองได้เลย</div></div>';
  return '<div class="dos-wrap"><div class="dos-mark">Pickup</div>' + body + '</div>';
}
