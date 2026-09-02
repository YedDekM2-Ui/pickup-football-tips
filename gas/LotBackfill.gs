/**
 * ============================================================
 * LotteryBackfill.gs — ดึงผลหวยย้อนหลังอัตโนมัติ (ไม่ต้องพิมพ์มือ)
 * ============================================================
 * หวยลาว : sanook GraphQL  https://graph.sanook.com/  (laoLottoes)
 * หวยไทย : thairath        https://www.thairath.co.th/lottery/archive[/<พ.ศ.>]
 *          (ข้อมูลอยู่ใน __NEXT_DATA__ → props.initialState.lottery.data.items)
 *
 * คำสั่ง Telegram:
 *   หวยลาว ดึง [200]      → เติมย้อนหลัง N งวด
 *   หวยไทย ดึง [200]      → เติมย้อนหลัง N งวด
 * แอดมิน: ?admin=..&action=lotbackfill[&n=200][&which=lao|thai]
 * ============================================================
 */

var LOT_BF = {
  LAO_GQL: 'https://graph.sanook.com/',
  TH_URL: 'https://www.thairath.co.th/lottery/archive',
  DEFAULT_LIMIT: 200,
  PAGE: 50,
  MAX_MS: 4.5 * 60 * 1000        // กันชน 6 นาทีของ GAS
};

/** เดือนไทยเต็ม + ปี พ.ศ.  '2026-07-01' → '1 กรกฎาคม 2569' */
var LOT_TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                     'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

function lotThaiDateLabel_(iso) {
  var p = String(iso || '').split('-');
  if (p.length !== 3) return String(iso || '');
  var mi = Number(p[1]) - 1;
  if (mi < 0 || mi > 11) return String(iso);
  return Number(p[2]) + ' ' + LOT_TH_MONTHS[mi] + ' ' + (Number(p[0]) + 543);
}

/** หัวตารางไม่ตรง = เขียนทับทั้งแถว (ต่างจาก sheetHeadSync_ ที่เติมต่อท้ายอย่างเดียว)
 *  ชีตหวยถูกเขียนด้วย lotSetText_ ตามตำแหน่งคอลัมน์ตายตัว หัวเพี้ยน = อ่านผิดคอลัมน์ทั้งชีต */
function lotEnsureHeaders_(sh, headers) {
  if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  var cur = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(cur[i] || '') !== headers[i]) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      return;
    }
  }
}

/**
 * merge แถวเข้าชีต — dedup ด้วย dateISO (คอลัมน์ A) เหมือน recordXxxResult_
 * rows = [[iso, ...], ...] ความกว้างเท่ากับ headers
 */
function lotMergeRows_(sheetName, headers, rows) {
  var sh = sheetEnsure_(sheetName, headers);
  lotEnsureHeaders_(sh, headers);
  var w = headers.length;
  // ⚠️ ต้องบังคับเป็น "ข้อความ" ก่อนเขียน ไม่งั้น Sheets กินเลข 0 หน้า ('0543' → 543) สถิติเพี้ยนทั้งชีต
  sh.getRange(1, 1, sh.getMaxRows(), w).setNumberFormat('@');
  var data = sh.getDataRange().getValues();
  var at = {};
  for (var i = 1; i < data.length; i++) {
    var k = lotIso_(data[i][0]);             // ⚠️ อาจเป็น Date object → String() ไม่มีวันตรง = เพิ่มแถวซ้ำ
    if (k) at[k] = i + 1;                    // เลขแถวจริงในชีต
  }
  var add = [], upd = 0;
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j], key = String(r[0]);
    if (at[key]) { sh.getRange(at[key], 1, 1, w).setValues([r]); upd++; }
    else { add.push(r); at[key] = -1; }
  }
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, w).setValues(add);
  return { added: add.length, updated: upd, total: Math.max(0, sh.getLastRow() - 1) };
}

/* ============================================================
 * หวยลาว — sanook GraphQL
 * ============================================================ */
function laoFetchSanook_(limit) {
  var q = 'query laoLottoes($first: Int, $after: String) {' +
    ' laoLottoes(first: $first, after: $after) {' +
    ' pageInfo { endCursor }' +
    ' edges { cursor node { dateSlug' +
    ' issueDateOnHuman(format: "YYYY-MM-DD" locale: "en" autoRelative: false)' +
    ' prizeResult { last4Prize last3Prize1 last3Prize2 } } } } }';

  var out = [], cursor = null, t0 = Date.now(), guard = 0;
  while (out.length < limit && guard++ < 30) {
    if (Date.now() - t0 > LOT_BF.MAX_MS) break;
    var res = UrlFetchApp.fetch(LOT_BF.LAO_GQL, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ query: q, variables: { first: LOT_BF.PAGE, after: cursor } }),
      headers: { 'Origin': 'https://www.sanook.com', 'User-Agent': 'Mozilla/5.0' },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) break;
    var j; try { j = JSON.parse(res.getContentText()); } catch (e) { break; }
    var edges = (((j.data || {}).laoLottoes || {}).edges) || [];
    if (!edges.length) break;                 // pageInfo.hasNextPage ของ sanook พัง → เช็ค edges ว่างแทน
    for (var i = 0; i < edges.length; i++) {
      var n = edges[i].node || {}, p = n.prizeResult || {};
      var iso = String(n.issueDateOnHuman || '').slice(0, 10);
      var n4 = String(p.last4Prize || '').replace(/\D/g, '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || n4.length !== 4) continue;
      // คอลัมน์ B ใช้ฟอร์แมตเดิมของชีตลาว (E d/M/yy) ให้ตรงกับแถวที่พิมพ์มือไว้แล้ว
      var lbl = Utilities.formatDate(new Date(iso + 'T00:00:00'), 'Asia/Bangkok', 'E d/M/yy');
      out.push([iso, lbl, n4, n4.slice(-3), n4.slice(-2)]);
    }
    cursor = edges[edges.length - 1].cursor;
  }
  return out.slice(0, limit);
}

function laoBackfill(limit) {
  limit = Number(limit) || LOT_BF.DEFAULT_LIMIT;
  var rows;
  try { rows = laoFetchSanook_(limit); }
  catch (e) { return '❌ ดึงหวยลาวไม่ได้: ' + e.message; }
  if (!rows.length) return '❌ ดึงหวยลาวไม่ได้ (sanook ไม่ตอบ/เปลี่ยนโครงสร้าง)';

  var r = lotMergeRows_(LAO.SHEET, LAO.HEADERS, rows);
  return '🇱🇦 ดึงหวยลาวย้อนหลังสำเร็จ' +
    '\n  ดึงมา ' + rows.length + ' งวด (' + rows[rows.length - 1][0] + ' → ' + rows[0][0] + ')' +
    '\n  เพิ่มใหม่ ' + r.added + ' · ทับของเดิม ' + r.updated + ' · ในชีตรวม ' + r.total + ' งวด' +
    '\n' + laoMiniStats_();
}

/* ============================================================
 * หวยไทย — thairath __NEXT_DATA__
 * prize id: 1=รางวัลที่1(6หลัก) · 10=เลขหน้า3ตัว · 6=เลขท้าย3ตัว · 7=เลขท้าย2ตัว
 * (2,3,4,5,11 = "รางวัลอื่นๆ" — ไม่เก็บ)
 * ============================================================ */
function thaiFetchThairath_(limit) {
  var out = [], seen = {}, t0 = Date.now();
  var nowBE = Number(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy')) + 543;

  for (var y = nowBE; y >= 2558 && out.length < limit; y--) {
    if (Date.now() - t0 > LOT_BF.MAX_MS) break;
    var url = LOT_BF.TH_URL + (y === nowBE ? '' : '/' + y);
    var items = [];
    try {
      var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.getResponseCode() !== 200) continue;
      var m = res.getContentText().match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!m) continue;
      items = ((((JSON.parse(m[1]).props || {}).initialState || {}).lottery || {}).data || {}).items || [];
    } catch (e) { continue; }

    for (var i = 0; i < items.length; i++) {
      var it = items[i] || {}, p = it.prizes || {};
      var iso = String(it.str || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || seen[iso]) continue;
      var p1 = String(((p['1'] || [])[0]) || '').replace(/\D/g, '');
      if (p1.length !== 6) continue;
      seen[iso] = 1;
      out.push([
        iso,
        'งวด ' + lotThaiDateLabel_(iso),
        p1.slice(-4),                                  // 4ตัวบน (ท้าย 4 ของรางวัลที่ 1)
        String(((p['7'] || [])[0]) || '').replace(/\D/g, ''),   // 2ตัวล่าง
        p1,                                            // รางวัลที่ 1
        (p['10'] || []).join('/'),                     // เลขหน้า 3 ตัว
        (p['6'] || []).join('/')                       // เลขท้าย 3 ตัว
      ]);
    }
  }
  out.sort(function (a, b) { return String(a[0]) < String(b[0]) ? 1 : -1; });
  return out.slice(0, limit);
}

function thaiBackfill(limit) {
  limit = Number(limit) || LOT_BF.DEFAULT_LIMIT;
  var rows;
  try { rows = thaiFetchThairath_(limit); }
  catch (e) { return '❌ ดึงหวยไทยไม่ได้: ' + e.message; }
  if (!rows.length) return '❌ ดึงหวยไทยไม่ได้ (thairath ไม่ตอบ/เปลี่ยนโครงสร้าง)';

  var r = lotMergeRows_(THAI_LOT.SHEET, THAI_LOT.HEADERS, rows);
  return '🇹🇭 ดึงหวยไทยย้อนหลังสำเร็จ' +
    '\n  ดึงมา ' + rows.length + ' งวด (' + rows[rows.length - 1][0] + ' → ' + rows[0][0] + ')' +
    '\n  เพิ่มใหม่ ' + r.added + ' · ทับของเดิม ' + r.updated + ' · ในชีตรวม ' + r.total + ' งวด' +
    '\n' + thaiMiniStats_();
}

/** เรียกรวม (แอดมิน / trigger) */
function lotBackfillAll(limit) {
  return [thaiBackfill(limit), '', laoBackfill(limit)].join('\n');
}
