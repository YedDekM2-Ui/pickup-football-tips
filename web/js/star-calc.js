/* star-calc.js — สูตรแกะดาวปฏิทินโหร 100 ปี → เลขแยกหลัก (คำนวณล้วน เทสต์ใน node ได้)
   หลักการ: แต่ละ "วิธีค้น" ให้ชุดเลขพร้อมเหตุผล → รวมคะแนนแยกตำแหน่ง
            น้ำหนักของแต่ละวิธีในแต่ละหลัก = วัดจากของจริงย้อนหลัง (ดวงวันนั้น เทียบผลที่ออกวันนั้น)
            วิธีไหนเข้าหลักไหนบ่อย ก็ได้น้ำหนักหลักนั้นมาก — ยิ่งส่งรูปมาก ยิ่งแม่นตามของจริง
   เลข: 1 อาทิตย์ 2 จันทร์ 3 อังคาร 4 พุธ 5 พฤหัส 6 ศุกร์ 7 เสาร์ 8 ราหู 9 เกตุ 0 มฤตยู */
'use strict';

var SC_PL = { '1': 'อาทิตย์', '2': 'จันทร์', '3': 'อังคาร', '4': 'พุธ', '5': 'พฤหัส',
              '6': 'ศุกร์', '7': 'เสาร์', '8': 'ราหู', '9': 'เกตุ', '0': 'มฤตยู' };
var SC_RASI = ['เมษ', 'พฤษภ', 'เมถุน', 'กรกฎ', 'สิงห์', 'กันย์', 'ตุลย์', 'พิจิก', 'ธนู', 'มังกร', 'กุมภ์', 'มีน'];
/* เจ้าเรือน (ตำราไทย: กุมภ์ = ราหู) */
var SC_LORD = ['3', '6', '4', '2', '1', '4', '6', '3', '5', '7', '8', '5'];
/* เกษตร (อยู่บ้านตัวเอง) และ อุจ (กำลังสูงสุด) */
var SC_OWN = { '1': [4], '2': [3], '3': [0, 7], '4': [2, 5], '5': [8, 11], '6': [1, 6], '7': [9, 10], '8': [10] };
var SC_EXALT = { '1': 0, '2': 1, '3': 9, '4': 5, '5': 3, '6': 11, '7': 6, '8': 7 };
var SC_ENEMY = [['1', '5'], ['2', '5'], ['3', '6'], ['4', '8']];
var SC_DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
var SC_ZOD = ['ชวด', 'ฉลู', 'ขาล', 'เถาะ', 'มะโรง', 'มะเส็ง', 'มะเมีย', 'มะแม', 'วอก', 'ระกา', 'จอ', 'กุน'];

/* หวยลาว ออก 20:30 (พุธ = กลางคืน) · หวยไทย ออก ~16:00 (พุธ = กลางวัน) */
var SC_KIND = {
  /* เจ้าของสั่ง 16 ต.ค. 69: ลาวคิดจาก 4 ตัวเหมือนไทย แล้วแยกบน/ล่างให้ชัด
     4 ตัว ABCD → บน = 3 ตัวบน BCD · 2 ตัวบน CD · ล่าง = 2 ตัวล่าง AB (ตามตารางลาวพัฒนา "225-92") */
  lao: { name: 'หวยลาว', pos: ['พัน', 'ร้อย', 'สิบ', 'หน่วย'], night: true,
         tag: ['ล่าง', 'บน·ล่าง', 'บน', 'บน'],
         sets: [['4 ตัว', [0, 1, 2, 3]], ['3 ตัวบน', [1, 2, 3]], ['2 ตัวบน', [2, 3]], ['2 ตัวล่าง', [0, 1]]] },
  thai: { name: 'หวยไทย', pos: ['พัน', 'ร้อย', 'สิบ', 'หน่วย', 'ล่างสิบ', 'ล่างหน่วย'], night: false,
          tag: ['บน', 'บน', 'บน', 'บน', 'ล่าง', 'ล่าง'],
          /* เจ้าของสั่ง 16 ต.ค. 69: หวยไทยคิดเฉพาะ 4 ตัวบน + 2 ตัวล่าง เท่านั้น */
          sets: [['4 ตัวบน', [0, 1, 2, 3]], ['2 ตัวล่าง', [4, 5]]] }
};
/* กาลกิณีดับแรงที่หลักสิบ-หน่วย หลักร้อยยังโผล่ได้ (ตามตำรา "สูตรดับบน-ดับล่าง") */
var SC_KAL_POSW = { 'พัน': 0.4, 'ร้อย': 0.5, 'สิบ': 1, 'หน่วย': 1, 'ล่างสิบ': 1, 'ล่างหน่วย': 1 };

var SC_METHODS = [
  ['day', 'ดาวประจำวัน'], ['conj', 'ดาวกุมกัน'], ['lagna', 'ลัคนา'], ['moon', 'จันทร์จร'],
  ['power', 'ดาวมีกำลัง/ดาวย้าย'], ['center', 'เลขกลางดวง'], ['lunar', 'ข้างขึ้น-แรม'],
  ['date', 'เลขวันที่'], ['stat', 'สถิติหลักนี้'], ['prev', 'งวดก่อน']
];

/* ---------------- วันที่ ---------------- */
function scYmd_(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? [+m[1], +m[2], +m[3]] : null; }
function scWd_(iso) { var a = scYmd_(iso); return new Date(Date.UTC(a[0], a[1] - 1, a[2])).getUTCDay(); }
function scJdn_(iso) {
  var a = scYmd_(iso), y = a[0], m = a[1], d = a[2];
  var k = Math.floor((14 - m) / 12), y2 = y + 4800 - k, m2 = m + 12 * k - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}
function scAddDays_(iso, n) {
  var a = scYmd_(iso), t = new Date(Date.UTC(a[0], a[1] - 1, a[2] + n));
  return t.toISOString().slice(0, 10);
}
/** นักษัตรประจำวัน (ปฏิทินจีน) — 0 = ชวด · เทียบแล้ว 1 ม.ค. 2000 = วันมะเมีย */
function scDayBranch_(iso) { return ((scJdn_(iso) + 49) % 60) % 12; }

/** จันทรคติโดยประมาณ (ยึด 12 ต.ค. 2569 = ขึ้น 1 ค่ำ เดือน 11 จากรูปเจ้าของ) — แก้เองได้ในหน้าแอป */
function scLunarGuess_(iso) {
  var SYN = 29.530588, age = (scJdn_(iso) - scJdn_('2026-10-12')) % SYN;
  var months = Math.floor((scJdn_(iso) - scJdn_('2026-10-12')) / SYN);
  if (age < 0) age += SYN;
  var month = ((11 - 1 + months) % 12 + 12) % 12 + 1;
  if (age < 14.77) return { side: 'ขึ้น', day: Math.floor(age) + 1, month: month };
  return { side: 'แรม', day: Math.min(15, Math.round(age - 15) + 1), month: month };
}
function scLunarParse_(s) {
  var t = String(s || '').replace(/[๐-๙]/g, function (c) { return String(c.charCodeAt(0) - 0x0E50); });
  var m = /(ขึ้น|แรม)\s*(\d+)\s*ค่ำ(?:\s*เดือน\s*(\d+))?/.exec(t);
  return m ? { side: m[1], day: +m[2], month: m[3] ? +m[3] : 0 } : null;
}
function scLunarText_(l) { return l ? (l.side + ' ' + l.day + ' ค่ำ' + (l.month ? ' เดือน ' + l.month : '')) : ''; }

/* ---------------- ดาวประจำวัน / เลขเสียตามวัน ---------------- */
function scDayStar_(wd, night) { return (wd === 3 && night) ? '8' : String(wd + 1); }
function scKalakini_(wd, night) { return ['6', '1', '2', night ? '5' : '3', '8', '7', '4'][wd]; }
/** แนวโน้มคู่/คี่ตามวัน (ตารางในสูตร) */
function scParity_(wd) {
  if (wd === 0 || wd === 2) return { kind: 'คี่', fav: ['1', '3', '5', '9'], text: 'วัน' + SC_DAY[wd] + ' เด่นเลขคี่' };
  if (wd === 1 || wd === 3 || wd === 5) return { kind: 'คู่', fav: ['2', '4', '6', '8'], text: 'วัน' + SC_DAY[wd] + ' เด่นเลขคู่' };
  if (wd === 4) return { kind: 'ผสม', fav: ['5', '4', '7'], text: 'วันพฤหัสบดี ผสม เด่น 5 4 7' };
  return { kind: 'คี่', fav: ['7', '3', '8'], text: 'วันเสาร์ เลขแรง เด่น 7 3 8' };
}

/* ---------------- ผลหวย → เลขแยกหลัก ---------------- */
function scDigits_(kind, row) {
  if (!row) return null;
  var s = kind === 'thai' ? String(row[1] || '') + String(row[2] || '') : String(row[1] || '');
  var n = SC_KIND[kind].pos.length;
  if (!new RegExp('^\\d{' + n + '}$').test(s)) return null;
  return s.split('');
}
function scResultMap_(kind, rows) {
  var m = {};
  (rows || []).forEach(function (r) { var d = scDigits_(kind, r); if (d) m[r[0]] = d; });
  return m;
}

/* ---------------- ตำแหน่งดาว ---------------- */
function scLoc_(chart) {
  var loc = {};
  (chart.rasi || []).forEach(function (cell, i) { (cell || []).forEach(function (d) { loc[String(d)] = i; }); });
  return loc;
}
function scNames_(list) { return list.map(function (d) { return SC_PL[d] + '(' + d + ')'; }).join(' '); }

/** ตัวสะสมคะแนน {digit: {s, why:[]}} */
function scBag_() {
  var b = {};
  return {
    add: function (d, s, why) {
      d = String(d); if (!/^[0-9]$/.test(d)) return;
      if (!b[d]) b[d] = { s: 0, why: [] };
      b[d].s += s; if (why && b[d].why.indexOf(why) < 0) b[d].why.push(why);
    },
    out: b
  };
}

/* ---------------- วิธีค้น (ไม่ผูกตำแหน่ง) ---------------- */
function scMethods_(ctx) {
  var ch = ctx.chart, loc = scLoc_(ch), res = {}, i;
  var cells = ch.rasi || [];
  function M(k) { res[k] = scBag_(); return res[k]; }

  /* 1) ดาวประจำวัน + ดาวที่กุม/เล็ง/ตรีโกณ กับดาววัน */
  var b = M('day'), D = ctx.dayStar;
  b.add(D, 1, 'เลขดาวประจำวัน' + SC_DAY[ctx.wd] + (ctx.wd === 3 && ctx.night ? 'กลางคืน (ราหู)' : '') + ' = ' + D);
  if (loc[D] !== undefined) {
    var r0 = loc[D];
    (cells[r0] || []).forEach(function (x) { if (x !== D) b.add(x, 0.8, SC_PL[x] + ' กุมดาววัน (' + SC_PL[D] + ') ใน' + SC_RASI[r0]); });
    (cells[(r0 + 6) % 12] || []).forEach(function (x) { b.add(x, 0.6, SC_PL[x] + ' เล็งดาววัน จาก' + SC_RASI[(r0 + 6) % 12]); });
    [4, 8].forEach(function (k) {
      (cells[(r0 + k) % 12] || []).forEach(function (x) { b.add(x, 0.4, SC_PL[x] + ' ตรีโกณดาววัน (' + SC_RASI[(r0 + k) % 12] + ')'); });
    });
  }

  /* 2) ดาวกุมกัน — เรือนเดียวกันมีหลายดวง พลังเบิ้ล */
  b = M('conj');
  cells.forEach(function (cell, r) {
    if ((cell || []).length < 2) return;
    cell.forEach(function (x) { b.add(x, 0.4 * (cell.length - 1), 'กุมกันใน' + SC_RASI[r] + ': ' + scNames_(cell)); });
  });

  /* 3) ลัคนา */
  b = M('lagna');
  if (ch.lagna >= 0) {
    var L = ch.lagna;
    b.add(SC_LORD[L], 0.8, 'เจ้าเรือนลัคนา' + SC_RASI[L] + ' = ' + SC_PL[SC_LORD[L]]);
    (cells[L] || []).forEach(function (x) { b.add(x, 1, SC_PL[x] + ' อยู่กับลัคนา (' + SC_RASI[L] + ')'); });
    (cells[(L + 6) % 12] || []).forEach(function (x) { b.add(x, 0.4, SC_PL[x] + ' เล็งลัคนา'); });
    b.add((L + 1) % 10, 0.5, 'ลัคนาราศีที่ ' + (L + 1));
  }

  /* 4) จันทร์จร — ดาวเร็วสุด เปลี่ยนทุก 2 วัน */
  b = M('moon');
  if (loc['2'] !== undefined) {
    var mr = loc['2'];
    b.add((mr + 1) % 10, 0.7, 'จันทร์อยู่ราศีที่ ' + (mr + 1) + ' (' + SC_RASI[mr] + ')');
    b.add(SC_LORD[mr], 0.6, 'เจ้าเรือนที่จันทร์อยู่ = ' + SC_PL[SC_LORD[mr]]);
    (cells[mr] || []).forEach(function (x) { if (x !== '2') b.add(x, 0.8, SC_PL[x] + ' กุมจันทร์ใน' + SC_RASI[mr]); });
    (cells[(mr + 6) % 12] || []).forEach(function (x) { b.add(x, 0.5, SC_PL[x] + ' เล็งจันทร์'); });
  }

  /* 5) ดาวมีกำลัง (อุจ/เกษตร) + ดาวย้ายวันนี้ */
  b = M('power');
  Object.keys(loc).forEach(function (d) {
    if (SC_EXALT[d] === loc[d]) b.add(d, 0.9, SC_PL[d] + ' อุจ (กำลังสูงสุด) ใน' + SC_RASI[loc[d]]);
    if (SC_OWN[d] && SC_OWN[d].indexOf(loc[d]) >= 0) b.add(d, 0.6, SC_PL[d] + ' เกษตร (อยู่บ้านตัวเอง) ใน' + SC_RASI[loc[d]]);
  });
  var mv = String(ch.moved || '');
  Object.keys(SC_PL).forEach(function (d) {
    if (mv.indexOf(SC_PL[d]) >= 0) b.add(d, 1, SC_PL[d] + ' ย้ายราศีวันนี้');
  });

  /* 6) เลขกลางดวง เช่น 27/24 */
  b = M('center');
  var cm = /^(\d+)\/(\d+)$/.exec(String(ch.center || ''));
  if (cm) {
    var A = +cm[1], B = +cm[2];
    String(A).split('').forEach(function (x) { b.add(x, 0.5, 'เลขกลางดวงบน ' + A); });
    String(B).split('').forEach(function (x) { b.add(x, 0.5, 'เลขกลางดวงล่าง ' + B); });
    b.add((A + B) % 10, 0.8, 'กลางดวง ' + A + '+' + B + ' = ' + (A + B));
    b.add(Math.abs(A - B) % 10, 0.5, 'กลางดวง ' + A + '−' + B + ' = ' + Math.abs(A - B));
  }

  /* 7) ข้างขึ้น-แรม */
  b = M('lunar');
  var lu = ctx.lunar;
  if (lu) {
    b.add(lu.day % 10, 1, lu.side + ' ' + lu.day + ' ค่ำ');
    if (lu.day >= 10) b.add(Math.floor(lu.day / 10) + lu.day % 10, 0.5, 'ผลรวมค่ำ ' + lu.day);
    if (lu.month) b.add(lu.month % 10, 0.5, 'เดือน ' + lu.month + ' จันทรคติ');
  }

  /* 8) เลขวันที่ (วันออก) */
  b = M('date');
  var ymd = scYmd_(ctx.iso), dd = ymd[2], mm = ymd[1], be = ymd[0] + 543;
  b.add(dd % 10, 0.8, 'วันที่ ' + dd);
  if (dd >= 10) b.add(Math.floor(dd / 10), 0.4, 'วันที่ ' + dd);
  b.add((dd + mm) % 10, 0.6, 'วัน+เดือน ' + dd + '+' + mm);
  var sum = String(dd) + mm + be, t = 0;
  for (i = 0; i < sum.length; i++) t += +sum[i];
  b.add(t % 10, 0.5, 'ผลรวมเลข ' + dd + '/' + mm + '/' + be + ' = ' + t);

  var out = {};
  Object.keys(res).forEach(function (k) { out[k] = res[k].out; });
  return out;
}

/* ---------------- วิธีค้นที่ผูกตำแหน่ง (สถิติ / งวดก่อน) ---------------- */
function scPosMethods_(kind, iso, results) {
  var dates = Object.keys(results).filter(function (d) { return d < iso; }).sort();
  var npos = SC_KIND[kind].pos.length, stat = [], prev = [], p;
  var last30 = dates.slice(-30), last = dates.length ? results[dates[dates.length - 1]] : null;
  for (p = 0; p < npos; p++) {
    var cnt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    last30.forEach(function (d) { cnt[+results[d][p]]++; });
    var order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(function (a, b) { return cnt[b] - cnt[a] || a - b; });
    var sb = scBag_();
    if (last30.length >= 8) {
      [1, 0.7, 0.5].forEach(function (s, k) {
        sb.add(order[k], s, 'หลักนี้ออกบ่อย ' + cnt[order[k]] + '/' + last30.length + ' งวดหลัง');
      });
    }
    stat.push(sb.out);
    var pb = scBag_();
    if (last) {
      pb.add(last[p], 1, 'งวดก่อนหลักนี้ออก ' + last[p]);
      last.forEach(function (x, q) { if (q !== p) pb.add(x, 0.3, 'อยู่ในเลขงวดก่อน ' + last.join('')); });
    }
    prev.push(pb.out);
  }
  return { stat: stat, prev: prev };
}

/* ---------------- บริบทของงวด ---------------- */
function scCtx_(kind, chart, iso, results) {
  var wd = scWd_(iso), night = SC_KIND[kind].night;
  var lunar = scLunarParse_(chart.lunar) || scLunarGuess_(chart.date || iso);
  return { kind: kind, chart: chart, iso: iso, wd: wd, night: night, lunar: lunar,
           dayStar: scDayStar_(wd, night), results: results || {} };
}

/** คะแนนของทุกวิธีในทุกตำแหน่ง → {k: [ {digit:{s,why}} x npos ]} */
function scAllMethods_(ctx) {
  var free = scMethods_(ctx), pm = scPosMethods_(ctx.kind, ctx.iso, ctx.results);
  var npos = SC_KIND[ctx.kind].pos.length, out = {};
  Object.keys(free).forEach(function (k) {
    out[k] = []; for (var p = 0; p < npos; p++) out[k].push(free[k]);
  });
  out.stat = pm.stat; out.prev = pm.prev;
  return out;
}

/* ---------------- เลขเสีย ---------------- */
function scDead_(ctx) {
  var dead = [], loc = scLoc_(ctx.chart);
  var K = scKalakini_(ctx.wd, ctx.night);
  dead.push({ d: K, w: 1.2, why: 'กาลกิณีวัน' + SC_DAY[ctx.wd] + (ctx.wd === 3 ? (ctx.night ? 'กลางคืน' : 'กลางวัน') : '') + ' (' + SC_PL[K] + ')', kal: true });
  SC_ENEMY.forEach(function (pr) {
    if (loc[pr[0]] !== undefined && loc[pr[0]] === loc[pr[1]]) {
      var w = 'คู่ศัตรู ' + pr.join('-') + ' อยู่เรือนเดียวกัน (' + SC_RASI[loc[pr[0]]] + ')';
      dead.push({ d: pr[0], w: 0.4, why: w }); dead.push({ d: pr[1], w: 0.4, why: w });
    }
  });
  var br = scDayBranch_(ctx.iso), cl = (br + 6) % 12;
  dead.push({ d: String((cl + 1) % 10), w: 0.5, why: 'วัน' + SC_ZOD[br] + ' ชง' + SC_ZOD[cl] + ' (เลข' + SC_ZOD[cl] + ' = ' + (cl + 1) + ')' });
  return dead;
}

/* ---------------- น้ำหนักจากของจริง ---------------- */
/**
 * วัดว่าแต่ละวิธีเข้าแต่ละหลักแค่ไหน จากดวงที่มีผลออกวันเดียวกัน (ก่อน untilIso)
 * w = (คะแนนที่ตกตรงเลขจริง + 1) / (คะแนนที่คาดว่าจะตกถ้าสุ่ม + 1) · 1 = เท่าสุ่ม
 */
function scWeights_(kind, charts, results, untilIso) {
  var npos = SC_KIND[kind].pos.length, acc = {}, n = 0;
  SC_METHODS.forEach(function (m) { acc[m[0]] = []; for (var p = 0; p < npos; p++) acc[m[0]].push({ hit: 0, exp: 0, top: 0, k: 0 }); });
  (charts || []).forEach(function (c) {
    if (untilIso && c.date >= untilIso) return;
    if (!scFits_(c, kind)) return;
    var real = results[c.date];
    if (!real) return;
    n++;
    var all = scAllMethods_(scCtx_(kind, c, c.date, results));
    SC_METHODS.forEach(function (m) {
      for (var p = 0; p < npos; p++) {
        var bag = all[m[0]][p] || {}, tot = 0, best = null;
        Object.keys(bag).forEach(function (d) { tot += bag[d].s; if (!best || bag[d].s > bag[best].s) best = d; });
        var a = acc[m[0]][p];
        a.hit += bag[real[p]] ? bag[real[p]].s : 0;
        a.exp += tot / 10;
        if (best !== null) { a.k++; if (best === real[p]) a.top++; }
      }
    });
  });
  var w = {};
  SC_METHODS.forEach(function (m) {
    w[m[0]] = acc[m[0]].map(function (a) {
      var v = (a.hit + 1) / (a.exp + 1);
      return { w: Math.max(0.3, Math.min(3, v)), hit: a.hit, exp: a.exp, top: a.top, k: a.k };
    });
  });
  return { n: n, w: w };
}

/* ---------------- ทำนาย ---------------- */
function scPredict_(kind, chart, iso, results, weights) {
  var ctx = scCtx_(kind, chart, iso, results);
  var all = scAllMethods_(ctx), K = SC_KIND[kind], npos = K.pos.length;
  var dead = scDead_(ctx), par = scParity_(ctx.wd);
  var pos = [], p;
  for (p = 0; p < npos; p++) {
    var sc = [], d;
    for (d = 0; d < 10; d++) sc.push({ d: String(d), s: 0, plus: [], minus: [] });
    SC_METHODS.forEach(function (m) {
      var bag = all[m[0]][p] || {}, wt = weights ? weights.w[m[0]][p].w : 1;
      Object.keys(bag).forEach(function (x) {
        var v = bag[x].s * wt;
        sc[+x].s += v;
        sc[+x].plus.push({ m: m[1], v: Math.round(v * 100) / 100, why: bag[x].why });
      });
    });
    par.fav.forEach(function (x) { sc[+x].s += 0.25; sc[+x].plus.push({ m: 'คู่/คี่ตามวัน', v: 0.25, why: [par.text] }); });
    dead.forEach(function (x) {
      var v = x.w * (x.kal ? (SC_KAL_POSW[K.pos[p]] || 1) : 1);
      sc[+x.d].s -= v; sc[+x.d].minus.push({ v: Math.round(v * 100) / 100, why: x.why });
    });
    var rank = sc.slice().sort(function (a, b) { return b.s - a.s || a.d - b.d; });
    pos.push({ name: K.pos[p], rank: rank, top: rank.slice(0, 3), closed: rank.slice(-2).map(function (x) { return x.d; }) });
  }

  /* เลขชุดตามประเภทรางวัล: เอา 3 อันดับแรกของแต่ละหลักมาไขว้ เรียงด้วยคะแนนรวม */
  var sets = K.sets.map(function (st) {
    var idx = st[1], combos = [{ n: '', s: 0 }];
    idx.forEach(function (pi) {
      var nx = [];
      combos.forEach(function (c) { pos[pi].rank.slice(0, idx.length >= 3 ? 2 : 3).forEach(function (r) { nx.push({ n: c.n + r.d, s: c.s + r.s }); }); });
      combos = nx;
    });
    /* เลขซ้ำในชุด (เบิ้ล/ตอง) ลดคะแนน — ยกเว้นวันที่ดวงชี้ว่าเบิ้ลแรง ค่อยให้ขึ้นเอง */
    combos.forEach(function (c) {
      var same = c.n.length - new Set(c.n.split('')).size;
      if (same) c.s *= Math.pow(0.6, same);
    });
    combos.sort(function (a, b) { return b.s - a.s; });
    return { name: st[0], list: combos.slice(0, 6).map(function (c) { return c.n; }) };
  });

  /* เลขวิ่ง = รวมคะแนนทุกหลัก */
  var tot = []; for (p = 0; p < 10; p++) tot.push({ d: String(p), s: 0 });
  pos.forEach(function (ps) { ps.rank.forEach(function (r) { tot[+r.d].s += r.s; }); });
  tot.sort(function (a, b) { return b.s - a.s; });
  var run = tot.slice(0, 2).map(function (x) { return x.d; });

  /* เบิ้ล / ตอง / หาม */
  var loc = scLoc_(chart), cells = chart.rasi || [], dbl = 0, dblWhy = [];
  var maxConj = 0; cells.forEach(function (c) { maxConj = Math.max(maxConj, (c || []).length); });
  if (maxConj >= 3) { dbl++; dblWhy.push('มีเรือนที่ดาวกุมกัน ' + maxConj + ' ดวง'); }
  if (ctx.lunar && (ctx.lunar.day === 15 || ctx.lunar.day === 8 || (ctx.lunar.side === 'แรม' && ctx.lunar.day === 14))) {
    dbl++; dblWhy.push('ตรงวันพระ (' + scLunarText_(ctx.lunar) + ')');
  }
  if (ctx.wd === 4 || ctx.wd === 6) { dbl++; dblWhy.push('วัน' + SC_DAY[ctx.wd] + ' มักมีเบิ้ลแฝง'); }
  var dRate = scDoubleRate_(kind, results, iso);
  if (dRate.n >= 10 && dRate.rate >= 0.15) { dbl++; dblWhy.push('เบิ้ลออก ' + dRate.hit + '/' + dRate.n + ' งวดหลัง'); }
  var hams = [];
  for (var r = 0; r < 6; r++) {
    var A = cells[r] || [], B = cells[r + 6] || [];
    if (!A.length || !B.length) continue;
    A.concat(B).forEach(function (x) { if (x !== ctx.dayStar && hams.indexOf(x + ctx.dayStar + x) < 0) hams.push(x + ctx.dayStar + x); });
  }
  var sTot = {}; tot.forEach(function (x) { sTot[x.d] = x.s; });
  hams.sort(function (a, b) { return sTot[b[0]] - sTot[a[0]]; });

  return {
    kind: kind, iso: iso, chartDate: chart.date, wd: ctx.wd, dayStar: ctx.dayStar, lunar: ctx.lunar,
    pos: pos, sets: sets, run: run, dead: dead, parity: par,
    dbl: { level: dbl >= 3 ? 'สูง' : (dbl === 2 ? 'กลาง' : 'ต่ำ'), why: dblWhy,
           list: run.map(function (x) { return x + x; }), tong: dbl >= 3 ? run[0] + run[0] + run[0] : '' },
    hams: hams.slice(0, 4), methods: all
  };
}

function scDoubleRate_(kind, results, iso) {
  /* เบิ้ลวัดที่ชุด 2 ตัว (ลาว 2 ตัวบน · ไทย 2 ตัวล่าง) */
  var idx = SC_KIND[kind].sets.filter(function (x) { return x[1].length === 2; })[0][1];
  var dates = Object.keys(results).filter(function (d) { return d < iso; }).sort().slice(-30), hit = 0;
  dates.forEach(function (d) { if (results[d][idx[0]] === results[d][idx[1]]) hit++; });
  return { n: dates.length, hit: hit, rate: dates.length ? hit / dates.length : 0 };
}

/** วัดย้อนหลังแบบไม่โกง: ทายดวงวันไหน ใช้น้ำหนักจากดวงก่อนวันนั้นเท่านั้น */
function scBacktest_(kind, charts, results) {
  var npos = SC_KIND[kind].pos.length, rows = [], top1 = 0, top3 = 0, cnt = 0;
  (charts || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (c) {
    if (!scFits_(c, kind)) return;
    var real = results[c.date];
    if (!real) return;
    var w = scWeights_(kind, charts, results, c.date);
    var pr = scPredict_(kind, c, c.date, results, w);
    var marks = [];
    for (var p = 0; p < npos; p++) {
      var t = pr.pos[p].top.map(function (x) { return x.d; });
      var m = t[0] === real[p] ? 1 : (t.indexOf(real[p]) >= 0 ? 3 : 0);
      if (m === 1) top1++;
      if (m) top3++;
      cnt++;
      marks.push({ real: real[p], top: t, m: m });
    }
    var setHits = pr.sets.map(function (s) {
      var want = SC_KIND[kind].sets.filter(function (x) { return x[0] === s.name; })[0][1].map(function (i) { return real[i]; }).join('');
      return { name: s.name, want: want, hit: s.list.indexOf(want) >= 0 };
    });
    rows.push({ date: c.date, real: real.join(''), marks: marks, sets: setHits, run: pr.run,
                runHit: pr.run.some(function (x) { return real.indexOf(x) >= 0; }) });
  });
  return { rows: rows, top1: top1, top3: top3, n: cnt };
}

/* ---------------- สถิติผลล้วน (ไม่ใช้ดวง) ---------------- */
function scStats_(kind, results, lastN) {
  var dates = Object.keys(results).sort();
  var use = lastN ? dates.slice(-lastN) : dates;
  var K = SC_KIND[kind], out = [];
  K.pos.forEach(function (name, p) {
    var cnt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], gap = [];
    use.forEach(function (d) { cnt[+results[d][p]]++; });
    for (var x = 0; x < 10; x++) {
      var g = -1;
      for (var i = dates.length - 1; i >= 0; i--) if (results[dates[i]][p] === String(x)) { g = dates.length - 1 - i; break; }
      gap.push(g < 0 ? dates.length : g);
    }
    var order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(function (a, b) { return cnt[b] - cnt[a] || a - b; });
    var even = 0; use.forEach(function (d) { if (+results[d][p] % 2 === 0) even++; });
    out.push({ name: name, cnt: cnt, gap: gap, hot: order.slice(0, 3), cold: order.slice(-3).reverse(), even: even, n: use.length });
  });
  var sets = K.sets.map(function (st) {
    var dbl = 0, idx = st[1];
    use.forEach(function (d) {
      var r = results[d], seen = {}, rep = false;
      idx.forEach(function (i) { if (seen[r[i]]) rep = true; seen[r[i]] = 1; });
      if (rep) dbl++;
    });
    return { name: st[0], dbl: dbl };
  });
  return { n: use.length, total: dates.length, pos: out, sets: sets, from: use[0] || '', to: use[use.length - 1] || '' };
}

/** วันหวยออกงวดถัดไปนับจากวันนี้ (ลาว จ-ศ ก่อน 20:30 · ไทย 1/16 ก่อน 16:00) */
function scNextDraw_(kind, now) {
  var t = now || new Date();
  var bkk = new Date(t.getTime() + 7 * 3600000);
  var iso = bkk.toISOString().slice(0, 10), hm = bkk.getUTCHours() * 60 + bkk.getUTCMinutes();
  for (var i = 0; i < 40; i++) {
    var d = scAddDays_(iso, i), wd = scWd_(d), day = +d.slice(8);
    if (kind === 'lao') { if (wd >= 1 && wd <= 5 && (i > 0 || hm < 20 * 60 + 30)) return d; }
    else if ((day === 1 || day === 16) && (i > 0 || hm < 16 * 60)) return d;
  }
  return iso;
}

/** วันออกของหวยชนิดนี้ไหม */
function scIsDraw_(kind, iso) {
  var wd = scWd_(iso), day = +iso.slice(8);
  return kind === 'lao' ? (wd >= 1 && wd <= 5) : (day === 1 || day === 16);
}

/** งวดที่เพิ่งออกล่าสุด (ไว้ตั้งค่าเริ่มต้นช่องกรอกผล) — วันออกแต่ยังไม่ถึงเวลา = ถอยไปงวดก่อน */
function scLastDraw_(kind, now) {
  var t = now || new Date(), bkk = new Date(t.getTime() + 7 * 3600000);
  var iso = bkk.toISOString().slice(0, 10), hm = bkk.getUTCHours() * 60 + bkk.getUTCMinutes();
  var cut = kind === 'lao' ? 20 * 60 + 30 : 16 * 60;
  for (var i = 0; i < 40; i++) {
    var d = scAddDays_(iso, -i);
    if (!scIsDraw_(kind, d)) continue;
    if (i === 0 && hm < cut) continue;
    return d;
  }
  return iso;
}

/** วันออกที่ยังไม่มีผล ย้อนหลัง n วัน (ไม่นับงวดที่ยังไม่ถึงเวลาออก) */
function scMissingDraws_(kind, results, n, now) {
  var last = scLastDraw_(kind, now), out = [];
  for (var i = 0; i < (n || 30); i++) {
    var d = scAddDays_(last, -i);
    if (scIsDraw_(kind, d) && !results[d]) out.push(d);
  }
  return out;
}

/** ดวงนี้ใช้กับหวยชนิดนี้ได้ไหม — ดวงที่ไม่ระบุชนิด ('') ใช้ได้ทั้ง 2 */
function scFits_(c, kind) { return !kind || !c.kind || c.kind === kind; }

/** ดวงที่ใช้ทายงวด iso: วันล่าสุด ≤ iso ก่อน · วันเท่ากันเลือกดวงชนิดเดียวกัน
    (วันที่ 1/16 มีดวงไทย 15:30 กับดวงลาว 20:20 คนละลัคนา ห้ามหยิบสลับกัน) */
function scPickChart_(charts, iso, kind) {
  var best = null, any = null;
  (charts || []).forEach(function (c) {
    if (c.date > iso) return;
    var better = function (b) { return !b || c.date > b.date || (c.date === b.date && c.kind === kind && b.kind !== kind); };
    if (scFits_(c, kind) && better(best)) best = c;
    if (better(any)) any = c;
  });
  /* วันใหม่กว่าชนะเสมอ (จันทร์ย้ายราศีทุก ~2 วัน) — ชนิดเดียวกันใช้ตัดสินเฉพาะวันเท่ากัน */
  if (best && any && any.date > best.date) return any;
  return best || any;
}

if (typeof module !== 'undefined') {
  module.exports = { SC_KIND: SC_KIND, SC_PL: SC_PL, SC_RASI: SC_RASI, SC_METHODS: SC_METHODS,
    scWd_: scWd_, scDayBranch_: scDayBranch_, scLunarGuess_: scLunarGuess_, scLunarParse_: scLunarParse_,
    scDayStar_: scDayStar_, scKalakini_: scKalakini_, scResultMap_: scResultMap_, scMethods_: scMethods_,
    scWeights_: scWeights_, scPredict_: scPredict_, scBacktest_: scBacktest_, scStats_: scStats_,
    scNextDraw_: scNextDraw_, scPickChart_: scPickChart_, scFits_: scFits_, scIsDraw_: scIsDraw_, scLastDraw_: scLastDraw_, scMissingDraws_: scMissingDraws_, scAddDays_: scAddDays_, scDead_: scDead_, scCtx_: scCtx_, scLunarText_: scLunarText_ };
}
