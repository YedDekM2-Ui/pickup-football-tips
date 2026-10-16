/**
 * ============================================================
 * LotStar.gs — สมุดดวงปฏิทินโหร 100 ปี (แกะดาว) สำหรับหน้า star.html
 * ------------------------------------------------------------
 * หลังบ้านบางที่สุด: เก็บดวงรายวัน + ส่งผลหวยลาว/ไทยที่จดไว้แล้วให้หน้าเว็บ
 * สูตรคำนวณทั้งหมดอยู่หน้าเว็บ (web/js/star-calc.js) เพราะต้องคิดใหม่ทุกครั้งที่แก้ดวง
 *
 * ชีต Star_Chart — 1 แถว = 1 วัน (วันเดียวกันบันทึกซ้ำ = ทับแถวเดิม)
 *   dateISO | ราศี (JSON 12 ช่อง) | ลัคนา | กลางดวง | จันทรคติ | ดาวย้าย | สถานะ | หมายเหตุ | บันทึกเมื่อ
 * ทุกช่องเขียนผ่าน lotSetText_ (ข้อความล้วน) — บทเรียน 0 หน้าหาย / วันที่กลายเป็น Date
 *
 * ⚠️ prefix st* — ห้ามชนกับ fb* fs* tf* fv* lot* wb*
 * ============================================================
 */

var STAR = {
  SHEET: 'Star_Chart',
  HEADERS: ['dateISO', 'ราศี', 'ลัคนา', 'กลางดวง', 'จันทรคติ', 'ดาวย้าย', 'สถานะ', 'หมายเหตุ', 'บันทึกเมื่อ']
};

/** ตรวจ + ทำความสะอาดดวงที่หน้าเว็บส่งมา — ผิดรูป = โยน error ข้อความไทย */
function stClean_(c) {
  c = c || {};
  var iso = String(c.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('วันที่ต้องเป็น ปปปป-ดด-วว');
  var rasi = c.rasi;
  if (!rasi || rasi.length !== 12) throw new Error('ราศีต้องมีครบ 12 ช่อง');
  var seen = {};
  rasi = rasi.map(function (cell) {
    return (cell || []).map(function (x) {
      var d = String(x).trim();
      if (!/^[0-9]$/.test(d)) throw new Error('ดาวต้องเป็นเลข 0-9 ตัวเดียว: ' + d);
      if (seen[d]) throw new Error('ดาว ' + d + ' อยู่ 2 ราศี');
      seen[d] = 1;
      return d;
    });
  });
  var lagna = Number(c.lagna);
  if (!(lagna >= 0 && lagna <= 11)) lagna = -1;
  return {
    date: iso, rasi: rasi, lagna: lagna,
    center: String(c.center || '').replace(/[^0-9\/]/g, '').slice(0, 7),
    lunar: String(c.lunar || '').trim().slice(0, 40),
    moved: String(c.moved || '').trim().slice(0, 60),
    special: String(c.special || '').trim().slice(0, 60),
    note: String(c.note || '').trim().slice(0, 300)
  };
}

function stRowOf_(c) {
  return [c.date, JSON.stringify(c.rasi), String(c.lagna), c.center, c.lunar, c.moved, c.special, c.note, nowIso_()];
}

/** แถวชีต → ดวง (อ่านกลับให้ทนทุกแบบ วันที่อาจกลับมาเป็น Date) */
function stParse_(r) {
  var rasi = [];
  try { rasi = JSON.parse(String(r[1] || '[]')); } catch (e) { rasi = []; }
  if (!rasi || rasi.length !== 12) return null;
  return {
    date: lotIso_(r[0]), rasi: rasi, lagna: Number(r[2]), center: String(r[3] || ''),
    lunar: String(r[4] || ''), moved: String(r[5] || ''), special: String(r[6] || ''),
    note: String(r[7] || ''), saved: String(r[8] || '')
  };
}

function stCharts_() {
  var sh = sheetIfExists_(STAR.SHEET);
  if (!sh) return [];
  var v = sh.getDataRange().getValues(), map = {};
  for (var i = 1; i < v.length; i++) {
    var c = stParse_(v[i]);
    if (c && c.date) map[c.date] = c;
  }
  return Object.keys(map).sort().map(function (k) { return map[k]; });
}

/** บันทึกดวง 1 วัน — วันซ้ำทับแถวเดิม */
function stSave_(chart) {
  var c = stClean_(chart);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheetEnsure_(STAR.SHEET, STAR.HEADERS);
    var v = sh.getDataRange().getValues(), at = -1;
    for (var i = 1; i < v.length; i++) if (lotIso_(v[i][0]) === c.date) { at = i + 1; break; }
    var row = at > 0 ? at : Math.max(2, sh.getLastRow() + 1);
    lotSetText_(sh, row, 1, [stRowOf_(c)]);
    return { ok: true, date: c.date, ทับของเดิม: at > 0 };
  } finally { lock.releaseLock(); }
}

function stDel_(iso) {
  iso = String(iso || '').trim();
  var sh = sheetIfExists_(STAR.SHEET);
  if (!sh) return { ok: false, error: 'ยังไม่มีชีตดวง' };
  var v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) {
    if (lotIso_(v[i][0]) === iso) { sh.deleteRow(i + 1); return { ok: true, ลบ: iso }; }
  }
  return { ok: false, error: 'ไม่พบดวงวันที่ ' + iso };
}

/** ก้อนเดียวที่หน้าเว็บต้องใช้: ดวงทั้งหมด + ผลลาว [iso, เลข4] + ผลไทย [iso, 4ตัวบน, 2ตัวล่าง] */
function stPayload_() {
  var lao = [], thai = [];
  try {
    lotResultRows_('lao').forEach(function (r) { if (r[2] && r[2].length === 4) lao.push([r[0], r[2]]); });
  } catch (e) { /* ไม่มีชีตลาวก็โชว์แค่ดวง */ }
  try {
    lotResultRows_('thai').forEach(function (r) { if (r[2] && r[2].length === 4) thai.push([r[0], r[2], r[3] || '']); });
  } catch (e) { /* เหมือนกัน */ }
  return { ok: true, at: nowIso_(), charts: stCharts_(), lao: lao, thai: thai };
}

/** ลงผลจากหน้าแอป — ใช้ทางเดิมของบอท (ผ่าน lotSetText_ อยู่แล้ว) */
function stResult_(kind, iso, a, b) {
  iso = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { ok: false, error: 'วันที่ไม่ถูก' };
  var msg = kind === 'thai' ? recordThaiResult_(a, b, iso) : recordLaoResult_(a, iso);
  var bad = /^❌/.test(String(msg));
  return { ok: !bad, ข้อความ: String(msg).slice(0, 300) };
}
