/* LotImport.gs — ย้ายผลหวยย้อนหลังจาก "ชีตบอทเก่า" (PIKTAX) มาที่บอทนี้

   ทำไมต้องมี: เลขฐาน B ต้องมีผลย้อนหลังอย่างน้อย 45 งวดถึงจะคิดได้ (LOTB.WARM ใน LotBase.gs)
   บอทใหม่เริ่มจากศูนย์ ถ้าไล่ขูดใหม่ 200 งวดจะช้าและเว็บต้นทางมักบล็อก — ของเก่ามีครบอยู่แล้ว
   หัวตารางของ 2 ชีตนี้เหมือนกันเป๊ะทั้ง 2 บอท (Lao_Lottery / Thai_Lottery) จึงยกแถวมาได้ตรง ๆ

   กฎที่ห้ามพลาด:
   - เขียนผ่าน lotSetText_ เท่านั้น ไม่งั้นเลข 0 นำหน้าหาย (0392 -> 392)
   - งวดที่มีอยู่แล้วไม่แตะ ของในบอทนี้ถือว่าใหม่กว่าเสมอ
   - ไม่ต้องขอสิทธิ์เพิ่ม บอทนี้มี scope spreadsheets อยู่แล้ว (เปิดชีตของบัญชีเดียวกันได้) */

var LOT_SRC_SHEET_ID = '1ZHdCDyiBwIBipiO6_2cs9pAA6zbDoZzkP7aicy9XuS4';   // ชีตบอทเก่า (PIKTAX)

function lotSrcId_() { return prop_('LOT_SRC_SHEET_ID') || LOT_SRC_SHEET_ID; }

function lotCfgOf_(kind) { return (kind === 'thai') ? THAI_LOT : LAO; }

/** อ่านผลจากชีตบอทเก่า จัดรูปให้ตรงกับของบอทนี้ คืน map คีย์ = dateISO (null = ไม่มีชีตนั้น) */
function lotImportRead_(kind) {
  var cfg = lotCfgOf_(kind);
  var sh = SpreadsheetApp.openById(lotSrcId_()).getSheetByName(cfg.SHEET);
  if (!sh) return null;
  var v = sh.getDataRange().getValues(), map = {};
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    var n = lotNormRow_(kind, v[i]);
    if (!n[0] || !n[2]) continue;                        // ไม่มีวันที่ / ไม่มีเลข = ทิ้ง
    while (n.length < cfg.HEADERS.length) n.push('');
    map[n[0]] = n.slice(0, cfg.HEADERS.length);          // งวดซ้ำในต้นทาง เอาแถวหลังสุด
  }
  return map;
}

/** ย้ายจริงทีละชนิด */
function lotImportRun_(kind) {
  var cfg = lotCfgOf_(kind), map;
  try { map = lotImportRead_(kind); }
  catch (e) {
    return { ok: false, kind: kind, error: 'เปิดชีตบอทเก่าไม่ได้: ' + (e && e.message ? e.message : e) };
  }
  if (!map) return { ok: false, kind: kind, error: 'ชีตบอทเก่าไม่มีแท็บ ' + cfg.SHEET };

  var sh = sheetEnsure_(cfg.SHEET, cfg.HEADERS);
  var cur = sh.getDataRange().getValues(), have = {}, i;
  for (i = 1; i < cur.length; i++) {
    var c = lotIso_(cur[i][0]);
    if (c) have[c] = true;
  }
  var keys = Object.keys(map).sort(), add = [];
  for (i = 0; i < keys.length; i++) if (!have[keys[i]]) add.push(map[keys[i]]);
  if (add.length) lotSetText_(sh, Math.max(2, sh.getLastRow() + 1), 1, add);

  var usable = 0;
  try { usable = lotbHistory_(kind).length; } catch (e2) { usable = 0; }
  return {
    ok: true, kind: kind,
    'ในบอทเก่า': keys.length, 'มีอยู่แล้ว': keys.length - add.length, 'เพิ่มใหม่': add.length,
    'คิดเลขฐานได้': usable, 'พอคิดเลขฐาน': usable >= (LOTB.WARM + 5)
  };
}

/** ทางเรียกจากลิงก์ — ?p=lotimport[&kind=lao|thai] ไม่ใส่ kind = ย้ายทั้งคู่ */
function lotImportAll_(kind) {
  var kinds = (kind === 'lao' || kind === 'thai') ? [kind] : ['lao', 'thai'];
  var out = { ok: true, 'ผล': {} };
  for (var i = 0; i < kinds.length; i++) {
    var r = lotImportRun_(kinds[i]);
    out['ผล'][kinds[i]] = r;
    if (!r.ok) out.ok = false;
  }
  return out;
}

/** ย้ายอัตโนมัติตอนผลย้อนหลังไม่พอ — ลองครั้งเดียวต่อวันต่อชนิด กันวนยิงชีตทุกข้อความ
    คืน true ถ้าหลังย้ายแล้วผลพอคิดเลขฐาน */
function lotImportIfThin_(kind) {
  try {
    if (lotbHistory_(kind).length >= (LOTB.WARM + 5)) return true;
    var ps = PropertiesService.getScriptProperties();
    var key = 'LOT_IMPORTED_' + kind, today = lotTodayISO_();
    if (ps.getProperty(key) === today) return false;      // วันนี้ลองแล้ว ไม่ลองซ้ำ
    ps.setProperty(key, today);                           // จดก่อนทำ กันวนถ้าตัวย้ายพัง
    var r = lotImportRun_(kind);
    return !!(r && r.ok && r['พอคิดเลขฐาน']);
  } catch (e) { return false; }
}
