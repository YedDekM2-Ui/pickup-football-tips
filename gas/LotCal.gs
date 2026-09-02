/**
 * ============================================================
 * Lottery.gs — หวยจากปฏิทิน 100 ปี (3 ตำรา) — โมดูลอับดุล
 * ============================================================
 * คำนวณ deterministic ในโค้ด (ฟรี ไม่เรียก API) สำหรับงวดถัดไป
 * 3 ตำรา:
 *   1) กำลังวัน (เลขประจำวันจันทร์-อาทิตย์)
 *   2) ข้างขึ้น-ข้างแรม (ค่ำ + ดิถี)
 *   3) เลขศาสตร์ผลรวมวันที่ (วัน+เดือน+ปีพ.ศ.)
 * ============================================================
 */

/** กำลังวัน (ตำราโหราศาสตร์ไทย) : อา6 จ15 อ8 พ17 พฤ19 ศ21 ส10 */
var DAY_POWER = [6, 15, 8, 17, 19, 21, 10];
var DAY_NAME_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/** งวดหวยไทยถัดไป (ออกทุกวันที่ 1 และ 16) จากวันที่อ้างอิง */
function nextDrawDate_(ref) {
  var d = ref ? new Date(ref) : new Date();
  var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  if (day < 16) return new Date(y, m, 16);
  return new Date(y, m + 1, 1);   // ข้ามเดือนอัตโนมัติ
}

/** งวดหวยไทยที่เพิ่งออก (ล่าสุด ≤ วันนี้) — ใช้ตอนบันทึกผล
 *  ⚠️ วันงวด (1/16) แต่ยังไม่ถึงเวลาออก (~16:00) = งวดวันนี้ยังไม่มีผล → ต้องถอยไปงวดก่อน
 *     ไม่งั้นลงผลงวดที่แล้วตอนเช้าวันงวด จะถูกบันทึกเป็นงวดวันนี้ */
function lastDrawDate_(ref) {
  var d = ref ? new Date(ref) : new Date();
  var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  if ((day === 1 || day === 16) && d.getHours() < 16)
    return day === 16 ? new Date(y, m, 1) : new Date(y, m - 1, 16);   // m-1 = ธ.ค. ปีก่อนได้เอง
  return new Date(y, m, day >= 16 ? 16 : 1);
}

/** วันออกหวยลาว = จันทร์–ศุกร์ (ไม่ออก เสาร์-อาทิตย์) */
function isLaoDrawDay_(d) {
  var w = d.getDay();
  return w >= 1 && w <= 5;
}

/** งวดหวยลาวถัดไป (ทุก จ.–ศ.) — วันออกก่อน 21:00 ถือเป็นงวดวันนี้ */
function nextLaoDrawDate_(ref) {
  var d = ref ? new Date(ref) : new Date();
  if (isLaoDrawDay_(d) && d.getHours() < 21)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  for (var i = 1; i <= 7; i++) {
    var n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    if (isLaoDrawDay_(n)) return n;
  }
  return d;
}

/** งวดหวยลาวที่เพิ่งออก (จ.–ศ. ล่าสุด ≤ วันนี้) — ใช้ตอนบันทึกผล
 *  ⚠️ ยังไม่ถึง 21:00 (LAO.ASK_HOUR) = งวดวันนี้ยังไม่ออก → เริ่มนับที่เมื่อวาน
 *     ตรงกับกติกาของ nextLaoDrawDate_ ที่ถือว่าก่อน 21:00 งวดวันนี้ยังเป็น "งวดหน้า" */
function lastLaoDrawDate_(ref) {
  var d = ref ? new Date(ref) : new Date();
  var start = (isLaoDrawDay_(d) && d.getHours() < 21) ? 1 : 0;
  for (var i = start; i <= 8; i++) {
    var n = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    if (isLaoDrawDay_(n)) return n;
  }
  return d;
}

/**
 * parseLotDateArg_ - ดึงวันที่ย้อนหลังท้ายคำสั่ง "d/m" หรือ "d/m/yy" → ISO
 * เช่น "ผลหวยลาว 0392 21/7" → '2026-07-21' · ไม่มี = null (ใช้งวดล่าสุด)
 */
function parseLotDateArg_(s) {
  var m = String(s || '').match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*$/);
  if (!m) return null;
  var now = new Date();
  var day = +m[1], mon = +m[2], y = m[3] ? ceYear_(m[3]) : now.getFullYear();
  if (!y) return null;                          // "69" = พ.ศ. 2569 → 2026 (ไม่ใช่ 2069)
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
  var d = new Date(y, mon - 1, day);
  // ไม่ระบุปีแล้วได้วันอนาคต = หมายถึงปีที่แล้ว
  if (!m[3] && d.getTime() > now.getTime() + 86400000) d = new Date(y - 1, mon - 1, day);
  return Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
}

/** ตัดวันที่ท้ายคำสั่งออก เหลือเฉพาะตัวเลขผล (กันเลขวันที่ถูกอ่านเป็นผลหวย) */
function stripLotDateArg_(s) {
  return String(s || '').replace(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*$/, '').trim();
}

/** อายุดวงจันทร์ (วัน) จากจุดอ้างอิง new moon 2000-01-06 18:14 UTC */
function moonAge_(date) {
  var synodic = 29.530588853;
  var epoch = Date.UTC(2000, 0, 6, 18, 14, 0);
  var days = (date.getTime() - epoch) / 86400000;
  var age = days % synodic;
  if (age < 0) age += synodic;
  return age;
}

/** ข้างขึ้น/ข้างแรม + ค่ำ (1-15) */
function lunarPhase_(date) {
  var age = moonAge_(date);
  if (age < 14.765) return { waxing: true,  kham: Math.min(15, Math.floor(age) + 1) };
  return { waxing: false, kham: Math.min(15, Math.floor(age - 14.765) + 1) };
}

function uniq2_(arr) {
  var seen = {}, out = [];
  arr.forEach(function (n) {
    var s = ('0' + (((n % 100) + 100) % 100)).slice(-2);
    if (!seen[s]) { seen[s] = true; out.push(s); }
  });
  return out;
}

/**
 * lotteryFromCalendar_ - คืนผลลัพธ์ 3 ตำรา + สรุปเลขซ้ำ
 */
function lotteryFromCalendar_(dateOpt) {
  var d = dateOpt ? new Date(dateOpt) : nextDrawDate_(new Date());
  var dow = d.getDay();
  var day = d.getDate(), month = d.getMonth() + 1, yBE = d.getFullYear() + 543;

  // --- ตำรา 1: กำลังวัน ---
  var power = DAY_POWER[dow];
  var t1good = uniq2_([power, power % 10 * 11, (power * 2)]);
  var t1bad  = uniq2_([(power + 5), (10 - (power % 10)) % 10 * 11]);

  // --- ตำรา 2: ข้างขึ้น-ข้างแรม ---
  var lp = lunarPhase_(d);
  var base = lp.kham;                          // 1-15
  var t2good = uniq2_([base, (base % 10) * 11, base + (lp.waxing ? 0 : 50)]);
  var t2bad  = uniq2_([(15 - base), (base * 3)]);

  // --- ตำรา 3: เลขศาสตร์ผลรวมวันที่ ---
  var sum = day + month + (yBE % 100);
  var root = ((sum - 1) % 9) + 1;              // 1-9
  var two = ('0' + (sum % 100)).slice(-2);
  var t3good = uniq2_([sum % 100, root * 11, day]);
  var t3bad  = uniq2_([(month * 7) % 100, (10 - root) % 10 * 11]);

  // --- กันเลขโผล่ทั้งช่อง "ดี" และ "เสีย" พร้อมกัน ---
  // เจอจริง: กำลังวัน=10 → ดี 10·00·20 แต่ (10-power%10)%10*11 = 00 เด้งไปอยู่ในเสียด้วย (ลาวก็ 55 ซ้ำแบบเดียวกัน)
  // กติกา: ติด "ดี" ของตำราไหนก็ตาม = ตัดออกจากช่องเสียทุกตำรา (ดีชนะ) → 🚫 เลี่ยง ก็สะอาดตามไปเอง
  var goodSet = {};
  [t1good, t2good, t3good].forEach(function (a) { a.forEach(function (s) { goodSet[s] = 1; }); });
  var cutGood = function (a) { return a.filter(function (s) { return !goodSet[s]; }); };
  t1bad = cutGood(t1bad); t2bad = cutGood(t2bad); t3bad = cutGood(t3bad);

  // --- สรุปเลขที่ซ้ำหลายตำรา = เด่นสุด ---
  var allGood = t1good.concat(t2good).concat(t3good);
  var count = {};
  allGood.forEach(function (s) { count[s] = (count[s] || 0) + 1; });
  var hot = Object.keys(count).filter(function (s) { return count[s] >= 2; });
  // 3 ตำราคิดคนละฐาน (กำลังวัน / ข้างขึ้น / ผลรวมวันที่) → ส่วนใหญ่ไม่ซ้ำกันเลย เด่นสุดเลยว่างประจำ
  // → ไม่ซ้ำก็ยกตัวหลักของแต่ละตำรา (ตัวแรก = ตัวตั้งต้นก่อนแปลง) มาเป็นเด่นแทน ไม่ปล่อย '—'
  if (!hot.length) {
    hot = uniq2_([t1good[0], t2good[0], t3good[0]].filter(String).map(function (s) { return parseInt(s, 10); }));
  }

  return {
    drawDate: Utilities.formatDate(d, 'Asia/Bangkok', 'd MMM') + ' ' + yBE,
    dayName: DAY_NAME_TH[dow],
    lunar: (lp.waxing ? 'ขึ้น' : 'แรม') + ' ' + lp.kham + ' ค่ำ',
    t1: { good: t1good, bad: t1bad, power: power },
    t2: { good: t2good, bad: t2bad },
    t3: { good: t3good, bad: t3bad, sum: sum, root: root },
    hot: hot
  };
}

/**
 * ข้อความหวยพร้อมส่ง Telegram — จัดแนวตั้ง อ่านง่ายบนมือถือ (เลี่ยง table pipe ที่ TG ไม่เรนเดอร์)
 * @param dateOpt วันงวด (ไม่ใส่ = คำนวณจาก kind)
 * @param kind    'lao' = ตำราลาว (งวด จ./ศ.) · อื่นๆ/ว่าง = ตำราไทย (งวด 1 & 16)
 */
function lotteryText_(dateOpt, kind) {
  var lao = /lao|ลาว/i.test(String(kind || ''));
  var d = dateOpt ? new Date(dateOpt) : (lao ? nextLaoDrawDate_(new Date()) : nextDrawDate_(new Date()));
  var r = lotteryFromCalendar_(d);
  // เก็บชุดเลขของงวดถัดไปไว้เกรดทีหลัง (เฉพาะงวดปกติ ไม่เก็บตอนดูย้อนหลัง)
  if (!dateOpt && typeof savePredictionQuiet_ === 'function') {
    savePredictionQuiet_(lao ? 'lao' : 'thai', d, r);
  }
  var dot = function (a) { return a.length ? a.join(' · ') : '—'; };
  var allBad = uniq2_(r.t1.bad.concat(r.t2.bad).concat(r.t3.bad).map(function (s) { return parseInt(s, 10); }));

  var L = [];
  L.push(lao ? '🇱🇦 ตำราลาว — เลขเด่นหวยลาว' : '🇹🇭 ตำราไทย — เลขเด่นหวยไทย');
  L.push('งวด ' + r.drawDate + ' · ' + r.dayName + ' · ' + r.lunar);
  L.push('━━━━━━━━━━━━━━');
  L.push('① กำลังวัน (=' + r.t1.power + ')');
  L.push('   ✅ ดี   ' + dot(r.t1.good));
  L.push('   ❌ เสีย  ' + dot(r.t1.bad));
  L.push('');
  L.push('② ข้างขึ้น-แรม');
  L.push('   ✅ ดี   ' + dot(r.t2.good));
  L.push('   ❌ เสีย  ' + dot(r.t2.bad));
  L.push('');
  L.push('③ เลขศาสตร์ (รวม=' + r.t3.sum + ')');
  L.push('   ✅ ดี   ' + dot(r.t3.good));
  L.push('   ❌ เสีย  ' + dot(r.t3.bad));
  L.push('━━━━━━━━━━━━━━');
  L.push('⭐ เด่นสุด : ' + (r.hot.length ? r.hot.join(' · ') : '—'));
  L.push('🔁 เบิ้ล   : ' + dot(uniq2_([r.t1.power % 10 * 11, r.t3.root * 11])));
  L.push('🚫 เลี่ยง  : ' + dot(allBad));
  // 📈 แปะสถิติจริงที่วัดได้ท้ายข้อความ — ดูเลขทีไรเห็นผลงานจริงทุกครั้ง
  if (typeof lotTrackLine_ === 'function') {
    var tl = lotTrackLine_(lao ? 'lao' : 'thai');
    if (tl) L.push(tl);
  }
  return L.join('\n');
}

/* ============================================================
 * เมนูรวม "หวย" — ตำราไทย + ตำราลาว + คีย์ลัดทั้งหมด
 * ============================================================ */
function lotteryMenuText_() {
  return [
    '🎰 หวย — เมนูรวม',
    '━━━━━━━━━━━━━━',
    lotteryText_(null, 'thai'),
    '',
    lotteryText_(null, 'lao'),
    '',
    lotteryKeysText_()
  ].join('\n');
}

/** คีย์ลัดหวยทั้งหมด — ใช้ซ้ำได้ทั้งเมนูหวย/หวยไทย/หวยลาว/เมนูใหญ่ */
function lotteryKeysText_() {
  return [
    '━━━ 🔑 คีย์หวย (จำแค่นี้พอ) ━━━',
    '🇹🇭 หวยไทย            → ตำราไทย + ผลล่าสุด + สถิติ',
    '🇱🇦 หวยลาว            → ตำราลาว + ผลล่าสุด + สถิติ',
    '',
    '🤖 หวยไทยB · หวยลาวB   → เลขฐาน 6 ตัว (AI Base Digits)',
    '   คิดจากผลจริงย้อนหลัง (Echo+Markov+ค้าง+ตำรา) ไม่ใช่ปฏิทินล้วน',
    '   ต่อท้าย "ย้อนหลัง [n]" = ตรวจความแม่นทีละงวด เช่น หวยลาวB ย้อนหลัง 20',
    '',
    '📥 อัพผล (เก็บเข้าสถิติ):',
    '   ผลหวยไทย 1234 56   (4 ตัวบน เว้นวรรค 2 ตัวล่าง)',
    '   ผลหวยลาว 0392      (เลข 2–4 หลัก · สามบน 392 · สองบน 92 · สองล่าง 03)',
    '   ย้อนหลัง = ต่อท้ายวันที่ เช่น "ผลหวยลาว 0392 21/7"',
    '',
    '🎯 หวยไทย แม่น · หวยลาว แม่น     → ความแม่นของ 3 ตำรา (เกรดอัตโนมัติ)',
    '🔁 หวยลาว เกรดย้อนหลัง          → เกรดงวดเก่าที่มีผลแล้วทั้งหมด',
    '',
    '📊 หวยไทย สถิติ · หวยลาว สถิติ   → ดูย้อนหลัง+เลขฮอต',
    '🔔 หวยลาว ถาม        → ถามงวดที่ยังไม่ได้บันทึกเดี๋ยวนี้',
    '   (ตอบเลขกลับ = บันทึกให้อัตโนมัติ)'
  ].join('\n');
}
