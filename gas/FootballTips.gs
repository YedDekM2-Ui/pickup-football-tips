/**
 * FootballTips.gs — บันทึกทีเด็ดบอลจาก football-scraper ลงชีตทุกวัน + เกรดผล (ถูก=เขียว ผิด=แดง)
 * scraper (GitHub) ส่ง POST {fbtips:[...]} มาที่ /exec → doPost เรียก fbtLog_
 * เกรดผล: fbtGradeTips_ ดึงสกอร์จริงจาก Forebet เทียบคำแนะนำ → เติมคอลัมน์ "ผล"
 *
 * 📦 ย้ายมาจาก PIKTAX — ต่างจากของเดิม 4 จุด (ตั้งใจ):
 *   1. ทุกชื่อขึ้นต้น fbt* — ของเดิมชื่อ fb* ซึ่งชนกับ Forebet.gs ของบอทนี้ 2 ตัว
 *      (fbKey_ ที่นั่นคือ 'บ้าน|เยือน' ไม่มีวันที่ · fbPct_ ที่นั่นแกะ % จาก HTML คนละเรื่องกันเลย)
 *   2. เข้าชีตผ่าน sheetEnsure_/sheetIfExists_ บน SHEET_ID ของโปรเจกต์นี้ (ไม่ผูก id เล่มไว้ในไฟล์)
 *   3. ไม่ระบายสีเงื่อนไข
 *   4. ตัดของที่ Compat.gs มีอยู่แล้ว 7 ตัวทิ้ง + ไม่มี trigger (ไม่มีสิทธิ์ script.scriptapp)
 */

/* ชื่อแท็บ + หัวตาราง อยู่ Config.gs ที่เดียวจริง (SHEETS.FBT / HEADERS.FBT) */
var FBTIPS_TAB = SHEETS.FBT;
// col N 'เรท' = ราคาน้ำแบบทศนิยมจากคอลัมน์ Coef. ของ Forebet (scraper แปลงจาก American odds มาให้แล้ว)
//   มีแค่ ~50% ของคู่ (Forebet ไม่ออกราคาทุกคู่) → คู่ที่ว่างจะไม่ถูกนับตอนคิดกำไร
// col O..S = ตัวเลขดิบของแต่ละตลาดต่อคู่ (scraper ส่งมาใน m1x2/mah/mou/mbtts) + ธงขัดแย้งที่คิดฝั่งนี้
//   O '1x2%'   = 'บ้าน/เสมอ/เยือน' เช่น '71/20/10' — มีเฉพาะคู่ที่ติดหน้า top ของ Forebet (~22 คู่/รอบ)
//   P 'AH'     = 'ฝั่ง|เส้น|ความมั่นใจ%' เช่น 'Home|-1.5|34'
//   Q 'สูงต่ำ%' = 'Under/Over|avg goals' เช่น '69/31|1.53' (เส้นมาตรฐาน 2.5)
//   R 'BTTS%'  = 'No/Yes' เช่น '51/49'
//   S 'ธงขัด'  = ผลของ fbtConflict_ — กฎอยู่ที่นี่ล้วน แก้กฎแล้วไม่ต้อง push scraper ใหม่
var FBTIPS_HEADER = HEADERS.FBT;
/* เปิด/สร้างแท็บ — ผ่านทางเข้าชีตของโปรเจกต์นี้ (เติมหัวที่ขาด + บังคับช่องข้อความให้เอง)
   ไม่ระบายสีเงื่อนไข ตามที่ตกลงไว้ตอนย้าย FabValue.gs */
function fbtSheet_() { return sheetEnsure_(SHEETS.FBT, HEADERS.FBT); }

/* ❌ fbNorm_ ตัดทิ้งตอนย้าย — Compat.gs มีตัวเดียวจริง */

/** คีย์ประจำแถว (col L)
 *  ⭐ มี id ของ Forebet เมื่อไหร่ ให้ใช้ id เป็นคีย์เสมอ — id เป็นเลขถาวรของคู่นั้น ไม่เปลี่ยนตามภาษา/เวลา
 *     (ของเดิมใช้ วันที่|เวลา|ชื่อบ้าน|ชื่อเยือน|ลีก → เวลาขยับนิดเดียว หรือ AI สะกดไทยบ้างอังกฤษบ้าง = กลายเป็นคนละคู่
 *      ในชีตจึงมีคู่เดียวกันซ้ำ 2 แถว เช่น Sogdiana Jizzakh กับ ซ็อกเดียนา จิซซาค → นับนิ่งพลาด ตามผลไม่เจอ)
 *  ไม่มี id ค่อยถอยไปใช้ วันที่|ชื่อบ้าน|ชื่อเยือน (ตัดเวลา/ลีกออก เพราะสองอันนั้นแกว่งบ่อยสุด) */
function fbtKey_(d, home, away, mid) {
  mid = String(mid || '').trim();
  return mid ? (d + '|#' + mid) : (d + '|' + fbNorm_(home) + '|' + fbNorm_(away));
}

/** ดึงเลข id ออกจากคีย์ col L (คืน '' ถ้าเป็นคีย์แบบเก่า) */
function fbtMidFromKey_(key) {
  var m = String(key || '').match(/\|#(\d+)$/);
  return m ? m[1] : '';
}

/** ธงขัดแย้งข้ามตลาด — ราคาแต่ละตลาดของ Forebet ควรเล่าเรื่องเดียวกัน ถ้าเล่าคนละเรื่อง = คู่นั้นน่าสงสัย
 *  m = { x2:'71/20/10', ah:'Home|-1.5|34', ou:'69/31|1.53', btts:'51/49' } (ว่างได้ทุกตัว)
 *  ⚠️ ตอนนี้แค่ "ติดธงไว้ดู" ยังไม่เอาไปตัดคู่ทิ้ง — รอเก็บสถิติก่อนว่าคู่ติดธงแพ้จริงกว่าปกติไหม
 *  ตัวเลขที่หายไปจะกลายเป็น NaN → ทุกเงื่อนไขเป็น false เอง (ไม่ต้องเช็คว่างซ้ำ) */
function fbtConflict_(pick, m) {
  m = m || {};
  var x = String(m.x2 || '').split('/');
  var ah = String(m.ah || '').split('|');
  var ouAll = String(m.ou || '').split('|'), ou = String(ouAll[0] || '').split('/');
  var bt = String(m.btts || '').split('/');
  var H = Number(x[0]), A = Number(x[2]);
  var side = ah[0] || '', line = Number(ah[1]);
  var U = Number(ou[0]), O = Number(ou[1]), avg = Number(ouAll[1]);
  var bYes = Number(bt[1]);
  var f = [];
  // 1) AH ให้ "ต่อ" ฝั่งหนึ่ง (เส้นติดลบ) แต่ 1x2 ให้อีกฝั่งชนะมากกว่า = ราคาต่อกับโอกาสชนะขัดกันเอง
  //    ⚠️ ต้องเช็ค line < 0 ด้วย — เส้นเป็นบวกคือฝั่งนั้น "รองรับแต้ม" ไม่ใช่ต่อ
  //    (เคสจริง IMT Novi Beograd: 1x2 = 25/54/21, AH = Away +0.25 → เดิมติดธงผิด)
  if (x.length === 3 && line < 0 && ((side === 'Home' && A > H) || (side === 'Away' && H > A))) f.push('AH↔1x2');
  // 2) เต็งต่อขาด (เส้น ≤ -1.5) ในเกมที่ตลาดบอกลูกน้อย = ต้องยิงชนะ 2 ลูกในเกมจืด
  if (line <= -1.5 && U >= 60) f.push('ต่อขาด↔ต่ำ');
  // 3) สูงต่ำ vs BTTS เล่าคนละเรื่อง
  if (O >= 55 && bYes <= 45) f.push('สูง↔BTTS');
  if (U >= 55 && bYes >= 55) f.push('ต่ำ↔BTTS');
  // 4) คำแนะนำที่บอทฟันไป ขัดกับตัวเลขตลาดของคู่นั้นเอง
  if (/สูง/.test(pick) && U >= 60) f.push('pick↔ต่ำ');
  if (/ต่ำ/.test(pick) && O >= 60) f.push('pick↔สูง');
  if (/ช่วยกันยิงหรือจบ\s*2|จบ\s*2\s*\+/.test(pick) && (U >= 60 || avg <= 2)) f.push('pick↔ลูกน้อย');
  if (/ยิงฝั่งเดียว/.test(pick) && bYes >= 60) f.push('pick↔BTTS');
  return f.join(' ');
}

/** บันทึกทีเด็ด: 1 แถวต่อคู่/วัน · รอบถัดไป "อัปเดตทับ" แล้วนับ "นิ่ง" (pick ซ้ำติดกันกี่รอบ)
 *  pick เท่าเดิม → นิ่ง+1 (ยิ่งเยอะยิ่งมั่นใจ) · pick เปลี่ยน → รีเซ็ตเป็น 1 (ราคาแกว่ง) */
function fbtLog_(rows, day) {
  if (!rows || !rows.length) return 'no rows';
  var sh = fbtSheet_();
  var last = sh.getLastRow();

  // index แถวเดิม 2 ทาง (กันแถวเก่าหลุด ตอนเปลี่ยนมาใช้คีย์ id):
  //   idxL = คีย์ที่เขียนไว้จริงใน col L (ทั้งแบบใหม่ '|#id' และแบบเก่า 'วันที่|เวลา|บ้าน|เยือน|ลีก')
  //   idxN = คำนวณใหม่จาก วันที่+ชื่อทีม  ← ตัวนี้ทำให้แถวเก่าเจอได้ ทั้งที่คีย์คนละแบบ
  var idxL = {}, idxN = {}, rPick = {}, rStreak = {};
  if (last >= 2) {
    var cur = sh.getRange(2, 1, last - 1, 13).getValues();
    for (var i = 0; i < cur.length; i++) {
      var r = i + 2;
      var k = String(cur[i][11] || '');
      if (k) idxL[k] = r;
      // ⚠️ ต้อง fbtDateStr_ — col A เป็น Date object, String() จะได้ 'Fri Jul 24 2026 …' ไม่เคยตรงกับ 'yyyy-MM-dd'
      //    ที่ฝั่ง scraper ส่งมา → idxN ตายสนิทมาตลอด (แถวเก่าไม่เคยถูกย้ายเข้าคีย์ id, พอ id เริ่มมาจะได้แถวซ้ำ)
      var nk = fbtDateStr_(cur[i][0]) + '|' + fbNorm_(cur[i][3]) + '|' + fbNorm_(cur[i][4]);
      if (!(nk in idxN)) idxN[nk] = r;
      rPick[r] = String(cur[i][6] || '');          // col G (คำแนะนำ)
      rStreak[r] = parseInt(cur[i][12], 10) || 1;  // col M (นิ่ง)
    }
  }

  var today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  var add = [], upd = 0, same = 0, changed = 0, mids = 0;
  rows.forEach(function (p) {
    var d = p.date || day || today;
    var mid = String(p.id || '').trim();
    if (mid) mids++;
    var key = fbtKey_(d, p.home, p.away, mid);
    var natKey = d + '|' + fbNorm_(p.home) + '|' + fbNorm_(p.away);
    var legacy = [d, p.time || '', p.home || '', p.away || '', p.league || ''].join('|');
    var pick = p.pick || '';
    var od = parseFloat(p.odds);                 // เรทน้ำทศนิยม (scraper แปลงมาแล้ว) · ไม่มี/เพี้ยน = ปล่อยว่าง
    od = (od >= 1.01 && od <= 50) ? od : '';
    // ตัวเลขตลาด O..R + ธงขัด S · คู่ที่ scraper หาไม่เจอจะเป็น '' → ธงว่างเอง
    var mk = { x2: String(p.m1x2 || ''), ah: String(p.mah || ''), ou: String(p.mou || ''), btts: String(p.mbtts || '') };
    var mrow = [mk.x2, mk.ah, mk.ou, mk.btts, fbtConflict_(pick, mk)];
    var hasMk = !!(mk.x2 || mk.ah || mk.ou || mk.btts);

    // หาแถวเดิม: คีย์ใหม่ → คีย์เก่าเป๊ะๆ → ชื่อทีม
    var row = idxL[key] || idxL[legacy] || idxN[natKey] || 0;
    if (row > 0) {
      var st;
      if (rPick[row] === pick) { st = (rStreak[row] || 1) + 1; same++; }   // นิ่งเพิ่ม
      else { st = 1; changed++; }                                          // เปลี่ยน = รีเซ็ต
      sh.getRange(row, 6, 1, 4).setValues([[p.fav || '', pick, p.stars || '', p.pct || '']]); // F..I อัปเดตล่าสุด
      sh.getRange(row, 12).setValue(key);          // L อัปคีย์เป็นแบบ id (ย้ายแถวเก่าเข้าระบบใหม่ทีละแถว)
      sh.getRange(row, 13).setValue(st);           // M นิ่ง (คงสกอร์จริง/ผล คอลัมน์ J,K ไว้)
      // N เรท: ทับเฉพาะตอนรอบใหม่ส่งราคามาจริง (ราคาขยับได้ เอาล่าสุด) · ไม่ส่งมา = คงของเดิม ห้ามล้างเป็นว่าง
      if (od) sh.getRange(row, 14).setValue(od);
      // O..S: ทับเฉพาะรอบที่ส่งตัวเลขมาจริง (ราคาขยับได้ เอาล่าสุด) · ไม่ส่งมา = คงของเดิม
      if (hasMk) sh.getRange(row, 15, 1, 5).setValues([mrow]);
      rPick[row] = pick; rStreak[row] = st;
      idxL[key] = row; idxN[natKey] = row; upd++;
    } else if (idxL[key] === -1 || idxN[natKey] === -1) {
      // เพิ่ง add ไปในแบตช์เดียวกันนี้ — ข้าม กัน add ซ้ำ
    } else {
      add.push([d, p.time || '', p.league || '', p.home || '', p.away || '',
        p.fav || '', pick, p.stars || '', p.pct || '', '', '', key, 1, od].concat(mrow));
      idxL[key] = -1; idxN[natKey] = -1;
    }
  });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, FBTIPS_HEADER.length).setValues(add);
  return 'upd ' + upd + ' (นิ่ง+' + same + ' เปลี่ยน' + changed + ') · new ' + add.length + '/' + rows.length +
    ' · มี id ' + mids + '/' + rows.length;
}

/** คืนประวัติทีเด็ดวันนี้(+เมื่อวาน ครอบ 'วันบอล' ข้ามเที่ยงคืน) เป็น JSON ให้ scraper อ่านนับรอบนิ่ง
 *  param: '1'/'today' = วันนี้+เมื่อวาน · หรือใส่ 'YYYY-MM-DD' เจาะจงวัน */
function fbtHistoryJson_(param) {
  try {
    var sh = sheetIfExists_(SHEETS.FBT);
    if (!sh || sh.getLastRow() < 2) return '[]';
    var tz = 'Asia/Bangkok';
    var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var yest = Utilities.formatDate(new Date(Date.now() - 86400000), tz, 'yyyy-MM-dd');
    var want = {};
    if (param && param !== '1' && param !== 'today') want[String(param)] = 1;
    else { want[today] = 1; want[yest] = 1; }
    var data = sh.getRange(2, 1, sh.getLastRow() - 1, 13).getValues();
    var out = [];
    for (var i = 0; i < data.length; i++) {
      var d = fbtDateStr_(data[i][0]);      // ⚠️ col A เป็น Date object — String(cell) จะได้ 'Fri Jul 24 2026 …' ไม่เคยตรง 'yyyy-MM-dd'
      if (!want[d]) continue;              //    ของเดิมใช้ String() ตรงๆ → endpoint นี้คืน [] มาตลอดแบบเงียบๆ
      out.push({
        date: d, time: String(data[i][1] || ''),
        home: String(data[i][3] || ''), away: String(data[i][4] || ''),
        fav: String(data[i][5] || ''), pick: String(data[i][6] || ''),
        stars: String(data[i][7] || ''), pct: String(data[i][8] || ''),
        result: String(data[i][10] || ''), streak: parseInt(data[i][12], 10) || 1,
        mid: fbtMidFromKey_(data[i][11])          // เลข id คู่ (scraper ใช้จับคู่แทนชื่อทีม)
      });
    }
    return JSON.stringify(out);
  } catch (e) { return '[]'; }
}

/** สถิติ "เกณฑ์ไหนวัดแล้วจริง" แบบเครื่องอ่าน — scraper ดึงไปใส่ prompt ให้ Gemini
 *  ต่างจาก fbtStatsText_ ตรงที่อันนั้นให้คนอ่าน อันนี้ให้โมเดลใช้ตัดสินใจ → ต้องแนบ n ทุกตัว
 *  ไม่ตัดสินให้ในนี้ (ปล่อยให้ main.py แปลงเป็นคำสั่ง) — ที่นี่มีหน้าที่ "รายงานตัวเลขจริง" อย่างเดียว
 *  คืน: {days,n,base,roi,g:[{c:หมวด,k:กลุ่ม,n,p:%ถูก,r:ROI% (null=คู่มีเรทน้อยกว่า 20)}]}
 */
function fbtCritJson_(days) {
  days = parseInt(days, 10) || 45;
  try {
    var sh = sheetIfExists_(SHEETS.FBT);
    if (!sh || sh.getLastRow() < 2) return '{}';
    var since = Utilities.formatDate(new Date(Date.now() - days * 86400000), 'Asia/Bangkok', 'yyyy-MM-dd');
    var data = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getValues();
    function box() { return { n: 0, win: 0, on: 0, ret: 0 }; }
    function hit(o, ok, od) { o.n++; if (ok) o.win++; if (od) { o.on++; o.ret += ok ? (od - 1) : -1; } }
    var all = box(), G = {};   // G[หมวด][กลุ่ม] = box
    function put(cat, key, ok, od) {
      G[cat] = G[cat] || {};
      G[cat][key] = G[cat][key] || box();
      hit(G[cat][key], ok, od);
    }
    for (var i = 0; i < data.length; i++) {
      var d = fbtDateStr_(data[i][0]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < since) continue;
      if (fbtIsJunkRow_(data[i][3], data[i][4])) continue;
      var res = String(data[i][10] || '').trim();
      if (res !== 'ถูก' && res !== 'ผิด') continue;
      var ok = (res === 'ถูก');
      var stars = parseFloat(data[i][7]) || 0;
      var streak = parseInt(data[i][12], 10) || 1;
      var od = parseFloat(data[i][13]);
      od = (od >= 1.01 && od <= 50) ? od : 0;
      hit(all, ok, od);
      put('ดาว', stars >= 4 ? '⭐4' : (stars >= 3.5 ? '⭐3.5' : (stars >= 3 ? '⭐3' : '⭐<3')), ok, od);
      put('ความนิ่ง', streak >= 3 ? 'นิ่ง≥3รอบ' : (streak === 2 ? 'นิ่ง2รอบ' : 'รอบแรก'), ok, od);
      put('ชนิดคำแนะนำ', fbtPickType_(data[i][6]), ok, od);
      put('ตัวล็อก', (stars >= 3.5 && streak >= 2) ? 'เข้าเกณฑ์ตัวล็อก' : 'ไม่เข้าเกณฑ์', ok, od);
      var pct = parseFloat(data[i][8]);
      if (od && pct >= 1 && pct <= 100) {
        var eg = (pct / 100) * od - 1;
        put('ส่วนต่างราคา', eg < 0 ? 'edge ติดลบ' : (eg < 0.10 ? 'edge บาง' : (eg < 0.25 ? 'edge ดี' : 'edge หนา')), ok, od);
      }
    }
    if (!all.n) return JSON.stringify({ days: days, n: 0, g: [] });
    var g = [];
    Object.keys(G).forEach(function (cat) {
      Object.keys(G[cat]).forEach(function (k) {
        var o = G[cat][k];
        if (o.n < 10) return;                       // ตัวอย่างน้อยเกินจะพูดถึง — ตัดทิ้งตั้งแต่ต้นทาง
        g.push({
          c: cat, k: k, n: o.n, p: fbtPct_(o),
          r: o.on >= 20 ? Math.round(o.ret / o.on * 1000) / 10 : null
        });
      });
    });
    return JSON.stringify({
      days: days, n: all.n, base: fbtPct_(all),
      roi: all.on >= 40 ? Math.round(all.ret / all.on * 1000) / 10 : null, g: g
    });
  } catch (e) { return '{}'; }
}

// ⏳ คู่ที่ยังไม่มีผลเกิน N วัน = เลิกตาม stamp 'หมดอายุ' แล้วตัดออกจากสถิติทั้งหมด
//    (ไม่ลบแถวทิ้ง เผื่อย้อนดู แต่ไม่ถูกนับ/ไม่โผล่ในคำว่า "รอผล" อีกเลย)
var FBT_MAX_DAYS = 7;
var FBT_EXPIRED = 'หมดอายุ';

/** feed ผลบอลตัวจริงของ Forebet (JSON ตัวเดียวกับที่ scraper ใช้เลือกทีเด็ด)
 *  🩸 ทำไมเลิกขูด HTML: หน้าผลที่ขูดได้มีแต่สายที่ Forebet ออกเส้น AH → ครอบทีเด็ดแค่ ~30%
 *     ที่เหลือขึ้นว่า "เว็บไม่มีข้อมูล" ทั้งที่เตะจบไปแล้ว → ค้างถาวร 200+ คู่
 *  ✅ feed นี้ให้ครบทุกลีค + ย้อนวันไหนก็ได้ (วัดจริง 2026-08-02: 422 คู่/วัน จบแล้ว 411)
 *     สนามที่ใช้: id · Host_SC/Guest_SC (เต็มเวลา) · Host_SC_HT/Guest_SC_HT (ครึ่งแรก) · comment (สถานะ) */
function fbtFeedUrl_(dateStr) {
  return 'https://www.forebet.com/scripts/getrs.php?ln=en&tp=1x2&in=' + dateStr + '&ord=0&tz=%2B420&tzs=0&tze=0';
}

/* ❌ fbDayShift_ / fbFetchJsonText_ ตัดทิ้งตอนย้าย — Compat.gs มีตัวเดียวจริง
   ตัวโหลด feed ของ Compat.gs วิ่งผ่าน fbProxy_() ไม่ได้ฝัง r.jina.ai ไว้ในไฟล์ */

/** แกะ feed → map สกอร์ '#<id>' (แม่นสุด) + 'ชื่อบ้าน+เยือน' (สำรอง) = [เต็มH, เต็มA, ครึ่งH, ครึ่งA] */
function fbtParseFeed_(text) {
  var map = {};
  if (!text) return map;
  var i = String(text).indexOf('[[');           // ผ่าน Jina จะมีหัว 'Title:/URL Source:' นำหน้า
  if (i < 0) return map;
  var s = String(text).slice(i), arr = null;
  try { arr = JSON.parse(s); } catch (e) {
    var j = s.lastIndexOf(']]');                // Jina ต่อท้ายด้วยขยะได้ → ตัดถึงวงเล็บปิดตัวท้ายสุด
    if (j > 0) { try { arr = JSON.parse(s.slice(0, j + 2)); } catch (e2) { return map; } }
  }
  var list = (arr && arr[0]) || [];
  for (var k = 0; k < list.length; k++) {
    var m = list[k];
    // ✅ เอาเฉพาะที่จบจริง — Postp./Cancl./null = ยังไม่เตะ · ตัวเลข (นาทีที่ 67) = กำลังเตะ ห้ามเกรดเด็ดขาด
    if (!/^(FT|AET|AP|Pen\.?)$/i.test(String(m.comment || ''))) continue;
    if (m.Host_SC == null || m.Guest_SC == null) continue;
    var sc = [parseInt(m.Host_SC, 10), parseInt(m.Guest_SC, 10)];
    if (isNaN(sc[0]) || isNaN(sc[1])) continue;
    if (m.Host_SC_HT != null && m.Guest_SC_HT != null) {
      var hh = parseInt(m.Host_SC_HT, 10), ha = parseInt(m.Guest_SC_HT, 10);
      if (!isNaN(hh) && !isNaN(ha)) { sc[2] = hh; sc[3] = ha; }
    }
    if (m.id) map['#' + m.id] = sc;
    var nk = fbNorm_(String(m.HOST_NAME || '')) + fbNorm_(String(m.GUEST_NAME || ''));
    if (nk && !(nk in map)) map[nk] = sc;
  }
  return map;
}

/** เกรดผล: ดึงสกอร์จริงจาก Forebet feed เทียบคำแนะนำ → เติม "ผล"
 *  + กวาดคู่ที่ค้างเกิน FBT_MAX_DAYS วันทิ้งทุกรอบ (ไม่ให้ค้างสะสมเป็นพันแถวเหมือนเดิม) */
function fbtGradeTips_() {
  var sh = sheetIfExists_(SHEETS.FBT);
  if (!sh || sh.getLastRow() < 2) return 'no data';

  var nRow = sh.getLastRow() - 1;
  var vals = sh.getRange(2, 1, nRow, 12).getValues();
  var tz = Session.getScriptTimeZone() || 'Asia/Bangkok';
  var t0 = new Date().getTime();
  var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var cutoff = fbDayShift_(todayStr, -FBT_MAX_DAYS);

  // 1️⃣ กวาดก่อน: แถวไหนหมดอายุ ตัดทิ้งเลย · แถวไหนยังไล่ได้ จดไว้ว่าต้องโหลดผลของวันไหน
  //    (โหลดเฉพาะวันที่มีคู่ค้างจริง = ไม่เสียโควต้าไปกับวันที่เกรดครบแล้ว)
  var need = {}, expired = 0, col10 = [], col11 = [];
  for (var i = 0; i < nRow; i++) {
    col10.push([vals[i][9]]); col11.push([vals[i][10]]);
    if (vals[i][10]) continue;                                  // มีผล/หมดอายุแล้ว
    var d = fbtDateStr_(vals[i][0]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (d < cutoff) { col11[i] = [FBT_EXPIRED]; expired++; continue; }
    need[d] = 1;
    need[fbDayShift_(d, 1)] = 1;      // feed อิงเขตเวลา → คู่ดึกของวันนั้นไปโผล่ใน in=<วันถัดไป>
  }

  // 2️⃣ โหลดผล — วันใหม่ก่อน (สำคัญสุด) เผื่อชน 6 นาทีแล้วตัดกลางคัน รอบหน้าค่อยเก็บวันเก่าต่อ
  var scores = {}, dates = Object.keys(need).sort().reverse(), fetched = 0;
  var maxDate = fbDayShift_(todayStr, 1);
  for (var u = 0; u < dates.length; u++) {
    if (new Date().getTime() - t0 > 240000) break;
    if (dates[u] > maxDate) continue;                           // อนาคต ไม่มีผลแน่นอน
    var one = fbtParseFeed_(fbFetchJsonText_(fbtFeedUrl_(dates[u])));
    fetched++;
    for (var k2 in one) if (!(k2 in scores)) scores[k2] = one[k2];
  }

  // 3️⃣ ตัดสิน
  var graded = 0, found = 0, stillPend = 0;
  for (var r = 0; r < nRow; r++) {
    if (col11[r][0]) continue;
    var sc = fbLookupScore_(scores, vals[r][3], vals[r][4], fbtMidFromKey_(vals[r][11]));
    if (!sc) { stillPend++; continue; }                         // ยังไม่จบ (หรือเลื่อน/ยกเลิก)
    found++;
    // สกอร์จริง (เติมเสมอ แม้ตัดสินถูกผิดไม่ได้) · มีครึ่งแรกใส่วงเล็บไว้ ให้ตรวจย้อนหลังได้เอง
    col10[r] = [sc[0] + '-' + sc[1] + (sc[2] != null ? ' (' + sc[2] + '-' + sc[3] + ')' : '')];
    var res = fbtJudge_(String(vals[r][6] || ''), sc[0], sc[1], sc[2], sc[3]);
    if (res == null) continue;                                  // คำแนะนำแปลกๆ → ใส่แค่สกอร์
    col11[r] = [res ? 'ถูก' : 'ผิด'];                            // ผล → conditional format ระบายสี
    graded++;
  }
  // เขียนกลับทีเดียว (ของเดิม setValue ทีละช่อง → กวาดหลายร้อยแถวไม่เคยจบใน 6 นาที)
  sh.getRange(2, 10, nRow, 1).setValues(col10);
  sh.getRange(2, 11, nRow, 1).setValues(col11);

  return 'เกรดใหม่ ' + graded + ' คู่ (เจอสกอร์ ' + found + ') · โหลด ' + fetched + ' วัน = ' +
    Object.keys(scores).length + ' คีย์ · ยังรอผล ' + stillPend + ' คู่ · ตัดทิ้งเกิน ' + FBT_MAX_DAYS + ' วัน ' + expired + ' คู่';
}

/* ❌ fbGradeTipsLegacy_ ตัดทิ้งตอนย้าย — ทางขูด HTML เลิกใช้แล้ว
   และมันก๊อป fbFetchForebetText_/fbParseScores_/fbLookupScore_ ซ้ำ Compat.gs */

/** ตัดสินถูก/ผิดจากคำแนะนำ + สกอร์ (คืน true/false/null=ตัดสินไม่ได้)
 *  hh/ha = สกอร์ครึ่งแรก (undefined ได้ ถ้าหน้านั้นไม่มีวงเล็บ) → ใช้ตัดสิน 'สูงแรก/ต่ำแรก'
 *  ⚠️ ไม่มีสกอร์ครึ่งแรก = คืน null (รอผล) ห้ามเอาสกอร์เต็มเวลามาตัดสินครึ่งแรก จะกลายเป็นถูกฟรี */
function fbtJudge_(pick, hg, ag, hh, ha) {
  pick = String(pick);
  // ⚽ BTTS — ต้องเช็คก่อนตัวอื่น · ลำดับสำคัญ: คำใหม่ก่อนคำเก่า เพราะ "ช่วยกันยิงหรือจบ2+" มี "ช่วยกันยิง" ซ้อนอยู่
  //    ตัดสินจากสกอร์เต็มเวลาเท่านั้น
  //    ยิงฝั่งเดียว        = มีทีมเดียวที่ยิงได้ (0-0 นับว่าไม่เข้า)
  //    ช่วยกันยิงหรือจบ2+  = รวมสองทีม ≥ 2 ลูก (ทั้งคู่ยิงก็เข้าเงื่อนไขนี้อยู่แล้ว)
  if (/ยิงฝั่งเดียว/.test(pick)) return (hg >= 1) !== (ag >= 1);
  if (/ช่วยกันยิงหรือจบ\s*2|จบ\s*2\s*\+/.test(pick)) return (hg + ag) >= 2;
  if (/ไม่ยิงกันทั้งคู่|BTTS\s*ไม่|BTTS\s*No/i.test(pick)) return !(hg >= 1 && ag >= 1);   // legacy
  if (/ยิงกันทั้งคู่|ทั้งคู่ยิง|ช่วยกันยิง|BTTS/i.test(pick)) return hg >= 1 && ag >= 1;    // legacy
  if (/บ้านไม่แพ้/.test(pick)) return hg >= ag;
  if (/เยือนไม่แพ้/.test(pick)) return ag >= hg;
  if (/เสมอ/.test(pick)) return hg === ag;
  if (/หาผู้ชนะ/.test(pick)) return hg !== ag;
  var half = /แรก/.test(pick);                       // 'สูงแรก 0.5' / 'ต่ำแรก 1.5' = ครึ่งแรกเท่านั้น
  if (half && (hh == null || ha == null)) return null;
  var sum = half ? (hh + ha) : (hg + ag);
  // 🩸 ของเดิมเขียน /สูง\s*([0-9.]+)/ → คำจริงคือ 'สูงเต็ม 2.5' มี 'เต็ม' คั่น \s* ไม่ยอมรับ
  //    → ไม่เคย match → คืน null → ทีเด็ดสูง/ต่ำ "ไม่เคยถูกเกรดเลยแม้แต่คู่เดียว" ตั้งแต่วันแรก
  //    (ยืนยันจากสถิติ: ชนิดคำแนะนำมีแต่ ไม่แพ้/หาผู้ชนะ/เสมอ ไม่มีสูง/ต่ำโผล่สักคู่)
  //    ต้องเผื่อคำคั่น 'เต็ม/แรก' และช่องว่าง/วงเล็บ ก่อนถึงเลขเส้น
  var ov = pick.match(/(?:สูง|over)\s*(?:เต็ม|แรก|เวลา|ครึ่ง)?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (ov) return sum > parseFloat(ov[1]);
  var un = pick.match(/(?:ต่ำ|under)\s*(?:เต็ม|แรก|เวลา|ครึ่ง)?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (un) return sum < parseFloat(un[1]);
  return null;
}

/* ❌ fbFetchForebetText_ / FB_LINK_RE / fbParseScores_ / fbLookupScore_ ตัดทิ้งตอนย้าย
   Compat.gs มีตัวเดียวจริงอยู่แล้วทั้ง 4 ตัว และของที่นั่นวิ่งผ่าน fbProxy_() ของบอทนี้
   (ของเดิมฝัง r.jina.ai ตรง ๆ → สวิตช์ FB_PROXY='-' ของเจ้าของสั่งไม่ได้) */

// ==========================================
// สถิติย้อนหลัง — "วัดผลก่อนค่อยเชื่อ"
// ตอบคำถามเดียว: ดาวเยอะ/นิ่งหลายรอบ แล้วมันถูกจริงไหม หรือแค่รู้สึกไปเอง
// ==========================================

/** วันที่ในชีตอาจเป็น string 'YYYY-MM-DD' หรือ Date object (ชีตแปลงเอง) → คืน string เสมอ */
function fbtDateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd');
  return String(v || '').trim();
}

/** แถวขยะที่ต้องไม่นับ (แถวเทส/หัวตารางหลุด) */
function fbtIsJunkRow_(home, away) {
  var h = String(home || '').trim(), a = String(away || '').trim();
  if (!h || !a) return true;
  if (/^(a|b|test|home team|away team)$/i.test(h) || /^(a|b|test|home team|away team)$/i.test(a)) return true;
  return false;
}

/** จัดกลุ่มคำแนะนำเป็นชนิด (ไว้ดูว่าเราถนัดตลาดไหน) */
function fbtPickType_(pick) {
  pick = String(pick || '');
  if (/ยิงฝั่งเดียว/.test(pick)) return 'ยิงฝั่งเดียว';
  if (/ช่วยกันยิงหรือจบ\s*2|จบ\s*2\s*\+/.test(pick)) return 'ช่วยกันยิงหรือจบ2+';
  if (/ไม่ยิงกันทั้งคู่|BTTS\s*(ไม่|No)/i.test(pick)) return 'ไม่ยิงกันทั้งคู่ (BTTS No)';
  if (/ยิงกันทั้งคู่|ทั้งคู่ยิง|ช่วยกันยิง|BTTS/i.test(pick)) return 'ยิงกันทั้งคู่ (BTTS Yes)';
  if (/ไม่แพ้/.test(pick)) return 'ไม่แพ้ (1X/X2)';
  if (/เสมอ/.test(pick)) return 'เสมอ';
  if (/หาผู้ชนะ/.test(pick)) return 'หาผู้ชนะ';
  // แยกครึ่งแรกออกจากเต็มเวลา — คนละตลาด คนละความแม่น รวมกันจะมองไม่เห็นว่าตัวไหนพัง
  if (/สูงแรก/.test(pick)) return 'สูงครึ่งแรก (HT Over)';
  if (/ต่ำแรก/.test(pick)) return 'ต่ำครึ่งแรก (HT Under)';
  if (/สูง/.test(pick)) return 'สูง (Over)';
  if (/ต่ำ/.test(pick)) return 'ต่ำ (Under)';
  return 'อื่นๆ';
}

function fbtPct_(o) { return o.n ? Math.round(o.win * 1000 / o.n) / 10 : 0; }

/** กำไรเป็นหน่วย + ROI% ของกลุ่ม (นับแค่คู่ที่มีเรท) · คืน '' ถ้ายังไม่มีคู่มีเรท */
function fbtRoiStr_(o) {
  if (!o || !o.on) return '';
  var u = Math.round(o.ret * 100) / 100;
  var roi = Math.round(o.ret / o.on * 1000) / 10;
  return (u >= 0 ? '+' : '') + u + 'u · ROI ' + (roi >= 0 ? '+' : '') + roi + '% (' + o.on + ' คู่มีเรท)';
}

/** บรรทัดสรุป 1 กลุ่ม · n<10 = ตัวอย่างน้อย ยังเชื่อไม่ได้ (ห้ามเอาไปตัดสินใจ)
 *  ต่อท้ายด้วยกำไรเฉพาะกลุ่มที่มีคู่มีเรท ≥20 คู่ — ต่ำกว่านั้น ROI แกว่งจนไร้ความหมาย */
function fbtStatLine_(label, o) {
  if (!o || !o.n) return '  ' + label + ' — ยังไม่มีข้อมูล';
  return '  ' + label + ': ' + fbtPct_(o) + '% (' + o.win + '/' + o.n + ')' +
    (o.n < 10 ? ' ⚠️ตัวอย่างน้อย' : '') +
    (o.on >= 20 ? ' · ' + fbtRoiStr_(o) : '');
}

/** สรุปสถิติย้อนหลัง N วัน (ค่าเริ่มต้น 30) */
function fbtStatsText_(days) {
  days = parseInt(days, 10) || 30;
  var sh = sheetIfExists_(SHEETS.FBT);
  if (!sh || sh.getLastRow() < 2) return '📊 ยังไม่มีข้อมูลทีเด็ดในชีต';

  var since = Utilities.formatDate(new Date(Date.now() - days * 86400000), 'Asia/Bangkok', 'yyyy-MM-dd');
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 14).getValues();

  // กำไรจริง (ROI): แทงคู่ละ 1 หน่วยเท่ากันทุกคู่ · ถูก = ได้ (เรท-1) · ผิด = เสีย 1
  //   ⚠️ นับเฉพาะคู่ที่ "มีเรท" (Forebet ออกราคาแค่ ~ครึ่ง) → n ของกำไรจะน้อยกว่าความแม่นเสมอ ปกติ
  //   ⚠️ แม่นสูงแต่ขาดทุนได้ ถ้าไปเน้นเรทต่ำ — ตัวเลขนี้แหละที่ต้องดู ไม่ใช่ %ถูก
  function box() { return { n: 0, win: 0, on: 0, ret: 0 }; }
  function hit(o, ok, od) {
    o.n++; if (ok) o.win++;
    if (od) { o.on++; o.ret += ok ? (od - 1) : -1; }
  }

  var all = box(), byStar = {}, byStreak = {}, byType = {}, byLeague = {}, lock = box(), notLock = box();
  var byEdge = {}, byDow = {}, byDay = {};
  var total = 0, ungraded = 0, days_ = {}, noOdds = 0, dropped = 0;

  for (var i = 0; i < data.length; i++) {
    var d = fbtDateStr_(data[i][0]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < since) continue;
    if (fbtIsJunkRow_(data[i][3], data[i][4])) continue;
    var res = String(data[i][10] || '').trim();
    // ⏳ หมดอายุ = ไม่มีวันได้ผลแล้ว → ตัดออกจากทุกตัวเลข ไม่นับเป็นทีเด็ด ไม่นับเป็นรอผล
    if (res === FBT_EXPIRED) { dropped++; continue; }
    total++; days_[d] = 1;
    byDay[d] = byDay[d] || box(); byDay[d].pend = byDay[d].pend || 0;
    if (res !== 'ถูก' && res !== 'ผิด') { ungraded++; byDay[d].pend++; continue; }
    var ok = (res === 'ถูก');
    var stars = parseFloat(data[i][7]) || 0;
    var streak = parseInt(data[i][12], 10) || 1;
    var od = parseFloat(data[i][13]);
    od = (od >= 1.01 && od <= 50) ? od : 0;
    if (!od) noOdds++;

    hit(all, ok, od);
    hit(byDay[d], ok, od);
    var sb = stars >= 4 ? '⭐4' : (stars >= 3.5 ? '⭐3.5' : (stars >= 3 ? '⭐3' : '⭐ต่ำกว่า3'));
    byStar[sb] = byStar[sb] || box(); hit(byStar[sb], ok, od);
    var kb = streak >= 3 ? 'นิ่ง ≥3 รอบ' : (streak === 2 ? 'นิ่ง 2 รอบ' : 'นิ่ง 1 รอบ (รอบแรก)');
    byStreak[kb] = byStreak[kb] || box(); hit(byStreak[kb], ok, od);
    var pt = fbtPickType_(data[i][6]);
    byType[pt] = byType[pt] || box(); hit(byType[pt], ok, od);
    var lg = String(data[i][2] || '').trim() || '(ไม่ระบุลีค)';
    if (lg.length > 26) lg = lg.slice(0, 25) + '…';
    byLeague[lg] = byLeague[lg] || box(); hit(byLeague[lg], ok, od);
    hit((stars >= 3.5 && streak >= 2) ? lock : notLock, ok, od);   // 🔒 ตัวล็อก = ดาวสูง + นิ่งอย่างน้อย 2 รอบ

    // 💵 ส่วนต่างราคา (edge) = ความมั่นใจเว็บ × เรท − 1
    //    ตรรกะ: ถ้าเว็บบอก 60% แล้วเรท 2.00 → 0.6×2−1 = +0.20 = "ราคาให้เกินความน่าจะเป็น" คุ้มแทง
    //           ถ้าเว็บบอก 60% แต่เรท 1.40 → 0.6×1.4−1 = −0.16 = ถูกก็จริงแต่ราคาไม่คุ้ม ยิ่งแทงยิ่งจน
    //    นี่คือตัวชี้ขาดว่า "แม่นแล้วได้เงินไหม" — สำคัญกว่าดาว เพราะดาวไม่รู้ราคา
    //    ⚠️ นับได้แค่คู่ที่มีทั้งเรทและ % (ไม่มีเรท = คำนวณไม่ได้ ข้ามไป ไม่ใช่ 0)
    var pct = parseFloat(data[i][8]);
    if (od && pct >= 1 && pct <= 100) {
      var eg = (pct / 100) * od - 1;
      var eb = eg < 0 ? 'ติดลบ (ราคาไม่คุ้ม)'
        : (eg < 0.10 ? 'บาง +0 ถึง +0.10'
          : (eg < 0.25 ? 'ดี +0.10 ถึง +0.25' : 'หนา +0.25 ขึ้นไป'));
      byEdge[eb] = byEdge[eb] || box(); hit(byEdge[eb], ok, od);
    }

    // 📅 แยกวันในสัปดาห์ — ทดสอบข้อสังเกต "บางลีคไม่ค่อยยิงวันศุกร์"
    //    ถ้าจริง วันนั้นทีเด็ดสูง/ต่ำจะแม่นคนละทาง → ต้องเห็นเป็นตัวเลขก่อน ห้ามใส่ในกฎเพราะรู้สึก
    var pp = d.split('-');
    var dw = new Date(+pp[0], +pp[1] - 1, +pp[2]).getDay();
    var dk = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][dw];
    byDow[dk] = byDow[dk] || box(); hit(byDow[dk], ok, od);
  }

  var L = [];
  L.push('📊 *สถิติทีเด็ดบอล* ' + days + ' วันล่าสุด (ตั้งแต่ ' + since + ')');
  L.push('ทีเด็ดทั้งหมด ' + total + ' คู่ · ' + Object.keys(days_).length + ' วัน' +
    (dropped ? '  (ตัดทิ้งไม่ได้ผลใน ' + FBT_MAX_DAYS + ' วัน ' + dropped + ' คู่)' : ''));
  if (!all.n) {
    L.push('');
    L.push('⚠️ *ยังตัดสินผลไม่ได้สักคู่* (' + ungraded + ' คู่รอผล)');
    L.push('แปลว่าตัวเกรดผลยังไม่เคยทำงานสำเร็จ — ต้องรัน fbtGradeTips_ ให้ผ่านก่อน');
    L.push('ตัวเลขความแม่นทั้งหมดยังเชื่ออะไรไม่ได้เลยจนกว่าช่องนี้จะมีของ');
    return L.join('\n');
  }
  L.push('ตัดสินผลแล้ว ' + all.n + ' คู่ · รอผลอีก ' + ungraded + ' คู่');
  L.push('');
  L.push('🎯 *ความแม่นรวม: ' + fbtPct_(all) + '%* (' + all.win + '/' + all.n + ')' + (all.n < 30 ? '  ⚠️ ยังน้อย ดูเป็นแนวโน้มพอ' : ''));
  L.push('');
  // 💰 กำไรจริง — ตัวเลขที่สำคัญกว่า %ถูก (แม่น 70% ก็ขาดทุนได้ ถ้าไปกินแต่เรทต่ำ)
  L.push('💰 *กำไรจริง* (สมมติแทงคู่ละ 1 หน่วยเท่ากันหมด)');
  if (!all.on) {
    L.push('  ยังไม่มีคู่ไหนมีเรทเลย — เพิ่งเริ่มเก็บ รออีก 2-3 วันค่อยดู');
  } else {
    L.push('  ' + fbtRoiStr_(all) + ' จาก ' + all.n + ' คู่ที่ตัดสินผลแล้ว');
    L.push('  ⚠️ Forebet ออกเรทแค่ ~ครึ่ง → ' + noOdds + ' คู่ไม่มีเรท ไม่ถูกนับ');
    if (all.on < 40) {
      L.push('  ⚠️ ' + all.on + ' คู่ยังน้อยเกินจะสรุป (ต้อง ≥40) — บวก/ลบตอนนี้คือดวง ไม่ใช่ฝีมือ');
    } else {
      L.push('  → ' + (all.ret > 0 ? '✅ ระบบคัดทีเด็ดชนะราคาอยู่' : (all.ret < 0 ? '❌ ถูกเยอะแต่ยังสู้ราคาไม่ได้ — ต้องรื้อวิธีคัด' : '➖ เท่าทุนพอดี')));
    }
  }
  L.push('');
  // 📆 รายวัน + ค่าเฉลี่ยสะสม — ตัวที่บอกว่า "ช่วงนี้ฟอร์มดีขึ้นหรือแย่ลง" ซึ่งค่าเฉลี่ยรวมกลบไว้หมด
  //    สะสม = นับจากวันเก่าสุดมาถึงวันนั้น (เส้นเดียวกับที่ควรใช้ตัดสินใจว่าจะเล่นต่อไหม)
  L.push('📆 *รายวัน* (สะสม = เฉลี่ยตั้งแต่วันแรกถึงวันนั้น)');
  var dayKeys = Object.keys(byDay).sort();                 // เก่า → ใหม่ (ต้องเรียงแบบนี้ถึงสะสมได้)
  var cw = 0, cn = 0, cret = 0, con = 0, dayLines = [];
  dayKeys.forEach(function (dk) {
    var o = byDay[dk];
    cw += o.win; cn += o.n; cret += o.ret; con += o.on;
    if (!o.n && !o.pend) return;
    var mm = dk.slice(8) + '/' + dk.slice(5, 7);
    var line = '  ' + mm + ' · ';
    line += o.n ? (o.win + '/' + o.n + ' = ' + fbtPct_(o) + '%') : '—';
    if (o.on) line += ' · ' + (o.ret >= 0 ? '+' : '') + (Math.round(o.ret * 10) / 10) + 'u';
    if (o.pend) line += ' · รอ ' + o.pend;
    if (cn) line += '  (สะสม ' + Math.round(cw * 1000 / cn) / 10 + '%' +
      (con >= 20 ? ' · ' + (cret >= 0 ? '+' : '') + (Math.round(cret * 10) / 10) + 'u' : '') + ')';
    dayLines.push(line);
  });
  dayLines.reverse().slice(0, 14).forEach(function (x) { L.push(x); });   // ใหม่สุดอยู่บน โชว์ 14 วันพอ
  if (dayLines.length > 14) L.push('  … อีก ' + (dayLines.length - 14) + ' วัน (พิมพ์ /สถิติบอล ' + days + ' ดูในชีต)');
  L.push('');
  L.push('⭐ *แยกตามดาว* (ดาวเยอะควรแม่นกว่า ถ้าไม่ใช่ = ระบบให้ดาวมั่ว)');
  ['⭐4', '⭐3.5', '⭐3', '⭐ต่ำกว่า3'].forEach(function (k) { if (byStar[k]) L.push(fbtStatLine_(k, byStar[k])); });
  L.push('');
  L.push('🔁 *แยกตามความนิ่ง* (ยิ่งบอกซ้ำหลายรอบ ควรยิ่งแม่น)');
  ['นิ่ง 1 รอบ (รอบแรก)', 'นิ่ง 2 รอบ', 'นิ่ง ≥3 รอบ'].forEach(function (k) { if (byStreak[k]) L.push(fbtStatLine_(k, byStreak[k])); });
  L.push('');
  L.push('🔒 *ตัวล็อก (≥3.5 ดาว + นิ่ง ≥2 รอบ)*');
  L.push(fbtStatLine_('ตัวล็อก', lock));
  L.push(fbtStatLine_('ที่เหลือ', notLock));
  if (lock.n >= 10 && notLock.n >= 10) {
    var gap = fbtPct_(lock) - fbtPct_(notLock);
    L.push('  → ' + (gap >= 5 ? '✅ ตัวล็อกแม่นกว่าจริง +' + Math.round(gap * 10) / 10 + ' จุด — เกณฑ์นี้ใช้ได้'
      : (gap <= -5 ? '❌ ตัวล็อกแม่น*น้อยกว่า* ' + Math.round(-gap * 10) / 10 + ' จุด — เกณฑ์นี้หลอกเรา ต้องรื้อ'
        : '➖ ต่างกันแค่ ' + Math.round(gap * 10) / 10 + ' จุด — เกณฑ์นี้ยังไม่ช่วยอะไร')));
  }
  L.push('');
  L.push('📈 *แยกตามชนิดคำแนะนำ*');
  Object.keys(byType).sort(function (a, b) { return byType[b].n - byType[a].n; })
    .forEach(function (k) { L.push(fbtStatLine_(k, byType[k])); });
  L.push('');

  // 💵 ส่วนต่างราคา — วางไว้ก่อนอันดับลีค เพราะข้อความรวมยาวเกิน 4096 จะถูกตัดท้าย (tgSend_ truncate)
  //    ของสำคัญต้องอยู่ก่อนของที่ยังเชื่อไม่ได้
  L.push('💵 *แยกตามส่วนต่างราคา* (ความมั่นใจเว็บ × เรท − 1)');
  var egOrder = ['หนา +0.25 ขึ้นไป', 'ดี +0.10 ถึง +0.25', 'บาง +0 ถึง +0.10', 'ติดลบ (ราคาไม่คุ้ม)'];
  var egAny = 0;
  egOrder.forEach(function (k) { if (byEdge[k]) { egAny++; L.push(fbtStatLine_(k, byEdge[k])); } });
  if (!egAny) {
    L.push('  ยังคำนวณไม่ได้ — ต้องมีทั้งเรทและ % ในแถวเดียวกัน');
  } else {
    L.push('  → ถ้ากลุ่ม "ติดลบ" ขาดทุนหนักกว่ากลุ่มอื่นชัดๆ = ตัดทิ้งได้เลย (ยังต้องรอ ≥40 คู่/กลุ่ม)');
  }
  L.push('');

  // 📅 วันในสัปดาห์
  L.push('📅 *แยกตามวัน* (เช็คข้อสังเกตว่าบางวันบอลไม่ยิง)');
  ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'].forEach(function (k) { if (byDow[k]) L.push(fbtStatLine_(k, byDow[k])); });
  L.push('  ⚠️ 7 วันหั่นข้อมูลเป็น 7 กอง — ต้องมีวันละ ≥20 คู่ค่อยเชื่อ');
  L.push('');

  // 🏆 อันดับลีค — ตัวที่เอาไปใช้ได้จริง (เล่นแค่ลีคที่ Forebet แม่น เลี่ยงลีคที่มันมั่ว)
  //    เกณฑ์ติดอันดับ ≥5 คู่ — ต่ำกว่านี้ 1 คู่พลิกก็เด้งจากบนสุดไปล่างสุด ไม่มีความหมาย
  //    เรียงตาม %ถูก แล้วตัดที่ 12 ลีค (มือถืออ่านไหว) · ลีคตัวอย่างน้อยสรุปเป็นบรรทัดเดียว
  var LG_MIN = 5, lgKeys = Object.keys(byLeague);
  var lgOk = lgKeys.filter(function (k) { return byLeague[k].n >= LG_MIN; });
  var lgThin = lgKeys.filter(function (k) { return byLeague[k].n < LG_MIN; });
  L.push('🏆 *อันดับลีค — Forebet แม่นลีคไหน* (ต้อง ≥' + LG_MIN + ' คู่ถึงติดอันดับ)');
  if (!lgOk.length) {
    L.push('  ยังไม่มีลีคไหนถึง ' + LG_MIN + ' คู่ — ' + lgKeys.length + ' ลีคกระจายกันหมด รอสะสมอีก');
  } else {
    lgOk.sort(function (a, b) {
      var pa = byLeague[a].win / byLeague[a].n, pb = byLeague[b].win / byLeague[b].n;
      return pb - pa || byLeague[b].n - byLeague[a].n;      // แม่นเท่ากัน → เอาตัวที่มีคู่มากขึ้นก่อน
    });
    lgOk.slice(0, 12).forEach(function (k, idx) {
      L.push(fbtStatLine_((idx + 1) + '. ' + k, byLeague[k]));
    });
    if (lgOk.length > 12) L.push('  … อีก ' + (lgOk.length - 12) + ' ลีค (ดูในชีต)');
    L.push('  ⚠️ ต่ำกว่า 10 คู่ยังเป็นดวง — เอาไปตัดลีคทิ้งได้เมื่อครบ ~20 คู่');
  }
  if (lgThin.length) {
    var thinN = 0;
    lgThin.forEach(function (k) { thinN += byLeague[k].n; });
    L.push('  · อีก ' + lgThin.length + ' ลีคมีไม่ถึง ' + LG_MIN + ' คู่ (รวม ' + thinN + ' คู่) — ยังจัดอันดับไม่ได้');
  }
  L.push('');
  L.push('_พิมพ์ /สถิติบอล 7 เพื่อดูย้อนหลัง 7 วัน_');
  return L.join('\n');
}

/* ❌ triggerLiveFootball_ (/บอลสด) ตัดทิ้งตอนย้าย — odds-api ตายแล้ว PIKTAX เองก็ถอดออกจากเมนูตั้งแต่ v196
   ❌ fbGradeTrigger_ ตัดทิ้ง — โปรเจกต์นี้ไม่เคยขอสิทธิ์ script.scriptapp (ห้ามเติม scope เจ้าของต้องกดอนุญาตใหม่ทั้งชุด)
      เกรดผลสั่งเองด้วย ?k=..&p=fbgrade */