/**
 * FabValue.gs — สมุดบันทึกใบ "ค่าคุ้มก่อนเกม" (ย้ายมาจาก PIKTAX)
 *
 *   fb_value.py --(?k=..&p=fvalert&text=..&meta=..)--> fvAlert_()   ส่ง+จด
 *   fb_value.py --(?k=..&p=fvpending)---------------> fvPending_() ถามว่าใบไหนยังไม่รู้ผล
 *   fb_value.py --(?k=..&p=fvgrade&data=..)---------> fvGrade_()   เติมผล+ตอบใต้ใบ
 *   เจ้าของพิมพ์ /สถิติค่าคุ้ม -----------------------> fvStatsText_()
 *
 * ⚠️ แท็บนี้แยกจากทุกแท็บ — คนละสมอง คนละเกณฑ์
 *    FBVALUE = ใบก่อนเกม วัดเป็น 1X2 แพ้/ชนะ
 *    เอาไปปนกับ PICKS (forebet) หรือ TalkFootball เมื่อไหร่ % พังทั้งสองฝั่ง
 *
 * ต่างจากของเดิมใน PIKTAX 3 จุด (ตั้งใจ):
 *   1. เข้าชีตผ่าน sheetEnsure_/sheetIfExists_ บน SHEET_ID ของโปรเจกต์นี้
 *   2. ส่งเทเลแกรมผ่าน tgApi_ ของโปรเจกต์นี้ (ปุ่มลัดติดไปด้วยทุกใบ)
 *   3. ไม่ระบายสีเงื่อนไข — ของเดิมทำตอนสร้างแท็บครั้งเดียว ไม่คุ้มกับโค้ดที่ต้องแบก
 *
 * ⚠️ ใช้ prefix fv* — ห้ามชนกับ fb* (Forebet.gs) fs* (FabScan.gs) tf* (TalkFootball.gs)
 */

/* คอลัมน์ที่ต้องรู้ตำแหน่ง (นับ 1) — ต้องตรงกับ HEADERS.FV ใน Config.gs */
var FV_C = { msg: 2, id: 3, ps: 8, side: 9, coef: 11, tier: 13,
             ft: 15, act: 16, judge: 17, exact: 18, ret: 19, at: 20 };

function fvSheet_() { return sheetEnsure_(SHEETS.FV, HEADERS.FV); }

function fvNow_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }

/** ส่งข้อความแล้วคืน message_id (ต้องได้ id ไว้ตอบใต้ใบตอนรู้ผล) */
function fvSend_(text, replyTo) {
  var chat = tgChat_();
  if (!chat) return 0;
  var payload = { chat_id: chat, text: truncate_(text, 4096), disable_web_page_preview: true,
                  reply_markup: JSON.stringify(tgKeyboard_()) };
  if (replyTo) payload.reply_to_message_id = replyTo;
  var r = tgApi_('sendMessage', payload);
  if (!r.ok) { logEvent_('ERROR', 'fvSend_: ' + (r.error || r.code)); return 0; }
  return (r.result && r.result.message_id) || 0;
}

/**
 * ?k=..&p=fvalert&text=<ใบ>&meta=<json>
 * meta: {id,lg,cc,h,a,ko,hs,gs,side,prob,coef,edge,tier,claim}
 */
function fvAlert_(text, metaJson) {
  text = String(text || '').trim();
  if (!text) return 'fvalert: ไม่มี text';
  if (!tgChat_()) return 'fvalert: ยังไม่มี TG_CHAT (ตั้งด้วย ?p=setchat ก่อน)';

  var m = {};
  try { m = JSON.parse(metaJson || '{}') || {}; } catch (e) { m = {}; }

  var mid = fvSend_(text, 0);
  if (!mid) return 'fvalert: ส่ง Telegram ไม่ผ่าน';

  /* ส่งออกไปแล้วถึงค่อยจด — จดไม่ลงก็ยังได้ใบ ไม่ใช่เงียบหาย */
  try {
    var sh = fvSheet_();
    sh.appendRow([
      fvNow_(), mid, String(m.id || ''),
      String(m.lg || '') + (m.cc ? ' [' + m.cc + ']' : ''),
      String(m.h || ''), String(m.a || ''), String(m.ko || ''),
      (m.hs == null ? '' : m.hs) + '-' + (m.gs == null ? '' : m.gs),
      String(m.side || ''),
      m.prob == null ? '' : m.prob, m.coef == null ? '' : m.coef,
      m.edge == null ? '' : m.edge, String(m.tier || ''),
      m.claim == null ? '' : m.claim,
      '', '', '', '', '', ''          // 6 ช่องท้าย = ผล รอ fvgrade เติม
    ]);
  } catch (e) {
    logEvent_('ERROR', 'fvAlert_ จดชีตไม่ลง: ' + e.message);
    return 'fvalert OK ' + mid + ' (แต่จดชีตไม่ลง: ' + e.message + ')';
  }
  return 'fvalert OK ' + mid;
}

/** ?k=..&p=fvpending → รหัสคู่ที่ยังไม่รู้ผล คั่นด้วย ,
    มีเพราะตัวเฝ้าบน runner ไม่มีความจำ ต้องถามชีตว่าค้างใบไหนอยู่ */
function fvPending_() {
  var sh = sheetIfExists_(SHEETS.FV);
  if (!sh) return '';
  var last = sh.getLastRow();
  if (last < 2) return '';
  var v = sh.getRange(2, 1, last - 1, FV_C.at).getValues();
  var ids = [];
  for (var i = 0; i < v.length; i++) {
    var id = String(v[i][FV_C.id - 1] || '').trim();
    var judged = String(v[i][FV_C.judge - 1] || '').trim();
    if (id && !judged) ids.push(id);
  }
  return ids.join(',');
}

function fvInt_(v) {
  var n = parseInt(String(v == null ? '' : v).replace(/[^\d-]/g, ''), 10);
  return isNaN(n) ? null : n;
}

/**
 * ?k=..&p=fvgrade&data=[{"id":"..","hs":2,"gs":1}]
 * ⚠️ ตัดสินที่ "ฝั่ง" (1/2/X) ไม่ใช่สกอร์เป๊ะ — สกอร์เป๊ะจดไว้ดูเฉยๆ คนละคอลัมน์
 *    เพราะการ์ดที่ส่งออกไปโฆษณา % ของ 1X2
 */
function fvGrade_(dataJson) {
  var arr = [];
  try { arr = JSON.parse(dataJson || '[]') || []; } catch (e) { return 'fvgrade: data ไม่ใช่ JSON'; }
  if (!arr.length) return 'fvgrade: ไม่มีข้อมูล';

  var sh = sheetIfExists_(SHEETS.FV);
  if (!sh) return 'fvgrade: ยังไม่มีแท็บ ' + SHEETS.FV;
  var last = sh.getLastRow();
  if (last < 2) return 'fvgrade: ยังไม่มีใบในชีต';

  var v = sh.getRange(2, 1, last - 1, FV_C.at).getValues();
  var want = {};
  for (var a = 0; a < arr.length; a++) {
    var k = String(arr[a] && arr[a].id || '').trim();
    if (k) want[k] = arr[a];
  }

  var n = 0, hit = 0;
  for (var i = 0; i < v.length; i++) {
    var id = String(v[i][FV_C.id - 1] || '').trim();
    if (!id || !want[id]) continue;
    if (String(v[i][FV_C.judge - 1] || '').trim()) continue;   // เกรดไปแล้ว ไม่เกรดซ้ำ

    var hs = fvInt_(want[id].hs), gs = fvInt_(want[id].gs);
    if (hs == null || gs == null) continue;

    var act = hs > gs ? '1' : (hs < gs ? '2' : 'X');
    var side = String(v[i][FV_C.side - 1] || '').trim();
    var ok = (side === act);
    var coef = parseFloat(String(v[i][FV_C.coef - 1] || '0').replace(/[^\d.]/g, '')) || 0;
    var ret = ok ? Math.round((coef - 1) * 1000) / 10 : -100;
    var pred = String(v[i][FV_C.ps - 1] || '').trim();
    var exact = (pred === (hs + '-' + gs)) ? 'ตรง' : '';

    var row = i + 2;
    sh.getRange(row, FV_C.ft).setNumberFormat('@');
    sh.getRange(row, FV_C.ft, 1, 6).setValues([[hs + '-' + gs, act, fvMark_(ok), exact, ret, fvNow_()]]);

    n++;
    if (ok) hit++;

    var mid = fvInt_(v[i][FV_C.msg - 1]);
    if (mid) {
      fvSend_((ok ? '✅ เข้า' : '❌ ไม่เข้า') + ' — จบ ' + hs + '-' + gs +
              (exact ? ' (สกอร์เป๊ะด้วย)' : (pred ? ' · ทายไว้ ' + pred : '')) +
              '\n' + (ok ? 'กำไรไม้นี้ ' + ret + '%' : 'เสียไม้นี้ 100%'), mid);
    }
  }
  return 'fvgrade OK เกรด ' + n + ' ใบ (เข้า ' + hit + ')';
}

function fvMark_(ok) { return ok ? 'ถูก' : 'ผิด'; }

/**
 * /สถิติค่าคุ้ม — สรุปจากของจริง ไม่ใช่เลขที่ฝังไว้ในการ์ด
 * มีไว้ทำไม: การ์ดอ้าง 73.0% จากคลังย้อนหลัง ต้องมีที่เทียบว่าของจริงตรงไหม
 */
function fvStatsText_() {
  var sh = sheetIfExists_(SHEETS.FV);
  var last = sh ? sh.getLastRow() : 0;
  if (!sh || last < 2) return '📊 ใบค่าคุ้มก่อนเกม — ยังไม่มีบันทึก';
  var v = sh.getRange(2, 1, last - 1, HEADERS.FV.length).getValues();

  var all = { n: 0, hit: 0, ret: 0, exact: 0 }, byTier = {}, pend = 0;
  for (var i = 0; i < v.length; i++) {
    var j = String(v[i][FV_C.judge - 1] || '').trim();
    if (!j) { pend++; continue; }
    var t = String(v[i][FV_C.tier - 1] || '').trim();
    if (!byTier[t]) byTier[t] = { n: 0, hit: 0, ret: 0 };
    var ok = (j === 'ถูก');
    var ret = parseFloat(v[i][FV_C.ret - 1]);
    if (isNaN(ret)) ret = ok ? 0 : -100;
    all.n++; byTier[t].n++;
    if (ok) { all.hit++; byTier[t].hit++; }
    if (String(v[i][FV_C.exact - 1] || '').trim()) all.exact++;
    all.ret += ret; byTier[t].ret += ret;
  }

  if (!all.n) return '📊 ใบค่าคุ้มก่อนเกม — ส่งไปแล้ว ' + pend + ' ใบ ยังไม่รู้ผลสักใบ';

  var L = ['📊 ใบค่าคุ้มก่อนเกม (ของจริง ไม่ใช่เลขย้อนหลัง)', ''];
  L.push('รวม ' + all.n + ' ใบ · เข้า ' + Math.round(all.hit / all.n * 1000) / 10 + '%');
  L.push('กำไร/ไม้ ' + (all.ret / all.n >= 0 ? '+' : '') + Math.round(all.ret / all.n * 10) / 10 + '%');
  L.push('สกอร์เป๊ะ ' + all.exact + ' ใบ (' + Math.round(all.exact / all.n * 1000) / 10 + '%)');
  L.push('');
  var keys = Object.keys(byTier).sort();
  for (var k = 0; k < keys.length; k++) {
    var b = byTier[keys[k]];
    L.push((keys[k] || '(ไม่ระบุชั้น)') + ' — ' + b.n + ' ใบ · เข้า ' +
           Math.round(b.hit / b.n * 1000) / 10 + '% · กำไร/ไม้ ' +
           (b.ret / b.n >= 0 ? '+' : '') + Math.round(b.ret / b.n * 10) / 10 + '%');
  }
  if (pend) L.push('', '⏳ ยังไม่รู้ผลอีก ' + pend + ' ใบ');
  if (all.n < 30) L.push('', '⚠️ n ยังน้อย (' + all.n + ' ใบ) ตัวเลขนี้ยังสรุปไม่ได้');
  return L.join('\n');
}
