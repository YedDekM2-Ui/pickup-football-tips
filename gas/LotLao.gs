/**
 * ============================================================
 * LaoLottery.gs — หวยลาว: บอทถาม จ.–ศ. → เจ้าของตอบเลข → บันทึกสถิติ
 * ============================================================
 * หวยลาวออกทุกวันจันทร์–ศุกร์ · 21:00 บอทถาม "หวยลาวออกอะไร?" (force_reply)
 * เจ้าของพิมพ์เลข 4 ตัว (เช่น 0392) → บันทึกลงชีต Lao_Lottery + สรุปสถิติ
 *
 * คำสั่ง:
 *   หวยลาว                → ตำราลาว + ผลล่าสุด + สถิติย่อ
 *   หวยลาว สถิติ           → สถิติเต็ม (สองบนฮอต / สองล่างฮอต / เลขท้าย / ล่าสุด)
 *   ผลหวยลาว 0392         → บันทึกผลงวดล่าสุด (ต่อท้ายวันที่ = ย้อนหลัง)
 *   หวยลาว ถาม           → ถามงวดที่ยังไม่ได้บันทึกเดี๋ยวนี้
 *   หวยลาว ค้าง           → งวดที่ยังไม่ได้บันทึก
 *   หวยลาว เพิ่มงวด 1/8    → เพิ่มงวดพิเศษ · หวยลาว ตัดงวด 1/8 → ตัดงวด
 *   หวยลาว ถาม            → ยิงคำถามทดสอบทันที
 *   หวยลาว ดึง [200]      → ดึงผลย้อนหลังจาก sanook อัตโนมัติ (LotteryBackfill.gs)
 * ============================================================
 */

var LAO = {
  SHEET: 'Lao_Lottery',
  HEADERS: ['dateISO', 'วันที่', 'เลข', 'สามบน', 'สองบน'],
  ASK_FN: 'askLaoLottery_',
  ASK_HOUR: 21,                 // ถามหลังหวยออก (~20:30 เวียงจันทน์)
  PROP_PENDING: 'LAO_PENDING'
};

/* ============================================================
 * router คำสั่ง "หวยลาว ..."
 * ============================================================ */
function handleLaoLottery_(chatId, t) {
  var s = String(t || '').replace(/^หวยลาว\s*/, '').trim();
  var low = s.toLowerCase();

  // "หวยลาวB" = ระบบเลขฐาน (LotBase.gs) — เช็คก่อนทุกตัว กัน "B ย้อนหลัง" ไปตกเกรดย้อนหลัง
  if (/^(b|บี)(\s|$)/i.test(s)) return lotbHandle_(chatId, 'lao', s.replace(/^(b|บี)\s*/i, ''));

  if (/^(เกรดย้อนหลัง|ย้อนหลัง|regrade)/i.test(s)) {
    var nG = (s.match(/(\d{1,4})\s*$/) || [])[1];
    return tgSend_(chatId, lotGradeBackfill_('lao', Number(nG) || 200));
  }
  if (/^(ตำแหน่ง|โต๊ด|position|pos)/i.test(s)) {
    var nP = (s.match(/(\d{1,4})\s*$/) || [])[1];
    return tgSend_(chatId, lotPosStatsText_('lao', Number(nP) || 100));
  }
  if (/^(แม่น|ความแม่น|เกรด|accuracy)/i.test(s)) return tgSend_(chatId, lotAccuracyText_('lao', 60));
  if (/^(ซ่อม|repair|fix)/i.test(s)) return tgSend_(chatId, lotRepairSheet_('lao'));
  if (/^(ค้าง|งวดค้าง|due)/i.test(s)) return tgSend_(chatId, lotDueText_('lao'));
  if (/^(เพิ่มงวด|งวดพิเศษ)/i.test(s)) return tgSend_(chatId, lotEditDraw_('lao', s, true));
  if (/^(ตัดงวด|ลบงวด|ไม่มีงวด)/i.test(s)) return tgSend_(chatId, lotEditDraw_('lao', s, false));
  if (/^(สถิติ|stat|stats|ประวัติ)/i.test(s)) return tgSend_(chatId, laoStatsText_(30));
  // ⛔ บอทนี้ไม่มี trigger (ไม่ขอสิทธิ์ script.scriptapp) — ตัวถามยิงจากข้างนอกผ่าน ?p=lotask
  if (/^(เตือน|ตั้งเตือน|setup|เปิดเตือน|ปิดเตือน|stop)/i.test(s))
    return tgSend_(chatId, '🔔 บอทนี้ไม่ตั้งเตือนเอง\nพิมพ์ "หวยลาว ถาม" เพื่อให้ถามงวดค้างเดี๋ยวนี้');
  if (/^(ถาม|test|ทดสอบ)/i.test(s)) { askLaoLottery_(true); return; }
  if (/^(ดึง|โหลด|backfill|sync)/i.test(s)) {
    var nL = (s.match(/(\d{2,4})\s*$/) || [])[1];
    return tgSend_(chatId, laoBackfill(nL));
  }
  if (/^(ตำรา|เลขเด่น|เลข)$/.test(s)) return tgSend_(chatId, lotteryText_(null, 'lao'));

  var dISO = parseLotDateArg_(s);          // "0392 21/7" → วันงวดย้อนหลัง
  var body = stripLotDateArg_(s);          // ตัดวันที่ออกก่อน กันเลขวันที่ถูกอ่านเป็นผล
  var num = body.match(/\b(\d{2,4})\b/);
  if (num) return tgSend_(chatId, recordLaoResult_(num[1], dISO));   // ไม่ระบุวัน = งวดล่าสุด

  // ไม่มีอาร์กิวเมนต์ = สรุปย่อ
  return tgSend_(chatId, laoOverviewText_());
}

/**
 * บอทถาม — trigger ยิงทุกวัน แต่ถามเฉพาะวันที่มีงวดค้าง
 * ⚠️ GAS ส่ง event object เข้ามาเป็น argument แรกเสมอ → ต้องเทียบ force === true
 */
function askLaoLottery_(force) {
  var chatId = getTgChatId_();
  if (!chatId) { logEvent_('WARN', 'askLaoLottery_: ไม่มี chat id'); return; }
  var todayISO = lotTodayISO_();
  var due = lotDueDraws_('lao', todayISO);
  if (force !== true && !due.length) return;          // เสาร์-อาทิตย์ / บันทึกครบแล้ว = เงียบ
  var iso = due.length ? due[0] : todayISO;           // ค้างเก่าสุดก่อน
  setLaoPending_({ date: iso, ts: Date.now() });
  var late = (iso !== todayISO)
    ? '\n(งวด ' + lotShortDate_(iso) + ' ยังไม่ได้บันทึก เลยตามถามย้อนให้ครับ)' : '';
  tgSendForceReply_(chatId,
    '🇱🇦 หวยลาวงวด ' + lotShortDate_(iso) + ' ออกอะไรครับ?' + late + '\n' +
    'พิมพ์เลข 4 ตัว เช่น 0392\n' +
    '(หรือพิมพ์ "ข้าม" ถ้าไม่ต้องเก็บงวดนี้)');
}

/* ============================================================
 * จับคำตอบ — เรียกจาก handleText_ (ถ้ามี pending อยู่)
 *   คืน string ถ้าจัดการแล้ว, null ถ้าไม่เกี่ยว (ให้ทำคำสั่งปกติต่อ)
 * ============================================================ */
function laoCatchReply_(chatId, t, lower) {
  var p = getLaoPending_();
  if (!p) return null;
  // หมดอายุ (เกิน 15 ชม. เผื่อตอบเช้าวันรุ่งขึ้น) → ล้างทิ้ง ปล่อยข้อความทำงานปกติ
  if (Date.now() - (p.ts || 0) > 15 * 3600000) { clearLaoPending_(); return null; }

  if (/^(ข้าม|ไม่ออก|ยังไม่ออก|skip|\/ข้าม)$/i.test(lower)) {
    clearLaoPending_();
    if (p.date) lotDrawListAdd_(LOT_DUE.PROP_SKIP, 'lao', p.date);   // เลิกตามถามงวดนี้
    return 'โอเค ข้ามงวด ' + lotShortDate_(p.date) + ' ครับ' +
      '\n(พิมพ์ "ผลหวยลาว 0392 ' + lotShortDate_(p.date) + '" ทีหลังได้ถ้าอยากเก็บ)' +
      lotAskNextDue_('lao');
  }
  if (/^\d{2,4}$/.test(t)) return recordLaoResult_(t, p.date) + lotAskNextDue_('lao');
  clearLaoPending_();                                            // พิมพ์อย่างอื่น → ยกเลิกรอ ทำคำสั่งปกติ
  return null;
}

/* ============================================================
 * บันทึกผล
 * ============================================================ */
function recordLaoResult_(numRaw, dateISO) {
  var num = String(numRaw).replace(/\D/g, '');
  if (num.length < 2 || num.length > 4) return '❌ เลขไม่ถูกต้อง — พิมพ์ 2–4 หลัก เช่น 0392';
  // หวยลาวออก 4 หลักเสมอ → พิมพ์ 3 หลักมา = เลข 0 หน้าหาย เติมคืนให้ (2 หลัก = รู้แค่สองบน ปล่อยไว้)
  if (num.length === 3) num = lotPad_(num, 4);
  clearLaoPending_();

  var d = dateISO ? new Date(dateISO + 'T00:00:00') : lastLaoDrawDate_(new Date());
  var iso = Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
  var thai = Utilities.formatDate(d, 'Asia/Bangkok', 'E d/M/yy');
  var d3 = num.length >= 3 ? num.slice(-3) : '';
  var d2 = num.slice(-2);

  // ไม่ได้ระบุวันเอง = เดาให้ → บอกทางแก้ถ้าเดาผิด (ยกงวดก่อนหน้ามาให้ก๊อปได้เลย)
  var hint = '';
  if (!dateISO) {
    var prev = lastLaoDrawDate_(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 23, 59));
    hint = '\n💡 ถ้าเป็นผลงวดก่อน พิมพ์  ผลหวยลาว ' + num + ' ' +
      Utilities.formatDate(prev, 'Asia/Bangkok', 'd/M');
  }

  // เกรดคำทำนายงวดนี้ (ถ้าเคยเก็บไว้) — ว่างถ้าไม่มี
  var gTxt = '';
  var g = gradePrediction_('lao', iso, num);
  if (g) gTxt = '\n\n' + g;

  var sh = sheetEnsure_(LAO.SHEET, LAO.HEADERS);
  // กันบันทึกซ้ำวันเดียวกัน → อัปเดตแถวเดิม
  // ⚠️ คอลัมน์ A อาจถูก Sheets แปลงเป็น Date → ต้องผ่าน lotIso_ ไม่งั้นหาไม่เจอ = แถวซ้ำ
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (lotIso_(data[i][0]) === iso) {
      lotSetText_(sh, i + 1, 1, [[iso, thai, num, d3, d2]]);
      return '✏️ อัปเดตผลหวยลาว ' + thai + ' = ' + num + laoBreak_(num) +
        hint + '\n' + laoMiniStats_() + gTxt;
    }
  }
  // ⚠️ appendRow ไม่ได้ — Sheets จะกินเลข 0 หน้า ('0480' → 480) ต้อง lotSetText_ (ฟอร์แมต @ ก่อนเขียน)
  lotSetText_(sh, sh.getLastRow() + 1, 1, [[iso, thai, num, d3, d2]]);
  return '✅ บันทึกหวยลาว ' + thai + ' = ' + num + laoBreak_(num) +
    hint + '\n' + laoMiniStats_() + gTxt;
}

/**
 * แยกส่วนเลขลาวเป็นบรรทัดเดียว → '\n  สามบน 702 · สองบน 02 · สองล่าง 07'
 * หวยลาว 4 หลัก ABCD: สามบน = BCD · สองบน = CD (2 ตัวท้าย) · สองล่าง = AB (2 ตัวหน้า)
 * เลขไม่ครบ 4 หลัก = โชว์เท่าที่รู้ (2 หลัก = รู้แค่สองบน)
 */
function laoBreak_(numRaw) {
  var n = String(numRaw || '').replace(/\D/g, '');
  var P = [];
  if (n.length >= 3) P.push('สามบน ' + n.slice(-3));
  if (n.length >= 2) P.push('สองบน ' + n.slice(-2));
  if (n.length >= 4) P.push('สองล่าง ' + n.slice(0, 2));
  return P.length ? '\n  ' + P.join(' · ') : '';
}

/* ============================================================
 * สถิติ
 * ============================================================ */
/** แถวผลหวยลาว เรียงเก่า→ใหม่ · ข้อความล้วน (เลข 0 หน้าครบ) · ตัดงวดซ้ำแล้ว */
function laoReadRows_() {
  return lotResultRows_('lao');                 // LotCore.gs — normalize Date/เลข 0 หน้า + dedupe
}

function laoMiniStats_() {
  var rows = laoReadRows_();
  if (!rows.length) return '(ยังไม่มีสถิติ) 🎯 เด่น: -';
  return '📊 บันทึกแล้ว ' + rows.length + ' งวด · 🎯 เด่นสองบน: ' + laoHotPair_() + ' · ท้าย ' + laoHotDigit_() +
    '\nล่าสุด: ' + rows.slice(-5).map(function (r) { return r[2]; }).reverse().join(', ');
}

/** เด่นสองบน = คู่ท้าย (2 ตัวท้าย) ที่ออกบ่อยสุด — ยังไม่มีข้อมูล = '-' */
function laoHotPair_() {
  var rows = laoReadRows_();
  if (!rows.length) return '-';
  var c = {};
  rows.forEach(function (r) { var d = String(r[4] || r[2]).slice(-2); if (d) c[d] = (c[d] || 0) + 1; });
  var keys = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
  return keys.length ? keys[0] + '(' + c[keys[0]] + ')' : '-';
}

/** เลขเด่นท้าย = เลขท้าย 1 ตัวที่ออกบ่อยสุด */
function laoHotDigit_() {
  var rows = laoReadRows_();
  if (!rows.length) return '-';
  var c = {};
  rows.forEach(function (r) { var d = String(r[4] || r[2]).slice(-1); if (d) c[d] = (c[d] || 0) + 1; });
  var keys = Object.keys(c).sort(function (a, b) { return c[b] - c[a]; });
  return keys.length ? keys[0] : '-';
}

function laoStatsText_(limit) {
  var rows = laoReadRows_();
  if (!rows.length)
    return '📊 หวยลาว — ยังไม่มีข้อมูล\nเริ่มเก็บด้วย  "ผลหวยลาว 0392"\n(ย้อนหลังได้ เช่น "ผลหวยลาว 0392 21/7")';

  // ความถี่ สองบน (2 ตัวท้าย) + สองล่าง (2 ตัวหน้า) + เลขท้าย 1 ตัว
  var c2 = {}, c1 = {}, cLow = {};
  rows.forEach(function (r) {
    var d2 = String(r[4] || r[2]).slice(-2);
    c2[d2] = (c2[d2] || 0) + 1;
    var d1 = d2.slice(-1);
    c1[d1] = (c1[d1] || 0) + 1;
    var full = String(r[2] || '').replace(/\D/g, '');
    if (full.length >= 4) { var lo = full.slice(0, 2); cLow[lo] = (cLow[lo] || 0) + 1; }
  });
  function top(obj, n) {
    return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; })
      .slice(0, n).map(function (k) { return k + '(' + obj[k] + ')'; });
  }

  var L = [];
  L.push('📊 สถิติหวยลาว (' + rows.length + ' งวด)');
  L.push('━━━━━━━━━━━━');
  L.push('🔥 สองบนออกบ่อย: ' + top(c2, 6).join('  '));
  if (Object.keys(cLow).length) L.push('🔻 สองล่างออกบ่อย: ' + top(cLow, 6).join('  '));
  L.push('🔢 เลขท้ายฮอต: ' + top(c1, 5).join('  '));
  L.push('━━━━━━━━━━━━');
  L.push('🗓️ ล่าสุด ' + Math.min(limit || 15, rows.length) + ' งวด:');
  rows.slice(-(limit || 15)).reverse().forEach(function (r) {
    var n = String(r[2] || '').replace(/\D/g, '');
    L.push('  ' + r[1] + '  →  ' + r[2] +
      (n.length >= 4 ? '  (บน ' + n.slice(-3) + '/' + n.slice(-2) + ' · ล่าง ' + n.slice(0, 2) + ')' : ''));
  });
  return L.join('\n');
}

function laoOverviewText_() {
  var rows = laoReadRows_();
  var last = rows.length ? rows[rows.length - 1] : null;

  var L = ['🇱🇦 หวยลาว — เมนู', '━━━━━━━━━━━━'];
  L.push(last ? '🏆 ผลล่าสุด ' + last[1] + ' = ' + last[2] + laoBreak_(last[2]) : '🏆 ยังไม่มีผลบันทึก');
  L.push(laoMiniStats_());
  L.push('');
  L.push(lotteryText_(null, 'lao'));         // ⬅️ ตำราลาวของงวดนั้น (จ.–ศ.)
  L.push('');
  L.push('━━━ 🔑 คีย์หวยลาว ━━━');
  L.push('📥 อัพผล    →  ผลหวยลาว 0392');
  L.push('   ย้อนหลัง →  ผลหวยลาว 0392 21/7');
  L.push('📊 สถิติเต็ม →  หวยลาว สถิติ');
  L.push('📍 ตำแหน่งที่เข้า →  หวยลาว ตำแหน่ง');
  L.push('⬇️ ดึงย้อนหลัง →  หวยลาว ดึง 200  (auto จาก sanook)');
  L.push('🔔 ให้บอทถามงวดค้าง → หวยลาว ถาม');
  L.push('🇹🇭 หวยไทย   →  ดูฝั่งไทย');
  return L.join('\n');
}

/* ---------- pending (persistent ใน Script Property) ---------- */
function setLaoPending_(o) { PropertiesService.getScriptProperties().setProperty(LAO.PROP_PENDING, JSON.stringify(o)); }
function getLaoPending_() {
  var v = PropertiesService.getScriptProperties().getProperty(LAO.PROP_PENDING);
  try { return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function clearLaoPending_() { PropertiesService.getScriptProperties().deleteProperty(LAO.PROP_PENDING); }
