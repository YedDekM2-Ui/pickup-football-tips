/**
 * ============================================================
 * LotBase.gs — "เลขฐาน" (Base Digits) · คำสั่ง  หวยลาวB / หวยไทยB
 * ============================================================
 * ต่างจากตำราเดิม (Lottery.gs) ตรงที่ตำราเดิมคิดจาก "วันที่งวด" ล้วน
 * ส่วนไฟล์นี้คิดจาก "ผลย้อนหลังจริงในชีต" → คัดเลข 0-9 เหลือ 6 ตัวเด่น
 *
 * 🧮 สูตร (ผมออกแบบเอง แล้วจูนน้ำหนักด้วย backtest walk-forward
 *     บนผลจริง ลาว 204 งวด / ไทย 200 งวด — ดูตาราง Accuracy ท้ายรายงาน)
 *   ① Echo   .40  งวดก่อนออกเลขอะไร งวดนี้เลขนั้นและเลขข้างเคียง (±1) มักตามมา
 *   ② Markov .25  สถิติจริง "งวดก่อนมี x → งวดถัดไปมี y บ่อยแค่ไหน"
 *   ③ ค้าง   .20  เลขที่หายไปนานกว่าปกติ (overdue)
 *   ④ ตำรา   .15  เลขจาก 3 ตำราปฏิทินของงวดนั้น (ยืม lotteryFromCalendar_)
 *   ✂️ ตัดทิ้ง: "เลขฮอต/ออกถี่" — backtest แล้ว **แย่กว่าสุ่ม** ทั้งลาวและไทย
 *
 * ⚠️ ความจริงที่ต้องรู้ (รายงานพิมพ์ให้ทุกครั้ง):
 *   เลขฐาน 6 ตัวจาก 10 ตัว → ต่อให้จิ้มมั่ว ก็ครอบคลุมได้ 2.40/4 = 60% อยู่แล้ว
 *   สูตรนี้วัดได้ ~62-63% — ดีกว่าสุ่มนิดเดียว ยังไม่ถึงระดับมีนัยสำคัญทางสถิติ
 *   เพราะงั้นเลข "Accuracy 80%" ที่เห็นตามกลุ่มหวย = เขาไม่ได้หักฐานสุ่มออก
 *
 * ทุกการ "อ่าน" ผ่าน lotResultRows_ เท่านั้น (กันเลข 0 หน้าหาย — ดู LotCore.gs)
 * ============================================================
 */

var LOTB = {
  W: { echo: 0.40, mk: 0.25, over: 0.20, cal: 0.15 },
  HALF: 25,          // ครึ่งชีวิตของน้ำหนักถอยหลัง (งวด)
  BASE_N: 6,         // ขนาดชุดเลขฐาน
  WARM: 40,          // งวดตั้งต้นก่อนเริ่มวัดผล
  RANDOM: 0.60       // ฐานสุ่มล้วนของชุด 6 ตัว = 6/10
};

/* ============================================================
 * 1) เตรียมข้อมูล
 * ============================================================ */

/** ผลย้อนหลังเฉพาะงวดที่มีเลข 4 หลักครบ → [[iso, '0480'], ...] เรียงเก่า→ใหม่ */
function lotbHistory_(kind) {
  var rows = lotResultRows_(kind), out = [];
  for (var i = 0; i < rows.length; i++) {
    var n = String(rows[i][2] || '');
    if (n.length === 4) out.push([rows[i][0], n]);
  }
  return out;
}

function lotbDigits_(s) {
  var a = [], t = String(s || '');
  for (var i = 0; i < t.length; i++) a.push(Number(t.charAt(i)));
  return a;
}

/** ปรับสเกลเป็น 0..1 (ทุกช่องเท่ากัน → 0.5 ทั้งแถว) */
function lotbNorm_(a) {
  var mx = a[0], mn = a[0], i;
  for (i = 1; i < a.length; i++) { if (a[i] > mx) mx = a[i]; if (a[i] < mn) mn = a[i]; }
  if (mx <= mn) return a.map(function () { return 0.5; });
  return a.map(function (x) { return (x - mn) / (mx - mn); });
}

/* ============================================================
 * 2) สัญญาณ 4 ตัว — คืน array 10 ช่อง (index = เลข 0-9)
 * ============================================================ */

/** ① Echo — งวดล่าสุดออกเลขอะไร เลขนั้น (+1.0) และ ±1 (+0.6) ได้แต้ม */
function lotbSigEcho_(hist) {
  var s = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (!hist.length) return s.map(function () { return 0.5; });
  lotbDigits_(hist[hist.length - 1][1]).forEach(function (d) {
    s[d] += 1;
    s[(d + 1) % 10] += 0.6;
    s[(d + 9) % 10] += 0.6;
  });
  return lotbNorm_(s);
}

/** ② Markov — จากทั้งกอง: งวดก่อนมี x แล้วงวดถัดไปมี y กี่ % */
function lotbSigMarkov_(hist) {
  if (hist.length < 20) return [.5, .5, .5, .5, .5, .5, .5, .5, .5, .5];
  var cnt = [], tot = [], i, j;
  for (i = 0; i < 10; i++) { cnt.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); tot.push(0); }
  for (i = 1; i < hist.length; i++) {
    var prev = lotbUniq_(lotbDigits_(hist[i - 1][1]));
    var cur = lotbUniq_(lotbDigits_(hist[i][1]));
    for (j = 0; j < prev.length; j++) {
      tot[prev[j]]++;
      for (var k = 0; k < cur.length; k++) cnt[prev[j]][cur[k]]++;
    }
  }
  var s = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var last = lotbUniq_(lotbDigits_(hist[hist.length - 1][1]));
  for (i = 0; i < last.length; i++) {
    var p = last[i];
    if (!tot[p]) continue;
    for (j = 0; j < 10; j++) s[j] += cnt[p][j] / tot[p];
  }
  return lotbNorm_(s);
}

/** ③ ค้าง — ไม่ออกมากี่งวดแล้ว (ยิ่งนาน ยิ่งได้แต้ม) */
function lotbSigOverdue_(hist) {
  var s = [], i;
  for (i = 0; i < 10; i++) s.push(hist.length);
  for (i = hist.length - 1; i >= 0; i--) {
    var gap = hist.length - 1 - i;
    lotbDigits_(hist[i][1]).forEach(function (d) { if (s[d] === hist.length) s[d] = gap; });
  }
  return lotbNorm_(s);
}

/** ④ ตำรา — เลขจาก 3 ตำราปฏิทินของงวดนั้น (ไม่ดูผลย้อนหลังเลย = ไม่มี lookahead) */
function lotbSigCal_(dateObj) {
  var s = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  try {
    var r = lotteryFromCalendar_(dateObj);
    var all = [].concat(r.t1.good, r.t2.good, r.t3.good, r.hot);
    all.forEach(function (t) { lotbDigits_(lotPad_(t, 2)).forEach(function (d) { s[d] += 1; }); });
  } catch (err) { return [.5, .5, .5, .5, .5, .5, .5, .5, .5, .5]; }
  return lotbNorm_(s);
}

function lotbUniqStr_(a) {
  var seen = {}, out = [];
  a.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; out.push(x); } });
  return out;
}

function lotbUniq_(a) {
  var seen = {}, out = [];
  a.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
  return out;
}

/* ============================================================
 * 3) รวมคะแนน → เลขฐาน
 * ============================================================ */

/**
 * คะแนนเลข 0-9 สำหรับงวดที่ยิงวันที่ dateObj โดยใช้ประวัติ hist (ก่อนงวดนั้นเท่านั้น)
 * @return {score:[10], order:[[digit,score]...] มาก→น้อย, sig:{...}}
 */
function lotbScore_(hist, dateObj) {
  var W = LOTB.W;
  var sig = {
    echo: lotbSigEcho_(hist),
    mk: lotbSigMarkov_(hist),
    over: lotbSigOverdue_(hist),
    cal: lotbSigCal_(dateObj)
  };
  var sc = [], d, k;
  for (d = 0; d < 10; d++) {
    var v = 0;
    for (k in W) if (W[k]) v += W[k] * sig[k][d];
    sc.push(v);
  }
  var order = sc.map(function (v, i) { return [i, v]; })
    .sort(function (a, b) { return b[1] - a[1] || a[0] - b[0]; });
  return { score: sc, order: order, sig: sig };
}

/** เลขฐาน n ตัว (เรียงตามคะแนน) */
function lotbBase_(hist, dateObj, n) {
  return lotbScore_(hist, dateObj).order.slice(0, n || LOTB.BASE_N)
    .map(function (x) { return x[0]; });
}

/**
 * คะแนนแยกตามหลัก (ตำแหน่ง 0=ซ้ายสุด … 3=ขวาสุด) จากความถี่ถ่วงน้ำหนักล่าสุด
 * ใช้แค่ตอน "จัดเรียง" เลขฐานให้เป็นชุด 2-3 ตัว ไม่ได้ใช้คัดเลขฐาน
 */
function lotbPosScore_(hist) {
  var pos = [], i, p;
  for (p = 0; p < 4; p++) pos.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  var lim = Math.min(hist.length, 120);
  for (i = 0; i < lim; i++) {
    var idx = hist.length - 1 - i;
    var w = Math.pow(0.5, i / LOTB.HALF);
    var ds = lotbDigits_(hist[idx][1]);
    for (p = 0; p < 4; p++) pos[p][ds[p]] += w;
  }
  return pos;
}

/** เรียงเลขในชุด base ตามความชอบของหลักนั้น → คืนเลขเด่นสุด k ตัวของหลัก p */
function lotbTopAtPos_(posScore, base, p, k) {
  return base.slice().sort(function (a, b) {
    return (posScore[p][b] - posScore[p][a]) || (base.indexOf(a) - base.indexOf(b));
  }).slice(0, k || 1);
}

/**
 * จัดเลขฐานลง 4 หลักแบบไม่ใช้ซ้ำ (greedy ไล่จากหลักขวาก่อน เพราะสองบนสำคัญสุด)
 * → 'ABCD' · ลาว: สามบน BCD · สองบน CD · สองล่าง AB
 */
function lotbSeq_(posScore, base) {
  var used = {}, out = [null, null, null, null];
  [3, 2, 1, 0].forEach(function (p) {
    var cand = lotbTopAtPos_(posScore, base.filter(function (d) { return !used[d]; }), p, 1);
    var pick = cand.length ? cand[0] : base[0];
    used[pick] = 1;
    out[p] = pick;
  });
  return out.join('');
}

/**
 * คู่เลขของสองหลัก เรียงตามคะแนนรวม → คืน k ชุดแรก (ไม่ซ้ำกัน)
 * ใช้ top 2 ของแต่ละหลักมาไขว้กัน = 4 คู่ แล้วคัด
 */
function lotbPairs_(posScore, base, pA, pB, k) {
  var A = lotbTopAtPos_(posScore, base, pA, 3), B = lotbTopAtPos_(posScore, base, pB, 3);
  var cand = [], seen = {};
  A.forEach(function (a) {
    B.forEach(function (b) {
      // เลขเบิ้ล (11,33) กินสองช่องด้วยเลขตัวเดียว โอกาสออกแค่ 10% — ตัดทิ้ง เอาไปกระจายดีกว่า
      if (a === b) return;
      var s = '' + a + b;
      if (seen[s]) return;
      seen[s] = 1;
      cand.push([s, posScore[pA][a] + posScore[pB][b]]);
    });
  });
  cand.sort(function (x, y) { return y[1] - x[1]; });
  return cand.slice(0, k || 2).map(function (x) { return x[0]; });
}

/* ============================================================
 * 4) backtest แบบ walk-forward (ใช้เฉพาะข้อมูลก่อนงวดนั้นจริงๆ)
 * ============================================================ */

/**
 * @param n จำนวนงวดล่าสุดที่ต้องการวัด (0 = ทั้งหมดเท่าที่ warm-up พอ)
 * @return {rows:[{iso,base,hit}], avg, best, worst, acc, n}
 */
function lotbBacktest_(hist, n) {
  var start = Math.max(LOTB.WARM, hist.length - (n || hist.length));
  var rows = [], sum = 0, best = -1, worst = 9;
  for (var i = start; i < hist.length; i++) {
    var base = lotbBase_(hist.slice(0, i), lotbDateOf_(hist[i][0]), LOTB.BASE_N);
    var inBase = {};
    base.forEach(function (d) { inBase[d] = 1; });
    var hit = 0;
    lotbDigits_(hist[i][1]).forEach(function (d) { if (inBase[d]) hit++; });
    rows.push({ iso: hist[i][0], num: hist[i][1], base: base.join(''), hit: hit });
    sum += hit;
    if (hit > best) best = hit;
    if (hit < worst) worst = hit;
  }
  var cnt = rows.length;
  return {
    rows: rows, n: cnt,
    avg: cnt ? sum / cnt : 0,
    best: cnt ? best : 0,
    worst: cnt ? worst : 0,
    acc: cnt ? sum / (cnt * 4) : 0
  };
}

function lotbDateOf_(iso) {
  return new Date(String(iso) + 'T00:00:00+07:00');
}

// locale ของสคริปต์เป็น en → formatDate('d MMM') ได้ "31 Jul" ปนไทย ดูแปลก จึงแปลงเดือนเอง
function lotbThaiDate_(d) {
  var M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var p = Utilities.formatDate(d, 'Asia/Bangkok', 'd/M/yyyy').split('/');
  return p[0] + ' ' + M[Number(p[1]) - 1] + ' ' + (Number(p[2]) + 543);
}

/* ============================================================
 * 5) รายงาน
 * ============================================================ */

function lotbStars_(hit) {
  return new Array(Math.max(0, hit) + 1).join('⭐') || '—';
}

function lotbBar_(v) {              // 0..1 → แถบ 5 ช่อง
  var f = Math.round(v * 5), s = '', i;
  for (i = 0; i < 5; i++) s += (i < f ? '▰' : '▱');
  return s;
}

/** เกรดจากความแม่นที่วัดได้จริง เทียบฐานสุ่ม 60% */
function lotbGrade_(acc) {
  if (acc >= 0.70) return { g: 'A', s: '⭐⭐⭐⭐' };
  if (acc >= 0.65) return { g: 'B', s: '⭐⭐⭐' };
  if (acc >= 0.60) return { g: 'C', s: '⭐⭐' };
  return { g: 'D', s: '⭐' };
}

/**
 * รายงานหลัก — คำสั่ง "หวยลาวB" / "หวยไทยB"
 * @param kind 'lao' | 'thai'
 */
function lotbReportText_(kind) {
  var lao = (kind === 'lao');
  var hist = lotbHistory_(kind);
  if (hist.length < LOTB.WARM + 5) {
    return '🤖 เลขฐาน B — ยังคำนวณไม่ได้\n' +
      'มีผลย้อนหลังแค่ ' + hist.length + ' งวด (ต้องการอย่างน้อย ' + (LOTB.WARM + 5) + ')\n' +
      'สั่ง "' + (lao ? 'หวยลาว ดึง 200' : 'หวยไทย ดึง 200') + '" เพื่อโหลดผลย้อนหลังก่อน';
  }

  var d = lao ? nextLaoDrawDate_(new Date()) : nextDrawDate_(new Date());
  var sc = lotbScore_(hist, d);
  var order = sc.order;
  var base = order.slice(0, 6).map(function (x) { return x[0]; });
  var rsv = order.slice(6).map(function (x) { return x[0]; });          // กันหลุด 4 ตัวที่เหลือ
  var pos = lotbPosScore_(hist);
  var last = hist[hist.length - 1];

  // จัดเลขฐานลง 4 หลัก ห้ามใช้ซ้ำ (ลาว: ABCD → สามบน BCD · สองบน CD · สองล่าง AB)
  var seq = lotbSeq_(pos, base);
  var up3 = seq.slice(1), up2 = seq.slice(2), lo2 = seq.slice(0, 2);
  // ตัวหลัก (จากชุดเต็ม) ต้องอยู่หัวลิสต์เสมอ ไม่งั้นดูขัดกันเอง
  var up2s = lotbUniqStr_([up2].concat(lotbPairs_(pos, base, 2, 3, 3))).slice(0, 3);
  var lo2s = lotbUniqStr_([lo2].concat(lotbPairs_(pos, base, 0, 1, 3))).slice(0, 3);

  var bt = lotbBacktest_(hist, 60);                 // วัดความแม่น 60 งวดหลังสุด
  var gr = lotbGrade_(bt.acc);
  var mx = order[0][1], mn = order[9][1], rng = (mx - mn) || 1;

  var L = [];
  L.push(lao ? '🤖 หวยลาว B — AI BASE DIGITS' : '🤖 หวยไทย B — AI BASE DIGITS');
  L.push('งวด ' + lotbThaiDate_(d) + ' · อ้างอิงผลจริง ' + hist.length + ' งวด');
  L.push('งวดก่อน ' + last[0] + ' = ' + last[1]);
  L.push('═══════════════');
  L.push('📊 เลขฐาน (Base Digits)');
  L.push('   ' + base.join(' • '));
  L.push('🔥 เลขชนเด่น (Top 3) : ' + base.slice(0, 3).join(' • '));
  L.push('🛡️ กันหลุด (Reserve) : ' + rsv.join('') + ' / ' + rsv.slice(0, 3).join(''));
  L.push('');
  L.push('💎 ชุดกลั่นกรอง');
  L.push('   6 ตัว : ' + base.join(''));
  L.push('   5 ตัว : ' + base.slice(0, 5).join(''));
  L.push('   4 ตัว : ' + base.slice(0, 4).join(''));
  L.push('   3 ตัว : ' + base.slice(0, 3).join(''));
  L.push('   2 ตัว : ' + base.slice(0, 2).join(''));
  L.push('');
  L.push('🎯 AI FINAL PICK');
  L.push('   ชุดเต็ม 4 ตัว : ' + seq);
  L.push('   สามบน   : ' + up3 + '  (กันโต๊ด ' + up3.charAt(2) + up3.charAt(1) + up3.charAt(0) + ')');
  L.push('   สองบน   : ' + up2s.join(' · ') + '   (ตัวหลัก ' + up2 + ')');
  // ลาว: สองล่าง = 2 หลักหน้าของเลข 4 ตัว (งวดเดียวกัน) → ทายได้ตรงๆ
  // ไทย: 2 ตัวล่างออกคนละวง ไม่ได้มาจาก 4 ตัวบน → เรียกให้ตรงว่า "สองหน้า" ไม่หลอกตัวเอง
  L.push('   ' + (lao ? 'สองล่าง' : 'สองหน้า ') + ' : ' + lo2s.join(' · ') + '   (ตัวหลัก ' + lo2 + ')');
  if (!lao) L.push('   ※ 2 ตัวล่างของไทยออกคนละวงกับ 4 ตัวบน สูตรนี้ไม่ครอบคลุม');
  L.push('');
  L.push('🔁 Adaptive Echo (ต่อยอดจาก ' + last[1] + ')');
  L.push('   Echo −1 : ' + lotbEchoShift_(last[1], -1));
  L.push('   Echo +1 : ' + lotbEchoShift_(last[1], 1));
  L.push('');
  L.push('📈 คะแนนดิบ 0-9');
  order.forEach(function (o, i) {
    L.push('   ' + (i < 6 ? '✅' : '▫️') + ' ' + o[0] + ' ' +
      lotbBar_((o[1] - mn) / rng) + ' ' + Math.round((o[1] - mn) / rng * 100) + '%');
  });
  L.push('═══════════════');
  L.push('🎖️ Confidence : ' + (bt.acc * 100).toFixed(1) + '%  ·  Grade ' + gr.g + ' ' + gr.s);
  L.push('   (วัดจริง walk-forward ' + bt.n + ' งวดหลังสุด · ฐานสุ่มล้วน 60.0%)');
  L.push('');
  L.push('พิมพ์ "' + (lao ? 'หวยลาวB ย้อนหลัง' : 'หวยไทยB ย้อนหลัง') + '" = ดูผลตรวจสอบย้อนหลังทีละงวด');
  return L.join('\n');
}

/** เลื่อนทุกหลัก ±1 (mod 10) — 0702 → −1 = 9691 · +1 = 1813 */
function lotbEchoShift_(num, k) {
  return lotbDigits_(num).map(function (d) { return (d + k + 10) % 10; }).join('');
}

/**
 * 📈 BASE DIGITS HISTORY ANALYSIS — ตรวจย้อนหลังทีละงวด
 * @param n จำนวนงวด (ค่าเริ่มต้น 10)
 */
function lotbHistoryText_(kind, n) {
  var hist = lotbHistory_(kind);
  var want = Math.max(3, Math.min(Number(n) || 10, 60));
  if (hist.length < LOTB.WARM + want) {
    return '📈 ย้อนหลังยังไม่พอ — มี ' + hist.length + ' งวด (ต้องการ ' + (LOTB.WARM + want) + ')';
  }
  var bt = lotbBacktest_(hist, want);
  var all = lotbBacktest_(hist, 0);            // ทั้งกอง ไว้เทียบว่า 10 งวดล่าสุดฟลุกไหม
  var gr = lotbGrade_(bt.acc);

  var L = [];
  L.push('═══════════════');
  L.push('📈 BASE DIGITS HISTORY ANALYSIS');
  L.push('📊 วิเคราะห์เลขฐานย้อนหลัง — ' + (kind === 'lao' ? 'หวยลาว' : 'หวยไทย'));
  L.push('═══════════════');
  L.push('ย้อนหลัง ' + bt.n + ' งวด  (Base Digits | ผล | Hit)');
  bt.rows.slice().reverse().forEach(function (r) {
    L.push(r.base + ' | ' + r.num + ' → ' + r.hit + '/4 ' + lotbStars_(r.hit));
  });
  L.push('');
  L.push('Average Hit : ' + bt.avg.toFixed(1) + '/4');
  L.push('Best Hit : ' + bt.best + '/4  ·  Worst Hit : ' + bt.worst + '/4');
  L.push('Accuracy : ' + (bt.acc * 100).toFixed(1) + '%   ← ฐานสุ่มล้วน 60.0%');
  L.push('');
  L.push('📐 ทั้งกอง ' + all.n + ' งวด : ' + all.avg.toFixed(3) + '/4 (' +
    (all.acc * 100).toFixed(1) + '%) · Grade ' + lotbGrade_(all.acc).g);
  L.push('');
  L.push('⚠️ อ่านเลขให้เป็น: เลขฐาน 6 ตัวจาก 10 ตัว ถึงจิ้มมั่วก็ได้ 60% อยู่แล้ว');
  L.push('   สูตรนี้ทำได้ ' + (all.acc * 100).toFixed(1) + '% = ' +
    (all.acc > LOTB.RANDOM ? 'ดีกว่าสุ่ม ' + ((all.acc - LOTB.RANDOM) * 100).toFixed(1) + ' จุด (ยังน้อย ห้ามเชื่อ 100%)'
      : 'ยังไม่ชนะการสุ่ม'));
  L.push('   ที่เห็นตามกลุ่มหวยเคลม 80% คือเขาไม่ได้หักฐานสุ่มออก · เล่นพอสนุก');
  return L.join('\n');
}

/**
 * router ย่อยของคำสั่ง B (เรียกจาก handleLaoLottery_ / handleThaiLottery_)
 * @param arg ข้อความหลังตัด "หวยลาวB" / "หวยไทยB" ออกแล้ว
 */
function lotbHandle_(chatId, kind, arg) {
  var s = String(arg || '').trim();
  if (/^(ย้อนหลัง|ประวัติ|history|backtest|เช็ค|ตรวจ)/i.test(s)) {
    var n = (s.match(/(\d{1,3})\s*$/) || [])[1];
    return tgSend_(chatId, lotbHistoryText_(kind, Number(n) || 10));
  }
  return tgSend_(chatId, lotbReportText_(kind));
}
