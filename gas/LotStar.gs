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
  /* ชนิด = lao / thai / '' — วันที่ 1, 16 มีทั้งไทย (ดวง 15:30) และลาว (ดวง 20:20) ลัคนาต่างกัน ต้องเก็บแยก
     แถวเก่าไม่มีคอลัมน์นี้ = '' (ใช้ได้ทั้ง 2 ชนิด) */
  HEADERS: ['dateISO', 'ราศี', 'ลัคนา', 'กลางดวง', 'จันทรคติ', 'ดาวย้าย', 'สถานะ', 'หมายเหตุ', 'บันทึกเมื่อ', 'ชนิด']
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
    note: String(c.note || '').trim().slice(0, 300),
    kind: (c.kind === 'lao' || c.kind === 'thai') ? c.kind : ''
  };
}

function stRowOf_(c) {
  return [c.date, JSON.stringify(c.rasi), String(c.lagna), c.center, c.lunar, c.moved, c.special, c.note, nowIso_(), c.kind];
}

/** แถวชีต → ดวง (อ่านกลับให้ทนทุกแบบ วันที่อาจกลับมาเป็น Date) */
function stParse_(r) {
  var rasi = [];
  try { rasi = JSON.parse(String(r[1] || '[]')); } catch (e) { rasi = []; }
  if (!rasi || rasi.length !== 12) return null;
  return {
    date: lotIso_(r[0]), rasi: rasi, lagna: Number(r[2]), center: String(r[3] || ''),
    lunar: String(r[4] || ''), moved: String(r[5] || ''), special: String(r[6] || ''),
    note: String(r[7] || ''), saved: String(r[8] || ''), kind: String(r[9] || '')
  };
}

function stCharts_() {
  var sh = sheetIfExists_(STAR.SHEET);
  if (!sh) return [];
  var v = sh.getDataRange().getValues(), map = {};
  for (var i = 1; i < v.length; i++) {
    var c = stParse_(v[i]);
    if (c && c.date) map[c.date + '|' + c.kind] = c;
  }
  return Object.keys(map).sort().map(function (k) { return map[k]; });
}

/** แถวเดิมของดวงนี้: วันเดียวกัน + ชนิดเดียวกัน · แถวเก่าที่ยังไม่มีชนิด ('') ให้ถูกทับได้ (เติมชนิดย้อนหลัง) */
function stFindRow_(v, iso, kind) {
  var loose = -1;
  for (var i = 1; i < v.length; i++) {
    if (lotIso_(v[i][0]) !== iso) continue;
    var k = String(v[i][9] || '');
    if (k === kind) return i + 1;
    if (k === '' && loose < 0) loose = i + 1;
  }
  return loose;
}

/** บันทึกดวง 1 วัน/ชนิด — ซ้ำทับแถวเดิม */
function stSave_(chart) {
  var c = stClean_(chart);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheetEnsure_(STAR.SHEET, STAR.HEADERS);
    var v = sh.getDataRange().getValues(), at = stFindRow_(v, c.date, c.kind);
    var row = at > 0 ? at : Math.max(2, sh.getLastRow() + 1);
    lotSetText_(sh, row, 1, [stRowOf_(c)]);
    return { ok: true, date: c.date, ทับของเดิม: at > 0 };
  } finally { lock.releaseLock(); }
}

function stDel_(iso, kind) {
  iso = String(iso || '').trim(); kind = String(kind || '');
  var sh = sheetIfExists_(STAR.SHEET);
  if (!sh) return { ok: false, error: 'ยังไม่มีชีตดวง' };
  var v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) {
    if (lotIso_(v[i][0]) === iso && String(v[i][9] || '') === kind) { sh.deleteRow(i + 1); return { ok: true, ลบ: iso }; }
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

/** ลงผลจากหน้าแอป — ใช้ทางเดิมของบอท (ผ่าน lotSetText_ อยู่แล้ว)
 *  หวยไทยส่งรางวัลที่ 1 เต็ม 6 หลักมาได้ (a = 6 หลัก → 4 ตัวบน = 4 ตัวท้าย)
 *  พ่วงหน้า 3 / ท้าย 3 (คั่น /) มาด้วย = เติมแถวให้ครบเหมือนงวดที่ดึงจาก thairath */
function stResult_(kind, iso, a, b, f3, b3) {
  iso = String(iso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { ok: false, error: 'วันที่ไม่ถูก' };
  var six = '';
  if (kind === 'thai') {
    var t = String(a || '').replace(/\D/g, '');
    if (t.length === 6) { six = t; a = t.slice(-4); }
  }
  var msg = kind === 'thai' ? recordThaiResult_(a, b, iso) : recordLaoResult_(a, iso);
  var bad = /^❌/.test(String(msg));
  if (!bad && six) {
    var fr = lotPadList_(String(f3 || '').replace(/[^0-9\/ ]/g, '').trim().replace(/\s+/g, '/'), 3);
    var bk = lotPadList_(String(b3 || '').replace(/[^0-9\/ ]/g, '').trim().replace(/\s+/g, '/'), 3);
    lotMergeRows_(THAI_LOT.SHEET, THAI_LOT.HEADERS,
      [[iso, 'งวด ' + lotThaiDateLabel_(iso), six.slice(-4), lotPad_(b, 2), six, fr, bk]]);
  }
  return { ok: !bad, ข้อความ: String(msg).slice(0, 300), รางวัลที่1: six };
}

/** กุญแจของหน้าแกะดาว: STAR_KEY (ใบเฉพาะ เปิดได้แค่ทางของแกะดาว) หรือกุญแจหลักใบไหนก็ได้
 *  มีใบเฉพาะเพราะเจ้าของลืม APP_KEY และจะยัดลิงก์ไว้หน้าโฮม — หลุดไปก็เห็นแค่สมุดดวง ไม่ถึงบอล/บิล
 *  ยังไม่ตั้ง STAR_KEY = ใช้ได้เฉพาะกุญแจหลัก (ไม่เปิดโล่ง) */
function stKeyOk_(q) {
  var want = prop_('STAR_KEY'), got = String((q && q.k) || '');
  if (want && got && got === want) return true;
  return keyOk_(q);
}

/** กุญแจดูอย่างเดียว (STAR_VIEW_KEY) — ลิงก์ให้แม่ เปิดดูได้ แต่เขียนอะไรไม่ได้เลย (เจ้าของสั่ง 16 ต.ค. 69) */
function stViewOnly_(q) {
  var v = prop_('STAR_VIEW_KEY'), got = String((q && q.k) || '');
  return !!v && !!got && got === v;
}

/** ทางของแกะดาวทั้งหมด — คืน null = ไม่ใช่ทางของแกะดาว ให้ไหลต่อไปด่านปกติ */
function stRoute_(p, q, body) {
  if (['star', 'starsave', 'stardel', 'starresult'].indexOf(p) < 0) return null;
  if (stViewOnly_(q)) {
    if (p !== 'star') return { ok: false, readOnly: true, error: 'ลิงก์นี้ดูได้อย่างเดียว' };
    var pv = stPayload_(); pv.readOnly = true; return pv;
  }
  if (!stKeyOk_(q)) return { ok: false, needKey: true, error: 'กุญแจไม่ถูก' };
  if (p === 'star') return stPayload_();
  if (p === 'starsave') return stSave_(body.chart);
  if (p === 'stardel') return stDel_(body.date, body.kind);
  return stResult_(String(body.kind || ''), body.date, body.a, body.b, body.f3, body.b3);
}
