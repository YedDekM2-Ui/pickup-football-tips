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
  return tgApi_('sendMessage', { chat_id: chatId, text: text, disable_web_page_preview: true });
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
  '/คู่ — คู่ที่ยังไม่เตะ\n' +
  '/คิดผล — ไล่หาสกอร์จบเกมเองรอบเดียว\n' +
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
function tgHandle_(update, nowMs) {
  var msg = (update && update.message) || null;
  if (!msg) return '';
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

  var out;
  if (text === '/start' || text === '/help' || text === '/เมนู') out = TG_MENU_;
  else if (text === '/id') out = 'เลขห้องนี้คือ ' + chat;
  else if (text === '/บิล') out = tgBills_();
  else if (text === '/สรุป') out = tgSummary_();
  else if (text === '/คู่') out = tgPicks_(nowMs || Date.now());
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
    else out = 'ไม่เข้าใจ\n\n' + TG_MENU_;
  }
  tgSend_(chat, out);
  return out;
}
