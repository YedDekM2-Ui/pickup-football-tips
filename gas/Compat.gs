/*******************************************************
 * Compat.gs — ตัวช่วยกลางที่ของย้ายมาจากบอทเก่า (PIKTAX) เรียกใช้
 *
 * มีไว้ทำไม: ไฟล์ที่ย้ายมา (FabScan/talkfootball/FabValue...) เขียนไว้ตอนอยู่บอทเก่า
 *   มันเรียก logEvent_ / fbDayShift_ / fbFetchJsonText_ ฯลฯ ซึ่งบอทใหม่ไม่มี
 *   → รวมไว้ที่เดียวตรงนี้ "ตัวเดียวจริง" ห้ามก๊อปซ้ำเข้าไปในไฟล์ที่ย้ายมา
 *
 * ⚠️ ทางเน็ตทุกเส้นต้องผ่าน fbProxy_() ของบอทนี้ ห้ามฝัง r.jina.ai ตรงๆ
 *    ไม่งั้นสวิตช์ FB_PROXY='-' ของเจ้าของจะปิดไม่ลง และบัตร JINA_KEY จะไม่ถูกใช้
 *******************************************************/

var CP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
var CP_LOG_KEEP = 30;   /* เก็บล็อกกี่บรรทัด — Script Property มีเพดาน 9KB ต่อค่า */

/** ล็อกที่ "อ่านได้จากมือถือ" — บอทนี้ไม่มีชีต LOG และเจ้าของเปิดเอดิเตอร์ไม่ไหว
 *  จึงเก็บเป็นวงแหวนใน Script Property RUN_LOG แล้วคาย/ดูผ่าน ?p=ping ได้ */
function logEvent_(level, message) {
  var line = '';
  try {
    line = Utilities.formatDate(new Date(), TZ, 'MM-dd HH:mm') + ' [' + String(level || '') + '] ' +
           truncate_(String(message == null ? '' : message), 300);
    var sp = PropertiesService.getScriptProperties();
    var old = sp.getProperty('RUN_LOG') || '';
    var arr = old ? old.split('\n') : [];
    arr.push(line);
    while (arr.length > CP_LOG_KEEP) arr.shift();
    sp.setProperty('RUN_LOG', arr.join('\n'));
  } catch (e) { /* ล็อกล้มห้ามล้มงานจริงตาม (กฎข้อ 1) */ }
  try { Logger.log(line); } catch (e2) { }
  return line;
}

function runLog_() {
  try { return PropertiesService.getScriptProperties().getProperty('RUN_LOG') || ''; }
  catch (e) { return ''; }
}

function truncate_(s, n) {
  var t = String(s == null ? '' : s);
  var lim = n || 200;
  return t.length <= lim ? t : t.slice(0, lim - 1) + '…';
}

/** เลื่อนวัน (string yyyy-MM-dd) — คิดบน UTC ล้วน กัน DST/เขตเวลาเลื่อนวันเอง */
function fbDayShift_(d, k) {
  var p = String(d).split('-');
  return Utilities.formatDate(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + k * 86400000), 'UTC', 'yyyy-MM-dd');
}

/** วันนี้แบบ yyyy-MM-dd เวลาไทย */
function fbToday_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

/** ยิงเอา "ข้อความดิบ" มา 1 หน้า — ใช้กับฟีด JSON และหน้า markdown
 *  md=true  → ห้ามใส่ X-Return-Format:html เพราะตัวแกะของ FabScan อ่าน markdown
 *  ตรงก่อน แล้วค่อยอ้อม: ฟีด getrs.php ยิงตรงติดบ่อย (ไม่ใช่หน้าเว็บ Cloudflare ไม่ค่อยกั้น) */
function cpGet_(url, via, md) {
  var head = { 'User-Agent': CP_UA, 'Accept': '*/*' };
  var target = url;
  if (via) {
    target = via + url;
    if (!md) head['X-Return-Format'] = 'html';
    var jk = prop_('JINA_KEY');
    if (jk) head['Authorization'] = 'Bearer ' + jk;
  } else {
    head['Referer'] = 'https://www.forebet.com/';
  }
  var r = UrlFetchApp.fetch(target, { method: 'get', muteHttpExceptions: true,
                                      followRedirects: true, headers: head });
  return { code: r.getResponseCode(), body: r.getContentText() };
}

/** ฟีด getrs.php — ยิงตรงก่อน (เร็ว) โดนกั้นค่อยอ้อม
 *  ✅ เช็ก '[[' ก่อนคืน ไม่งั้นหน้าเออเร่อ 200 จะถูกนับว่าสำเร็จ แล้วไปตายตอนแกะ */
function fbFetchJsonText_(url) {
  try {
    var r = cpGet_(url, '', true);
    if (r.code === 200 && String(r.body).indexOf('[[') >= 0) return r.body;
  } catch (e) { }
  var via = fbProxy_();
  if (!via) return '';
  try {
    var r2 = cpGet_(url, via, true);
    if (r2.code === 200) return r2.body;
  } catch (e2) { }
  return '';
}

/** หน้าเว็บ forebet แบบ markdown (ผ่านทางอ้อม) — ยิงตรงไม่มีประโยชน์ วัดแล้วโดน 403 ทุกครั้ง */
function fbFetchForebetText_(url) {
  var via = fbProxy_();
  if (!via) return '';
  try {
    var r = cpGet_(url, via, true);
    return r.code === 200 ? r.body : '';
  } catch (e) { return ''; }
}

/* ==========================================================
   ตัวแกะสกอร์จริงจากหน้า forebet — ย้ายมาจาก PIKTAX FootballTips.gs
   ใช้เกรดผล /talkfootball · หน้าที่กินคือ markdown ที่ได้จาก fbFetchForebetText_
   ========================================================== */

function fbNorm_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
}

/* โครงจริงของบล็อกหนึ่งคู่ (นับจากบรรทัดลิงก์):
     +0  [ชื่อบ้านชื่อเยือน MM/DD/YYYY h:mm AM](https://www.forebet.com/en/football/matches/slug-2419777)
     +16 '90' / 'HT' / ''      ← สถานะ
     +18 '**2 - 2**(2 - 1)'    ← ผลจริงเต็มเวลา (ในวงเล็บ = ครึ่งแรก) ตัวหนาเสมอ
   slug มีตัวใหญ่/%xx ได้ (เคยตกหล่นไป 3 คู่/หน้า) */
var FB_LINK_RE = /\[(.+?)\s+\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}\s*(?:[AP]M)?\]\(https:\/\/www\.forebet\.com\/en\/football\/matches\/[A-Za-z0-9.%\-]+?-(\d+)\)/;

/** คืน map 2 ชนิดคีย์: '#<id>' (แม่นสุด) และ '<ชื่อบ้าน+ชื่อเยือน ตัดอักขระ>' (สำรอง) */
function fbParseScores_(text) {
  var map = {};
  if (!text) return map;
  var lines = String(text).split('\n');
  for (var i = 0; i < lines.length; i++) {
    var lm = lines[i].match(FB_LINK_RE);
    if (!lm) continue;
    var names = lm[1].trim(), mid = lm[2];
    var status = '', sc = null;
    for (var j = i + 1; j < Math.min(i + 26, lines.length); j++) {
      if (FB_LINK_RE.test(lines[j])) break;         // ถึงคู่ถัดไปแล้ว
      var ln = lines[j].trim();
      if (!ln) continue;
      var sm = ln.match(/^\*\*(\d+)\s*[-–]\s*(\d+)\*\*\s*(?:\((\d+)\s*[-–]\s*(\d+)\))?/);
      if (sm) {
        sc = [parseInt(sm[1], 10), parseInt(sm[2], 10)];
        if (sm[3] != null) { sc[2] = parseInt(sm[3], 10); sc[3] = parseInt(sm[4], 10); }
        break;
      }
      if (/^(FT|AET|AP|Pen\.?|HT|\d{1,3})$/i.test(ln)) status = ln;
    }
    if (!sc) continue;                               // ยังไม่เตะ/ไม่มีสกอร์
    // เอาเฉพาะที่ "จบแล้ว" — กำลังเตะอยู่ห้ามเกรด (นำ 2-0 ครึ่งแรก จบจริง 2-1 คนละเรื่อง)
    if (!/^(90|FT|AET|AP|Pen\.?)$/i.test(status)) continue;
    map['#' + mid] = sc;
    var nk = fbNorm_(names);
    if (nk && !(nk in map)) map[nk] = sc;
  }
  return map;
}

/** หาสกอร์: id ก่อน (แม่นสุด) → ชื่อบ้าน+เยือนต่อกัน → เผื่อชื่อเป็น substring กัน */
function fbLookupScore_(scores, home, away, mid) {
  if (mid && scores['#' + mid]) return scores['#' + mid];
  var h = fbNorm_(home), a = fbNorm_(away);
  if (!h || !a) return null;
  if (scores[h + a]) return scores[h + a];
  for (var k in scores) {
    if (k.charAt(0) === '#') continue;
    if (k.indexOf(h) === 0 && k.length > h.length && k.substring(k.length - a.length) === a) return scores[k];
  }
  return null;
}

/* ==========================================================
   ตัวช่วยของฝั่งหวย (ย้ายมาจาก PIKTAX) — ตัวเดียวจริงอยู่ที่นี่
   ========================================================== */

/** ปีอะไรก็ได้ → ค.ศ. 4 หลัก · 69 → 2569 → 2026 · คืน 0 ถ้าอ่านไม่ออก
 *  ต้นเหตุเดิม: ผู้ใช้พิมพ์ปีไทย 2 หลัก ("21/7/69") แล้วโค้ดเอาไปทำ Date ตรงๆ */
function ceYear_(y) {
  y = parseInt(y, 10);
  if (isNaN(y)) return 0;
  if (y < 100) y += 2500;      // 69 → พ.ศ. 2569
  if (y > 2400) y -= 543;      // พ.ศ. → ค.ศ.
  return (y >= 1900 && y <= 2200) ? y : 0;
}

/** ห้องแชทเจ้าของ — บอทเก่ามีหลายคน บอทนี้มีคนเดียว (TG_CHAT) */
function getTgChatId_() { return tgChat_(); }

/** ส่งข้อความแบบ "บังคับให้ตอบกลับ" — ใช้ตอนบอทถามผลหวย
 *  ต้อง force_reply เพราะตัวรับผล (lotCatchReply_) ดูจากบรรทัดที่ผู้ใช้ Reply มา
 *  ถ้าส่งธรรมดา ผู้ใช้พิมพ์เลขลอยๆ จะไม่รู้ว่าเป็นของหวยตัวไหน */
function tgSendForceReply_(chatId, text) {
  return tgApi_('sendMessage', {
    chat_id: String(chatId || tgChat_()),
    text: String(text),
    reply_markup: JSON.stringify({ force_reply: true, selective: false })
  });
}

/* ==========================================================
   ทางที่ "เครื่องขูดบน GitHub Actions" เรียก — ย้ายมาจากบอทเก่า (PIKTAX)
   เครื่องขูดพูดภาษาเก่า: ?admin=<กุญแจ>&action=<ชื่อ>  และ  ?ff=<url>
   ตัวแปลภาษาอยู่หัว doGet ใน Api.gs — ที่นี่มีแต่เนื้องาน
   ========================================================== */

/* ?ff= เป็นทางเดียวที่ "ไม่มีกุญแจ" (ฝั่ง python ไม่ได้ส่งมาแต่ไหนแต่ไร)
   จึงต้องล็อกไว้ที่ forebet.com เท่านั้น ไม่งั้นมันคือพร็อกซีเปิดให้คนทั้งโลกใช้ */
var FF_HOST = 'forebet.com';

function ffAllowed_(url) {
  var m = String(url || '').match(/^https:\/\/([^\/?#]+)/i);
  if (!m) return false;
  var host = m[1].toLowerCase().replace(/:\d+$/, '');
  return host === FF_HOST || host.slice(-(FF_HOST.length + 1)) === '.' + FF_HOST;
}

/** คืน "ข้อความดิบ" ของหน้า forebet · ล้มแล้วคืนป้ายสั้น ๆ
 *  ป้าย BAD_URL / FETCH_ERR คือสัญญาเดิมกับฝั่ง python (มันเช็กคำขึ้นต้นพวกนี้)
 *  และสั้นกว่า 500 ตัวอักษร ฝั่ง forebet_api จึงนับเป็นล้มแล้วยิงซ้ำเอง */
function ffFetch_(url) {
  url = String(url || '').trim();
  if (!ffAllowed_(url)) return 'BAD_URL';
  var t = fbFetchJsonText_(url);            /* ตรงก่อน (ฟีด getrs.php) แล้วค่อยอ้อม markdown */
  if (t) return t;
  t = fbFetchForebetText_(url);             /* ยิงซ้ำทางอ้อม — กัน 429 ชั่วคราว */
  return t || 'FETCH_ERR';
}

/** ?action=notify&text=.. — ทางสำรองของ fb_watch และทางเดียวของ fb_pick
 *  ต้องมีคำว่า "notify OK" ในคำตอบ ฝั่ง python เช็กคำนี้ตรง ๆ */
function notify_(text) {
  text = String(text || '').trim();
  if (!text) return 'notify: ไม่มี text';
  if (!tgChat_()) return 'notify: ยังไม่มี TELEGRAM_CHAT_ID (ทัก /start ก่อน)';
  var mid = f5Send_(text);
  if (!mid) return 'notify: ส่ง Telegram ไม่ผ่าน';
  return 'notify OK ' + mid;
}

/* ---------- ตั้งค่าลับจากลิงก์ (อยู่หลังด่านกุญแจแล้ว) ----------
   บทเรียนจากบอทเก่า: หน้า Script Properties แทบกดไม่ได้บนมือถือ
   ของที่ต้องตั้งจึงต้องมีทางตั้งผ่านลิงก์เสมอ
   ⚠️ คายกลับได้แค่ "ตั้งแล้ว / ยาวกี่ตัว" ห้ามคายค่าจริงออกไป
   ⚠️ APP_KEY ไม่อยู่ในรายชื่อ — ทับกุญแจประตูตัวเองไม่ได้ */
var CFG_ALLOW = ['GH_TOKEN', 'JINA_KEY', 'FB_PROXY', 'FB_TZ_SHIFT', 'FOREBET_URL',
                 'TG_TOKEN', 'TG_HOOK_KEY', 'SCRAPER_KEY'];

/* ตั้งกุญแจใบที่ 2 (SCRAPER_KEY) ได้ "ครั้งเดียว" ตอนที่ยังว่างอยู่
   ทำไมต้องมี: กุญแจตัวจริง APP_KEY อยู่ใน Script Properties อ่านจากข้างนอกไม่ได้เลย
   เครื่องขูดบน GitHub Actions จึงต้องมีกุญแจของตัวเองที่ตั้งได้จากข้างนอก 1 ครั้ง
   ตั้งแล้วประตูนี้ปิดถาวร (ตอบ "ตั้งไปแล้ว") จะเปลี่ยนต้องมีกุญแจเดิมแล้วใช้ ?p=setprop
   ห้ามคายค่ากลับ คายแค่ยาวกี่ตัว */
function claimKey_(v) {
  var p = PropertiesService.getScriptProperties();
  if (p.getProperty('SCRAPER_KEY')) return { ok: false, error: 'ตั้งไปแล้ว เปลี่ยนทางนี้ไม่ได้' };
  v = String(v == null ? '' : v).trim();
  if (v.length < 24) return { ok: false, error: 'กุญแจสั้นเกินไป ต้องอย่างน้อย 24 ตัว' };
  p.setProperty('SCRAPER_KEY', v);
  return { ok: true, ผล: 'ตั้งแล้ว', ยาว: v.length };
}

function setProp_(name, val) {
  name = String(name || '').trim();
  if (CFG_ALLOW.indexOf(name) < 0) return { ok: false, error: 'ตั้งได้เฉพาะ ' + CFG_ALLOW.join(' / ') };
  var p = PropertiesService.getScriptProperties();
  var v = String(val == null ? '' : val);
  if (v === '') { p.deleteProperty(name); return { ok: true, ชื่อ: name, ผล: 'ลบแล้ว' }; }
  p.setProperty(name, v);
  return { ok: true, ชื่อ: name, ผล: 'ตั้งแล้ว', ยาว: v.length };
}

function cfgStat_() {
  var p = PropertiesService.getScriptProperties();
  var o = {};
  CFG_ALLOW.concat(['APP_KEY', 'SHEET_ID', 'TG_CHAT']).forEach(function (k) {
    /* คายแค่ "ตั้งแล้ว/ยังไม่ได้ตั้ง" กับความยาว ห้ามคายค่าจริง */
    var v = p.getProperty(k);
    o[k] = v ? ('ตั้งแล้ว (' + String(v).length + ' ตัว)') : 'ยังไม่ได้ตั้ง';
  });
  return { ok: true, ค่า: o };
}
