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

function lotDueDraws_(kind, todayISO, backDays) {
  var back = backDays || (kind === 'thai' ? LOT_DUE.THAI_BACK_DAYS : LOT_DUE.LAO_BACK_DAYS);
  var have = lotRecordedISO_(kind);
  var out = [];
  for (var i = back; i >= 0; i--) {
    var iso = lotISOShift_(todayISO, -i);
    if (!isLotDrawDay_(kind, iso)) continue;
    if (have[iso]) continue;
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
