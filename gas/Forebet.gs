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
/* หัวข้อ 2 กล่องที่เจ้าของสั่ง — ต้องตรงตัวและเป็นข้อความในแท็กของมันเอง
   ห้ามใช้คำหลวมๆ: หน้าเดียวกันมี <h1>Featured matches</h1> ของตารางใหญ่อยู่ด้วย
   เผลอไปจับอันนั้น = ได้คู่มั่วจากตาราง ไม่ใช่คู่ในกล่อง */
var FB_ANCHOR = {
  FEATURED: 'Featured match',
  POTD: 'Pick of the day'
};

var FB_WINDOW = 4000;   /* อ่านต่อจากหัวข้อไปเท่านี้ตัวอักษร พอสำหรับ 1 กล่อง */

/* ---------- ตัวช่วยอ่านหน้าเว็บ ---------- */

/** ตัด tag/สคริปต์/สไตล์ทิ้ง เหลือแต่ตัวหนังสือ */
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

function fbClean_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

/** หัวข้อต้องเป็นข้อความเดี่ยวๆ ในแท็ก: >Featured match<
    "Featured matches" จะไม่เข้าเงื่อนไข เพราะหลังคำมีตัว s ไม่ใช่ < */
function fbAnchorRe_(phrase) {
  var p = String(phrase || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp('>\\s*' + p + '\\s*<', 'i');
}

function fbWindow_(html, kind) {
  var s = String(html || '');
  var m = fbAnchorRe_(FB_ANCHOR[kind] || '').exec(s);
  if (!m) return { found: false, idx: -1, raw: '', text: '' };
  var start = m.index + m[0].length;
  var raw = s.slice(start, start + FB_WINDOW);
  return { found: true, idx: m.index, raw: raw, text: fbStrip_(raw) };
}

/* ---------- อ่านทีละช่อง ---------- */

/** หัวตารางของเขาเขียนว่า "Home team / Away team" — หลุดมาเมื่อไหร่คือจับผิดกล่อง */
function fbTeamOk_(s) {
  var t = fbClean_(s);
  if (t.length < 2 || t.length > 40) return false;
  if (/^(home|away)\s*team$/i.test(t)) return false;
  return /[A-Za-zÀ-ɏ]/.test(t);
}

/** ชื่อทีมจริงซ่อนอยู่ชั้นในของ microdata:
    <span itemprop="homeTeam" ...><span itemprop="name">ชื่อ</span></span>
    (ของเดิมอ่านชั้นเดียว เลยได้ค่าว่าง แล้วไปตกที่ตัวสำรองที่คว้าหัวตารางมาแทน) */
function fbNameOf_(raw, prop) {
  var s = String(raw || '');
  var m = new RegExp('itemprop="' + prop + '"[\\s\\S]{0,400}?itemprop="name"[^>]*>\\s*([^<]{2,60}?)\\s*<', 'i').exec(s);
  if (m) return fbClean_(m[1]);
  m = new RegExp('itemprop="' + prop + '"[^>]*>([\\s\\S]{0,200}?)<\\/span>', 'i').exec(s);
  return m ? fbClean_(fbStrip_(m[1])) : '';
}

function fbTeams_(raw) {
  var h = fbNameOf_(raw, 'homeTeam'), a = fbNameOf_(raw, 'awayTeam');
  if (fbTeamOk_(h) && fbTeamOk_(a)) return { home: h, away: a, how: 'micro' };

  /* สำรอง: <meta itemprop="name" content="ทีมเหย้า vs ทีมเยือน"> */
  var m = /<meta[^>]*itemprop="name"[^>]*content="([^"]{5,90})"/i.exec(String(raw || ''));
  if (m) {
    var p = fbClean_(m[1]).split(/\s+vs\.?\s+/i);
    if (p.length === 2 && fbTeamOk_(p[0]) && fbTeamOk_(p[1])) {
      return { home: fbClean_(p[0]), away: fbClean_(p[1]), how: 'meta' };
    }
  }
  return null;
}

/** รหัสคู่ของ forebet — ใช้ตามไปหาแถวเดียวกันในตารางใหญ่ (ชื่อทีมซ้ำกันได้ รหัสไม่ซ้ำ) */
function fbMatchId_(raw) {
  var s = String(raw || '');
  var m = /getstag\(\s*this\s*,\s*(\d{4,12})/i.exec(s);
  if (m) return m[1];
  m = /itemprop="url"[^>]*href="[^"]*?-(\d{4,12})"/i.exec(s);
  if (m) return m[1];
  m = /id="(\d{4,12})"/i.exec(s);
  return m ? m[1] : '';
}

/** ชื่อลีก — เขาฝังไว้ในพารามิเตอร์ของ getstag(...)
    ไม่มีมา (บางคู่เขาส่งค่าว่าง) = ใช้ตัวย่อที่หน้าเว็บโชว์จริง เช่น Co1 */
function fbLeague_(raw) {
  var s = String(raw || '');
  var m = /getstag\([^)]*?,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/i.exec(s);
  if (m && fbClean_(m[2])) return fbClean_(m[2]);
  if (m && fbClean_(m[1])) return fbClean_(m[1]);
  var t = /class="[^"]*shortTag[^"]*"[^>]*>\s*([^<]{1,20}?)\s*</i.exec(s);
  if (t) return fbClean_(t[1]);
  var l = /predictions-1x2\/[^"']*["'][^>]*>\s*([^<]{2,40}?)\s*</i.exec(s);
  return l ? fbClean_(l[1]) : '';
}

/** 1X2 — ตัวเลขอยู่ใน span ซ้อน span: <span class="forepr"><span>1</span></span> */
function fbWdl_(raw) {
  var m = /class="[^"]*forepr[^"]*"[^>]*>[\s\S]{0,40}?([12X])\s*<\/span>/i.exec(String(raw || ''));
  return m ? m[1].toUpperCase() : '';
}

function fbDate_(raw) {
  var s = String(raw || '');
  var m = /itemprop="startDate"[^>]*datetime="(\d{4})-(\d{2})-(\d{2})/i.exec(s);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /\b(\d{2})\/(\d{2})\/(\d{4})\b/.exec(s);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

/** วัน-เวลาตามที่หน้าเว็บเขาโชว์เป๊ะๆ ไม่แปลงเขตเวลา (กฎข้อ 6 ห้ามเดา) */
function fbWhenText_(raw) {
  var m = /class="[^"]*date_bah[^"]*"[^>]*>\s*([^<]{5,30}?)\s*</i.exec(String(raw || ''));
  return m ? fbClean_(m[1]) : '';
}

/* ---------- ตามไปเก็บของที่กล่องไม่มี ---------- */

/** กล่อง Featured / Pick of the day มีแค่ ทีม/ลีก/เวลา/1X2
    สกอร์ที่เดากับเปอร์เซ็นต์อยู่ในแถวของคู่เดียวกันในตารางใหญ่ หน้าเดียวกันนั่นแหละ
    → ไม่ต้องยิงเน็ตเพิ่ม แค่ตามรหัสคู่ไปหาแถวนั้น */
function fbRowById_(html, id) {
  var s = String(html || ''), key = String(id || '');
  if (!key) return '';
  var at = -1;
  while ((at = s.indexOf(key, at + 1)) >= 0) {
    var from = s.lastIndexOf('class="rcnt', at);
    if (from < 0) continue;
    if (at - from > FB_WINDOW) continue;
    var chunk = s.slice(from, from + FB_WINDOW);
    if (chunk.indexOf('ex_sc') >= 0) return chunk;
  }
  return '';
}

/** สกอร์ที่เดา — มี 2 ที่ในแถว (แบบมือถือกับแบบตาราง) เอาอันแรกที่อ่านออกเป็นตัวเลขจริง */
function fbScore_(row) {
  var s = String(row || '');
  var re = /class="[^"]*ex_sc[^"]*"[^>]*>([\s\S]{0,120}?)<\/(?:div|span)>/gi, m;
  while ((m = re.exec(s))) {
    var n = /(\d{1,2})\s*[-–:]\s*(\d{1,2})/.exec(fbStrip_(m[1]));
    if (n) return n[1] + '-' + n[2];
  }
  return '';
}

/** เปอร์เซ็นต์ — เขาให้มา 3 ตัวเรียง 1 / X / 2 ต้องหยิบตัวที่ตรงกับผลที่เขาเดา
    ไม่รู้ว่าเขาเดาอะไร = ไม่หยิบ ดีกว่าหยิบผิดตัว */
function fbPct_(row, wdl) {
  var m = /class="[^"]*fprc[^"]*"[^>]*>([\s\S]{0,200}?)<\/div>/i.exec(String(row || ''));
  if (!m) return 0;
  var nums = fbStrip_(m[1]).match(/\d{1,3}/g) || [];
  if (nums.length < 3) return 0;
  var w = String(wdl || '').toUpperCase();
  var i = (w === '1') ? 0 : (w === 'X') ? 1 : (w === '2') ? 2 : -1;
  if (i < 0) return 0;
  var n = Number(nums[i]);
  return (n >= 1 && n <= 100) ? n : 0;
}

/** ราคา — ของเขาเป็นแบบอเมริกันได้ (-118) กฎข้อ 6 ห้ามแปลง ไม่ใช่ทศนิยมก็ปล่อย 0
    และต้องอ่านจากช่องราคาเท่านั้น (เลข 2.74 ในแถวคือ "ค่าเฉลี่ยประตู" หน้าตาเหมือนราคามาก) */
function fbOdds_(row) {
  var m = /class="[^"]*prmod[^"]*"[^>]*>([\s\S]{0,400}?)<\/div>/i.exec(String(row || ''));
  if (!m) return 0;
  var n = /(?:^|[^\d.])([1-9]\d?\.\d{2})(?!\d)/.exec(fbStrip_(m[1]));
  if (!n) return 0;
  var v = Number(n[1]);
  return (v >= 1.01 && v <= 99.99) ? v : 0;
}

/** อ่าน 1 กล่องให้จบ — อ่านชื่อทีมไม่ได้ = คืน null (ถือว่าไม่ได้ของ)
    ที่เหลืออ่านไม่ได้ = ปล่อยว่าง ยังนับว่าได้ของ */
function fbParseOne_(html, kind) {
  var w = fbWindow_(html, kind);
  if (!w.found) return null;
  var t = fbTeams_(w.raw);
  if (!t) return null;
  var id = fbMatchId_(w.raw);
  var row = fbRowById_(html, id);
  var wdl = fbWdl_(w.raw) || fbWdl_(row);
  return {
    'ช่อง': kind,
    'ลีก': fbLeague_(w.raw),
    'ทีมเหย้า': t.home,
    'ทีมเยือน': t.away,
    'วันที่': fbDate_(w.raw),
    'เวลาเตะ': '',              /* ไม่รู้เขตเวลาของเขาแน่ชัด = ไม่กรอก ดีกว่ากรอกผิด */
    'เวลาที่เขาโชว์': fbWhenText_(w.raw),
    'เดาผล': wdl,
    'เดาสกอร์': fbScore_(row),
    'เปอร์เซ็นต์': fbPct_(row, wdl),
    'ราคา': fbOdds_(row),
    'รหัสคู่': id,
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
