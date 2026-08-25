/* page-ledger.js — หน้า 3: สรุปยอดรวม + กราฟกำไรสะสม
   กราฟวาดเป็น SVG เองทั้งหมด ไม่พึ่ง lib — จะได้ไม่มีอะไรต้องโหลดจากเน็ต */
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

function ledgerRow_(b) {
  return '<div class="lg-row">' +
    '<div class="lg-left">' +
      '<div>' + esc_(teamTh(b['เหย้า'], b['เหย้าไทย'])) + ' พบ ' +
                esc_(teamTh(b['เยือน'], b['เยือนไทย'])) + '</div>' +
      '<div class="muted">' + esc_(thDate(b['เวลาเตะ'])) + ' · ' + esc_(marketLine(b)) + '</div>' +
    '</div>' +
    '<div class="lg-right ' + (Number(b['รวมกำไร']) < 0 ? 'neg' : 'pos') + '">' +
      esc_(fmtSigned(b['รวมกำไร'])) +
    '</div>' +
  '</div>';
}

function renderLedger(data) {
  var lg = (data && data.ledger) ? data.ledger : {};
  var bets = (data && data.bets ? data.bets : []).slice();
  bets.sort(function (a, b) {
    return (Date.parse(b['เวลาเตะ']) || 0) - (Date.parse(a['เวลาเตะ']) || 0);
  });

  var profit = Number(lg['กำไรสะสม']) || 0;
  var head = '<div class="card">' +
    '<div class="muted">กำไรสะสม</div>' +
    '<div class="lg-big ' + (profit < 0 ? 'neg' : 'pos') + '">' + esc_(fmtSigned(profit)) + '</div>' +
    curveSvg(lg['เส้นกราฟ'], 320, 90) +
    '<div class="row"><span class="muted">ลงไปทั้งหมด</span><span>' +
      esc_(fmtMoney(lg['ลงไปทั้งหมด'])) + '</span></div>' +
    '<div class="row"><span class="muted">จำนวนใบที่รู้ผลแล้ว</span><span>' +
      esc_(String(lg['จำนวนใบ'] === undefined ? 0 : lg['จำนวนใบ'])) + '</span></div>' +
    '<div class="row"><span class="muted">อัตราชนะ</span><span>' +
      esc_(rateText_(lg['อัตราชนะ'])) + '</span></div>' +
  '</div>';

  var list = bets.length
    ? '<div class="card">' + bets.map(ledgerRow_).join('') + '</div>'
    : '<div class="card"><div class="muted">ยังไม่มีบิล</div></div>';

  return head + list;
}
