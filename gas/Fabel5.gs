/**
 * Fabel5.gs — ใบเตือนบอลสดของ FABEL5 + เกรดผลด้วยการ "ตอบสกอร์ใต้ใบเตือน"
 *
 * ทำไมต้องอยู่ฝั่ง GAS: เจ้าของจะปิดคอม → ตัวเกรดที่เครื่องบ้าน (fb_grade.py) ใช้ไม่ได้
 * แต่ข้อความที่ตอบใน Telegram วิ่งเข้า webhook ของ PIKTAX ซึ่งอยู่บนเครื่อง Google → บันทึกได้ตลอด
 *
 * วงจร:
 *   fb_watch.py  --(?admin=..&action=f5alert&text=..&meta=..)-->  f5Alert_()
 *        → ส่งเข้า Telegram แล้วจำ message_id ไว้ในชีต (แถวละ 1 ใบเตือน)
 *   เจ้าของ "ตอบกลับ" ใบนั้นด้วยสกอร์จบ เช่น 2-1
 *        → f5CatchReply_() หาแถวจาก message_id → ตัดสิน → เขียนผล → ตอบยอดสะสมกลับไป
 *
 * ⚖️ เกณฑ์ตัดสินลอกจาก fb_grade.py / fb_calib.py เป๊ะ ห้ามแก้ข้างเดียว ไม่งั้นเลข 2 ที่เทียบกันไม่ได้
 *   และต้องวัดเป็น "ลูกที่ยังไม่เกิด" เพราะใบเตือนออกตอนสกอร์ยังเท่าพักครึ่งเป๊ะ
 *   (เกณฑ์แบบ "จบ ≥2 ลูก" ตอนพัก 2-0 = ชนะฟรี ชุดเก่าพลาดตรงนี้ทั้งชุด):
 *     lv_nolose → ฝั่งที่ Forebet เชียร์ (≥70%) ไม่แพ้
 *     bts1_g1 / bh_g1 / over_g1 → ครึ่งหลังมีประตูอีก ≥1
 *   ชุดคีย์เก่า (ht00_2h_goal / debt_*) เลิกเตือนแล้ว แต่ยังเกรดใบที่ค้างอยู่ได้
 *
 * ⚠️ ใช้ prefix f5* — ห้ามชนกับ fb* หรือ fbt* ของไฟล์อื่น (คนละระบบ คนละชีต)
 *
 * 📦 ย้ายมาจาก PIKTAX — ต่างจากของเดิม 4 จุด (ตั้งใจ):
 *   1. เข้าชีตผ่าน sheetEnsure_ บน SHEET_ID ของโปรเจกต์นี้ (ไม่ผูก id เล่มไว้ในไฟล์)
 *   2. ส่งเทเลแกรมผ่าน tgApi_ ของโปรเจกต์นี้ (ปุ่มลัดติดไปด้วยทุกใบ)
 *   3. ไม่ระบายสีเงื่อนไข
 *   4. ไม่มี trigger — โปรเจกต์นี้ไม่เคยขอสิทธิ์ script.scriptapp
 *      f5Poke() ยังอยู่ ใช้มือกด/ยิงลิงก์เอา ส่วน f5PokeTrigger_ ตัดทิ้ง
 */

/* ชื่อแท็บกับหัวตารางย้ายไปอยู่ Config.gs แล้ว (SHEETS.F5 / HEADERS.F5) — ที่เดียวจริง */
var F5_TAB = SHEETS.F5;
var F5_HEADER = HEADERS.F5;
// คอลัมน์ที่ต้องรู้ตำแหน่ง (1-based)
// คอลัมน์ใหม่ "ต่อท้ายเสมอ" ห้ามแทรกกลาง — เลขข้างล่างนี้ผูกกับตำแหน่งจริง แถวเก่าจะเพี้ยนหมด
var F5_C = { msg: 2, ft: 12, res: 13, ans: 19, red: 20, gmin: 21, src: 22 };

var F5_FAV_TH = 70;   // ต้องตรงกับ fb_watch.py / fb_calib.py / fb_grade.py

var F5_LABEL = {
  // ⚠️ ต้องตรงกับ RULES[...]["label"] ใน fb_watch.py เป๊ะ ไม่งั้นการ์ดกับใบเฉลยผลพูดคนละคำ
  //    bh_g1 ท่อน "(เต็งไม่แพ้หรืออาจจะแซงได้)" เจ้าของสั่งใส่เอง — วัดได้ 54.1% (n=344)
  //    ไม่ใช่ 86.1% ที่เป็นเลขของเกณฑ์จริง → ต้องมี F5_NOTE กำกับเสมอ
  lv_nolose: 'พักครึ่งยังเสมอ แต่เขาทายเต็งไว้แรง → เต็งไม่น่าแพ้',
  bts1_g1:   'ครึ่งแรกยิงอยู่ฝั่งเดียว แต่เขาทายว่ายิงกันทั้งคู่ → อีกฝั่งอาจยิงคืนได้อย่างน้อย 1 ลูก',
  bh_g1:     'เต็งตามอยู่ครึ่งแรก → ครึ่งหลังยังมีลูกมาอีก (เต็งไม่แพ้หรืออาจจะแซงได้)',
  over_g1:   'ครึ่งแรกบอลต่ำ แต่เขาทายว่าเกมนี้จะยิงได้ครึ่งหลัง → มีอีกอย่างน้อย 1 ลูก',
  // คีย์เก่า เลิกเตือนแล้ว แต่ยังต้องเกรดใบที่ค้างอยู่
  ht00_2h_goal: '(เลิกใช้) ครึ่งแรก 0-0 → ครึ่งหลังมีประตู',
  debt_over:    '(เลิกใช้) สูงค้าง → จบ ≥3 ประตู',
  debt_btts:    '(เลิกใช้) ยิงฝั่งเดียว → BTTS',
  debt_fav:     '(เลิกใช้) ตัวเต็งยังไม่นำ → จบพลิกชนะ'
};

// ต้องตรงกับ RULES[...]["note"] ใน fb_watch.py — เลขกำกับท่อนที่ไม่ใช่เกณฑ์ตัดสิน
var F5_NOTE = {
  bh_g1: 'ท่อนในวงเล็บมีเลขของมันเอง — เต็งไม่แพ้ตอนจบ 54.1% (ตามมาเสมอ 25.0% + พลิกชนะ 29.1% · 344 คู่)'
};

/* เปิด/สร้างแท็บ — ผ่านทางเข้าชีตของโปรเจกต์นี้ (เติมหัวที่ขาด + บังคับช่องข้อความให้เอง)
   ไม่ระบายสีเงื่อนไข ตามที่ตกลงไว้ตอนย้าย FabValue.gs */
function f5Sheet_() { return sheetEnsure_(SHEETS.F5, HEADERS.F5); }

/** ส่งข้อความแล้วคืน message_id (ต้องได้ id ไว้ให้เจ้าของตอบสกอร์ใต้ใบ) */
function f5Send_(text) {
  var chat = tgChat_();
  if (!chat) return 0;
  var r = tgApi_('sendMessage', { chat_id: chat, text: truncate_(text, 4096),
                                  disable_web_page_preview: true,
                                  reply_markup: JSON.stringify(tgKeyboard_()) });
  if (!r.ok) { logEvent_('ERROR', 'f5Send_: ' + (r.error || r.code)); return 0; }
  return (r.result && r.result.message_id) || 0;
}

/**
 * ?admin=..&action=f5alert&text=<ใบเตือน>&meta=<json>
 * meta: {id,mkt,head,tag,cc,lg,h,a,min,HH,GH,hit,n,base,p1,p2}
 */
function f5Alert_(text, metaJson) {
  text = String(text || '').trim();
  if (!text) return 'f5alert: ไม่มี text';
  if (!getTgChatId_()) return 'f5alert: ยังไม่มี TELEGRAM_CHAT_ID (ทัก /start ก่อน)';

  var m = {};
  try { m = JSON.parse(metaJson || '{}') || {}; } catch (e) { m = {}; }

  var mid = f5Send_(text);
  if (!mid) return 'f5alert: ส่ง Telegram ไม่ผ่าน';

  // ส่งออกไปแล้วถึงค่อยจด — ถ้าจดไม่ลง ใบยังถึงมือ ไม่ใช่เงียบหาย
  try {
    var sh = f5Sheet_();
    sh.appendRow([
      Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'),
      mid, String(m.id || ''), String(m.mkt || ''), String(m.head || ''),
      String(m.tag || '') + (m.cc ? ' [' + m.cc + ']' : ''), m.lg == null ? '' : m.lg,
      String(m.h || ''), String(m.a || ''), m.min == null ? '' : m.min,
      (m.HH == null ? '' : m.HH) + '-' + (m.GH == null ? '' : m.GH),
      '', '',                                        // สกอร์จบ / ผล — รอเจ้าของตอบ
      m.hit == null ? '' : m.hit, m.n == null ? '' : m.n, m.base == null ? '' : m.base,
      m.p1 == null ? '' : m.p1, m.p2 == null ? '' : m.p2, '', '', ''
    ]);   // 3 ช่องท้าย = ตอบเมื่อ / ใบแดง / นาทีที่เห็นลูก — เติมทีหลังทั้งคู่
    // ใบแดง "เหย้า-เยือน" · null ทั้งคู่ = ไม่รู้ → เว้นว่าง ("ไม่มีใบแดง" กับ "ไม่รู้" คนละเรื่อง)
    // ต้องบังคับเป็นข้อความก่อน ไม่งั้น Sheets แปลง "0-1" เป็นวันที่ (เจอมาแล้วกับช่องสกอร์จบ)
    if (m.rh != null || m.ra != null) {
      sh.getRange(sh.getLastRow(), F5_C.red).setNumberFormat('@')
        .setValue((m.rh || 0) + '-' + (m.ra || 0));
    }
  } catch (e) {
    logEvent_('ERROR', 'f5Alert_ จดชีตไม่ลง: ' + e.message);
    return 'f5alert OK ' + mid + ' (แต่จดชีตไม่ลง: ' + e.message + ')';
  }
  return 'f5alert OK ' + mid;
}

function f5Int_(v) {
  var n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return isNaN(n) ? null : n;
}

/**
 * บรรทัด "กินเมื่อ" ของใบยืนยันผล — ต้องบอกชื่อทีมตรงๆ
 *
 * ทำไม: หัวใบว่า "บ้านไม่แพ้" แต่บรรทัดสถิติเดิมเขียนว่า "ฝั่งนั้นไม่แพ้"
 * ซึ่งไม่มีคำว่าฝั่งไหนอยู่ในประโยคเลย + คนอ่านสลับกับ "ต่อบ้าน" ได้ (คนละใบ:
 * ไม่แพ้ = เสมอได้ตังค์คืน · ต่อบ้าน = เสมอแล้วเสีย)
 * ⚠️ ถ้อยคำต้องตรงกับ f5Judge_ ข้างล่างเป๊ะ และตรงกับ _bet() ใน fb_watch.py
 * ตลาดเก่าที่เลิกเตือนแล้วคืน '' — ไม่รู้ก็ไม่พูด ดีกว่าพูดผิด
 */
function f5Need_(mkt, head, home, away) {
  if (mkt === 'lv_nolose') {
    var isAway = String(head).indexOf('เยือน') === 0;
    return (isAway ? away : home) + ' ชนะ หรือ เสมอ';
  }
  if (mkt === 'bts1_g1' || mkt === 'bh_g1' || mkt === 'over_g1') {
    return 'มีประตูอีกอย่างน้อย 1 ลูก หลังจากใบเตือน';
  }
  return '';
}

/** ตัดสินใบเตือน 1 ใบ · คืน true/false · null = ตัดสินไม่ได้ */
function f5Judge_(mkt, HS, GS, HH, GH, p1, p2) {
  var tot = HS + GS;
  // rem = ลูกครึ่งหลัง = ของที่ยังไม่เกิดตอนเตือน (ใบออกตอนสกอร์ยังเท่าพักครึ่งเป๊ะ)
  var rem = (HH == null || GH == null) ? null : tot - (HH + GH);

  // ── ชุดปัจจุบัน ──
  if (mkt === 'lv_nolose') {
    if (p1 == null || p2 == null || HH == null) return null;
    if (p1 >= F5_FAV_TH) return HS >= GS;
    if (p2 >= F5_FAV_TH) return GS >= HS;
    return null;
  }
  if (mkt === 'bts1_g1' || mkt === 'bh_g1' || mkt === 'over_g1') {
    return rem == null ? null : rem >= 1;
  }

  // ── ชุดเก่า เลิกเตือนแล้ว แต่ใบที่ค้างอยู่ต้องเกรดด้วยเกณฑ์เดิมของมัน ──
  if (mkt === 'ht00_2h_goal') return tot >= 1;
  if (mkt === 'debt_over')    return tot >= 3;
  if (mkt === 'debt_btts')    return HS > 0 && GS > 0;
  if (mkt === 'debt_fav') {
    if (p1 == null || p2 == null || HH == null || GH == null) return null;
    if (p1 >= 60 && HH <= GH) return HS > GS;
    if (p2 >= 60 && GH <= HH) return GS > HS;
  }
  return null;
}

/**
 * เจ้าของตอบสกอร์ใต้ใบเตือน → เกรดให้เลย
 * คืน true = จัดการแล้ว (ห้ามส่งต่อให้ handleText_ ไม่งั้นเลข "2-1" ไปโดนตัวอ่านเงินกิน)
 */
function f5CatchReply_(chatId, msg) {
  var rep = msg.reply_to_message;
  if (!rep || !rep.message_id) return false;
  // ด่านถูก ๆ ก่อนเปิดชีต: ใบเตือน FABEL5 ขึ้นต้นด้วย ⚽ เสมอ
  if (String(rep.text || '').indexOf('⚽') !== 0) return false;

  var sh = f5Sheet_(), last = sh.getLastRow();
  if (last < 2) return false;
  var ids = sh.getRange(2, F5_C.msg, last - 1, 1).getValues();
  var row = 0;
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === String(rep.message_id)) { row = i + 2; break; }
  }
  if (!row) return false;                       // ไม่ใช่ใบของเรา — ปล่อยผ่านตามปกติ

  var t = String(msg.text || '');
  var mm = t.match(/(\d{1,2})\s*[-:xX×–]\s*(\d{1,2})/);
  if (!mm) {
    tgSend_(chatId,
      '✍️ ตอบสกอร์ได้ 3 แบบ (เรียงตามใบเตือน: เจ้าบ้าน-เยือน)\n' +
      '· `0-2 จบ` = สกอร์จบเกม → เฉลยผลเลย\n' +
      '· `0-2 57` = เพิ่งยิงนาที 57 → จดนาทีไว้ ยังไม่เฉลย\n' +
      '· `0-2 57 จบ` = ยิงนาที 57 แล้วจบเลย → จดนาที + เฉลย', false);
    return true;
  }
  var HS = parseInt(mm[1], 10), GS = parseInt(mm[2], 10);

  // ── นาทีที่ยิง + คำว่า "จบ" ────────────────────────────────────────────────
  // เอาสกอร์ออกจากข้อความก่อนค่อยหาเลขนาที ไม่งั้นไปคว้าเลขสกอร์มาเป็นนาที
  var rest = t.replace(mm[0], ' ');
  var gmn = rest.match(/(\d{1,3})/);
  gmn = gmn ? parseInt(gmn[1], 10) : null;
  if (gmn !== null && (gmn < 1 || gmn > 130)) gmn = null;   // นอกช่วงนาทีบอล = ไม่ใช่นาที
  // เจ้าของพิมพ์เอง = นาทีจริง → ทับของตัวเฝ้าได้เลย (ของตัวเฝ้าคลาด ±5 เพราะยิงทุก 5 นาที)
  if (gmn !== null) sh.getRange(row, F5_C.gmin).setValue(gmn);

  // "จบ" = สกอร์นี้คือผลจบเกม · ไม่บอกนาทีมาเลย = ตอบหลังเกมจบตามเคย ก็ถือว่าจบ
  var isFT = /จบ|เต็มเวลา|\bft\b/i.test(rest) || gmn === null;
  if (!isFT) {
    tgSend_(chatId,
      '📝 จดไว้แล้ว: ยิงนาที ' + gmn + "'  (สกอร์ตอนนี้ " + HS + '-' + GS + ')\n' +
      'พอจบเกมตอบอีกทีว่า  ' + HS + '-' + GS + ' จบ  แล้วจะเฉลยผลให้', false);
    return true;
  }

  var r = sh.getRange(row, 1, 1, F5_HEADER.length).getValues()[0];
  var mkt = String(r[3]), head = String(r[4]), home = String(r[7]), away = String(r[8]);
  var ht = String(r[10]).split('-');
  var HH = f5Int_(ht[0]), GH = f5Int_(ht[1]);
  var p1 = r[16] === '' ? null : Number(r[16]), p2 = r[17] === '' ? null : Number(r[17]);
  var again = String(r[F5_C.res - 1] || '') !== '';

  var g = f5Judge_(mkt, HS, GS, HH, GH, p1, p2);
  // ต้องบังคับเป็นข้อความก่อน ไม่งั้น Sheets แปลง "2-1" เป็นวันที่ 2 ม.ค. (เจอจริง 9 ส.ค. 69)
  sh.getRange(row, F5_C.ft).setNumberFormat('@').setValue(HS + '-' + GS);
  sh.getRange(row, F5_C.res).setValue(g === null ? 'ตัดสินไม่ได้' : (g ? 'ถูก' : 'ผิด'));
  sh.getRange(row, F5_C.ans).setValue(
    Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'));
  sh.getRange(row, F5_C.src).setValue('ตอบเอง');

  var mark = g === null ? '⚠️ ตัดสินไม่ได้ (ข้อมูลใบนี้ไม่ครบ)' : (g ? '✅ เข้า' : '❌ ไม่เข้า');
  var need = f5Need_(mkt, head, home, away);
  tgSend_(chatId,
    (again ? '✏️ แก้ผลเป็น ' : '') + mark + '\n' +
    home + ' ' + HS + '-' + GS + ' ' + away +
    (gmn === null ? '' : "  (ยิงนาที " + gmn + "')") + '\n' +
    (need ? '🎯 กินเมื่อ: ' + need + '\n' : '') +
    '📊 ' + (F5_LABEL[mkt] || head) + '\n' +
    (F5_NOTE[mkt] ? '📎 ' + F5_NOTE[mkt] + '\n' : '') +
    f5Tally_(sh), false);
  return true;
}

/**
 * ช่อง "เวลาเตือน" → 'yyyy-MM-dd'
 *
 * 🐛 บั๊กที่ทำให้ "วันนี้ 0/0" ตลอดกาล: เราเขียนลงเป็นข้อความ แต่ Sheets แปลงเป็น Date ให้เอง
 * พอ getValues() คืนมาเป็น Date แล้วโค้ดเดิมเอาไป String() จะได้ "Sun Aug 09 2026 22:50:00..."
 * ซึ่งไม่มีทางขึ้นต้นด้วย "2026-08-09" เลย → นับวันนี้ไม่เจอสักใบ (ตระกูลเดียวกับบั๊ก "2-1" เป็นวันที่)
 * รับทั้ง 2 หน้าตา เพราะแถวเก่ากับแถวใหม่ปนกันอยู่ในชีตเดียว
 */
function f5At_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  return String(v || '');
}
function f5Day_(v) { return f5At_(v).slice(0, 10); }

/** บรรทัดสรุปท้ายข้อความยืนยัน — วันนี้กี่ใบ / รวมทั้งหมดกี่ % */
function f5Tally_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return '';
  var v = sh.getRange(2, 1, last - 1, F5_HEADER.length).getValues();
  var today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  var dn = 0, dh = 0, an = 0, ah = 0;
  for (var i = 0; i < v.length; i++) {
    var res = String(v[i][F5_C.res - 1] || '');
    if (res !== 'ถูก' && res !== 'ผิด') continue;
    an++; if (res === 'ถูก') ah++;
    if (f5Day_(v[i][0]) === today) { dn++; if (res === 'ถูก') dh++; }
  }
  if (!an) return '';
  return 'วันนี้ ' + dh + '/' + dn + ' · รวม ' + ah + '/' + an +
         ' (' + Math.round(ah * 1000 / an) / 10 + '%)' +
         (an < 20 ? ' — ยังน้อยกว่า 20 ใบ อย่าเพิ่งเชื่อ' : '');
}

/** /สถิติเตือน — แยกรายตลาด (ห้ามรวมเป็นเลขเดียว คนละตลาดคนละเรื่อง) */
function f5StatsText_() {
  var sh = f5Sheet_(), last = sh.getLastRow();
  if (last < 2) return '📬 ยังไม่เคยเตือนสักใบ';
  var v = sh.getRange(2, 1, last - 1, F5_HEADER.length).getValues();
  var per = {}, wait = 0, all = 0;
  for (var i = 0; i < v.length; i++) {
    all++;
    var mkt = String(v[i][3]), res = String(v[i][F5_C.res - 1] || '');
    if (res !== 'ถูก' && res !== 'ผิด') { wait++; continue; }
    if (!per[mkt]) per[mkt] = { n: 0, hit: 0, said: 0 };
    per[mkt].n++;
    if (res === 'ถูก') per[mkt].hit++;
    per[mkt].said += Number(v[i][13]) || 0;
  }
  var out = ['📬 เตือนไป ' + all + ' ใบ · รู้ผลแล้ว ' + (all - wait) + ' · รอตอบ ' + wait, ''];
  var keys = Object.keys(per).sort(function (a, b) { return per[b].n - per[a].n; });
  if (!keys.length) return out[0] + '\n\nยังไม่มีใบไหนรู้ผล — ตอบสกอร์ใต้ใบเตือนได้เลย';
  for (var k = 0; k < keys.length; k++) {
    var o = per[keys[k]], real = o.hit * 100 / o.n, said = o.said / o.n;
    out.push((F5_LABEL[keys[k]] || keys[k]));
    out.push('   ' + o.hit + '/' + o.n + ' = ' + (Math.round(real * 10) / 10) + '%' +
             (said ? '  · ตอนเตือนโชว์ ' + (Math.round(said * 10) / 10) + '%' +
                     ' (ห่าง ' + (real - said >= 0 ? '+' : '') + Math.round((real - said) * 10) / 10 + ')' : ''));
  }
  out.push('');
  out.push('(ห่างติดลบ = โม้เกินจริง · ใบน้อยกว่า 20 ยังเชื่อไม่ได้)');
  return out.join('\n');
}

/**
 * อ่านช่องสกอร์ให้กลับมาเป็น "H-A" เสมอ
 * Sheets เคยกลืน "2-1" เป็นวันที่ 2 ม.ค. (แถวเก่าก่อน 9 ส.ค. 69)
 * = เลขหน้าไปเป็น "วัน" เลขหลังไปเป็น "เดือน" → กลับด้านคืน (ยืนยันกับใบทดสอบ TEST0001 ที่รู้ผลจริงว่า 2-1)
 */
function f5Score_(x) {
  if (x instanceof Date) return x.getDate() + '-' + (x.getMonth() + 1);
  return String(x == null ? '' : x);
}

/**
 * ── นาฬิกาปลุก: ให้ GAS เป็นคนปลุก fb-watch แทน cron ของ GitHub ────────────────
 *
 * ทำไมต้องมี: cron ของ repo ฟรีไม่ตรงเวลา — วัดจริง 9 ส.ค. 69 ตั้งไว้ทุก 5 นาที
 * แต่ตื่นแค่ 2 ครั้ง ห่างกัน 48 นาที (GitHub เอาไปเข้าคิวรวมกับทั้งโลก)
 * หน้าต่างเตือนกว้างแค่ 13 นาที (นาทีที่ 45-58 ของเกม) → ตื่นช้าทีเดียวก็ข้ามคู่ทั้งดุ้น
 *
 * ทำไมใช้ dispatch ได้: วัดแล้ว 3 รอบที่สั่งเอง created_at = run_started_at เป๊ะ
 * ไม่มีดีเลย์ (dispatch ไม่เข้าคิวหน่วงแบบ cron) · repo เป็น public → นาทีฟรีไม่จำกัด
 *
 * cron เดิมใน fb-watch.yml ปล่อยไว้เหมือนเดิม = ตัวสำรองถ้า GAS เงียบ
 * 🔴 ปิดชั่วคราว: ตั้ง Script Property  F5_POKE = off  (ไม่ต้องลบ trigger)
 */
var F5_REPO = 'YedDekM2-Ui/football-scraper';
var F5_WF   = 'fb-watch.yml';

function f5Poke() {
  var p = PropertiesService.getScriptProperties();
  if (String(p.getProperty('F5_POKE') || '') === 'off') return 'f5poke: ปิดอยู่ (F5_POKE=off)';
  var token = p.getProperty('GH_TOKEN');
  if (!token) return 'f5poke: ยังไม่ได้ตั้ง GH_TOKEN';
  try {
    var res = UrlFetchApp.fetch(
      'https://api.github.com/repos/' + F5_REPO + '/actions/workflows/' + F5_WF + '/dispatches', {
        method: 'post', muteHttpExceptions: true, contentType: 'application/json',
        headers: {
          'Authorization': 'token ' + token,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        payload: JSON.stringify({ ref: 'main' })
      });
    var c = res.getResponseCode();
    // 204 = สั่งได้ · อย่างอื่นจดไว้เงียบ ๆ ไม่ต้องกวน Telegram ทุก 5 นาที
    if (c !== 204) logEvent_('ERROR', 'f5Poke HTTP ' + c + ' ' + res.getContentText().substring(0, 120));
    return 'f5poke HTTP ' + c + (c === 204 ? ' (สั่งแล้ว)' : '');
  } catch (e) {
    logEvent_('ERROR', 'f5Poke: ' + e.message);
    return 'f5poke error: ' + e.message;
  }
}

/* ❌ f5PokeTrigger_ ตัดทิ้งตอนย้าย — โปรเจกต์นี้ไม่มีสิทธิ์ script.scriptapp
   ปลุก fb-watch เองด้วย ?k=..&p=f5poke หรือปล่อยให้ cron ใน fb-watch.yml ทำแทน */

/**
 * ?admin=..&action=f5del&id=<match_id> → ลบแถวใบเตือนของ match_id นั้นทิ้ง
 *
 * มีไว้ลบ "ใบที่ไม่ใช่ของจริง" เท่านั้น (ใบทดสอบ) เพราะมันถูกนับรวมใน f5StatsText_
 * → ตลาดนั้นจะโชว์ % สวยเกินจริง ซึ่งผิดหลักของระบบนี้ทั้งระบบ
 *
 * 🔒 กันมือลั่น: ต้องระบุ id · ลบได้ครั้งละไม่เกิน 20 แถว · ลบจากล่างขึ้นบน (ไม่งั้นเลขแถวเลื่อน)
 */
function f5Del_(id) {
  id = String(id || '').trim();
  if (!id) return 'f5del: ต้องระบุ id';

  var sh = f5Sheet_(), last = sh.getLastRow();
  if (last < 2) return 'f5del: ยังไม่มีแถว';

  var v = sh.getRange(2, 3, last - 1, 1).getValues();   // คอลัมน์ match_id
  var rows = [];
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim() === id) rows.push(i + 2);
  }
  if (!rows.length) return 'f5del: ไม่เจอ id ' + id;
  if (rows.length > 20) return 'f5del: เจอ ' + rows.length + ' แถว — เยอะผิดปกติ ไม่ลบให้';

  for (var j = rows.length - 1; j >= 0; j--) sh.deleteRow(rows[j]);
  logEvent_('INFO', 'f5del ' + id + ' ลบ ' + rows.length + ' แถว');
  return 'f5del ' + id + ': ลบ ' + rows.length + ' แถว';
}

/**
 * ?admin=..&action=f5stamp&data=[{"id":"<match_id>","min":52},...]
 *
 * จด "นาทีที่เห็นลูกแรกหลังพักครึ่ง" ของใบที่เตือนไปแล้ว
 * มีไว้ตอบคำถามเดียว: เตือนแล้วอีกกี่นาทีลูกถึงมา
 *   ถ้าลูกมาไวเกือบทุกใบ = จังหวะที่ราคายังไม่ขยับแทบไม่มีจริง (เจ้าของทักมา 9 ส.ค. 69)
 *   วัด 2-3 อาทิตย์ค่อยสรุป — ห้ามเดาก่อนมีเลข
 *
 * ⏱️ ตัวเฝ้ายิงทุก 5 นาที → เลขนี้คลาดได้ถึง +5 นาที ("นาทีที่เห็น" ไม่ใช่ "นาทีที่ยิงจริง")
 *    พอสำหรับหาค่ากลาง ไม่พอสำหรับอ้างรายใบ
 *
 * 🔒 เขียนทับไม่ได้ — ช่องไหนมีค่าแล้วข้าม (ครั้งแรกที่เห็นคือค่าที่ถูก ตัวเฝ้ายิงซ้ำทุกรอบ)
 */
function f5Stamp_(dataJson) {
  var arr = [];
  try { arr = JSON.parse(dataJson || '[]') || []; } catch (e) { return 'f5stamp: data ไม่ใช่ JSON'; }
  if (!arr.length) return 'f5stamp: ไม่มีข้อมูล';
  if (arr.length > 50) return 'f5stamp: ' + arr.length + ' รายการ — เยอะผิดปกติ ไม่จดให้';

  var sh = f5Sheet_(), last = sh.getLastRow();
  if (last < 2) return 'f5stamp: ยังไม่มีแถว';

  var ids = sh.getRange(2, 3, last - 1, 1).getValues();            // match_id
  var got = sh.getRange(2, F5_C.gmin, last - 1, 1).getValues();    // นาทีที่เห็นลูก
  var n = 0, skip = 0;
  for (var k = 0; k < arr.length; k++) {
    var it = arr[k] || {};
    var id = String(it.id || '').trim(), mn = f5Int_(it.min);
    if (!id || mn === null) continue;
    for (var i = ids.length - 1; i >= 0; i--) {     // ไล่จากล่าง = ใบล่าสุดของคู่นั้น
      if (String(ids[i][0]).trim() !== id) continue;
      if (String(got[i][0] || '') !== '') { skip++; break; }
      sh.getRange(i + 2, F5_C.gmin).setValue(mn);
      got[i][0] = mn;
      n++;
      break;
    }
  }
  return 'f5stamp: จด ' + n + ' แถว' + (skip ? ' (ข้าม ' + skip + ' ที่จดแล้ว)' : '');
}

/**
 * ?admin=..&action=f5grade&data=[{"id":"<match_id>","FT":"2-1"},...]
 *
 * เกรดใบเตือนจาก "สกอร์จบเกม" ที่ตัวดึง Forebet ส่งมาให้ — ไม่ต้องรอเจ้าของตอบสกอร์เอง
 *
 * ทำไมต้องมี (18 ส.ค. 69): มีใบค้างไม่รู้ผล 72 จาก 93 ใบ เพราะทางเดียวที่เกรดได้คือ
 *   เจ้าของตอบสกอร์ใต้ใบเตือน → ยิ่งเตือนเยอะ ตัวเลขยิ่งไม่ขยับ ระบบวัดตัวเองไม่ได้
 *
 * ⚠️ ห้ามเกรดจากคอลัมน์ "นาทีที่เห็นลูก" (gmin) เด็ดขาด — ช่องว่างแปลได้ 2 อย่าง
 *    "ไม่มีลูกจริง" กับ "ท่อจดพลาด" (เคยพลาด 8 ใน 13 ใบ เมื่อ 11 ส.ค. 69)
 *    ถ้านับเฉพาะใบที่มี gmin จะได้ 100% ปลอม → ตัดสินจากสกอร์จบอย่างเดียว
 *
 * 🔒 ทับผลที่มีอยู่แล้วไม่ได้ — ของที่เจ้าของตอบเองชนะเสมอ ตัวนี้เติมเฉพาะช่องว่าง
 *    ใช้ f5Judge_ ตัวเดียวกับตอนเจ้าของตอบ → เกณฑ์ตัดสินเป็นชุดเดียวกันเป๊ะ
 */
function f5Grade_(dataJson) {
  var arr = [];
  try { arr = JSON.parse(dataJson || '[]') || []; } catch (e) { return 'f5grade: data ไม่ใช่ JSON'; }
  if (!arr.length) return 'f5grade: ไม่มีข้อมูล';
  if (arr.length > 200) return 'f5grade: ' + arr.length + ' รายการ — เยอะผิดปกติ ไม่เกรดให้';

  var sh = f5Sheet_(), last = sh.getLastRow();
  if (last < 2) return 'f5grade: ยังไม่มีแถว';

  var v = sh.getRange(2, 1, last - 1, F5_HEADER.length).getValues();
  // คอลัมน์ 19-22 (ตอบเมื่อ/ใบแดง/นาทีที่เห็นลูก/ที่มาผล) — อ่านมาทั้งแถบเพื่อเขียนกลับทีเดียว
  // ห้ามเขียนเฉพาะ 19 กับ 22 แยกกัน เพราะ 20-21 คั่นกลางอยู่ (ต้องคงค่าเดิมไว้)
  var now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
  var ok = 0, bad = 0, dunno = 0, skip = 0, miss = 0;

  for (var k = 0; k < arr.length; k++) {
    var it = arr[k] || {};
    var id = String(it.id || '').trim();
    var mm = String(it.FT || '').match(/(\d{1,2})\s*-\s*(\d{1,2})/);
    if (!id || !mm) continue;
    var HS = parseInt(mm[1], 10), GS = parseInt(mm[2], 10);
    var found = 0;
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][2]).trim() !== id) continue;
      found++;
      if (String(v[i][F5_C.res - 1] || '') !== '') { skip++; continue; }   // มีผลแล้ว ไม่ยุ่ง
      var ht = String(v[i][10]).split('-');
      var g = f5Judge_(String(v[i][3]), HS, GS, f5Int_(ht[0]), f5Int_(ht[1]),
                       v[i][16] === '' ? null : Number(v[i][16]),
                       v[i][17] === '' ? null : Number(v[i][17]));
      var row = i + 2;
      // ต้องบังคับเป็นข้อความก่อน ไม่งั้น Sheets แปลง "2-1" เป็นวันที่ (เจอจริง 9 ส.ค. 69)
      sh.getRange(row, F5_C.ft, 1, 2).setNumberFormat('@')
        .setValues([[HS + '-' + GS, g === null ? 'ตัดสินไม่ได้' : (g ? 'ถูก' : 'ผิด')]]);
      sh.getRange(row, F5_C.ans, 1, 4).setValues(
        [[now, v[i][19], v[i][20], 'auto']]);
      v[i][F5_C.res - 1] = 'x';   // กัน data ส่ง id ซ้ำมาในก้อนเดียว แล้วนับซ้ำ
      if (g === null) dunno++; else if (g) ok++; else bad++;
    }
    if (!found) miss++;
  }
  var msg = 'f5grade: เกรดใหม่ ' + (ok + bad + dunno) + ' ใบ (ถูก ' + ok + ' · ผิด ' + bad +
            ' · ตัดสินไม่ได้ ' + dunno + ')' +
            (skip ? ' · ข้าม ' + skip + ' (มีผลแล้ว)' : '') +
            (miss ? ' · ไม่เจอในชีต ' + miss + ' id' : '');
  if (ok + bad + dunno) logEvent_('INFO', msg);
  return msg;
}

/** ?admin=..&action=f5dump&since=YYYY-MM-DD → JSONL เอาไปรวมกับ fb_alert_log.jsonl ที่เครื่องบ้าน */
function f5Dump_(since) {
  var sh = f5Sheet_(), last = sh.getLastRow();
  if (last < 2) return '';
  var v = sh.getRange(2, 1, last - 1, F5_HEADER.length).getValues();
  var out = [];
  for (var i = 0; i < v.length; i++) {
    var at = f5At_(v[i][0]);   // Date ↔ ข้อความปนกันในชีต — ต้องผ่านตัวแปลงก่อนเทียบ since
    if (since && at < since) continue;
    var res = String(v[i][F5_C.res - 1] || '');
    out.push(JSON.stringify({
      at: at, id: String(v[i][2]), mkt: String(v[i][3]), head: String(v[i][4]),
      lg: v[i][6], h: String(v[i][7]), a: String(v[i][8]), min: v[i][9],
      ht: f5Score_(v[i][10]), FT: f5Score_(v[i][11]),
      res: res === 'ถูก' ? true : (res === 'ผิด' ? false : null),
      hit: v[i][13], n: v[i][14], base: v[i][15],
      red: String(v[i][19] || ''),   // "เหย้า-เยือน" · ว่าง = ไม่รู้ (แถวเก่าก่อน 10 ส.ค. 69 ว่างหมด)
      gmin: v[i][20] === '' ? null : v[i][20],   // นาทีที่เห็นลูกแรกหลังพัก (±5) · null = ไม่ได้เห็น
      by: String(v[i][21] || ''),   // ใครเกรด: 'auto' = จากสกอร์จบ · 'ตอบเอง' = เจ้าของพิมพ์ · '' = แถวเก่า
      src: 'tg'
    }));
  }
  return out.join('\n');
}

/**
 * ── /รายงาน — ลิงก์หน้าเดียวที่มีข้อมูลครบ + บังคับอัพเดทก่อนดู ────────────────
 *
 * เจ้าของสั่งเอง 17 ส.ค. 69: "ต้องเห็นข้อมูลครบในหน้าเดียว · ส่งลิงก์ให้ทุกครั้งที่ขอ
 *   และบอทต้องอัพเดทให้ใหม่ทุกวันก่อนเรียกดู"
 *
 * หน้าเว็บสร้างโดย workflow fb-report.yml (เครื่องที่ 4 ของ FABEL5 — ไม่ส่งข้อความหาใคร
 * แค่สร้างหน้าเว็บ) แล้ว deploy ลง GitHub Pages · ลิงก์เดิมตลอด ปักหมุดในแชตได้
 *
 * "อัพเดทก่อนดู" ทำแบบนี้: ถ้ารอบที่สำเร็จล่าสุดไม่ใช่ของวันนี้ (เวลาไทย) → สั่งทำใหม่ทันที
 *   แต่ยังส่งลิงก์ให้เลย ไม่ให้ยืนรอหน้าจอเปล่า เพราะหน้าเก่ายังอ่านได้
 *   (ตัวสร้างใช้ ~3-8 นาที เพราะดึง Forebet อ้อม ?ff= ทีละหน้า)
 *
 * cron ใน fb-report.yml ยิงเองวันละ 4 รอบอยู่แล้ว — ตัวนี้เป็นตัวกันพลาดเวลา cron หายรอบ
 */
var F5_WF_REPORT  = 'fb-report.yml';
var F5_REPORT_URL = 'https://yeddekm2-ui.github.io/football-scraper/';

/** อ่านรายการรอบล่าสุดของ workflow (repo เป็น public → ไม่มีโทเคนก็อ่านได้) */
function f5ghRuns_(wf, token) {
  var h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) h['Authorization'] = 'token ' + token;
  var res = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + F5_REPO + '/actions/workflows/' + wf + '/runs?per_page=8',
    { muteHttpExceptions: true, headers: h });
  if (res.getResponseCode() !== 200) return null;
  return JSON.parse(res.getContentText()).workflow_runs || [];
}

/** สั่ง workflow ตัวไหนก็ได้ให้ทำงานเดี๋ยวนี้ → true = สั่งได้ (HTTP 204) */
function f5Dispatch_(wf, token) {
  var res = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + F5_REPO + '/actions/workflows/' + wf + '/dispatches', {
      method: 'post', muteHttpExceptions: true, contentType: 'application/json',
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      payload: JSON.stringify({ ref: 'main' })
    });
  var c = res.getResponseCode();
  if (c !== 204) logEvent_('ERROR', 'f5Dispatch ' + wf + ' HTTP ' + c + ' ' + res.getContentText().substring(0, 120));
  return c === 204;
}

function f5ReportText_(force) {
  var TZ = 'Asia/Bangkok';
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  // ⚠️ tgSend_ ส่งข้อความล้วน (ไม่มี parse_mode) → ห้ามใส่แท็ก HTML มันจะโชว์เป็นตัวอักษร
  var out = ['📊 รายงานด่านแรก FABEL5 — ข้อมูลครบในหน้าเดียว', F5_REPORT_URL, ''];

  var runs = f5ghRuns_(F5_WF_REPORT, token);
  if (runs === null) {
    // อ่านสถานะไม่ได้ ก็ยังต้องส่งลิงก์ — ข้อ 2 ของเจ้าของคือ "ส่งลิงก์ทุกครั้งที่ขอ"
    out.push('⚠️ เช็คสถานะรอบอัพเดทไม่ได้ตอนนี้ (ลิงก์ยังใช้ได้ปกติ)');
    return out.join('\n');
  }

  var done = null, running = false, failed = null;
  for (var i = 0; i < runs.length; i++) {
    if (runs[i].status !== 'completed') { running = true; continue; }
    if (!done && runs[i].conclusion === 'success') done = runs[i];
    if (!done && !failed && runs[i].conclusion === 'failure') failed = runs[i];
  }

  if (done) {
    var at  = new Date(done.updated_at);
    var day = Utilities.formatDate(at, TZ, 'yyyy-MM-dd');
    out.push('🕒 หน้าที่เห็นตอนนี้: ' +
      (day === today ? 'ของวันนี้ ' : 'ของ ' + Utilities.formatDate(at, TZ, 'd/M') + ' (ยังไม่ใช่วันนี้) ') +
      Utilities.formatDate(at, TZ, 'HH:mm') + ' น.');
  } else if (failed) {
    // ไม่มีรอบสำเร็จ + รอบล่าสุดล้ม = ลิงก์ยังไม่มีของ อย่าให้เจ้าของกดลิงก์ตายเปล่าๆ
    out.push('❌ ยังไม่มีหน้าเลย — รอบล่าสุดล้ม ' +
      Utilities.formatDate(new Date(failed.updated_at), TZ, 'd/M HH:mm') + ' น.');
    out.push('   ดูสาเหตุ: ' + failed.html_url);
  } else {
    out.push('🕒 ยังไม่มีรอบที่สำเร็จเลย (รอบแรกกำลังทำ)');
  }

  var stale = force || !done || Utilities.formatDate(new Date(done.updated_at), TZ, 'yyyy-MM-dd') !== today;

  if (running) {
    out.push('🔄 กำลังทำหน้าใหม่อยู่ — อีก ~3-8 นาทีกดลิงก์เดิมซ้ำ');
  } else if (!stale) {
    out.push('✅ เป็นของวันนี้แล้ว · พิมพ์ "/รายงาน ใหม่" ถ้าอยากบังคับทำใหม่');
  } else if (!token) {
    out.push('⚠️ หน้าไม่ใช่ของวันนี้ และสั่งทำใหม่ไม่ได้ (ยังไม่ได้ตั้ง GH_TOKEN)');
  } else if (f5Dispatch_(F5_WF_REPORT, token)) {
    out.push('🔄 สั่งทำหน้าของวันนี้ให้แล้ว — อีก ~3-8 นาทีกดลิงก์เดิมซ้ำ (ของเก่ายังอ่านได้)');
  } else {
    out.push('⚠️ สั่งทำใหม่ไม่ผ่าน (จดไว้ในล็อกแล้ว) · ลิงก์ยังใช้ได้');
  }
  return out.join('\n');
}

/** ตัวรับคำสั่งจาก Telegram — "/รายงาน" หรือ "/รายงาน ใหม่" (บังคับทำใหม่) */
function f5HandleReportCmd_(chatId, t) {
  var force = /(ใหม่|force|refresh|อัพเดท)/i.test(String(t || ''));
  return tgSend_(chatId, f5ReportText_(force));
}
