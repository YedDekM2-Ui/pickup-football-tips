/* page-ledger.js — หน้า 3: สรุปยอดรวม + กราฟกำไรสะสม + รายการบิลทุกใบ
   กราฟวาดเป็น SVG เองทั้งหมด ไม่พึ่ง lib — จะได้ไม่มีอะไรต้องโหลดจากเน็ต
   หน้านี้คือที่เดียวที่โชว์ยอดเงิน (OCR อ่านยอดมาก็ลงที่นี่) */
'use strict';

function segColor(v) { return Number(v) < 0 ? 'var(--red)' : 'var(--green)'; }

function curveSvg(points, w, h) {
  var pts = points || [];
  if (!pts.length) return '';

  var vals = pts.map(function (p) { return Number(p['สะสม']) || 0; });
  var hi = Math.max.apply(null, vals.concat([0]));
  var lo = Math.min.apply(null, vals.concat([0]));
  var span = (hi - lo) || 1;              // เส้นแบน = ไม่หารด้วยศูนย์
  var pad = 6;
  var innerH = h - pad * 2;

  function y_(v) { return pad + (hi - v) / span * innerH; }
  function x_(i) { return pts.length === 1 ? w / 2 : (i / (pts.length - 1)) * w; }

  var zeroY = y_(0).toFixed(1);
  var parts = ['<line x1="0" y1="' + zeroY + '" x2="' + w + '" y2="' + zeroY +
               '" stroke="#3a4150" stroke-width="1" stroke-dasharray="4 4"/>'];

  if (pts.length === 1) {
    var cx = x_(0).toFixed(1), cy = y_(vals[0]).toFixed(1);
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + segColor(vals[0]) + '"/>');
  } else {
    for (var i = 1; i < pts.length; i++) {
      parts.push('<line x1="' + x_(i - 1).toFixed(1) + '" y1="' + y_(vals[i - 1]).toFixed(1) +
                 '" x2="' + x_(i).toFixed(1) + '" y2="' + y_(vals[i]).toFixed(1) +
                 '" stroke="' + segColor(vals[i]) + '" stroke-width="2" stroke-linecap="round"/>');
    }
  }

  return '<svg class="curve" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h +
         '" preserveAspectRatio="none">' + parts.join('') + '</svg>';
}

function rateText_(r) {
  if (r === null || r === undefined || r === '') return '—';
  var v = Number(r);
  if (isNaN(v)) return '—';
  return Math.round(v * 1000) / 10 + '%';
}

/* ---- จัดกลุ่มตามเดือน (คิดเป็นเวลาไทยเสมอ) ---- */

function monthKey_(iso) {
  var d = thShift_(iso);
  if (!d) return '?';
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1);
}

function monthText_(iso) {
  var d = thShift_(iso);
  if (!d) return 'ไม่รู้เดือน';
  return TH_MONTH[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear() + 543).slice(-2);
}

/** ชื่อบรรทัดบิล — เอาเฉพาะฝั่งที่เลือก ไม่เอาชื่อทีมขึ้นทั้งคู่
    ตลาดที่ไม่มีฝั่ง (สูง/ต่ำ เสมอ สกอร์ตรง) และไม่ได้ระบุทีมที่เลือก
    ถึงจะตกมาใช้ชื่อคู่ ไม่งั้นจะไม่รู้ว่าบิลนี้ของคู่ไหน */
function ledgerTitle_(b) {
  var m = marketLine(b);
  if (b['ตลาด'] === 'AH') return m;                 // marketLine มีชื่อฝั่งที่เลือกอยู่ในตัวแล้ว
  var side = teamTh(b['ทีมที่เลือก'], b['ทีมที่เลือกไทย']);
  if (side) return side + ' · ' + m;
  return teamTh(b['เหย้า'], b['เหย้าไทย']) + ' VS ' +
         teamTh(b['เยือน'], b['เยือนไทย']) + ' · ' + m;
}

function ledgerSub_(s) {
  return '<div class="lg-sub">' +
    '<span class="lg-sub-m">' + esc_(marketLine(s)) + '</span>' +
    '<span class="lg-sub-p ' + (Number(s['กำไร']) < 0 ? 'neg' : 'pos') + '">' +
      esc_(fmtSigned(s['กำไร'])) +
    '</span>' +
  '</div>';
}

function ledgerRow_(b, no) {
  var subs = (b.subs || []).map(ledgerSub_).join('');
  return '<div class="lg-row">' +
    '<div class="lg-left">' +
      '<div class="lg-when">' +
        '<span class="lg-no">#' + esc_(String(no)) + '</span>' +
        esc_(thDate(b['เวลาเตะ'])) + ' · ' + esc_(thTime(b['เวลาเตะ'])) +
      '</div>' +
      '<div class="lg-pick">' + esc_(ledgerTitle_(b)) + '</div>' +
      subs +
    '</div>' +
    '<div class="lg-right ' + (Number(b['รวมกำไร']) < 0 ? 'neg' : 'pos') + '">' +
      esc_(fmtSigned(b['รวมกำไร'])) +
    '</div>' +
  '</div>';
}

/** บิลเรียงใหม่สุดขึ้นก่อนอยู่แล้ว → เลขในเดือนจึงไล่จากมากลงน้อย
    ใบบนสุดของเดือน = จำนวนบิลทั้งเดือน อ่านปุ๊บรู้เลยว่าเดือนนี้แทงไปกี่ใบ */
function ledgerGroups_(bets) {
  var out = [], i = 0;
  while (i < bets.length) {
    var key = monthKey_(bets[i]['เวลาเตะ']), j = i;
    while (j < bets.length && monthKey_(bets[j]['เวลาเตะ']) === key) j++;
    var n = j - i;
    out.push('<div class="lg-month">' + esc_(monthText_(bets[i]['เวลาเตะ'])) +
             ' · ' + n + ' บิล</div>');
    for (var k = 0; k < n; k++) out.push(ledgerRow_(bets[i + k], n - k));
    i = j;
  }
  return out.join('');
}

/** นับบิลทั้งหมดจริงๆ รวมบิลย่อย และรวมใบที่ยังไม่รู้ผล
    ('จำนวนใบ' ที่เซิร์ฟเวอร์ส่งมานับเฉพาะใบที่รู้ผลแล้ว — คนละความหมาย เลยแยกบรรทัด settled */
function billCount_(bets) {
  var n = 0;
  for (var i = 0; i < (bets || []).length; i++) n += 1 + ((bets[i].subs || []).length);
  return n;
}

/** กำไรคิดเป็นกี่ % ของต้นทุน = ช่อง % ขึ้นลงแบบแอปหุ้น
    ยังไม่ลงเงินเลย = ขีด ห้ามหารศูนย์ */
function roiText_(profit, cost) {
  var c = Number(cost) || 0;
  if (!(c > 0)) return '—';
  var pct = (Number(profit) || 0) / c * 100;
  return (pct < 0 ? '▼ ' : '▲ ') + (Math.round(Math.abs(pct) * 10) / 10) + '%';
}

function stkCell_(k, v, note) {
  return '<div class="stk-cell">' +
    '<div class="stk-k">' + esc_(k) + '</div>' +
    '<div class="stk-v">' + esc_(v) + '</div>' +
    (note ? '<div class="stk-note">' + esc_(note) + '</div>' : '') +
  '</div>';
}

function renderLedger(data) {
  var lg = (data && data.ledger) ? data.ledger : {};
  var bets = (data && data.bets ? data.bets : []).slice();
  bets.sort(function (a, b) {
    return (Date.parse(b['เวลาเตะ']) || 0) - (Date.parse(a['เวลาเตะ']) || 0);
  });

  var profit = Number(lg['กำไรสะสม']) || 0;
  var cost = Number(lg['ลงไปทั้งหมด']) || 0;
  var settled = lg['จำนวนใบ'] === undefined ? 0 : Number(lg['จำนวนใบ']);
  var cls = profit < 0 ? 'neg' : 'pos';
  var head = '<div class="card stk">' +
    '<div class="stk-cap">TOTAL P/L</div>' +
    '<div class="stk-val ' + cls + '">' + esc_(fmtSigned(profit)) + '</div>' +
    '<div class="stk-delta ' + cls + '">ROI ' + esc_(roiText_(profit, cost)) + '</div>' +
    curveSvg(lg['เส้นกราฟ'], 320, 90) +
    '<div class="stk-grid">' +
      stkCell_('BILLS', String(billCount_(bets)), settled + ' settled') +
      stkCell_('COST', fmtMoney(cost), '') +
      stkCell_('WIN RATE', rateText_(lg['อัตราชนะ']), '') +
    '</div>' +
  '</div>';

  var list = bets.length
    ? '<div class="card">' + ledgerGroups_(bets) + '</div>'
    : '<div class="card"><div class="muted">ยังไม่มีบิล</div></div>';

  return head + list;
}
