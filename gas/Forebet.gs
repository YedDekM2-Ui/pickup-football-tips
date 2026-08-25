/* Forebet.gs — ดึง "Featured match" กับ "Pick of the day" มาแช่แข็งไว้
   เหตุผลที่ต้องแช่: forebet เปลี่ยนคู่บ่อยมาก ถ้าไม่จดไว้ ตอนกลับมาดูก็ไม่เหลือของเดิม

   กฎของไฟล์นี้
   1) ดึงไม่ได้ / อ่านไม่ออก = "ไม่ทำอะไรเลย" ของเก่าบนหน้า 1 ต้องอยู่ครบเหมือนเดิม
      (ห้ามลบ ห้ามเขียนทับด้วยของว่าง)
   2) คู่เดิมยังขึ้นอยู่ = ไม่จดซ้ำ และ "ไม่อัปเดตตัวเลขของแถวเก่า"
      เพราะเจ้าของขอภาพ ณ ตอนนั้น ไม่ใช่ตัวเลขล่าสุด
   3) ตัวอ่านห้ามยึดชื่อ class ของเว็บเขาอย่างเดียว — เขาแก้หน้าเว็บเมื่อไหร่ก็พังเมื่อนั้น
      จึงอ่าน 2 ชั้น: ชั้นแรกยึด class ชั้นสองยึด "ข้อความที่ถอด tag ออกแล้ว"
   4) เวลาเตะ: ถ้าไม่รู้เขตเวลาแน่ชัด ปล่อยว่าง ห้ามเดาแล้วบวกลบเอง (กฎเหล็กข้อ 6) */

var FB_URLS = [
  'https://www.forebet.com/en',
  'https://www.forebet.com/en/football-tips-and-predictions-for-today'
];

var FB_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

var FB_KIND = { FEATURED: 'FEATURED', POTD: 'POTD' };

/* คำที่ใช้หาหัวข้อ — เผื่อมี tag คั่นกลางระหว่างคำ เลยยอมให้มีอะไรคั่นได้ไม่เกิน 40 ตัว */
var FB_ANCHOR = {
  FEATURED: ['featured', 'match'],
  POTD: ['pick', 'of', 'the', 'day']
};

var FB_WINDOW = 4000;   /* อ่านต่อจากหัวข้อไปเท่านี้ตัวอักษร พอสำหรับ 1 การ์ด */

/* ---------- ตัวช่วยล้วนๆ (ไม่แตะเน็ต ไม่แตะชีต) เทสต์ได้ตรงๆ ---------- */

/** ถอด tag ออกให้เหลือแต่ข้อความ — script/style ต้องทิ้งทั้งก้อน ไม่งั้นได้โค้ดปนมา */
function fbStrip_(html) {
  var s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
       .replace(/<style[\s\S]*?<\/style>/gi, ' ')
       .replace(/<!--[\s\S]*?-->/g, ' ')
       .replace(/<[^>]*>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
       .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
       .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
       .replace(/&[a-z]+;/gi, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/** สร้าง regex จากรายการคำ ยอมให้มี tag/ช่องว่างคั่นระหว่างคำได้ */
function fbAnchorRe_(words) {
  var parts = [];
  for (var i = 0; i < words.length; i++) parts.push(words[i]);
  return new RegExp(parts.join('[\\s\\S]{0,40}?'), 'i');
}

/** หาหัวข้อแล้วตัดหน้าต่างข้อมูลออกมา — ไม่เจอหัวข้อ = คืน found:false ไม่ throw */
function fbWindow_(html, kind) {
  var words = FB_ANCHOR[kind] || [];
  var s = String(html || '');
  var m = fbAnchorRe_(words).exec(s);
  if (!m) return { found: false, idx: -1, raw: '', text: '' };
  var start = m.index + m[0].length;
  var raw = s.slice(start, start + FB_WINDOW);
  return { found: true, idx: m.index, raw: raw, text: fbStrip_(raw) };
}

function fbClean_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

/** ชื่อทีมที่รับได้: มีตัวอักษร ยาว 2-40 ไม่ใช่ตัวเลขล้วน */
function fbTeamOk_(s) {
  var t = fbClean_(s);
  if (t.length < 2 || t.length > 40) return false;
  return /[A-Za-zÀ-ÿ]/.test(t);
}

/** ชั้นที่ 1 — ยึดชื่อ class ของ forebet (แม่นสุดตอนที่เขายังไม่แก้หน้าเว็บ) */
function fbTeamsByClass_(raw) {
  var s = String(raw || '');
  var h = /class="[^"]*homeTeam[^"]*"[^>]*>\s*([^<]{2,40}?)\s*</i.exec(s);
  var a = /class="[^"]*awayTeam[^"]*"[^>]*>\s*([^<]{2,40}?)\s*</i.exec(s);
  if (h && a) return { home: fbClean_(h[1]), away: fbClean_(a[1]), how: 'class' };
  var t = /class="[^"]*tnms[^"]*"[^>]*>[\s\S]{0,200}?>\s*([^<]{2,40}?)\s*<[\s\S]{0,200}?>\s*([^<]{2,40}?)\s*</i.exec(s);
  if (t) return { home: fbClean_(t[1]), away: fbClean_(t[2]), how: 'tnms' };
  return null;
}

/** ชั้นที่ 2 — ยึดข้อความ "ทีม - ทีม" / "ทีม vs ทีม" ที่ถอด tag แล้ว
    ตัวคั่นต้องมีตัวอักษรขนาบทั้งสองข้าง เลข "2-1" จึงไม่หลุดมาเป็นชื่อทีม */
function fbTeamsByText_(text) {
  var re = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.'\-]*(?: [A-Za-zÀ-ÿ0-9.'\-]+){0,3})\s+(?:-|–|—|vs\.?|v\.)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.'\-]*(?: [A-Za-zÀ-ÿ0-9.'\-]+){0,3})/;
  var m = re.exec(String(text || ''));
  if (!m) return null;
  return { home: fbClean_(m[1]), away: fbClean_(m[2]), how: 'text' };
}

function fbTeams_(raw, text) {
  var byClass = fbTeamsByClass_(raw);
  if (byClass && fbTeamOk_(byClass.home) && fbTeamOk_(byClass.away) &&
      byClass.home !== byClass.away) return byClass;
  var byText = fbTeamsByText_(text);
  if (byText && fbTeamOk_(byText.home) && fbTeamOk_(byText.away) &&
      byText.home !== byText.away) return byText;
  return null;
}

/** 1X2 — ยึด class ก่อน ถ้าไม่มีค่อยหาตัวเดี่ยวๆ 1/X/2 ในข้อความ */
function fbWdl_(raw, text) {
  var m = /class="[^"]*forepr[^"]*"[^>]*>\s*([12X])\s*</i.exec(String(raw || ''));
  if (m) return m[1].toUpperCase();
  var t = /(?:^|\s)([12X])(?=\s+\d{1,3}\s*%)/.exec(String(text || ''));
  return t ? t[1].toUpperCase() : '';
}

function fbPct_(text) {
  var m = /(\d{1,3})\s*%/.exec(String(text || ''));
  if (!m) return 0;
  var n = Number(m[1]);
  return (n >= 1 && n <= 100) ? n : 0;
}

/** ราคาแบบทศนิยม 2 ตำแหน่ง 1.01-99.99 — ต่ำกว่า 1.01 ไม่ใช่ราคา */
function fbOdds_(text) {
  var re = /\b([1-9]\d?\.\d{2})\b/g, m;
  while ((m = re.exec(String(text || '')))) {
    var n = Number(m[1]);
    if (n >= 1.01 && n <= 99.99) return n;
  }
  return 0;
}

/** สกอร์ที่เดา เช่น 2-1 — ต้องไม่มีตัวอักษรติดหัวท้าย และเลขไม่เกิน 2 หลัก */
function fbScore_(text) {
  var m = /(?:^|[^\d\w])(\d{1,2})\s*[-–:]\s*(\d{1,2})(?![\d\w])/.exec(String(text || ''));
  return m ? (m[1] + '-' + m[2]) : '';
}

/** วันที่ — รับ dd/mm/yyyy, dd.mm.yyyy และ yyyy-mm-dd คืนเป็น yyyy-mm-dd เสมอ */
function fbDate_(text) {
  var s = String(text || '');
  var a = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
  if (a) return a[1] + '-' + a[2] + '-' + a[3];
  var b = /\b(\d{2})[\/.](\d{2})[\/.](\d{4})\b/.exec(s);
  if (b) return b[3] + '-' + b[2] + '-' + b[1];
  return '';
}

/** ลีก — เอาจากลิงก์ทำนายผลของเขา ไม่มีก็ปล่อยว่าง ไม่ใช่เรื่องคอขาดบาดตาย */
function fbLeague_(raw) {
  var m = /predictions-1x2\/[^"']*["'][^>]*>\s*([^<]{2,40}?)\s*</i.exec(String(raw || ''));
  return m ? fbClean_(m[1]) : '';
}

/** อ่าน 1 ก้อนให้จบ — อ่านชื่อทีมไม่ได้ = คืน null (ถือว่าไม่ได้ของ)
    ที่เหลืออ่านไม่ได้ = ปล่อยว่าง ยังนับว่าได้ของ */
function fbParseOne_(html, kind) {
  var w = fbWindow_(html, kind);
  if (!w.found) return null;
  var t = fbTeams_(w.raw, w.text);
  if (!t) return null;
  return {
    'ช่อง': kind,
    'ลีก': fbLeague_(w.raw),
    'ทีมเหย้า': t.home,
    'ทีมเยือน': t.away,
    'วันที่': fbDate_(w.text),
    'เวลาเตะ': '',              /* ไม่รู้เขตเวลาของเขาแน่ชัด = ไม่กรอก ดีกว่ากรอกผิด */
    'เดาผล': fbWdl_(w.raw, w.text),
    'เดาสกอร์': fbScore_(w.text),
    'เปอร์เซ็นต์': fbPct_(w.text),
    'ราคา': fbOdds_(w.text),
    'อ่านทีมจาก': t.how
  };
}

/* ---------- ทางเน็ต ---------- */

function fbFetch_(url) {
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': FB_UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  return { code: res.getResponseCode(), body: res.getContentText() };
}

/** ไล่ยิงทีละ url จนกว่าจะได้ 200 ที่มีเนื้อ — ทุกอันพังก็คืนอันสุดท้ายไปเป็นหลักฐาน */
function fbFetchAny_() {
  var urls = prop_('FOREBET_URL') ? [prop_('FOREBET_URL')] : FB_URLS;
  var last = { url: '', code: 0, body: '' };
  for (var i = 0; i < urls.length; i++) {
    try {
      var r = fbFetch_(urls[i]);
      last = { url: urls[i], code: r.code, body: r.body || '' };
      if (r.code === 200 && last.body.length > 1000) return last;
    } catch (err) {
      last = { url: urls[i], code: -1, body: String(err && err.message ? err.message : err) };
    }
  }
  return last;
}

/* ---------- ทางชีต ---------- */

/** แถวล่าสุดของช่องนั้น (ยึดลำดับที่จดลงชีต แถวท้าย = ใหม่สุด) */
function fbLatest_(rows, kind) {
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i]['ช่อง'] || '') === kind) return rows[i];
  }
  return null;
}

function fbSameMatch_(row, snap) {
  if (!row) return false;
  return String(row['ทีมเหย้า'] || '') === snap['ทีมเหย้า'] &&
         String(row['ทีมเยือน'] || '') === snap['ทีมเยือน'];
}

function fbAppend_(snap, stamp) {
  var sh = sheetEnsure_(SHEETS.PICKS, HEADERS.PICKS);
  var vals = {
    'ID': 'FB-' + snap['ช่อง'] + '-' + stamp.replace(/[^0-9]/g, '').slice(0, 14),
    'วันที่': snap['วันที่'],
    'ช่อง': snap['ช่อง'],
    'ลีก': snap['ลีก'],
    'ทีมเหย้า': snap['ทีมเหย้า'],
    'ทีมเยือน': snap['ทีมเยือน'],
    'เวลาเตะ': snap['เวลาเตะ'],
    'เดาผล': snap['เดาผล'],
    'เดาสกอร์': snap['เดาสกอร์'],
    'เปอร์เซ็นต์': snap['เปอร์เซ็นต์'],
    'ราคา': snap['ราคา'],
    'สกอร์จริง': '',
    'ถูกผิด': '',
    'สร้างเมื่อ': stamp
  };
  var row = [];
  for (var i = 0; i < HEADERS.PICKS.length; i++) row.push(vals[HEADERS.PICKS[i]] === undefined ? '' : vals[HEADERS.PICKS[i]]);
  sh.appendRow(row);
  return vals['ID'];
}

/* ---------- งานจริง ---------- */

/** ดึง 1 รอบ — คืนรายงานว่าเกิดอะไรขึ้นบ้าง ไม่ throw ออกไปข้างนอก
    ล้มตรงไหนก็ตาม ของเก่าในชีตต้องไม่ถูกแตะ */
function fbSnapRun_() {
  var got = fbFetchAny_();
  var out = { ok: false, code: got.code, url: got.url, len: (got.body || '').length,
              added: [], skipped: [], missed: [] };
  if (got.code !== 200 || out.len < 1000) {
    out.error = 'ดึงหน้าเว็บไม่ได้ (' + got.code + ')';
    return out;
  }

  var rows = readObjects_(SHEETS.PICKS);
  var stamp = nowIso_();
  var kinds = [FB_KIND.FEATURED, FB_KIND.POTD];
  for (var i = 0; i < kinds.length; i++) {
    var kind = kinds[i], snap;
    try { snap = fbParseOne_(got.body, kind); } catch (err) { snap = null; }
    if (!snap) { out.missed.push(kind); continue; }
    if (fbSameMatch_(fbLatest_(rows, kind), snap)) {
      out.skipped.push(kind);            /* คู่เดิม = ปล่อยของเก่าไว้ ห้ามเขียนทับ */
      continue;
    }
    try {
      out.added.push({ 'ช่อง': kind, id: fbAppend_(snap, stamp),
                       คู่: snap['ทีมเหย้า'] + ' VS ' + snap['ทีมเยือน'],
                       'อ่านทีมจาก': snap['อ่านทีมจาก'] });
    } catch (err) {
      out.missed.push(kind + ' (เขียนชีตไม่ได้)');
    }
  }
  out.ok = true;
  return out;
}

/** ตัวที่ trigger เรียก — ห้ามโยน error ออก ไม่งั้น Google ส่งเมลเตือนรัวๆ */
function fbSnapTick() {
  try { fbSnapRun_(); } catch (err) { Logger.log('fbSnapTick: ' + err); }
}

/** ติด trigger ให้ถ้าทำได้ — ทำไม่ได้ก็ห้ามล้มทั้งงาน
    (deployment นี้ไม่ได้ขอสิทธิ์ script.scriptapp ไว้ เรียกแล้วมัน throw
     ถ้าปล่อยให้ throw มันจะกลืนรายงานของ fbSnapRun_ ที่สำเร็จไปแล้วทั้งก้อน) */
function fbEnsureTrigger_() {
  try {
    var all = ScriptApp.getProjectTriggers();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getHandlerFunction && all[i].getHandlerFunction() === 'fbSnapTick') return 'มีอยู่แล้ว';
    }
    ScriptApp.newTrigger('fbSnapTick').timeBased().everyHours(6).create();
    return 'ติดตั้งแล้ว';
  } catch (err) {
    return 'ติดไม่ได้ (ไม่ได้ขอสิทธิ์ trigger) — ไม่เป็นไร หน้าเว็บดึงเองเมื่อของเก่าเกิน ' + FB_STALE_HOURS + ' ชม.';
  }
}

/* ---------- ดึงเองเมื่อของเก่า (ไม่พึ่ง trigger) ---------- */
/* ทำไมต้องมี: ทางติด trigger ขอสิทธิ์ script.scriptapp ที่ deployment นี้ไม่ได้ขอไว้
   ถ้าไปเพิ่มสิทธิ์ทีหลัง เจ้าของต้องกดอนุญาตใหม่ทั้งชุดจากมือถือ เสี่ยงพังของที่ใช้อยู่
   จึงให้ "ทางอ่านข้อมูล" เป็นคนดึงเองเมื่อภาพนิ่งเก่าเกินกำหนด — ไม่ใช้สิทธิ์เพิ่มเลย */
var FB_STALE_HOURS = 6;    /* ภาพนิ่งเก่ากว่านี้ = ถึงเวลาไปดูใหม่ */
var FB_RETRY_MIN = 30;     /* ดึงพลาด (403) ห้ามยิงรัว ไม่งั้นเปิดหน้าทีไรก็ต้องรอโหลด */

function fbMs_(v) {
  var t = Date.parse(String(v || ''));
  return isNaN(t) ? 0 : t;
}

/** ภาพนิ่งเก่าเกินกำหนดหรือยัง — ช่องไหนยังไม่เคยดึงเลย ก็ถือว่าเก่า */
function fbStale_(pickRows, nowMs) {
  var kinds = [FB_KIND.FEATURED, FB_KIND.POTD];
  for (var i = 0; i < kinds.length; i++) {
    var r = fbLatest_(pickRows || [], kinds[i]);
    if (!r) return true;
    var t = fbMs_(r['สร้างเมื่อ']);
    if (!t) return true;
    if (nowMs - t > FB_STALE_HOURS * 3600000) return true;
  }
  return false;
}

function fbLastTry_() {
  try { return fbMs_(prop_('FB_LAST_TRY')); } catch (err) { return 0; }
}
function fbMarkTry_(iso) {
  try { PropertiesService.getScriptProperties().setProperty('FB_LAST_TRY', iso); }
  catch (err) { /* จดเวลาไม่ได้ก็ไม่เป็นไร แค่เสียตัวหน่วง */ }
}

/** เรียกจากทางอ่านข้อมูล (?p=all)
    คืน true ถ้ามีของใหม่เข้าชีต — คนเรียกต้องอ่านชีตซ้ำ
    ห้าม throw เด็ดขาด หน้าเว็บต้องขึ้นได้เสมอ ถึง forebet จะล่มก็ตาม */
function fbAutoSnap_(pickRows, nowMs) {
  try {
    var now = nowMs || Date.now();
    if (!fbStale_(pickRows, now)) return false;
    var last = fbLastTry_();
    if (last && now - last < FB_RETRY_MIN * 60000) return false;   /* เพิ่งลองไป ยังไม่ถึงคิว */
    fbMarkTry_(new Date(now).toISOString());
    var r = fbSnapRun_();
    return !!(r && r.added && r.added.length);
  } catch (err) {
    return false;
  }
}

/** ตัวส่องปัญหา — ใช้ตอนตัวอ่านอ่านไม่ออก จะได้รู้ว่าหน้าเว็บเขาหน้าตายังไง
    คายเฉพาะของสาธารณะจาก forebet ไม่มีข้อมูลของเจ้าของ แต่ยังกันด้วยกุญแจตามกฎข้อ 3 */
function fbProbe_() {
  var got = fbFetchAny_();
  var out = { code: got.code, url: got.url, len: (got.body || '').length, blocks: {} };
  var kinds = [FB_KIND.FEATURED, FB_KIND.POTD];
  for (var i = 0; i < kinds.length; i++) {
    var kind = kinds[i], w = { found: false, text: '' };
    try { w = fbWindow_(got.body, kind); } catch (err) { /* ปล่อย */ }
    var parsed = null;
    try { parsed = fbParseOne_(got.body, kind); } catch (err) { parsed = null; }
    out.blocks[kind] = {
      เจอหัวข้อ: !!w.found,
      อ่านออก: !!parsed,
      ได้: parsed,
      ตัวอย่างข้อความ: String(w.text || '').slice(0, 400)
    };
  }
  return out;
}

/** คู่ที่ปักหมุดบนหน้า 1 = แถวล่าสุดของแต่ละช่อง ช่องไหนยังไม่มีก็ข้าม */
function fbPinned_(pickRows, tmap) {
  var kinds = [FB_KIND.FEATURED, FB_KIND.POTD], out = [];
  for (var i = 0; i < kinds.length; i++) {
    var r = fbLatest_(pickRows || [], kinds[i]);
    if (r) out.push(pickOut_(r, tmap));
  }
  return out;
}
