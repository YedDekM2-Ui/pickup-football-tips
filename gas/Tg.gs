/* Tg.gs — บอทเทเลแกรมของโปรเจกต์นี้ (คนละตัวกับ PIKTAX ห้ามปนกัน)

   มีไว้ทำอะไร: สั่งงานจากมือถือโดยไม่ต้องเปิดหน้าเว็บ
     - ดูบิลที่ยังไม่รู้ผล / สรุปกำไรขาดทุน / คู่ที่จะเตะวันนี้
     - ใส่สกอร์จบเกม แล้วมันคิดเงินให้ทันที (ทางเดียวกับ ?p=score)

   กฎของไฟล์นี้:
   1. โทเคนอยู่ใน Script Property `TG_TOKEN` เท่านั้น ห้ามโผล่ในไฟล์/ในข้อความตอบ
   2. ทางเข้า webhook มีกุญแจของตัวเอง `TG_HOOK_KEY` — คนละดอกกับ APP_KEY
      เพราะที่อยู่ webhook ไปนอนอยู่บนเซิร์ฟเวอร์เทเลแกรม จะเอากุญแจหน้าเว็บไปฝากไม่ได้
   3. ยังไม่ตั้งกุญแจ = ปิดตาย ไม่ใช่เปิดหมด (บทเรียน ADMIN_KEY ของ PIKTAX)
   4. คุยด้วยได้คนเดียวคือเจ้าของ (`TG_CHAT`) — ยังไม่ตั้ง ตอบได้แค่บอกเลขห้องให้ไปตั้ง
   5. ตอบไม่ได้ก็ต้องบอกว่าทำไม ห้ามเงียบ ห้ามเดาตัวเลขเงิน
*/

var TG_API_ = 'https://api.telegram.org/bot';

function tgTok_()  { return prop_('TG_TOKEN'); }
function tgChat_() { return prop_('TG_CHAT'); }

/** ยิงคำสั่งไปหาเทเลแกรม — พังก็คืนก้อนบอกเหตุ ห้าม throw ออกไปให้ webhook ตอบ 500
    (เทเลแกรมเห็น 500 แล้วจะยิงซ้ำ ๆ จนกลายเป็นข้อความซ้ำ) */
function tgApi_(method, payload) {
  var tok = tgTok_();
  if (!tok) return { ok: false, error: 'ยังไม่ได้ตั้ง TG_TOKEN' };
  try {
    var res = UrlFetchApp.fetch(TG_API_ + tok + '/' + method, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload || {}),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var body = {};
    try { body = JSON.parse(res.getContentText()) || {}; } catch (e) { body = {}; }
    return { ok: code === 200 && body.ok === true, code: code,
             error: body.description || '', result: body.result || null };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function tgSend_(chatId, text) {
  /* reply_markup ติดไปทุกข้อความ - เทเลแกรมจำปุ่มชุดล่าสุดของห้อง
     ถ้าส่งบางข้อความไม่ติด ปุ่มจะหายไปเฉยๆ ตอนเจ้าของกำลังใช้อยู่ */
  return tgApi_('sendMessage', { chat_id: chatId, text: text, disable_web_page_preview: true,
                                 reply_markup: JSON.stringify(tgKeyboard_()) });
}

/** ส่งหาเจ้าของ — ใช้ตอนบอทอยากบอกเองโดยไม่มีใครถาม */
function tgTell_(text) {
  var c = tgChat_();
  if (!c) return { ok: false, error: 'ยังไม่ได้ตั้ง TG_CHAT' };
  return tgSend_(c, text);
}

/* ---------- ผูก webhook ----------
   เรียกจากลิงก์ที่เจ้าของกดเอง (?p=hook) เพราะโปรเจกต์นี้ไม่มี trigger
   url = ที่อยู่เว็บแอปตัวนี้ ไม่ใช่ความลับ (อยู่ในไฟล์หน้าเว็บอยู่แล้ว) */
function tgHookUrl_(execUrl) {
  var s = prop_('TG_HOOK_KEY');
  if (!s) return '';
  return String(execUrl || '') + '?p=tg&s=' + encodeURIComponent(s);
}

function tgSetHook_(execUrl) {
  if (!tgTok_()) return { ok: false, error: 'ยังไม่ได้ตั้ง TG_TOKEN ที่ Script Properties' };
  if (!prop_('TG_HOOK_KEY')) return { ok: false, error: 'ยังไม่ได้ตั้ง TG_HOOK_KEY ที่ Script Properties' };
  if (!execUrl) return { ok: false, error: 'ไม่รู้ที่อยู่เว็บแอป ส่ง &url= มาด้วย' };
  var r = tgApi_('setWebhook', {
    url: tgHookUrl_(execUrl),
    allowed_updates: ['message'],
    drop_pending_updates: true
  });
  /* ห้ามคาย url กลับออกไป เพราะในนั้นมีกุญแจ */
  return { ok: r.ok, error: r.error || '', 'ผูกแล้ว': r.ok === true };
}

/** สวิตช์ปิดบอท — ถอน webhook ทิ้ง เทเลแกรมจะเลิกยิงมาหาเราทันที
    ทำเป็นลิงก์เพราะเจ้าของอยู่บนมือถือ หน้า Script Properties กดยาก
    เปิดใหม่ = ยิง ?p=hook&url=... เหมือนเดิม ไม่ต้องตั้งอะไรใหม่
    drop_pending_updates = ล้างคิวที่ค้างอยู่ด้วย ไม่งั้นเปิดกลับมาแล้วของเก่าเด้งตาม */
function tgOffHook_() {
  if (!tgTok_()) return { ok: false, error: 'ยังไม่ได้ตั้ง TG_TOKEN ที่ Script Properties' };
  var r = tgApi_('deleteWebhook', { drop_pending_updates: true });
  return { ok: r.ok, error: r.error || '', 'ปิดแล้ว': r.ok === true };
}

/** สภาพ webhook ตอนนี้ — ตัด url ทิ้งก่อนคาย เพราะมีกุญแจอยู่ในนั้น */
function tgHookInfo_() {
  var r = tgApi_('getWebhookInfo', {});
  if (!r.ok) return { ok: false, error: r.error || 'ถามไม่ได้' };
  var w = r.result || {};
  return { ok: true,
    'ผูกอยู่': !!w.url,
    'คิวค้าง': Number(w.pending_update_count) || 0,
    'พลาดล่าสุด': String(w.last_error_message || '') };
}

/* ---------- เนื้อความที่บอทตอบ ---------- */

var TG_MENU_ =
  'คำสั่งที่ใช้ได้\n' +
  '/บิล — บิลที่ยังไม่รู้ผล\n' +
  '/สรุป — กำไรขาดทุนสะสม\n' +
  '/picktips — ทีเด็ดที่ผ่านเกณฑ์ เรียงตามมั่นใจสุด\n' +
  '/คู่ — คู่ที่ยังไม่เตะ\n' +
  '/คิดผล — ไล่หาสกอร์จบเกมเองรอบเดียว\n' +
  '/หาคู่ [เลข] — สแกน Live coef. จาก forebet (เลข = ค่าคุ้มขั้นต่ำ)\n' +
  '/talkfootball — คำทำนายเว็บ talkfootball (ครึ่งแรก 90%+ · SH/OU2.5/BTTS เสริม)\n' +
  '/tfสถิติ [วัน] — ความแม่นของ talkfootball ย้อนหลัง (ไม่ใส่ = 30 วัน)\n' +
  '/สถิติค่าคุ้ม — ผลจริงของใบค่าคุ้มก่อนเกม (เข้ากี่ % · กำไร/ไม้)\n' +
  '/สถิติเตือน — ผลจริงของใบเตือนบอลสด FABEL5 (เกรดเอง ไม่ต้องตอบสกอร์)\n' +
  '/สถิติบอล [วัน] — ความแม่นทีเด็ด FootballTips ย้อนหลัง (ไม่ใส่ = 30 วัน)\n' +
  '/รายงาน — หน้าเดียวจบ ทุกคู่ทุกด่าน ลิงก์เดิมตลอด ("/รายงาน ใหม่" = บังคับทำใหม่)\n' +
  '/หุ้น [us] — หุ้นเด่นวันนี้ (ไม่ใส่ = ตลาดไทย)\n' +
  'หวยไทย · หวยลาว — ผลหวย + ตำราเลขเด่น (พิมพ์ "หวยไทย ช่วย" ดูคำสั่งย่อย)\n' +
  'หวยไทยB · หวยลาวB — เลขฐาน 6 ตัว คิดจากผลจริงย้อนหลัง\n' +
  'หวย — เมนูรวมหวย ปฏิทินงวด + เลขเด่นตามตำรา\n' +
  '/id — เลขห้องแชตนี้\n\n' +
  'ใส่สกอร์เอง: พิมพ์ "รหัสบิล สกอร์" เช่น  B7 2-1';

function tgResThai_(res) {
  return ({ WIN_FULL: 'ชนะเต็ม', WIN_HALF: 'ชนะครึ่ง', PUSH: 'คืนทุน',
            LOSS_HALF: 'แพ้ครึ่ง', LOSS_FULL: 'แพ้เต็ม' })[String(res || '')] || String(res || '');
}

function tgMoney_(n) {
  var v = Number(n) || 0;
  return (v > 0 ? '+' : '') + (Math.round(v * 100) / 100);
}

/** บิลที่ยังไม่รู้ผล — เอาเฉพาะใบแม่ ใบลูกคิดรวมอยู่ในใบแม่แล้ว */
function tgBills_() {
  var rows = readObjects_(SHEETS.BETS), out = [], i;
  for (i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r['ผล'] || '') !== '') continue;
    if (String(r['Parent_ID'] || '') !== '') continue;
    out.push(r);
  }
  if (!out.length) return 'ไม่มีบิลค้าง ทุกใบรู้ผลหมดแล้ว';
  var lines = ['บิลที่ยังไม่รู้ผล ' + out.length + ' ใบ', ''];
  for (i = 0; i < out.length && i < 15; i++) {
    var b = out[i];
    lines.push(String(b['ID']) + '  ' + String(b['ทีมเหย้า'] || '') + ' พบ ' + String(b['ทีมเยือน'] || ''));
    lines.push('   ' + fbYmd_(b['วันที่']) + ' ' + fbHm_(b['เวลาเตะ']) +
               ' · ' + String(b['ตลาด'] || '') + ' · เลือก ' + String(b['ทีมที่เลือก'] || '-'));
  }
  if (out.length > 15) lines.push('… อีก ' + (out.length - 15) + ' ใบ');
  lines.push('', 'ใส่สกอร์: พิมพ์  ' + String(out[0]['ID']) + ' 2-1');
  return lines.join('\n');
}

function tgSummary_() {
  var s = ledgerStats_(readObjects_(SHEETS.BETS));
  if (!s['จำนวนใบ']) return 'ยังไม่มีบิลที่รู้ผล เลยยังไม่มีอะไรให้สรุป';
  var wr = s['อัตราชนะ'] === null ? '-' : (Math.round(s['อัตราชนะ'] * 1000) / 10) + '%';
  return ['สรุปยอด',
          'กำไรสะสม  ' + tgMoney_(s['กำไรสะสม']),
          'ลงไปแล้ว   ' + s['ลงไปทั้งหมด'],
          'จำนวนใบ    ' + s['จำนวนใบ'],
          'อัตราชนะ   ' + wr].join('\n');
}

function tgPicks_(nowMs) {
  var live = fbUpcoming_(readObjects_(SHEETS.PICKS), nowMs || Date.now());
  if (!live.length) return 'ยังไม่มีคู่ที่รอเตะในชีต ลองเปิดหน้าเว็บให้มันดึงรอบใหม่';
  var lines = ['คู่ที่ยังไม่เตะ ' + live.length + ' คู่', ''];
  for (var i = 0; i < live.length && i < 12; i++) {
    var p = live[i];
    lines.push(fbHm_(p['เวลาเตะ']) + '  ' + String(p['ทีมเหย้า'] || '') + ' พบ ' + String(p['ทีมเยือน'] || ''));
    lines.push('   ' + String(p['ลีก'] || '') + ' · เดา ' + String(p['เดาผล'] || '-') +
               ' ' + (Number(p['เปอร์เซ็นต์']) || 0) + '%');
  }
  if (live.length > 12) lines.push('… อีก ' + (live.length - 12) + ' คู่');
  return lines.join('\n');
}

/* ---------- ใส่สกอร์ผ่านแชท ----------
   รูปแบบเดียว: "<รหัสบิล> 2-1"  ถอดไม่ออก = คืน null ไม่เดา
   เพราะเดาผิดแปลว่าลงผลผิดใบ แล้วเงินในสรุปเพี้ยนตามไปหมด */
function tgParseScore_(text) {
  var s = String(text || '').trim();
  var m = s.match(/^([A-Za-z0-9_-]{1,32})[\s]+(\d{1,2})\s*[-:x ]\s*(\d{1,2})$/);
  if (!m) return null;
  return { id: m[1], h: m[2], a: m[3] };
}

function tgDoScore_(cmd) {
  var res;
  try {
    res = stlWrite_(cmd.id, cmd.h, cmd.a);
  } catch (err) {
    return 'ลงผลไม่ได้ — ' + (err && err.message ? err.message : err);
  }
  if (!res || !res['ลง']) {
    var why = (res && res['ข้าม'] && res['ข้าม'].length) ? res['ข้าม'].join(' · ') : 'คิดผลจากบิลนี้ไม่ได้';
    return 'ลงไม่ได้ — ' + why;
  }
  var lines = ['ลงผลแล้ว ' + cmd.id + '  ' + cmd.h + '-' + cmd.a, ''];
  var rows = res['ใบ'] || [];
  for (var i = 0; i < rows.length; i++) {
    lines.push(String(rows[i]['ID']) + '  ' + tgResThai_(rows[i]['ผล']) + '  ' + tgMoney_(rows[i]['กำไร']));
  }
  return lines.join('\n');
}

/* ---------- ตัวรับสาย ----------
   คืนค่าเป็น "ข้อความที่ตอบไปแล้ว" เอาไว้ให้เทสต์ดู · คืน '' = เงียบ ไม่ตอบใคร */
/* ---------- ด่านกันเด้งซ้ำ ----------
   เทเลแกรมยิงข้อความเดิมซ้ำได้เรื่อยๆ ถ้ามันไม่แน่ใจว่าเราได้รับ (ตอบช้า/เน็ตสะดุด)
   ทุกข้อความมีเลข update_id ประจำตัว — เห็นเลขเดิมซ้ำ = ทิ้งเงียบ ไม่ตอบซ้ำ
   จำไว้ 6 ชม. ในแคช (ไม่ใช้ชีต เพราะของแบบนี้ควรหมดอายุเอง)
   บทเรียนเดียวกับ PIKTAX v171 — ตอนนั้นข้อความเด้งซ้อนเพราะไม่มีด่านนี้ */
function tgFresh_(uid) {
  if (uid === null || uid === undefined || uid === '') return true;
  try {
    var c = CacheService.getScriptCache();
    var k = 'tgu:' + uid;
    if (c.get(k)) return false;
    c.put(k, '1', 21600);
    return true;
  } catch (e) { return true; }        /* แคชพัง = ปล่อยผ่าน ดีกว่าบอทใบ้ */
}

function tgHandle_(update, nowMs) {
  var msg = (update && update.message) || null;
  if (!msg) return '';
  if (!tgFresh_(update && update.update_id)) return '';
  var chat = String((msg.chat && msg.chat.id) || '');
  var text = String(msg.text || '').trim();
  if (!chat) return '';

  var owner = tgChat_();
  if (!owner) {
    /* ยังไม่ตั้งเจ้าของ — บอกเลขห้องให้ไปใส่เอง แล้วจบ ไม่ทำอย่างอื่น */
    var t0 = 'ยังไม่ได้ตั้งเจ้าของ\n\nเอาเลขนี้ไปใส่ใน Script Property ชื่อ TG_CHAT\n\n' + chat;
    tgSend_(chat, t0);
    return t0;
  }
  if (chat !== owner) return '';          /* คนอื่นทัก = เงียบสนิท ไม่บอกว่ามีบอทอยู่ */

  /* ตอบใต้ใบถามผลหวย (Reply) = เลขหวยแน่นอน ต้องจบที่ทางหวยเท่านั้น
     ด่านนี้ห้ามย้ายลงไปอยู่ใต้คำสั่งอื่น — บทเรียน PIKTAX 16 ส.ค. 69
     เจ้าของตอบ "4615" มาตัวเดียว แล้วมันไหลไปตัวอ่านรายการเงิน ลงบิลถอน 4,615 บาท */
  if (msg.reply_to_message) {
    try { if (lotCatchReply_(chat, msg)) return ''; }
    catch (e0) {
      tgSend_(chat, 'บันทึกผลหวยไม่สำเร็จ: ' + truncate_(String(e0 && e0.message ? e0.message : e0), 200));
      return '';
    }
    /* ตอบสกอร์ใต้ใบเตือนบอลสด FABEL5 → เกรดใบนั้นเลย (ใบเตือนขึ้นต้นด้วย ⚽ เสมอ)
       ต้องอยู่ตรงนี้ ก่อนตัวอ่าน "รหัสบิล สกอร์" ข้างล่าง ไม่งั้น "2-1" ที่ตอบใต้ใบเตือน
       จะไหลไปเข้าตัวคิดผลบิลแทน — บทเรียนเดียวกับหวย */
    try { if (f5CatchReply_(chat, msg)) return ''; }
    catch (e1) {
      tgSend_(chat, 'เกรดใบเตือนไม่สำเร็จ: ' + truncate_(String(e1 && e1.message ? e1.message : e1), 200));
      return '';
    }
  }

  var out;
  if (text === '/start' || text === '/help' || text === '/เมนู') out = TG_MENU_;
  else if (text === '/id') out = 'เลขห้องนี้คือ ' + chat;
  else if (text === '/บิล') out = tgBills_();
  else if (text === '/สรุป') out = tgSummary_();
  else if (text === '/คู่') out = tgPicks_(nowMs || Date.now());
  else if (/^\/หาคู่(\s|$)/.test(text)) {
    /* ตัวนี้ส่งเอง "หลายข้อความ" (ตอบรับ + การ์ดเป็นชุด) จึง return ตรงนี้เลย
       ถ้าปล่อยตกไปท้ายฟังก์ชัน tgSend_(chat, out) จะยิงซ้ำอีกใบเปล่าๆ */
    try { fsHandleCmd_(chat, text); }
    catch (e) { tgSend_(chat, 'สแกนไม่สำเร็จ: ' + truncate_(String(e && e.message ? e.message : e), 200)); }
    return '';
  }
  else if (/^\/?talkfootball$/i.test(text)) {
    /* ดึงสด 4 หน้าพร้อมกัน ช้าได้ถึงสิบวินาที — พังต้องบอกว่าพังตรงไหน ไม่ใช่เงียบ */
    try { out = tfText_(); }
    catch (e) { out = 'talkfootball ดึงไม่ได้: ' + truncate_(String(e && e.message ? e.message : e), 200); }
  }
  else if (/^\/tfสถิติ(\s|$)/.test(text)) {
    var dArg = (text.split(/\s+/)[1] || '').replace(/[^0-9]/g, '');
    try { out = tfStatsText_(dArg || 30); }
    catch (e) { out = 'อ่านสถิติไม่ได้: ' + truncate_(String(e && e.message ? e.message : e), 200); }
  }
  else if (/^\/?สถิติค่าคุ้ม$/.test(text)) {
    /* อ่านชีตอย่างเดียว ไม่ยิงเน็ต — ใบมาจาก fb_value.py ทาง ?p=fvalert */
    try { out = fvStatsText_(); }
    catch (e) { out = 'อ่านสถิติค่าคุ้มไม่ได้: ' + truncate_(String(e && e.message ? e.message : e), 200); }
  }
  /* === 3 ตัวนี้ย้ายมาจากบอทเก่า (PIKTAX) — คนละเล่มกันทั้งหมด ห้ามเอามารวมกัน ===
     /สถิติเตือน  = ใบเตือนบอลสด FABEL5 (แท็บ FABEL5 · ตัวเฝ้ายิงเข้ามาทาง ?p=f5alert)
     /สถิติบอล    = ทีเด็ดก่อนเกม FootballTips (แท็บ FootballTips · เกรดจากสกอร์จริง)
     /รายงาน      = หน้าเว็บรวมบน GitHub Pages ลิงก์เดิมตลอด
     /สถิติบอล ห้ามปิดท้ายด้วย $ เพราะรับเลขวันต่อท้ายได้ (เช่น "/สถิติบอล 7") */
  else if (/^\/?สถิติเตือน$/.test(text)) {
    try { out = f5StatsText_(); }
    catch (e) { out = 'อ่านสถิติเตือนไม่ได้: ' + truncate_(String(e && e.message ? e.message : e), 200); }
  }
  else if (/^\/?สถิติบอล/.test(text)) {
    try { out = fbtStatsText_((text.match(/(\d+)/) || [])[1] || 30); }
    catch (e) { out = 'อ่านสถิติบอลไม่ได้: ' + truncate_(String(e && e.message ? e.message : e), 200); }
  }
  else if (/^\/?(รายงาน|report)/i.test(text)) {
    /* ตัวนี้ส่งข้อความเอง (เช็คหน้าเว็บ + อาจสั่ง workflow ทำใหม่) จึง return ตรงนี้
       ปล่อยตกไปท้ายฟังก์ชันจะยิงซ้ำอีกใบเปล่า — แบบเดียวกับ /หาคู่ */
    try { f5HandleReportCmd_(chat, text); }
    catch (e) { tgSend_(chat, 'เปิดรายงานไม่ได้: ' + truncate_(String(e && e.message ? e.message : e), 200)); }
    return '';
  }
  else if (/^\/?หุ้น(\s|$)/.test(text)) {
    /* ยิงเน็ตออกนอก ช้าได้หลายวินาที — พังต้องบอกว่าพัง ไม่ใช่เงียบ */
    var mkt = text.replace(/^\/?หุ้น\s*/, '');
    try { out = stocksText_(mkt); }
    catch (e) { out = 'ค้นหุ้นไม่ได้: ' + truncate_(String(e && e.message ? e.message : e), 200); }
  }
  /* === หวย — ต้องเรียง ลาว → ไทย → เมนูรวม (ตัวยาวกว่าดักก่อน กันโดนกลืน) ===
     สามตัวนี้ส่งข้อความเอง (บางคำสั่งส่งหลายใบ) จึง return '' ตรงนี้
     ถ้าปล่อยตกไปท้ายฟังก์ชัน tgSend_(chat, out) จะยิงใบเปล่าซ้ำ — แบบเดียวกับ /หาคู่
     คำสั่งเป็นคำไทยล้วน ไม่มี / นำหน้า (ของเดิมในบอทเก่าเป็นแบบนี้ เจ้าของพิมพ์จนชิน) */
  else if (/^(ผล)?หวยลาว/.test(text)) {
    try { handleLaoLottery_(chat, text.replace(/^ผลหวยลาว/, 'หวยลาว')); }
    catch (e) { tgSend_(chat, 'หวยลาวพัง: ' + truncate_(String(e && e.message ? e.message : e), 200)); }
    return '';
  }
  else if (/^(ผล)?หวยไทย/.test(text)) {
    try { handleThaiLottery_(chat, text.replace(/^ผลหวยไทย/, 'หวยไทย')); }
    catch (e) { tgSend_(chat, 'หวยไทยพัง: ' + truncate_(String(e && e.message ? e.message : e), 200)); }
    return '';
  }
  else if (/^(หวย|เลขเด็ด|เลขเด่น)/.test(text)) {
    try { out = lotteryMenuText_(); }
    catch (e) { out = 'เปิดเมนูหวยไม่ได้: ' + truncate_(String(e && e.message ? e.message : e), 200); }
  }
  else if (text === '/picktips' || text === '/ทีเด็ด') out = tgPickTips_(nowMs || Date.now());
  else if (text === '/คิดผล') {
    /* ตัวไล่คิดผลมีตัวกันยิงถี่ 10 นาที · null = ยังไม่ถึงรอบ ไม่ใช่ "หาไม่เจอ"
       ต้องแยกให้ออก ไม่งั้นเจ้าของนึกว่าฟีดพัง */
    var t;
    try { t = stlAutoTick_(nowMs || Date.now()); } catch (e) { t = null; }
    if (!t) out = 'เพิ่งไล่ไปเมื่อกี้ รออีกสักครู่ค่อยสั่งใหม่';
    else if (t['ลง']) out = 'ไล่คิดผลแล้ว ลงไป ' + t['ลง'] + ' ใบ';
    else if (!t['ตรวจ']) out = 'ไม่มีบิลค้างให้ไล่';
    else out = 'ไล่แล้ว ' + t['ตรวจ'] + ' ใบ ยังหาสกอร์ไม่เจอสักใบ ใส่เองได้ที่  <รหัสบิล> 2-1';
  } else {
    var cmd = tgParseScore_(text);
    if (cmd) out = tgDoScore_(cmd);
    /* ตั้งใจตอบสั้น ไม่กางเมนูทั้งใบ — พิมพ์ผิดทีนึงแล้วเมนูเด้งเต็มจอ เจ้าของรำคาญ
       อยากดูเมนูค่อยพิมพ์ /help เอง */
    else out = 'ไม่เข้าใจ — พิมพ์ /help ดูคำสั่ง';
  }
  tgSend_(chat, out);
  return out;
}

/* ---------- บอทชื่ออะไร ----------
   ไว้ตอนหาบอทในเทเลแกรมไม่เจอ · ถามเทเลแกรมตรงๆ ว่าโทเคนนี้เป็นของบอทตัวไหน
   ตอบแค่ชื่อ ไม่คายโทเคน · ถามได้แปลว่าโทเคนใช้ได้จริงด้วย */
function tgMe_() {
  var r = tgApi_('getMe', {});
  if (!r.ok) return { ok: false, error: r.error || ('เทเลแกรมตอบ ' + (r.code || '?')) };
  var u = String((r.result && r.result.username) || '');
  return { ok: true,
           'ชื่อบอท': u ? '@' + u : '(บอทนี้ยังไม่มีชื่อผู้ใช้)',
           'ชื่อที่โชว์': String((r.result && r.result.first_name) || ''),
           'ลิงก์เปิดแชท': u ? 'https://t.me/' + u : '' };
}

/* ---------- ตั้งเจ้าของจากมือถือ ----------
   หน้า Script Properties ในเอดิเตอร์หายากบนจอเล็ก · ทางนี้ตั้งผ่านลิงก์ได้เลย
   อยู่หลังด่านกุญแจ APP_KEY เสมอ (ดู Api.gs) เพราะมันเปลี่ยนว่าใครเป็นเจ้าของบอท
   ตั้งเสร็จทักไปหาห้องนั้นทันที — ถ้าข้อความไม่เด้ง แปลว่าเลขผิด รู้ได้ตรงนั้นเลย */
function tgSetChat_(id) {
  var s = String(id || '').trim();
  if (!/^-?\d{5,}$/.test(s)) {
    return { ok: false, error: 'เลขห้องไม่ถูกแบบ ต้องเป็นตัวเลขล้วน (ห้องกลุ่มมีขีดนำหน้าได้)' };
  }
  /* ตั้งเลขเดิมซ้ำ = ไม่ต้องทักอีก
     ลิงก์นี้ไปนอนอยู่ในเบราว์เซอร์มือถือ พอแท็บมันรีเฟรชเองข้อความก็เด้งทุกที */
  if (tgChat_() === s) {
    return { ok: true, 'ตั้งแล้ว': true, 'ข้อความทดสอบ': 'ตั้งเลขนี้ไว้อยู่แล้ว ไม่ได้ทักซ้ำ' };
  }
  PropertiesService.getScriptProperties().setProperty('TG_CHAT', s);
  var r = tgSend_(s, 'ตั้งเจ้าของเรียบร้อย ห้องนี้คุยกับบอทได้แล้ว\n\n' + TG_MENU_);
  if (!r || !r.ok) {
    return { ok: false, 'ตั้งแล้ว': true,
             error: 'ตั้งเลขให้แล้ว แต่ทักเข้าไปไม่ได้ — ถ้ายังไม่เคยกด Start ในแชทบอท กดก่อนแล้วเปิดลิงก์นี้ซ้ำ' };
  }
  return { ok: true, 'ตั้งแล้ว': true, 'ข้อความทดสอบ': 'ส่งไปแล้ว ไปดูในแชทบอทได้เลย' };
}

/* ---------- เมนูลัด (ปุ่มถาวรใต้ช่องพิมพ์) ----------
   ย้ายแนวคิดมาจาก PIKTAX `tgKeyboard_()` — เจ้าของอยู่บนมือถือ พิมพ์คำสั่งไทยทีละตัวช้า
   กฎเดิมจาก PIKTAX: ใส่เฉพาะปุ่มที่ "กดบ่อยจริง" ตัวที่นานๆ ใช้ทีให้พิมพ์เอา
   is_persistent = ปุ่มไม่หายหลังกด (ไม่งั้นต้องกดไอคอนเรียกคืนทุกที) */
function tgKeyboard_() {
  return {
    keyboard: [
      [{ text: '/picktips' }, { text: '/คู่' }],
      [{ text: '/บิล' }, { text: '/สรุป' }],
      [{ text: '/คิดผล' }, { text: '/หาคู่' }],
      [{ text: '/talkfootball' }, { text: '/tfสถิติ' }],
      [{ text: '/รายงาน' }, { text: '/สถิติเตือน' }, { text: '/สถิติบอล' }],
      [{ text: 'หวยไทย' }, { text: 'หวยลาว' }, { text: 'หวย' }],
      [{ text: 'หวยไทยB' }, { text: 'หวยลาวB' }],
      [{ text: '/help' }]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

/* ---------- /picktips — ทีเด็ดที่คัดแล้ว ----------
   ต่างจาก /คู่ ตรงที่ /คู่ เรียงตามเวลา (ดูว่าคืนนี้มีอะไรเตะบ้าง)
   ส่วนอันนี้เรียงตาม "มั่นใจสุด" และตัดคู่ที่ไม่ถึงเกณฑ์ทิ้ง — ไว้ตัดสินใจ ไม่ใช่ไว้ดูตาราง

   เกณฑ์อยู่ที่ Script Property `TIP_MIN_PCT` (ไม่ตั้ง = 70)
   ทำเป็น property เพราะเจ้าของจะขยับเกณฑ์เองจากมือถือได้ ไม่ต้องรอ push

   ⚠️ เปอร์เซ็นต์พวกนี้เป็น "ของที่ forebet เดา" ยังไม่ใช่สถิติที่วัดผลแล้ว
      เลยต้องมีบรรทัดกำกับท้ายใบ ห้ามให้อ่านเป็นทีเด็ดที่พิสูจน์แล้ว
      (บทเรียนหน้า /รายงาน ของ FABEL5 — ด่านแรกไม่ใช่ hit rate) */
function tipMinPct_() {
  var raw = prop_('TIP_MIN_PCT');
  if (raw === '' || raw === null || raw === undefined) return 70;
  var n = Number(raw);
  return isFinite(n) && n > 0 ? n : 70;
}

/** ดึงตลาดที่ผ่านเกณฑ์ของคู่นั้นออกมาเป็นรายการ — คู่ไหนไม่ผ่านสักตลาด คืนอาร์เรย์ว่าง */
function tipMarkets_(p, minPct) {
  var out = [];
  var push = function (name, pick, pct) {
    var n = Number(pct);
    if (!isFinite(n) || n < minPct) return;
    var t = String(pick || '').trim();
    out.push({ 'ตลาด': name, 'เลือก': t, '%': n });
  };
  push('1X2', p['เดาผล'], p['เปอร์เซ็นต์']);
  push('Over/Under', 'Over', p['Over %']);
  push('ทั้งคู่ยิง', 'YES', p['BTTS YES %']);
  push('สองโอกาส', p['DB เดาผล'], p['DB %']);
  push('ครึ่งแรก/จบ', p['HT/FT เดาผล'], p['HT/FT %']);
  out.sort(function (a, b) { return b['%'] - a['%']; });
  return out;
}

function tgPickTips_(nowMs) {
  var minPct = tipMinPct_();
  var live = fbUpcoming_(readObjects_(SHEETS.PICKS), nowMs || Date.now());
  if (!live.length) return 'ยังไม่มีคู่ที่รอเตะในชีต ลองเปิดหน้าเว็บให้มันดึงรอบใหม่';

  var picked = [], i;
  for (i = 0; i < live.length; i++) {
    var mk = tipMarkets_(live[i], minPct);
    if (mk.length) picked.push({ p: live[i], mk: mk, top: mk[0]['%'] });
  }
  /* ไม่มีอะไรผ่านเกณฑ์ = บอกตรงๆ พร้อมเกณฑ์ที่ใช้ ห้ามลดเกณฑ์เองให้มีของโชว์
     (ถ้าลดเอง เจ้าของจะนึกว่าวันนี้มีทีเด็ด ทั้งที่จริงไม่มี) */
  if (!picked.length) {
    return 'วันนี้ไม่มีคู่ไหนถึงเกณฑ์ ' + minPct + '%\n' +
           'ดูทั้งหมดได้ที่ /คู่ · อยากขยับเกณฑ์ตั้ง TIP_MIN_PCT';
  }
  picked.sort(function (a, b) { return b.top - a.top; });

  var lines = ['ทีเด็ด ' + picked.length + ' คู่ (เกณฑ์ ' + minPct + '%)', ''];
  for (i = 0; i < picked.length && i < 10; i++) {
    var p = picked[i].p, mk = picked[i].mk, k;
    lines.push(fbHm_(p['เวลาเตะ']) + '  ' + String(p['ทีมเหย้า'] || '') + ' พบ ' + String(p['ทีมเยือน'] || ''));
    lines.push('   ' + String(p['ลีก'] || ''));
    for (k = 0; k < mk.length; k++) {
      lines.push('   ' + mk[k]['ตลาด'] + '  ' + (mk[k]['เลือก'] || '-') + '  ' + mk[k]['%'] + '%');
    }
  }
  if (picked.length > 10) lines.push('… อีก ' + (picked.length - 10) + ' คู่');
  lines.push('', 'เลขพวกนี้คือที่ forebet เดา ยังไม่ใช่สถิติที่วัดผลแล้ว');
  return lines.join('\n');
}
