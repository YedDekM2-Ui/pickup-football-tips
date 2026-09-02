/**
 * ============================================================
 * LotCore.gs — แกนกลางหวย: กันเลข 0 หน้าหาย + ตำแหน่งที่เข้า
 * ============================================================
 * 🐛 บั๊กที่ไฟล์นี้แก้ (เจอ 29/7/69 จากการ dump ชีตจริง):
 *   1) recordLaoResult_/recordThaiResult_ เขียนด้วย appendRow/setValues เฉยๆ
 *      → Sheets แปลง '0480' เป็นตัวเลข 480  (เลข 0 หน้าหาย สถิติเพี้ยน)
 *      → แปลง '2026-07-28' เป็น Date object
 *   2) พอคอลัมน์ A เป็น Date  →  String(cell) = 'Tue Jul 28 2026 …'
 *      ไม่มีวันตรงกับ 'yyyy-MM-dd' → กันซ้ำพัง (ได้แถวซ้ำ) · lotpFind_ หาไม่เจอ
 *      · lotGradeBackfill_ ตกด่าน regex → ข้ามทุกแถว · เรียงวันที่มั่ว
 *   ทางแก้: ทุก "เขียน" ผ่าน lotSetText_ (บังคับฟอร์แมต @ ก่อน)
 *           ทุก "อ่าน" ผ่าน lotIso_ / lotPad_
 *
 * 📍 ตำแหน่งที่เข้า (ผู้ใช้ขอ): ผล 0480 → คู่ติดกันนับจากขวา
 *      ตำแหน่ง 1 = 80 (ลาว = สองบน) · 2 = 48 · 3 = 04 (ลาว = สองล่าง)
 *      ทายไว้ 04 → เข้าตรง ตำแหน่ง 3 · ทายไว้ 08 → เข้าโต๊ด ตำแหน่ง 1
 * ============================================================
 */

/* ============================================================
 * 1) normalize — อ่านค่าจากชีตให้กลับมาเป็นข้อความเสมอ
 * ============================================================ */

/** ค่าคอลัมน์วันที่ (Date หรือ string) → 'yyyy-MM-dd' */
function lotIso_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
  }
  return String(v == null ? '' : v).trim().slice(0, 10);
}

/** เติม 0 หน้าให้ครบ n หลัก ('' คงเป็น '') — 480 → '0480' */
function lotPad_(v, n) {
  var s = String(v == null ? '' : v).replace(/\D/g, '');
  if (!s) return '';
  while (s.length < n) s = '0' + s;
  return s;
}

/** เติม 0 ให้ลิสต์คั่น / เช่น '123/45' → '123/045' */
function lotPadList_(v, n) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  return s.split('/').map(function (x) { return lotPad_(x, n); }).filter(String).join('/');
}

/**
 * แถวหวยลาว [iso, ป้าย, เลข, สามบน, สองบน] → ข้อความล้วน เติม 0 ครบ
 * ⚠️ ความยาวเดิมของ "เลข" เดาจากสามบน: มี = เดิม 4 หลัก · ว่าง = เดิม 2 หลัก
 *    (กัน '27' ที่พิมพ์มาแค่ 2 หลัก ถูกยัดเป็น '0027')
 */
function lotNormLaoRow_(r) {
  var d3 = lotPad_(r[3], 3);
  var num = d3 ? lotPad_(r[2], 4) : lotPad_(r[2], 2);
  var d2 = lotPad_(r[4], 2) || num.slice(-2);
  var iso = lotIso_(r[0]);
  var lbl = String(r[1] || '').trim() ||
    (iso ? Utilities.formatDate(new Date(iso + 'T00:00:00'), 'Asia/Bangkok', 'E d/M/yy') : '');
  return [iso, lbl, num, d3, d2];
}

/** แถวหวยไทย [iso, งวด, 4ตัวบน, 2ตัวล่าง, รางวัลที่1, หน้า3, ท้าย3] */
function lotNormThaiRow_(r) {
  var iso = lotIso_(r[0]);
  return [iso,
    String(r[1] || '').trim() || (iso ? 'งวด ' + lotThaiDateLabel_(iso) : ''),
    lotPad_(r[2], 4), lotPad_(r[3], 2), lotPad_(r[4], 6),
    lotPadList_(r[5], 3), lotPadList_(r[6], 3)];
}

function lotNormRow_(kind, r) {
  return kind === 'thai' ? lotNormThaiRow_(r) : lotNormLaoRow_(r);
}

/**
 * อ่านชีตผลหวย → แถวข้อความล้วน เรียงเก่า→ใหม่ ตัดงวดซ้ำ (แถวล่างสุดชนะ = แก้ทีหลัง)
 */
function lotResultRows_(kind) {
  var sh = (kind === 'thai')
    ? sheetEnsure_(THAI_LOT.SHEET, THAI_LOT.HEADERS)
    : sheetEnsure_(LAO.SHEET, LAO.HEADERS);
  var v = sh.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    var n = lotNormRow_(kind, v[i]);
    if (!n[0] || !n[2]) continue;
    map[n[0]] = n;                                  // งวดเดียวกัน แถวหลังทับแถวหน้า
  }
  return Object.keys(map).sort().map(function (k) { return map[k]; });
}

/* ============================================================
 * 2) เขียน — บังคับ "ข้อความ" ก่อนเสมอ ไม่งั้น Sheets กินเลข 0 หน้า
 * ============================================================ */
function lotSetText_(sh, row, col, values) {
  var h = values.length, w = values[0].length;
  var need = row + h - 1;
  if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
  if (sh.getMaxColumns() < col + w - 1) sh.insertColumnsAfter(sh.getMaxColumns(), col + w - 1 - sh.getMaxColumns());
  var rg = sh.getRange(row, col, h, w);
  if (rg.setNumberFormat) rg.setNumberFormat('@');
  rg.setValues(values);
  return rg;
}

/* ============================================================
 * 3) ตำแหน่งที่เข้า (คำนวณล้วน — เทสต์ได้ตรงๆ)
 * ============================================================ */

/**
 * เลข 2 หลักที่ทายไว้ ไปเข้าตำแหน่งไหนของผล (นับจากขวา)
 * 0480 → คู่ ['04','48','80'] = ตำแหน่ง 3, 2, 1
 * @return [{pos:3, mode:'ตรง'}, ...]  ว่าง = ไม่เข้า
 */
function lotPosHits_(pred, numRaw) {
  var p = String(pred || '').replace(/\D/g, '');
  var n = String(numRaw || '').replace(/\D/g, '');
  var out = [];
  if (p.length !== 2 || n.length < 2) return out;
  var w = lotWindows_(n);                       // ซ้าย→ขวา
  var rev = p.charAt(1) + p.charAt(0);
  for (var i = 0; i < w.length; i++) {
    var pos = w.length - i;                     // ขวาสุด = ตำแหน่ง 1
    if (w[i] === p) out.push({ pos: pos, mode: 'ตรง' });
    else if (w[i] === rev) out.push({ pos: pos, mode: 'โต๊ด' });
  }
  return out;
}

/** ชื่อตำแหน่งอ่านง่าย */
function lotPosName_(pos) {
  return pos === 1 ? 'ท้าย (สองบน)' : pos === 2 ? 'กลาง' : pos === 3 ? 'หน้า (สองล่าง)' : 'ที่ ' + pos;
}

/**
 * เก็บเป็นข้อความบรรทัดเดียว → '04@3ตรง|08@1โต๊ด'
 * @param preds รายการเลขที่ทายไว้ (เอาเฉพาะฝั่ง "ดี")
 */
function lotPosText_(preds, numRaw) {
  var seen = {}, out = [];
  (preds || []).forEach(function (p) {
    lotPosHits_(p, numRaw).forEach(function (h) {
      var k = String(p).replace(/\D/g, '') + '@' + h.pos + h.mode;
      if (seen[k]) return;
      seen[k] = 1;
      out.push(k);
    });
  });
  return out.join('|');
}

/** '04@3ตรง|08@1โต๊ด' → [{n:'04',pos:3,mode:'ตรง'}, ...] */
function lotPosParse_(txt) {
  return String(txt || '').split('|').map(function (s) {
    var m = s.match(/^(\d{2})@(\d+)(ตรง|โต๊ด)$/);
    return m ? { n: m[1], pos: Number(m[2]), mode: m[3] } : null;
  }).filter(Boolean);
}

/** '04@3ตรง|08@1โต๊ด' → '04 ที่ 3 ตรง · 08 ที่ 1 โต๊ด' */
function lotPosLine_(txt) {
  var a = lotPosParse_(txt);
  if (!a.length) return '—';
  return a.map(function (h) { return h.n + ' ที่ ' + h.pos + ' ' + h.mode; }).join(' · ');
}

/**
 * 📍 สรุปสถิติตำแหน่งที่เข้า — อ่านคอลัมน์ 'ตำแหน่ง' ของ Lot_Predict
 * (ผู้ใช้ขอเก็บไว้ก่อน ค่อยเรียกดูทีหลัง: "หวยลาว ตำแหน่ง")
 */
function lotPosStatsText_(kind, limit) {
  var sh = sheetIfExists_(LOTP.SHEET);   // อ่านอย่างเดียว — ไม่มีชีตก็ไม่สร้างเปล่าทิ้งไว้
  var data = sh ? sh.getDataRange().getValues() : [];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]) !== kind) continue;
    if (!String(data[i][LOTP_COL.RESULT - 1] || '')) continue;      // ยังไม่เกรด
    rows.push(data[i]);
  }
  rows = rows.slice(-(limit || 100));
  var flag = (kind === 'lao') ? '🇱🇦 ลาว' : '🇹🇭 ไทย';
  if (!rows.length) {
    return '📍 ตำแหน่งที่เข้า ' + flag + '\nยังไม่มีงวดที่เกรดแล้ว' +
      '\nพิมพ์ "หวย' + (kind === 'lao' ? 'ลาว' : 'ไทย') + ' เกรดย้อนหลัง" เพื่อไล่เกรดงวดเก่าก่อน';
  }

  var pos = {}, mode = { 'ตรง': 0, 'โต๊ด': 0 }, drawHit = 0, tot = 0, recent = [];
  rows.forEach(function (v) {
    var hits = lotPosParse_(v[LOTP_COL.POS - 1]);
    if (hits.length) drawHit++;
    hits.forEach(function (h) {
      tot++;
      pos[h.pos] = pos[h.pos] || { n: 0, 'ตรง': 0, 'โต๊ด': 0 };
      pos[h.pos].n++;
      pos[h.pos][h.mode]++;
      mode[h.mode]++;
    });
    recent.push({ d: String(v[1] || lotIso_(v[0])), num: String(v[LOTP_COL.RESULT - 1] || ''), t: v[LOTP_COL.POS - 1] });
  });

  var L = [];
  L.push('📍 ตำแหน่งที่เข้า ' + flag + ' — ' + rows.length + ' งวดล่าสุด');
  L.push('━━━━━━━━━━━━━━');
  L.push('เข้าอย่างน้อย 1 ตัว : ' + drawHit + '/' + rows.length + ' งวด · รวม ' + tot + ' ครั้ง');
  L.push('🎯 ตรง ' + mode['ตรง'] + ' · 🔄 โต๊ด ' + mode['โต๊ด']);
  L.push('━━━ แยกตำแหน่ง (นับจากขวา) ━━━');
  Object.keys(pos).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (k) {
    var p = pos[k];
    L.push('  ที่ ' + k + ' ' + lotPosName_(Number(k)) + ' : ' + p.n +
      ' (ตรง ' + p['ตรง'] + ' · โต๊ด ' + p['โต๊ด'] + ')');
  });
  L.push('━━━━━━━━━━━━━━');
  L.push('🗓️ ล่าสุด:');
  recent.slice(-10).reverse().forEach(function (r) {
    L.push('  ' + r.d + '  ' + r.num + '  →  ' + lotPosLine_(r.t));
  });
  L.push('');
  L.push('💡 ผล 0480 → ที่ 1 = 80 (สองบน) · ที่ 2 = 48 · ที่ 3 = 04 (สองล่าง)');
  L.push('   ทายไว้ 08 แล้วออก 80 = "โต๊ด" (กลับตัว)');
  return L.join('\n');
}

/* ============================================================
 * 4) ซ่อมชีตที่พังไปแล้ว (แถวซ้ำ + เลข 0 หน้าหาย + วันที่เป็น Date)
 *    สำรองชีตเดิมไว้ก่อนเสมอ → ย้อนกลับได้
 * ============================================================ */
function lotRepairSheet_(kind) {
  var name = (kind === 'thai') ? THAI_LOT.SHEET : LAO.SHEET;
  var headers = (kind === 'thai') ? THAI_LOT.HEADERS : LAO.HEADERS;
  var ss = SpreadsheetApp.openById(prop_('SHEET_ID'));
  var sh = sheetEnsure_(name, headers);

  var raw = sh.getDataRange().getValues();
  var before = Math.max(0, raw.length - 1);
  var rows = lotResultRows_(kind);                       // normalize + ตัดซ้ำ + เรียงแล้ว
  if (!rows.length) return '⚠️ ' + name + ' ว่าง — ไม่มีอะไรให้ซ่อม';

  // สำรองก่อนแตะของจริง
  var stamp = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmm');
  var bak = name + '_bak_' + stamp;
  if (!ss.getSheetByName(bak)) sh.copyTo(ss).setName(bak);

  rows.reverse();                                        // ใหม่อยู่บน (อ่านง่าย)
  if (sh.getMaxRows() > 1) sh.getRange(2, 1, sh.getMaxRows() - 1, sh.getMaxColumns()).clearContent();
  lotSetText_(sh, 1, 1, [headers]);
  lotSetText_(sh, 2, 1, rows);

  return '🔧 ซ่อม ' + name + ' เรียบร้อย' +
    '\n  ก่อน ' + before + ' แถว → หลัง ' + rows.length + ' แถว (ตัดซ้ำ ' + (before - rows.length) + ')' +
    '\n  เติม 0 หน้า + วันที่เป็นข้อความ + ฟอร์แมต @ ทั้งชีต' +
    '\n  สำรองไว้ที่ชีต "' + bak + '"';
}

/* ============================================================
 * 6) จับคำตอบที่ "ตอบใต้ใบถามผลหวย" (Reply) — ด่านกันเลขหวยกลายเป็นบิล
 * ============================================================ */

/**
 * เจ้าของกด Reply ใต้ใบถามผลหวย → บังคับให้จบที่ทางหวยเท่านั้น
 * คืน true = จัดการแล้ว (ห้ามส่งต่อ handleText_)
 *
 * 🐛 บั๊กที่ฟังก์ชันนี้แก้ (เกิดจริง 16 ส.ค. 69 งวด 16 สิงหาคม):
 *    ของเดิมจับคำตอบด้วย "รูปแบบตัวเลข" อย่างเดียว (thaiCatchReply_ ต้องได้ 4 ตัว + 2 ตัว)
 *    เจ้าของตอบ "4615" มาตัวเดียว → ไม่เข้ารูป → คืน null → ไหลต่อไปตัวอ่านรายการเงิน
 *    → ลงบิล CASH_WITHDRAW 4,615.00 ฿ ทั้งที่เป็นเลขหวย
 *
 *    ทางแก้ = ดูที่ "บรรทัด Reply" ไม่ใช่ดูที่รูปแบบเลข
 *    ตอบใต้ใบถามหวย = เจตนาชัดว่าเป็นเลขหวย ต่อให้พิมพ์ผิดรูปก็ต้อง fail-closed อยู่ในหวย
 *    (ห้ามคืน false หลังจากรู้แล้วว่าเป็นใบหวย ไม่งั้นรูรั่วเดิมกลับมา)
 */
function lotCatchReply_(chatId, msg) {
  var rep = msg && msg.reply_to_message;
  if (!rep) return false;
  var rt = String(rep.text || '');
  if (rt.indexOf('ออกอะไรครับ') < 0) return false;        // ไม่ใช่ใบถามผลหวย → ปล่อยผ่าน
  var kind = rt.indexOf('หวยไทย') >= 0 ? 'thai'
           : rt.indexOf('หวยลาว') >= 0 ? 'lao' : '';
  if (!kind) return false;

  // ↓↓↓ ตั้งแต่บรรทัดนี้ลงไป = ใบหวยแน่นอน ทุกทางออกต้อง return true ↓↓↓
  var t = String(msg.text || '').trim();
  var lower = t.toLowerCase();
  var p = kind === 'thai' ? getThaiPending_() : getLaoPending_();
  var date = p && p.date ? p.date : null;                  // ไม่มี pending = ปล่อยให้ record เดางวดเอง

  // ข้าม — ต้องมี pending ถึงจะจดว่าเลิกตามถามงวดไหน
  if (/^(ข้าม|ไม่ออก|ยังไม่ออก|skip|\/ข้าม)$/i.test(lower)) {
    if (kind === 'thai') clearThaiPending_(); else clearLaoPending_();
    if (date) lotDrawListAdd_(LOT_DUE.PROP_SKIP, kind, date);
    tgSend_(chatId, 'โอเค ข้ามงวด ' + (date ? lotShortDate_(date) : 'นี้') + ' ครับ' +
      lotAskNextDue_(kind), false);
    return true;
  }

  var d = t.replace(/\D/g, '');                            // เอาเฉพาะตัวเลข

  if (kind === 'lao') {
    if (d.length >= 2 && d.length <= 4) {
      tgSend_(chatId, recordLaoResult_(d, date) + lotAskNextDue_('lao'), false);
      return true;
    }
    tgSend_(chatId, '❌ หวยลาวต้อง 2–4 หลัก เช่น  0392\n(หรือพิมพ์ "ข้าม" ถ้าไม่ต้องเก็บงวดนี้)', false);
    return true;
  }

  // ── หวยไทย: ต้องได้ครบ 4 ตัวบน + 2 ตัวล่าง ─────────────────────────────
  var m = t.match(/^(\d{4})\D+(\d{2})$/);
  if (m) {
    tgSend_(chatId, recordThaiResult_(m[1], m[2], date) + lotAskNextDue_('thai'), false);
    return true;
  }
  if (d.length === 6) {                                    // "461523" ติดกัน = 4+2
    tgSend_(chatId, recordThaiResult_(d.slice(0, 4), d.slice(4), date) + lotAskNextDue_('thai'), false);
    return true;
  }
  if (d.length === 4) {
    // ได้แค่ 4 ตัวบน — คงคิวไว้ ถามต่อ 2 ตัวล่าง (ห้ามจดครึ่งเดียว ชีตต้องครบทั้งคู่)
    tgSendForceReply_(chatId,
      '📌 รับ 4 ตัวบน ' + d + ' ไว้แล้ว — ขอ 2 ตัวล่างด้วยครับ\n' +
      'ตอบกลับใบนี้เป็น  ' + d + ' 56  (หรือพิมพ์แค่ 2 หลัก)\n' +
      '🇹🇭 หวยไทย งวด ' + (date ? lotThaiDateLabel_(date) : 'นี้') + ' ออกอะไรครับ?');
    return true;
  }
  if (d.length === 2) {
    // 2 หลักเดี่ยว — เป็น 2 ตัวล่างได้ ถ้าใบที่ตอบมีเลข 4 ตัวบนติดมาแล้ว
    var up = rt.match(/รับ 4 ตัวบน (\d{4})/);
    if (up) {
      tgSend_(chatId, recordThaiResult_(up[1], d, date) + lotAskNextDue_('thai'), false);
      return true;
    }
  }
  tgSend_(chatId,
    '❌ ยังไม่ครบ — หวยไทยต้องมีทั้ง 4 ตัวบน และ 2 ตัวล่าง\n' +
    'ตอบกลับใบถามเป็น  1234 56\n' +
    '(หรือพิมพ์ "ข้าม" ถ้าไม่ต้องเก็บงวดนี้)\n' +
    '📎 ตอบใต้ใบถามหวย จะไม่ถูกอ่านเป็นรายการเงินแล้วครับ', false);
  return true;
}

/** ซ่อมทั้งสองฝั่ง + ดึงผลจริงมาทับงวดล่าสุด (แถวที่พิมพ์มือผิดจะถูกแทนด้วยของจริง) */
function lotRepairAll(refetch) {
  var out = [lotRepairSheet_('lao'), lotRepairSheet_('thai')];
  if (refetch !== false) {
    try { out.push('', laoBackfill(30)); } catch (e) { out.push('⚠️ ดึงลาวไม่ได้: ' + e.message); }
  }
  return out.join('\n');
}
