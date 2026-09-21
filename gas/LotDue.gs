/**
 * ============================================================
 * LotDrawDay.gs — "ถามทุกงวด" ไม่ให้หลุด (หวยไทย + หวยลาว)
 * ============================================================
 * ปัญหาเดิม
 *   1) หวยไทยตั้ง trigger ไว้เฉพาะวันที่ 1 กับ 16 → งวดที่กองสลากเลื่อน
 *      (30 ธ.ค. / 17 ม.ค. / 2 พ.ค.) ไม่เคยถูกถามเลย
 *   2) วันไหนบอทเงียบ (trigger หาย / เน็ตล่ม / ไม่ได้ตอบ) = งวดนั้นหายถาวร
 *
 * วิธีใหม่
 *   - trigger เหลือ "ทุกวัน" ตัวเดียวต่อหวย แล้วมาเช็คในโค้ดว่าวันนี้เป็นงวดไหม
 *   - เช็คย้อนหลังด้วย: งวดไหนยังไม่มีในชีต → ถามซ้ำจนกว่าจะได้ (นี่คือตัวประกันจริง)
 *   - งวดพิเศษ เพิ่ม/ตัด เองได้ผ่าน Script Properties ไม่ต้องแก้โค้ด
 *       LOT_EXTRA_DRAWS = "thai:2026-12-30,lao:2026-08-01"
 *       LOT_SKIP_DRAWS  = "thai:2027-01-01"
 * ============================================================
 */

var LOT_DUE = {
  THAI_BACK_DAYS: 20,             // ไทยออกทุก ~15 วัน → ย้อน 20 วันครอบคลุม 1 งวดเต็ม
  LAO_BACK_DAYS: 7,
  PROP_EXTRA: 'LOT_EXTRA_DRAWS',
  PROP_SKIP: 'LOT_SKIP_DRAWS'
};

/** งวดที่กองสลากเลื่อนเป็นประจำ (MM-DD) — ตัดวันปกติออก ไปออกวันแทนแทน */
var THAI_MOVED_OFF = ['01-01', '01-16', '05-01'];
var THAI_MOVED_ON = ['12-30', '01-17', '05-02'];

/* ============================================================
 * ตัวช่วยวันที่ (คำนวณล้วน ไม่พึ่ง Utilities.formatDate)
 * ============================================================ */
function lotISOToDate_(iso) {
  var p = String(iso || '').split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function lotDateToISO_(d) {
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}
function lotISOShift_(iso, days) {
  var d = lotISOToDate_(iso);
  d.setDate(d.getDate() + days);
  return lotDateToISO_(d);
}
/** ISO → "28/7" (ไว้โชว์สั้นๆ) */
function lotShortDate_(iso) {
  var p = String(iso || '').split('-');
  return p.length === 3 ? (Number(p[2]) + '/' + Number(p[1])) : String(iso || '');
}

/* ============================================================
 * รายการงวดพิเศษใน Script Properties  "kind:YYYY-MM-DD,kind:..."
 * ============================================================ */
function lotDrawList_(propKey, kind) {
  var raw = PropertiesService.getScriptProperties().getProperty(propKey) || '';
  var out = [];
  raw.split(',').forEach(function (s) {
    var p = String(s).trim().split(':');
    if (p.length === 2 && p[0] === kind && /^\d{4}-\d{2}-\d{2}$/.test(p[1])) out.push(p[1]);
  });
  return out;
}
function lotDrawListAdd_(propKey, kind, iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return false;
  var sp = PropertiesService.getScriptProperties();
  var arr = String(sp.getProperty(propKey) || '').split(',')
    .map(function (s) { return String(s).trim(); }).filter(String);
  var item = kind + ':' + iso;
  if (arr.indexOf(item) < 0) arr.push(item);
  sp.setProperty(propKey, arr.join(','));
  return true;
}
function lotDrawListDel_(propKey, kind, iso) {
  var sp = PropertiesService.getScriptProperties();
  var item = kind + ':' + iso;
  var arr = String(sp.getProperty(propKey) || '').split(',')
    .map(function (s) { return String(s).trim(); })
    .filter(function (s) { return s && s !== item; });
  sp.setProperty(propKey, arr.join(','));
  return true;
}

/* ============================================================
 * วันนี้เป็นวันงวดไหม
 * ============================================================ */
function isThaiDrawDay_(iso) {
  if (lotDrawList_(LOT_DUE.PROP_SKIP, 'thai').indexOf(iso) >= 0) return false;
  if (lotDrawList_(LOT_DUE.PROP_EXTRA, 'thai').indexOf(iso) >= 0) return true;
  var md = String(iso).slice(5);
  if (THAI_MOVED_ON.indexOf(md) >= 0) return true;
  if (THAI_MOVED_OFF.indexOf(md) >= 0) return false;
  var dd = String(iso).slice(8, 10);
  return dd === '01' || dd === '16';
}
function isLaoDrawDayISO_(iso) {
  if (lotDrawList_(LOT_DUE.PROP_SKIP, 'lao').indexOf(iso) >= 0) return false;
  if (lotDrawList_(LOT_DUE.PROP_EXTRA, 'lao').indexOf(iso) >= 0) return true;
  return isLaoDrawDay_(lotISOToDate_(iso));         // จ.–ศ. (Lottery.gs)
}
function isLotDrawDay_(kind, iso) {
  return kind === 'thai' ? isThaiDrawDay_(iso) : isLaoDrawDayISO_(iso);
}

/* ============================================================
 * งวดที่ยังไม่ได้บันทึก (เก่า → ใหม่)
 * ============================================================ */
function lotRecordedISO_(kind) {
  var sh = (kind === 'thai')
    ? sheetEnsure_(THAI_LOT.SHEET, THAI_LOT.HEADERS)
    : sheetEnsure_(LAO.SHEET, LAO.HEADERS);
  var v = sh.getDataRange().getValues();
  var set = {};
  for (var i = 1; i < v.length; i++) {
    var k = v[i][0];
    if (!k) continue;
    if (Object.prototype.toString.call(k) === '[object Date]') k = lotDateToISO_(k);
    set[String(k).slice(0, 10)] = 1;
  }
  return set;
}

/** งวด "วันนี้" ถึงเวลาออกผลหรือยัง
    ยังไม่ถึง = ยังไม่มีเลขให้ตอบ ถามไปเจ้าของก็ตอบเลขงวดเก่า = บันทึกเบิ้ล
    อ่านเวลาไม่ได้ = ถือว่าออกแล้ว (ห้ามทำให้เงียบถาวร) */
function lotDrawnYet_(kind) {
  var hour;
  try { hour = Number(Utilities.formatDate(new Date(), TZ, 'H')); } catch (e) { return true; }
  if (!(hour >= 0)) return true;
  return hour >= ((kind === 'thai') ? THAI_LOT.ASK_HOUR : LAO.ASK_HOUR);
}

function lotDueDraws_(kind, todayISO, backDays) {
  var back = backDays || (kind === 'thai' ? LOT_DUE.THAI_BACK_DAYS : LOT_DUE.LAO_BACK_DAYS);
  var have = lotRecordedISO_(kind);
  var out = [];
  for (var i = back; i >= 0; i--) {
    var iso = lotISOShift_(todayISO, -i);
    if (!isLotDrawDay_(kind, iso)) continue;
    if (have[iso]) continue;
    if (iso === todayISO && !lotDrawnYet_(kind)) continue;   // ผลยังไม่ออก อย่าเพิ่งถาม
    out.push(iso);
  }
  return out;
}

/** วันนี้ (ตามเวลาไทย) */
function lotTodayISO_() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
}

/** ตอบไปแล้ว 1 งวด → ถ้ายังค้างอีก ถามต่อทันที (คืนข้อความต่อท้าย) */
function lotAskNextDue_(kind) {
  try {
    var due = lotDueDraws_(kind, lotTodayISO_());
    if (!due.length) return '';
    if (kind === 'thai') askThaiLottery_(true); else askLaoLottery_(true);
    return '\n\n⏭ ยังค้างอีก ' + due.length + ' งวด — ถามต่อให้แล้วครับ';
  } catch (e) { return ''; }
}

/** ข้อความสรุปงวดค้าง (คำสั่ง "หวยไทย ค้าง" / "หวยลาว ค้าง") */
function lotDueText_(kind) {
  var name = kind === 'thai' ? 'หวยไทย' : 'หวยลาว';
  var due = lotDueDraws_(kind, lotTodayISO_());
  if (!due.length) return '✅ ' + name + ' บันทึกครบทุกงวดแล้ว (ย้อน ' +
    (kind === 'thai' ? LOT_DUE.THAI_BACK_DAYS : LOT_DUE.LAO_BACK_DAYS) + ' วัน)';
  return '⏳ ' + name + ' ค้าง ' + due.length + ' งวด:\n' +
    due.map(function (d) { return '  • ' + lotShortDate_(d); }).join('\n') +
    '\nพิมพ์ "' + name + ' ถาม" ให้บอทถามทีละงวด หรือใส่ผลพร้อมวันที่ได้เลย';
}

/** คำสั่ง "ถาม" จากแชท — มีงวดค้างก็ถาม ไม่มีต้องบอกด้วยว่าค้างกี่งวด
    ห้ามเงียบ — สั่งแล้วไม่มีอะไรขึ้น เจ้าของจะอ่านว่าบอทตาย */
function lotAskCmd_(chatId, kind) {
  var due = [];
  try { due = lotDueDraws_(kind, lotTodayISO_()); } catch (e) { due = []; }
  if (!due.length) return tgSend_(chatId, lotDueText_(kind));
  if (kind === 'thai') askThaiLottery_(true); else askLaoLottery_(true);
}

/* ============================================================
 * ดู/ลบ งวดที่จดไว้แล้ว (จดผิด/จดเบิ้ล ต้องมีทางลบจากมือถือ)
 * ============================================================ */

/** แถวล่าสุด N งวด พร้อมเลข — เอาไว้ตรวจก่อนลบ */
function lotRowsText_(kind, limit) {
  var k = (kind === 'thai') ? 'thai' : 'lao';
  var name = (k === 'thai') ? 'หวยไทย' : 'หวยลาว';
  var n = Number(limit) > 0 ? Number(limit) : 10;
  var rows;
  try { rows = lotResultRows_(k); } catch (e) { return '❌ อ่านชีตไม่ได้: ' + e; }
  var L = ['🗂 ' + name + ' — จดไว้ ' + rows.length + ' งวด (โชว์ล่าสุด ' + Math.min(n, rows.length) + ')'];
  rows.slice(-n).reverse().forEach(function (r) {
    L.push('  ' + r[0] + '  ' + r[2] + (r[3] ? '  (บน ' + r[3] + ' · ล่าง ' + r[4] + ')' : ''));
  });
  return L.join('\n');
}

/** ลบทุกแถวของงวดที่ระบุ — ใช้ตอนจดเบิ้ล/จดผิดวัน */
function lotDelRow_(kind, isoIn) {
  var k = (kind === 'thai') ? 'thai' : 'lao';
  var cfg = (k === 'thai') ? THAI_LOT : LAO;
  var name = (k === 'thai') ? 'หวยไทย' : 'หวยลาว';
  var iso = String(isoIn || '').slice(0, 10);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(iso))
    return '❌ ใส่วันที่แบบ 2026-09-04 ด้วยครับ';
  var sh = sheetIfExists_(cfg.SHEET);
  if (!sh) return '❌ ยังไม่มีชีต ' + cfg.SHEET;
  var v = sh.getDataRange().getValues(), hit = [], i;
  for (i = 1; i < v.length; i++) {
    var key = v[i][0];
    if (!key) continue;
    if (Object.prototype.toString.call(key) === '[object Date]') key = lotDateToISO_(key);
    if (String(key).slice(0, 10) === iso) hit.push({ row: i + 1, num: String(v[i][2] || '') });
  }
  if (!hit.length) return 'ℹ️ ' + name + ' งวด ' + iso + ' — ไม่มีในชีตอยู่แล้ว';
  for (i = hit.length - 1; i >= 0; i--) sh.deleteRow(hit[i].row);
  return '🗑 ลบ ' + name + ' งวด ' + iso + ' แล้ว ' + hit.length + ' แถว (เลข ' +
    hit.map(function (h) { return h.num; }).join(', ') + ')';
}

/** ?p=lotdue — ดูสถานะจริงจากข้างนอก: เวลาไทย / คำถามที่ค้าง / งวดค้าง / งวดท้ายๆ ที่จดไว้ */
function lotDueDump_(kind) {
  var k = (kind === 'thai') ? 'thai' : 'lao';
  var name = (k === 'thai') ? 'หวยไทย' : 'หวยลาว';
  var cfg = (k === 'thai') ? THAI_LOT : LAO;
  var L = [];
  L.push('🔎 ' + name + ' — สถานะตอนนี้');
  L.push('เวลาไทย: ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') +
         '  (หวยออก ' + cfg.ASK_HOUR + ':00 → ' + (lotDrawnYet_(k) ? 'ออกแล้ว' : 'ยังไม่ออก') + ')');
  var pend = '';
  try { pend = PropertiesService.getScriptProperties().getProperty(cfg.PROP_PENDING) || ''; } catch (e) {}
  L.push('คำถามค้าง: ' + (pend || '(ไม่มี)'));
  var due = [];
  try { due = lotDueDraws_(k, lotTodayISO_()); } catch (e2) {}
  L.push('งวดค้าง: ' + (due.length ? due.join(', ') : 'ไม่มี'));
  try {
    var have = lotRecordedISO_(k), keys = [];
    for (var d in have) keys.push(d);
    keys.sort();
    L.push('จดไว้ ' + keys.length + ' งวด · ล่าสุด: ' + keys.slice(-5).join(', '));
  } catch (e3) { L.push('อ่านชีตไม่ได้: ' + e3); }
  return L.join('\n');
}

/** ?p=lotcancel — ลบคำถามที่ค้างทิ้ง (ตอบไปก็เบิ้ล) */
function lotCancelAsk_(kind) {
  var k = (kind === 'thai') ? 'thai' : 'lao';
  if (k === 'thai') clearThaiPending_(); else clearLaoPending_();
  return '🗑 ลบคำถาม' + ((k === 'thai') ? 'หวยไทย' : 'หวยลาว') +
    'ที่ค้างอยู่แล้ว — ตอบเลขตอนนี้จะไม่ถูกบันทึก';
}

/**
 * "หวยไทย เพิ่มงวด 30/12"  /  "หวยลาว ตัดงวด 1/8"
 *   add=true  → บังคับให้เป็นวันงวด (ลบออกจากรายการตัดด้วย)
 *   add=false → บังคับให้ไม่ใช่วันงวด (ลบออกจากรายการเพิ่มด้วย)
 */
function lotEditDraw_(kind, s, add) {
  var name = kind === 'thai' ? 'หวยไทย' : 'หวยลาว';
  var iso = parseLotDateArg_(String(s));
  if (!iso) {
    return '❌ ใส่วันที่ด้วยครับ เช่น  ' + name + ' ' + (add ? 'เพิ่มงวด 30/12' : 'ตัดงวด 1/1') +
      '\n(รูปแบบ วัน/เดือน หรือ วัน/เดือน/ปี)';
  }
  if (add) {
    lotDrawListDel_(LOT_DUE.PROP_SKIP, kind, iso);
    lotDrawListAdd_(LOT_DUE.PROP_EXTRA, kind, iso);
    return '✅ เพิ่มงวด ' + name + ' วันที่ ' + lotShortDate_(iso) + ' แล้ว — บอทจะถามงวดนี้ให้';
  }
  lotDrawListDel_(LOT_DUE.PROP_EXTRA, kind, iso);
  lotDrawListAdd_(LOT_DUE.PROP_SKIP, kind, iso);
  return '✅ ตัดงวด ' + name + ' วันที่ ' + lotShortDate_(iso) + ' แล้ว — บอทจะไม่ถามงวดนี้';
}

/* ── ตัวถามผลหวย ─────────────────────────────────────────────
   บอทเก่ามี trigger รายชั่วโมงคอยถาม แต่บอทนี้ไม่มีสิทธิ์ตั้ง trigger (ไม่ขอ script.scriptapp
   เพราะเจ้าของจะต้องกดอนุญาตใหม่ทั้งชุด) จึงเกาะรอบ "ดึงข้อความ" ที่ fb-watch ยิงเข้ามาทุก ~20 วิ
   แทน — ผลลัพธ์เหมือนกันคือถึงเวลาแล้วบอทถามเอง                                        */

/** สั่งถามจากลิงก์ — ?p=lotask[&kind=lao|thai][&force=1] */
function lotAskRun_(kind, force) {
  var kinds = (kind === 'lao' || kind === 'thai') ? [kind] : ['thai', 'lao'];
  var out = {};
  for (var i = 0; i < kinds.length; i++) {
    var k = kinds[i];
    try {
      var due = lotDueDraws_(k, lotTodayISO_());
      if (k === 'thai') askThaiLottery_(force === true); else askLaoLottery_(force === true);
      var asked = due.length > 0;                       // force ไม่เสกงวดขึ้นมาเองได้อีกแล้ว
      /* จดวันไว้ด้วย ไม่งั้นตัวถามอัตโนมัติ (lotAutoAsk_) จะถามซ้ำอีกใบตอนถึงชั่วโมงของมัน */
      if (asked) { try { PropertiesService.getScriptProperties().setProperty('LOT_ASKED_' + k, lotTodayISO_()); } catch (e0) {} }
      out[k] = { 'ค้างอยู่': due.length, 'ถาม': asked ? 'ถามแล้ว' : 'ไม่มีงวดค้าง เลยเงียบ' };
    } catch (e) {
      out[k] = { error: String(e && e.message ? e.message : e) };
    }
  }
  return { ok: true, 'ผล': out };
}

/** ถามเองอัตโนมัติ — เรียกจาก tgPoll_ ทุกรอบ
    จดวันไว้ "เฉพาะตอนมีงวดค้างจริง" ไม่งั้นวันที่ไม่มีงวด (เสาร์-อาทิตย์ของลาว) จะกินโควตาวันนั้นไปฟรี ๆ
    จดก่อนถาม เพราะถ้าตัวถามพังกลางทางแล้วไม่จด มันจะวนถามใหม่ทุก 20 วินาที */
function lotAutoAsk_() {
  try {
    var hour = Number(Utilities.formatDate(new Date(), TZ, 'H'));
    var today = lotTodayISO_();
    var ps = PropertiesService.getScriptProperties();
    var list = [['thai', THAI_LOT.ASK_HOUR], ['lao', LAO.ASK_HOUR]];
    for (var i = 0; i < list.length; i++) {
      var k = list[i][0];
      if (hour < list[i][1]) continue;                     // ยังไม่ถึงเวลาหวยออก
      var key = 'LOT_ASKED_' + k;
      if (ps.getProperty(key) === today) continue;         // วันนี้ถามไปแล้ว
      var due = [];
      try { due = lotDueDraws_(k, today); } catch (e2) { due = []; }
      if (!due.length) continue;                           // ไม่มีงวดค้าง = เงียบ และไม่จดวัน
      try { ps.setProperty(key, today); } catch (e3) { /* จดไม่ได้ก็ยังถาม แค่เสี่ยงถามซ้ำ */ }
      try {
        if (k === 'thai') askThaiLottery_(false); else askLaoLottery_(false);
      } catch (e4) {
        try { logEvent_('WARN', 'ถามผลหวยไม่สำเร็จ: ' + k); } catch (e5) {}
      }
    }
  } catch (e) { /* หวยพังห้ามลามไปทำให้ดึงข้อความพัง */ }
}
