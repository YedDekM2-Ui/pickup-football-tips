/**
 * ============================================================
 * ThaiLottery.gs — หวยไทย: บันทึกผล + สถิติ (คู่กับ LaoLottery.gs)
 * ============================================================
 * ตำราไทย (เลขเด่น) อยู่ใน Lottery.gs — ไฟล์นี้เก็บ "ผลจริง" ที่ออก
 * งวดหวยไทย = ทุกวันที่ 1 และ 16
 *
 * คำสั่ง:
 *   หวยไทย                 → ตำราไทยงวดหน้า + ผลล่าสุด + สถิติย่อ
 *   หวยไทย สถิติ            → สถิติเต็ม
 *   ผลหวยไทย 1234 56       → บันทึกผลงวดล่าสุด (4 ตัวบน / 2 ตัวล่าง)
 *   ผลหวยไทย 1234 56 16/7  → บันทึกย้อนหลัง (ระบุวันงวด)
 *   หวยไทย ถาม             → ถามงวดที่ยังไม่ได้บันทึกเดี๋ยวนี้
 *   หวยไทย ค้าง             → งวดที่ยังไม่ได้บันทึก
 *   หวยไทย เพิ่มงวด 30/12    → เพิ่มงวดพิเศษ (กองสลากเลื่อน)
 *   หวยไทย ตัดงวด 1/1        → ตัดงวดที่ไม่มีจริง
 *   หวยไทย ถาม             → ยิงคำถามทดสอบทันที
 *   หวยไทย ดึง [200]       → ดึงผลย้อนหลังจาก thairath อัตโนมัติ (LotteryBackfill.gs)
 * ============================================================
 */

var THAI_LOT = {
  SHEET: 'Thai_Lottery',
  // A–D เดิมความหมายไม่เปลี่ยน (สถิติทุกฟังก์ชันอ่าน r[2]/r[3]) · E–G เพิ่มใหม่จาก backfill
  HEADERS: ['dateISO', 'งวด', '4ตัวบน', '2ตัวล่าง', 'รางวัลที่1', 'เลขหน้า3ตัว', 'เลขท้าย3ตัว'],
  ASK_FN: 'askThaiLottery_',
  ASK_HOUR: 16,                 // ถามหลังหวยออก (บนออก ~15:30)
  PROP_PENDING: 'THAI_PENDING'
};

/* ============================================================
 * router คำสั่ง "หวยไทย ..."
 * ============================================================ */
function handleThaiLottery_(chatId, t) {
  var s = String(t || '').replace(/^หวยไทย\s*/, '').trim();

  // "หวยไทยB" = ระบบเลขฐาน (LotBase.gs) — เช็คก่อนทุกตัว กัน "B ย้อนหลัง" ไปตกเกรดย้อนหลัง
  if (/^(b|บี)(\s|$)/i.test(s)) return lotbHandle_(chatId, 'thai', s.replace(/^(b|บี)\s*/i, ''));

  if (/^(เกรดย้อนหลัง|ย้อนหลัง|regrade)/i.test(s)) {
    var nG = (s.match(/(\d{1,4})\s*$/) || [])[1];
    return tgSend_(chatId, lotGradeBackfill_('thai', Number(nG) || 200));
  }
  if (/^(ตำแหน่ง|โต๊ด|position|pos)/i.test(s)) {
    var nP = (s.match(/(\d{1,4})\s*$/) || [])[1];
    return tgSend_(chatId, lotPosStatsText_('thai', Number(nP) || 100));
  }
  if (/^(แม่น|ความแม่น|เกรด|accuracy)/i.test(s)) return tgSend_(chatId, lotAccuracyText_('thai', 60));
  if (/^(ซ่อม|repair|fix)/i.test(s)) return tgSend_(chatId, lotRepairSheet_('thai'));
  if (/^(ค้าง|งวดค้าง|due)/i.test(s)) return tgSend_(chatId, lotDueText_('thai'));
  if (/^(เพิ่มงวด|งวดพิเศษ)/i.test(s)) return tgSend_(chatId, lotEditDraw_('thai', s, true));
  if (/^(ตัดงวด|ลบงวด|ไม่มีงวด)/i.test(s)) return tgSend_(chatId, lotEditDraw_('thai', s, false));
  if (/^(สถิติ|stat|stats|ประวัติ)/i.test(s)) return tgSend_(chatId, thaiStatsText_(24));
  // ⛔ บอทนี้ไม่มี trigger (ไม่ขอสิทธิ์ script.scriptapp) — ตัวถามยิงจากข้างนอกผ่าน ?p=lotask
  if (/^(เตือน|ตั้งเตือน|setup|เปิดเตือน|ปิดเตือน|stop)/i.test(s))
    return tgSend_(chatId, '🔔 บอทนี้ไม่ตั้งเตือนเอง\nพิมพ์ "หวยไทย ถาม" เพื่อให้ถามงวดค้างเดี๋ยวนี้');
  if (/^(ถาม|test|ทดสอบ)/i.test(s)) { askThaiLottery_(true); return; }
  if (/^(ดึง|โหลด|backfill|sync)/i.test(s)) {
    var nT = (s.match(/(\d{2,4})\s*$/) || [])[1];
    return tgSend_(chatId, thaiBackfill(nT));
  }
  if (/^(ตำรา|เลขเด่น|เลข)$/.test(s))         return tgSend_(chatId, lotteryText_(null, 'thai'));

  var dISO = parseLotDateArg_(s);
  var body = stripLotDateArg_(s);
  var m = body.match(/(\d{4})\D+(\d{2})(?!\d)/);          // "1234 56"
  if (m) return tgSend_(chatId, recordThaiResult_(m[1], m[2], dISO));
  if (/\d/.test(body))
    return tgSend_(chatId, '❌ รูปแบบไม่ถูก — ต้องใส่ทั้ง 4 ตัวบน และ 2 ตัวล่าง\nเช่น  ผลหวยไทย 1234 56');

  return tgSend_(chatId, thaiOverviewText_());
}

/**
 * บอทถาม — trigger ยิงทุกวัน แต่ถามเฉพาะวันที่มีงวดค้าง
 * ⚠️ GAS ส่ง event object เข้ามาเป็น argument แรกเสมอ → ต้องเทียบ force === true
 */
function askThaiLottery_(force) {
  var chatId = getTgChatId_();
  if (!chatId) { logEvent_('WARN', 'askThaiLottery_: ไม่มี chat id'); return; }
  var todayISO = lotTodayISO_();
  var due = lotDueDraws_('thai', todayISO);
  if (force !== true && !due.length) return;          // ไม่ใช่วันงวด และไม่มีค้าง = เงียบ
  var iso = due.length ? due[0] : todayISO;           // ค้างเก่าสุดก่อน
  setThaiPending_({ date: iso, ts: Date.now() });
  var late = (iso !== todayISO) ? '\n(งวดนี้ยังไม่ได้บันทึก เลยตามถามย้อนให้ครับ)' : '';
  tgSendForceReply_(chatId,
    '🇹🇭 หวยไทย งวด ' + lotThaiDateLabel_(iso) + ' ออกอะไรครับ?' + late + '\n' +
    'พิมพ์ 4 ตัวบน เว้นวรรค 2 ตัวล่าง เช่น  1234 56\n' +
    '(หรือพิมพ์ "ข้าม" ถ้าไม่ต้องเก็บงวดนี้)');
}

/* ============================================================
 * จับคำตอบ — เรียกจาก handleText_ (ถ้ามี pending อยู่)
 *   คืน string ถ้าจัดการแล้ว, null ถ้าไม่เกี่ยว
 *   ⚠️ ไม่ล้าง pending เมื่อไม่ตรง (เผื่อหวยลาวถามคาบเกี่ยววันเดียวกัน)
 * ============================================================ */
function thaiCatchReply_(chatId, t, lower) {
  var p = getThaiPending_();
  if (!p) return null;
  if (Date.now() - (p.ts || 0) > 20 * 3600000) { clearThaiPending_(); return null; }

  if (/^(ข้าม|ไม่ออก|ยังไม่ออก|skip|\/ข้าม)$/i.test(lower)) {
    clearThaiPending_();
    if (p.date) lotDrawListAdd_(LOT_DUE.PROP_SKIP, 'thai', p.date);   // เลิกตามถามงวดนี้
    return 'โอเค ข้ามงวด ' + lotShortDate_(p.date) + ' ครับ' +
      '\n(พิมพ์ "ผลหวยไทย 1234 56 ' + lotShortDate_(p.date) + '" ทีหลังได้ถ้าอยากเก็บ)' +
      lotAskNextDue_('thai');
  }
  var m = String(t).match(/^(\d{4})\D+(\d{2})$/);
  if (m) return recordThaiResult_(m[1], m[2], p.date) + lotAskNextDue_('thai');
  return null;
}

function setThaiPending_(o) { PropertiesService.getScriptProperties().setProperty(THAI_LOT.PROP_PENDING, JSON.stringify(o)); }
function getThaiPending_() {
  var v = PropertiesService.getScriptProperties().getProperty(THAI_LOT.PROP_PENDING);
  try { return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function clearThaiPending_() { PropertiesService.getScriptProperties().deleteProperty(THAI_LOT.PROP_PENDING); }

/* ============================================================
 * บันทึกผล
 * ============================================================ */
function recordThaiResult_(top4, bottom2, dateISO) {
  var t3 = String(top4).replace(/\D/g, '');
  var b2 = String(bottom2).replace(/\D/g, '');
  if (t3.length !== 4 || b2.length !== 2)
    return '❌ รูปแบบไม่ถูก — พิมพ์ "ผลหวยไทย 1234 56"';
  clearThaiPending_();

  var d = dateISO ? new Date(dateISO + 'T00:00:00') : lastDrawDate_(new Date());
  var iso = Utilities.formatDate(d, 'Asia/Bangkok', 'yyyy-MM-dd');
  var lbl = 'งวด ' + lotThaiDateLabel_(iso);        // "งวด 16 กรกฎาคม 2569"

  // ไม่ได้ระบุวันเอง = เดาให้ → บอกทางแก้ถ้าเดาผิด (ยกงวดก่อนหน้ามาให้ก๊อปได้เลย)
  var hint = '';
  if (!dateISO) {
    var prev = lastDrawDate_(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 23, 59));
    hint = '\n💡 ถ้าเป็นผลงวดก่อน พิมพ์  ผลหวยไทย ' + t3 + ' ' + b2 + ' ' +
      Utilities.formatDate(prev, 'Asia/Bangkok', 'd/M');
  }

  // เกรดคำทำนายงวดนี้ (ถ้าเคยเก็บไว้) — ว่างถ้าไม่มี
  var gTxt = '';
  var g = gradePrediction_('thai', iso, t3, b2);
  if (g) gTxt = '\n\n' + g;

  var sh = sheetEnsure_(THAI_LOT.SHEET, THAI_LOT.HEADERS);
  // ⚠️ เทียบวันด้วย lotIso_ (คอลัมน์ A อาจเป็น Date) + เขียนด้วย lotSetText_ (กัน Sheets กินเลข 0 หน้า)
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (lotIso_(data[i][0]) === iso) {
      lotSetText_(sh, i + 1, 1, [[iso, lbl, t3, b2]]);
      return '✏️ อัปเดตผลหวยไทย ' + lbl + '\n  4 ตัวบน ' + t3 + ' · 2 ตัวล่าง ' + b2 + hint + '\n' + thaiMiniStats_() + gTxt;
    }
  }
  lotSetText_(sh, sh.getLastRow() + 1, 1, [[iso, lbl, t3, b2]]);
  return '✅ บันทึกผลหวยไทย งวด ' + lbl +
    '\n  4 ตัวบน ' + t3 + ' · 2 ตัวล่าง ' + b2 +
    hint + '\n' + thaiMiniStats_() + gTxt;
}

/* ============================================================
 * สถิติ
 * ============================================================ */
/** แถวผลหวยไทย เรียงเก่า→ใหม่ · ข้อความล้วน (เลข 0 หน้าครบ) · ตัดงวดซ้ำแล้ว */
function thaiReadRows_() {
  return lotResultRows_('thai');                // LotCore.gs — normalize Date/เลข 0 หน้า + dedupe
}

/** นับความถี่ → เรียงมากไปน้อย คืน ['45(3)', ...] */
function thaiTop_(obj, n) {
  return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; })
    .slice(0, n).map(function (k) { return k + '(' + obj[k] + ')'; });
}

function thaiMiniStats_() {
  var rows = thaiReadRows_();
  if (!rows.length) return '(ยังไม่มีสถิติหวยไทย)';
  var c2 = {};
  rows.forEach(function (r) { var v = String(r[3] || '').slice(-2); if (v) c2[v] = (c2[v] || 0) + 1; });
  var hot = thaiTop_(c2, 1);
  return '📊 เก็บแล้ว ' + rows.length + ' งวด · 🎯 2 ตัวล่างฮอต: ' + (hot.length ? hot[0] : '-') +
    '\nล่าสุด: ' + rows.slice(-4).reverse().map(function (r) { return r[2] + '/' + r[3]; }).join(', ');
}

function thaiStatsText_(limit) {
  var rows = thaiReadRows_();
  if (!rows.length)
    return '📊 หวยไทย — ยังไม่มีข้อมูล\nเริ่มเก็บด้วย  "ผลหวยไทย 1234 56"\n(ย้อนหลังได้ เช่น "ผลหวยไทย 1234 56 16/7")';

  var c2 = {}, c1 = {}, cFront = {}, cB3 = {}, cF3 = {};
  rows.forEach(function (r) {
    var b2 = String(r[3] || '').slice(-2);
    if (b2) { c2[b2] = (c2[b2] || 0) + 1; c1[b2.slice(-1)] = (c1[b2.slice(-1)] || 0) + 1; }
    var t3 = String(r[2] || '');
    if (t3) cFront[t3.slice(-1)] = (cFront[t3.slice(-1)] || 0) + 1;
    String(r[6] || '').split('/').forEach(function (v) { v = v.replace(/\D/g, ''); if (v.length === 3) cB3[v] = (cB3[v] || 0) + 1; });
    String(r[5] || '').split('/').forEach(function (v) { v = v.replace(/\D/g, ''); if (v.length === 3) cF3[v] = (cF3[v] || 0) + 1; });
  });

  var L = [];
  L.push('📊 สถิติหวยไทย (' + rows.length + ' งวด)');
  L.push('━━━━━━━━━━━━');
  L.push('🔥 2 ตัวล่างออกบ่อย: ' + thaiTop_(c2, 6).join('  '));
  L.push('🔢 เลขท้าย 1 ตัวฮอต: ' + thaiTop_(c1, 5).join('  '));
  L.push('🎯 ท้าย 4 ตัวบนฮอต: ' + thaiTop_(cFront, 5).join('  '));
  if (Object.keys(cB3).length) L.push('3️⃣ เลขท้าย 3 ตัวออกซ้ำ: ' + thaiTop_(cB3, 5).join('  '));
  if (Object.keys(cF3).length) L.push('🔺 เลขหน้า 3 ตัวออกซ้ำ: ' + thaiTop_(cF3, 5).join('  '));
  L.push('━━━━━━━━━━━━');
  var n = Math.min(Number(limit) || 12, 40, rows.length);
  L.push('🗓️ ล่าสุด ' + n + ' งวด  (รางวัลที่1 · หน้า3 · ท้าย3 · ท้าย2):');
  rows.slice(-n).reverse().forEach(function (r) {
    L.push('  ' + r[1] + '\n    ' + (r[4] || r[2]) + ' · ' + (r[5] || '-') + ' · ' + (r[6] || '-') + ' · ' + r[3]);
  });
  return L.join('\n');
}

function thaiOverviewText_() {
  var rows = thaiReadRows_();
  var last = rows.length ? rows[rows.length - 1] : null;
  var L = ['🇹🇭 หวยไทย — เมนู', '━━━━━━━━━━━━'];
  L.push(last ? '🏆 ผลล่าสุด ' + last[1] + '\n  รางวัลที่ 1: ' + (last[4] || last[2]) +
                ' · หน้า3: ' + (last[5] || '-') + ' · ท้าย3: ' + (last[6] || '-') + ' · ท้าย2: ' + last[3]
              : '🏆 ยังไม่มีผลบันทึก');
  L.push(thaiMiniStats_());
  L.push('');
  L.push(lotteryText_(null, 'thai'));
  L.push('');
  L.push('━━━ 🔑 คีย์หวยไทย ━━━');
  L.push('📥 อัพผล    →  ผลหวยไทย 1234 56');
  L.push('   ย้อนหลัง →  ผลหวยไทย 1234 56 16/7');
  L.push('📊 สถิติเต็ม →  หวยไทย สถิติ');
  L.push('⬇️ ดึงย้อนหลัง →  หวยไทย ดึง 200  (auto จาก thairath)');
  L.push('🔔 ให้บอทถามงวดค้าง → หวยไทย ถาม');
  L.push('🇱🇦 หวยลาว   →  ดูฝั่งลาว');
  return L.join('\n');
}
