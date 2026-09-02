/**
 * ============================================================
 * LotPredict.gs — เก็บคำทำนายหวย + เกรดถูก/ผิดอัตโนมัติ
 * ------------------------------------------------------------
 * ไหลงาน:
 *   1) ผู้ใช้พิมพ์ "หวยลาว" / "หวยไทย"  → lotteryText_() เซฟชุดเลขงวดนั้นลงชีต Lot_Predict
 *   2) บันทึกผลจริง (recordLaoResult_ / recordThaiResult_) → เกรดแถวนั้นทันที
 *   3) "หวยลาว แม่น" / "หวยไทย แม่น"    → สรุปความแม่นแยกตำรา
 *
 * เกรด 3 ระดับ (ยึดจากที่ผู้ใช้นับจริง เช่น ผล 0480 → 04 เข้าในเลข, 08 = 80 กลับตัว):
 *   🎯 ตรง  = ตรงคู่ท้าย (ลาว = สองบน · ไทย = 2 ตัวล่าง)
 *   ✅ ใน   = โผล่เป็นคู่ติดกันในเลขผล (0480 → 04, 48, 80)
 *   🔄 กลับ = กลับตัวแล้วโผล่ในเลขผล  (08 ↔ 80)
 * ============================================================
 */

var LOTP = {
  SHEET: 'Lot_Predict',
  HEADERS: ['dateISO', 'วันที่', 'ชนิด', 'เด่นสุด', 'เบิ้ล', 'เลี่ยง',
            'ตำรา1', 'ตำรา2', 'ตำรา3', 'ผล', 'เกรด',
            'เข้ากี่ตัว', 'เลี่ยงพลาด', 't1', 't2', 't3', 'ts', 'ตำแหน่ง']
};

/* ============================================================
 * ส่วนคำนวณล้วน (ไม่แตะชีต — เทสต์ได้ตรงๆ)
 * ============================================================ */

/** คู่เลข 2 หลักที่ติดกันในเลขผล เช่น 0480 → ['04','48','80'] */
function lotWindows_(numRaw) {
  var n = String(numRaw || '').replace(/\D/g, '');
  var out = [];
  for (var i = 0; i + 2 <= n.length; i++) out.push(n.substr(i, 2));
  return out;
}

/**
 * เกรดเลข 1 ตัว → '' | 'ตรง' | 'ใน' | 'กลับ'
 * @param numRaw  เลขผล (ลาว = 4 ตัวรวด · ไทย = 4 ตัวบน)
 * @param last2   2 ตัวล่างของไทย (คนละชุดกับ numRaw) — ไม่ใส่ = ท้าย numRaw เอง (ลาว = สองบน)
 */
function lotHit_(pred, numRaw, last2) {
  var p = String(pred || '').replace(/\D/g, '');
  var n = String(numRaw || '').replace(/\D/g, '');
  var b = String(last2 || '').replace(/\D/g, '');
  if (p.length !== 2 || (n.length < 2 && b.length < 2)) return '';
  var low = b.length === 2 ? b : n.slice(-2);
  if (p === low) return 'ตรง';
  var w = lotWindows_(n);
  if (b.length === 2 && w.indexOf(b) < 0) w.push(b);
  if (w.indexOf(p) >= 0) return 'ใน';
  if (w.indexOf(p.charAt(1) + p.charAt(0)) >= 0) return 'กลับ';
  return '';
}

var LOTP_ICON = { 'ตรง': '🎯', 'ใน': '✅', 'กลับ': '🔄' };

/** เกรดทั้งชุด → { hot, dbl, avoid, t1, t2, t3, hits, avoidMiss, text } */
function lotGrade_(pred, numRaw, last2) {
  var n = String(numRaw || '').replace(/\D/g, '');
  var b = String(last2 || '').replace(/\D/g, '');
  var mark = function (arr) {
    return (arr || []).map(function (p) { return { n: p, lv: lotHit_(p, n, b) }; });
  };
  var hot = mark(pred.hot), dbl = mark(pred.dbl), avoid = mark(pred.avoid);
  var t1 = mark(pred.t1), t2 = mark(pred.t2), t3 = mark(pred.t3);
  var won = function (a) { return a.filter(function (x) { return x.lv; }); };

  var show = function (a) {
    if (!a.length) return '—';
    return a.map(function (x) {
      return x.n + (x.lv ? LOTP_ICON[x.lv] : '');
    }).join(' · ');
  };

  var hotWin = won(hot), avoidBad = won(avoid);
  var L = [];
  L.push('📋 เกรดคำทำนายงวดนี้ (ผล ' + n + (b ? ' / ' + b : '') + ')');
  L.push('⭐ เด่นสุด : ' + show(hot) + '  → เข้า ' + hotWin.length + '/' + hot.length);
  L.push('🔁 เบิ้ล   : ' + show(dbl));
  L.push('🚫 เลี่ยง  : ' + show(avoid) +
    (avoidBad.length ? '  ⚠️ พลาด ' + avoidBad.length + ' ตัว' : '  ✔️ เลี่ยงถูก'));
  L.push('① ' + show(t1) + ' · ② ' + show(t2) + ' · ③ ' + show(t3));

  return {
    hot: hot, dbl: dbl, avoid: avoid, t1: t1, t2: t2, t3: t3,
    hits: hotWin.length,
    avoidMiss: avoidBad.length,
    t1Hit: won(t1).length, t2Hit: won(t2).length, t3Hit: won(t3).length,
    text: L.join('\n')
  };
}

/** แปลงผลลัพธ์ lotteryFromCalendar_ → ชุดเลขที่จะเก็บ (ตรงกับที่โชว์ใน lotteryText_) */
function lotPredFromCalc_(r) {
  return {
    hot:   r.hot || [],
    dbl:   uniq2_([r.t1.power % 10 * 11, r.t3.root * 11]),
    avoid: uniq2_(r.t1.bad.concat(r.t2.bad).concat(r.t3.bad)
             .map(function (s) { return parseInt(s, 10); })),
    t1: r.t1.good, t2: r.t2.good, t3: r.t3.good
  };
}

/* ============================================================
 * ส่วนชีต
 * ============================================================ */

var LOTP_COL = { RESULT: 10, GRADE: 11, HITS: 12, AVOID: 13, T1: 14, T2: 15, T3: 16, TS: 17, POS: 18 };

function lotpFind_(sh, iso, kind) {
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    // ⚠️ คอลัมน์ A อาจเป็น Date object → ต้อง lotIso_ ไม่งั้นหาไม่เจอ (เกรดย้อนหลังเงียบ)
    if (lotIso_(data[i][0]) === iso && String(data[i][2]) === kind) {
      return { row: i + 1, values: data[i] };
    }
  }
  return null;
}

/**
 * savePrediction_ - เซฟชุดเลขของงวด (เขียนซ้ำได้ถ้ายังไม่เกรด)
 * @param kind 'lao' | 'thai'
 * @param d    วันงวด (Date)
 * @param r    ผลจาก lotteryFromCalendar_ (ส่งมาได้เพื่อไม่คำนวณซ้ำ)
 */
function savePrediction_(kind, d, r) {
  r = r || lotteryFromCalendar_(d);
  var p = lotPredFromCalc_(r);
  var iso  = Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
  var thai = Utilities.formatDate(d, 'Asia/Bangkok', 'E d/M/yy');
  var j = function (a) { return (a || []).join(','); };
  var row = [iso, thai, kind, j(p.hot), j(p.dbl), j(p.avoid),
             j(p.t1), j(p.t2), j(p.t3), '', '', '', '', '', '', '',
             Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'), ''];

  var sh = sheetEnsure_(LOTP.SHEET, LOTP.HEADERS);
  lotEnsureHeaders_(sh, LOTP.HEADERS);                 // sheetEnsure_ เขียน header แค่ตอนสร้างชีตใหม่
  var f = lotpFind_(sh, iso, kind);
  // ⚠️ ทุกช่องต้องเป็นข้อความ ('08,13,04' ปลอดภัย แต่ลิสต์ตัวเดียวอย่าง '05' จะโดนกินเป็น 5)
  if (!f) { lotSetText_(sh, sh.getLastRow() + 1, 1, [row]); return 'new'; }
  if (String(f.values[LOTP_COL.RESULT - 1] || '')) return 'graded';  // เกรดแล้ว ห้ามทับ
  lotSetText_(sh, f.row, 1, [row]);
  return 'updated';
}

/** อ่านชุดเลขที่เก็บไว้ของงวดนั้น → pred object (null ถ้าไม่มี) */
function lotpPredOfRow_(v) {
  var sp = function (s) {
    return String(s || '').split(',').filter(function (x) { return x; });
  };
  return { hot: sp(v[3]), dbl: sp(v[4]), avoid: sp(v[5]),
           t1: sp(v[6]), t2: sp(v[7]), t3: sp(v[8]) };
}

/** เลขฝั่ง "ดี" ทั้งหมดของงวด (ไม่รวมเลี่ยง) — ใช้หาตำแหน่งที่เข้า */
function lotpGoodNums_(p) {
  var seen = {}, out = [];
  ['hot', 'dbl', 't1', 't2', 't3'].forEach(function (k) {
    (p[k] || []).forEach(function (x) {
      var n = String(x).replace(/\D/g, '');
      if (n.length !== 2 || seen[n]) return;
      seen[n] = 1;
      out.push(n);
    });
  });
  return out;
}

/**
 * gradePrediction_ - เกรดงวดที่ผลออกแล้ว
 * @return ข้อความสรุป ('' ถ้าไม่มีคำทำนายเก็บไว้)
 */
function gradePrediction_(kind, iso, numRaw, last2) {
  try {
    var sh = sheetEnsure_(LOTP.SHEET, LOTP.HEADERS);
    var f = lotpFind_(sh, iso, kind);
    if (!f) {
      // ไม่เคยเปิดดูเลขงวดนี้ → คำนวณย้อนหลังได้ เพราะ 3 ตำราคิดจาก "วันที่งวด" ล้วน
      // (ไม่ใช่การมองผลแล้วย้อนแต่งเลข — สูตรเดิม วันเดิม ได้เลขชุดเดิมเป๊ะ)
      savePrediction_(kind, new Date(iso + 'T00:00:00'));
      f = lotpFind_(sh, iso, kind);
      if (!f) return '';
    }
    var pred = lotpPredOfRow_(f.values);
    var g = lotGrade_(pred, numRaw, last2);
    lotSetText_(sh, f.row, LOTP_COL.RESULT, [[
      String(numRaw).replace(/\D/g, '') + (last2 ? '/' + last2 : ''),
      g.hits + '/' + g.hot.length + (g.avoidMiss ? ' · เลี่ยงพลาด ' + g.avoidMiss : ''),
      String(g.hits), String(g.avoidMiss), String(g.t1Hit), String(g.t2Hit), String(g.t3Hit)
    ]]);

    // 📍 ตำแหน่งที่เข้า — เก็บไว้ดูย้อนหลัง ('04@3ตรง|08@1โต๊ด')
    var posTxt = lotPosText_(lotpGoodNums_(pred), numRaw);
    lotSetText_(sh, f.row, LOTP_COL.POS, [[posTxt]]);

    return g.text + (posTxt ? '\n📍 ตำแหน่ง: ' + lotPosLine_(posTxt) : '');
  } catch (e) {
    logEvent_('ERROR', 'gradePrediction_: ' + e.message);
    return '';
  }
}

/** เซฟคำทำนายแบบเงียบ — เรียกจาก lotteryText_ (พังห้ามทำให้ข้อความหวยพัง) */
function savePredictionQuiet_(kind, d, r) {
  try { savePrediction_(kind, d, r); } catch (e) {
    logEvent_('ERROR', 'savePrediction_: ' + e.message);
  }
}

/* ============================================================
 * เกรดย้อนหลังทั้งกอง — เดินจากชีตผลจริงที่มีอยู่แล้ว
 * ทำได้เพราะ 3 ตำราคำนวณจาก "วันที่งวด" ล้วน ไม่ได้ดูผลก่อนแล้วค่อยแต่งเลข
 * ============================================================ */
function lotGradeBackfill_(kind, limit) {
  var n = limit || 200;
  // lotResultRows_ (LotCore.gs) แปลง Date → ISO และเติมเลข 0 หน้าให้แล้ว
  // ⚠️ ของเดิมอ่านดิบๆ แล้วกรองด้วย regex วันที่ → คอลัมน์ A เป็น Date เลยตกด่านทุกแถว เกรดไม่เคยขึ้นเลยสักงวด
  var rows = lotResultRows_(kind).slice(-n);
  var res = (kind === 'lao')
    ? function (v) { return { iso: v[0], num: v[2], b2: '' }; }
    : function (v) { return { iso: v[0], num: v[2], b2: v[3] }; };
  var ok = 0, skip = 0;
  rows.forEach(function (v) {
    var r = res(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.iso) || !r.num) { skip++; return; }
    if (gradePrediction_(kind, r.iso, r.num, r.b2)) ok++; else skip++;
  });
  return '🔁 เกรดย้อนหลัง ' + (kind === 'lao' ? 'หวยลาว' : 'หวยไทย') +
    ' — สำเร็จ ' + ok + ' งวด' + (skip ? ' · ข้าม ' + skip : '') +
    '\n\n' + lotAccuracyText_(kind, 200);
}

/* ============================================================
 * สถิติความแม่น
 * ------------------------------------------------------------
 * ⚠️ เปอร์เซ็นต์ดิบอ่านไม่ได้ความ ถ้าไม่เทียบ "ฐานสุ่ม"
 * 1 เลขทายมั่วมีโอกาสเข้า = (จำนวนโค้ดที่นับว่าเข้าของงวดนั้น)/100
 *   ลาว 0480 → 04,48,80 + กลับตัว 40,84,08 = 6 โค้ด → สุ่มก็ได้ 6%
 *   ไทยมี 2 ตัวล่างเพิ่มอีกชุด → ราว 8%
 * ทุกตัวเลขในรายงานนี้เลยมี "สุ่ม x%" กำกับ + ตัวคูณ (1.00x = เสมอสุ่ม)
 * ============================================================ */

/** จำนวนโค้ด 2 หลักที่ถือว่า "เข้า" ของงวดนั้น (ต้องตรงกับกติกาใน lotHit_) */
function lotWinCodes_(resultCell) {
  var p = String(resultCell || '').split('/');
  var n = String(p[0] || '').replace(/\D/g, '');
  var b = String(p[1] || '').replace(/\D/g, '');
  var w = lotWindows_(n);
  if (b.length === 2 && w.indexOf(b) < 0) w.push(b);
  var seen = {};
  w.forEach(function (x) { seen[x] = 1; seen[x.charAt(1) + x.charAt(0)] = 1; });
  return Object.keys(seen).length;
}

/** โครงสถิติเปล่า (ใช้ทั้งตอนยังไม่มีชีต และเป็นจุดตั้งต้นของการนับ) */
function lotStatsEmpty_() {
  return { n: 0, drawWin: 0, drawExp: 0, hotHit: 0, hotTot: 0, hotExp: 0,
           avoidMiss: 0, avoidExp: 0, t: [0, 0, 0], tTot: [0, 0, 0], tExp: [0, 0, 0], per: [] };
}

/** ตัวเลขดิบของสถิติ — ใช้ร่วมกันทั้งรายงานและบรรทัดสถิติท้ายข้อความหวย */
function lotStats_(kind, limit) {
  // อ่านอย่างเดียว — ยังไม่มีชีตก็แค่ "ยังไม่มีสถิติ" ห้ามสร้างชีตเปล่า (แค่เปิดดูเลขไม่ใช่การบันทึก)
  var sh = sheetIfExists_(LOTP.SHEET);
  if (!sh) return lotStatsEmpty_();
  var data = sh.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]) !== kind) continue;
    if (!String(data[i][LOTP_COL.RESULT - 1] || '')) continue;   // ยังไม่เกรด
    rows.push(data[i]);
  }
  // ⚠️ แถวในชีตไม่ได้เรียงวันที่ (เกรดย้อนหลังต่อท้ายเอา) → ต้องเรียงก่อน
  // ไม่งั้น "งวดล่าสุด" กับค่าเฉลี่ยสะสมเพี้ยนทั้งชุด
  rows.sort(function (a, b) {
    return String(lotIso_(a[0])) < String(lotIso_(b[0])) ? -1 : 1;
  });
  rows = rows.slice(-(limit || 30));

  var o = lotStatsEmpty_();
  o.n = rows.length;
  rows.forEach(function (v) {
    var k = lotWinCodes_(v[LOTP_COL.RESULT - 1]) / 100;          // โอกาสสุ่มต่อ 1 เลข
    var hotN = String(v[3] || '').split(',').filter(String).length;
    var hit = Number(v[LOTP_COL.HITS - 1]) || 0;
    o.hotTot += hotN; o.hotHit += hit; o.hotExp += hotN * k;
    if (hit > 0) o.drawWin++;
    o.drawExp += 1 - Math.pow(1 - k, hotN);                      // โอกาสสุ่มแล้วเข้าอย่างน้อย 1 ตัว
    var avN = String(v[5] || '').split(',').filter(String).length;
    o.avoidMiss += Number(v[LOTP_COL.AVOID - 1]) || 0;
    o.avoidExp += avN * k;
    [LOTP_COL.T1, LOTP_COL.T2, LOTP_COL.T3].forEach(function (c, j) {
      var tot = String(v[6 + j] || '').split(',').filter(String).length;
      o.t[j] += Number(v[c - 1]) || 0; o.tTot[j] += tot; o.tExp[j] += tot * k;
    });
    o.per.push({ iso: lotIso_(v[0]), res: String(v[LOTP_COL.RESULT - 1] || ''),
                 hit: hit, tot: hotN });
  });
  return o;
}

/** เทียบกับสุ่ม → '1.08x ชนะสุ่ม' */
function lotLift_(hit, exp) {
  if (!exp) return '—';
  var r = hit / exp;
  return (Math.round(r * 100) / 100) + 'x ' +
    (r >= 1.15 ? 'ชนะสุ่ม' : r <= 0.85 ? 'แพ้สุ่ม' : 'เสมอสุ่ม');
}

function lotAccuracyText_(kind, limit) {
  var flag = kind === 'lao' ? '🇱🇦 ลาว' : '🇹🇭 ไทย';
  var o = lotStats_(kind, limit || 30);
  if (!o.n) {
    return '📊 ความแม่น ' + flag + '\nยังไม่มีงวดที่เกรดแล้ว — เริ่มนับตั้งแต่งวดที่พิมพ์ "หวย' +
      (kind === 'lao' ? 'ลาว' : 'ไทย') + '" ดูเลขไว้ก่อน แล้วบันทึกผลทีหลัง';
  }
  var pct = function (a, b) { return b ? Math.round(a * 100 / b) + '%' : '—'; };
  var pct1 = function (a, b) { return b ? (Math.round(a * 1000 / b) / 10) + '%' : '—'; };
  var bar = function (a, b) {
    var f = b ? Math.round(a * 10 / b) : 0;
    return new Array(f + 1).join('█') + new Array(10 - f + 1).join('░');
  };

  var L = [];
  L.push('📊 ความแม่น ' + flag + ' — ' + o.n + ' งวดล่าสุด');
  L.push('━━━━━━━━━━━━━━');
  L.push('⭐ เด่นสุดเข้าอย่างน้อย 1 ตัว : ' + o.drawWin + '/' + o.n + ' งวด (' + pct(o.drawWin, o.n) + ')');
  L.push('   สุ่มได้ ' + pct1(o.drawExp, o.n) + ' → ' + lotLift_(o.drawWin, o.drawExp));
  L.push('   รายตัว ' + o.hotHit + '/' + o.hotTot + ' (' + pct(o.hotHit, o.hotTot) + ')' +
    ' · สุ่ม ' + pct1(o.hotExp, o.hotTot) + ' → ' + lotLift_(o.hotHit, o.hotExp));
  L.push('🚫 เลี่ยงแล้วดันออก : ' + o.avoidMiss + ' ครั้ง (สุ่มจะพลาด ' +
    (Math.round(o.avoidExp) || 0) + ' ครั้ง → ' +
    (o.avoidExp && o.avoidMiss < o.avoidExp * 0.85 ? 'เลี่ยงได้ผล' : 'พอๆ กับสุ่ม') + ')');
  L.push('━━━ แยกตำรา (เทียบสุ่ม) ━━━');
  ['① กำลังวัน  ', '② ข้างขึ้น-แรม', '③ เลขศาสตร์ '].forEach(function (name, k) {
    L.push(name + ' ' + bar(o.t[k], o.tTot[k]) + ' ' + pct(o.t[k], o.tTot[k]) +
      ' (' + o.t[k] + '/' + o.tTot[k] + ')');
    L.push('     สุ่ม ' + pct1(o.tExp[k], o.tTot[k]) + ' → ' + lotLift_(o.t[k], o.tExp[k]));
  });

  // 📆 รายงวดล่าสุด + ค่าเฉลี่ยสะสม (สะสม = ตั้งแต่งวดแรกในชุดถึงงวดนั้น)
  L.push('');
  L.push('📆 *รายงวดล่าสุด* (สะสม = เฉลี่ยถึงงวดนั้น)');
  var cw = 0, ct = 0, lines = [];
  o.per.forEach(function (r) {
    cw += r.hit; ct += r.tot;
    var mm = /^\d{4}-\d{2}-\d{2}$/.test(r.iso || '') ? r.iso.slice(8) + '/' + r.iso.slice(5, 7) : '—';
    lines.push('  ' + mm + ' · ' + (r.res || '—') + ' · ' +
      (r.hit ? '✅ ' + r.hit + '/' + r.tot : '✖️ 0/' + r.tot) +
      '  (สะสม ' + pct1(cw, ct) + ')');
  });
  lines.reverse().slice(0, 12).forEach(function (x) { L.push(x); });

  L.push('');
  L.push('💡 นับแบบ: 🎯 ตรง' + (kind === 'lao' ? 'สองบน' : ' 2 ตัวล่าง') +
    ' · ✅ อยู่ในเลขผล · 🔄 กลับตัวแล้วอยู่ในเลขผล');
  L.push('💡 1.00x = เท่ากับทายมั่ว · เกิน 1.15x ถึงจะเรียกว่าตำรามีของ');
  return L.join('\n');
}

/** บรรทัดสถิติจริงต่อท้ายข้อความหวย — เห็นทุกครั้งที่ดูเลข ไม่ต้องไปเปิดดูเอง */
function lotTrackLine_(kind) {
  try {
    var o = lotStats_(kind, 100);
    if (o.n < 10) return '';
    var nm = ['①กำลังวัน', '②ข้างขึ้น-แรม', '③เลขศาสตร์'];
    var rank = [0, 1, 2].map(function (j) {
      return { j: j, r: o.tExp[j] ? o.t[j] / o.tExp[j] : 0 };
    }).sort(function (a, b) { return b.r - a.r; });
    return '━━━━━━━━━━━━━━\n📈 สถิติจริง ' + o.n + ' งวดหลัง: เด่นเข้า ' +
      Math.round(o.drawWin * 100 / o.n) + '% ของงวด (' + lotLift_(o.drawWin, o.drawExp) + ')\n' +
      '   ตำรานำ: ' + rank.map(function (x) {
        return nm[x.j] + ' ' + (Math.round(x.r * 100) / 100) + 'x';
      }).join(' · ') + '\n   พิมพ์ "หวย' + (kind === 'lao' ? 'ลาว' : 'ไทย') + ' แม่น" ดูเต็ม';
  } catch (e) { return ''; }
}

/* ============================================================
 * เกรดอัตโนมัติรายวัน — ผลที่อัปเข้ามาจะถูกเกรดเองทุกเช้า
 * ============================================================ */
function lotGradeDaily() {
  var out = [];
  ['lao', 'thai'].forEach(function (k) {
    try { lotGradeBackfill_(k, 40); out.push(k + ' ok'); }
    catch (e) { out.push(k + ' err ' + e.message); logEvent_('ERROR', 'lotGradeDaily ' + k + ': ' + e.message); }
  });
  return out.join(' · ');
}
