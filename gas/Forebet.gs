/* Forebet.gs — ดึง "Featured match" กับ "Pick of the day" มาแช่แข็งไว้
   เหตุผลที่ต้องแช่: forebet เปลี่ยนคู่บ่อยมาก ถ้าไม่จดไว้ ตอนกลับมาดูก็ไม่เหลือของเดิม

   กฎของไฟล์นี้
   1) ดึงไม่ได้ / อ่านไม่ออก = "ไม่ทำอะไรเลย" ของเก่าบนหน้า 1 ต้องอยู่ครบเหมือนเดิม
      (ห้ามลบ ห้ามเขียนทับด้วยของว่าง)
   2) คู่เดิมยังขึ้นอยู่ = ไม่จดซ้ำ และ "ไม่อัปเดตตัวเลขของแถวเก่า"
      เพราะเจ้าของขอภาพ ณ ตอนนั้น ไม่ใช่ตัวเลขล่าสุด
   3) ตัวอ่านห้ามยึดชื่อ class ของเว็บเขาอย่างเดียว — เขาแก้หน้าเว็บเมื่อไหร่ก็พังเมื่อนั้น
      จึงอ่าน 2 ชั้น: ชั้นแรกยึด class ชั้นสองยึด "ข้อความที่ถอด tag ออกแล้ว"
   4) เวลาเตะ: เจ้าของสั่งให้ใช้เวลาไทย = เวลาที่หน้าเว็บโชว์ + 7 ชม.
      (ปรับได้ที่ Script Property FB_TZ_SHIFT · ของต้นทางยังเก็บดิบไว้ในช่อง 'เวลาที่เขาโชว์')
   5) ยิงตรงไปหา forebet โดน Cloudflare กั้น (403) — ทางที่ผ่านคือให้ Jina เปิดหน้าแทน */

var FB_URLS = [
  'https://www.forebet.com/en',
  'https://www.forebet.com/en/football-tips-and-predictions-for-today'
];

var FB_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/* forebet ปิดประตูใส่ IP ที่ไม่ใช่คนจริง (Cloudflare ตอบ 403) — วัดแล้วยิงตรงไม่ผ่าน
   ทางที่ผ่าน = ให้ Jina เปิดหน้าแทนเรา
   สำคัญ: ต้องขอ 'html' ด้วย ไม่งั้น Jina คืน markdown ที่ไม่มี microdata = ตัวอ่านตาบอด
   เปลี่ยน/ปิดได้จาก Script Property FB_PROXY (ใส่ '-' = ปิด ยิงตรงอย่างเดียว) */
var FB_PROXY = 'https://r.jina.ai/';

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

/** ลิงก์หน้าของคู่นั้นเอง — ในกล่องปักหมุดมีให้ (itemprop="url")
    ต้องมี เพราะเปอร์เซ็นต์กับสกอร์ที่เดา "ไม่ได้อยู่ในกล่อง" และคู่ปักหมุดก็ไม่โผล่ในตารางใหญ่
    (วัดแล้ว: รหัสคู่ 2526629/2476034 ปรากฏเฉพาะในกล่อง ไม่มีในตารางหน้าแรกเลย)
    -> ทางเดียวที่ได้ของครบคือตามลิงก์นี้ไปเปิดหน้าของคู่ ตามที่เจ้าของสั่งไว้ */
function fbMatchUrl_(raw) {
  var m = /href="(\/en\/football\/matches\/[^"]{5,180})"/i.exec(String(raw || ''));
  if (!m) return '';
  return 'https://www.forebet.com' + fbClean_(m[1]);
}

/** ชื่อลีกเต็มจาก getstag(...) — ให้รหัสคู่มาด้วยจะยึดของคู่นั้นเป๊ะๆ
    (แถวในตารางใหญ่ 1 ก้อนมี getstag ของคู่อื่นปนมาได้ ห้ามหยิบมั่ว) */
function fbLeagueFull_(raw, id) {
  var s = String(raw || '');
  var want = String(id || '').replace(/[^0-9]/g, '');
  var re = /getstag\(\s*this\s*,\s*(\d{4,12})\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*\)/gi;
  var m;
  while ((m = re.exec(s))) {
    if (want && m[1] !== want) continue;
    var name = fbClean_(m[3]) || fbClean_(m[2]);
    if (name) return name;         /* ค่าว่างข้ามไป หาตัวถัดไปต่อ */
  }
  return '';
}

/** ชื่อลีก — เขาฝังไว้ในพารามิเตอร์ของ getstag(...)
    🪤 กล่องปักหมุดบางใบเขาส่งค่าว่างมา `getstag(this,2528659,'','','','co')`
       ทั้งที่แถวเดียวกันในตารางใหญ่มีครบ `'Colombia','Primera A'`
       -> ตามรหัสคู่ไปหยิบจากแถวใหญ่ก่อน (วิธีเดียวกับสกอร์/เปอร์เซ็นต์)
    หมดทุกทางค่อยใช้ตัวย่อที่หน้าเว็บโชว์จริง เช่น Co1 */
function fbLeague_(raw, row, id) {
  var full = fbLeagueFull_(raw, id) || fbLeagueFull_(row, id);
  if (full) return full;
  var s = String(raw || '');
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

/** วัน-เวลาตามที่หน้าเว็บเขาโชว์เป๊ะๆ ไม่แปลงอะไรทั้งนั้น — เก็บไว้เป็นหลักฐานต้นทาง */
function fbWhenText_(raw) {
  var m = /class="[^"]*date_bah[^"]*"[^>]*>\s*([^<]{5,30}?)\s*</i.exec(String(raw || ''));
  return m ? fbClean_(m[1]) : '';
}

/* เจ้าของสั่ง: ใช้เวลาไทย = บวก 7 จากเวลาที่หน้าเว็บโชว์
   แก้ตัวเลขได้จาก Script Property FB_TZ_SHIFT (เผื่อ forebet เปลี่ยนค่าเริ่มต้นของเขา)
   ของเดิมที่เขาโชว์ยังเก็บไว้ทั้งดุ้นในช่อง 'เวลาที่เขาโชว์' เทียบกันได้ตลอด */
var FB_TZ_SHIFT = 7;

/** เวลาไทยเร็วกว่า UTC 7 ชม. — ค่าคงที่ของโลก ไม่ใช่ค่าปรับได้ ห้ามเอาไปปนกับ FB_TZ_SHIFT */
var TH_UTC_OFFSET = 7;

/** วันของคู่ ต้องมาจาก "ข้อความก้อนเดียวกับเวลา" ก่อนเสมอ
    ทำไมไม่เอา startDate: มันอยู่คนละชิ้นกับเวลา เวลาเราตัดหน้ามาเป็นก้อน 4000 ตัว
    ก้อนมันคาบเอา startDate ของคู่ถัดไปมาด้วย -> วันเพี้ยนไป 1 วัน แต่เวลาถูก
    (ของจริง 26 ส.ค. 69: Admira Praha หน้าเว็ปเขียน 26/08/2026 17:30 แต่การ์ดขึ้น 27/8)

    เขาสลับ วัน/เดือน ไปมาได้จริง (วัดมาแล้ว ทั้ง 26/08/2026 และ 08/26/2026)
    -> เอาเฉพาะแบบที่ "เป็นวันจริงได้" ถ้าเป็นได้ทั้งคู่ ค่อยให้ startDate ชี้ขาด
    อ่านวันจากข้อความไม่ออก = ถอยกลับไปใช้ startDate เหมือนเดิม */
function fbTextDate_(text, dateIso) {
  var iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso || ''));
  var base = iso ? { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) } : null;
  var m = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(String(text || ''));
  if (!m) return base;

  var y = Number(m[3]), a = Number(m[1]), b = Number(m[2]);
  var cand = [];
  if (b >= 1 && b <= 12 && a >= 1 && a <= 31) cand.push({ y: y, m: b, d: a });   /* วัน/เดือน */
  if (a >= 1 && a <= 12 && b >= 1 && b <= 31) cand.push({ y: y, m: a, d: b });   /* เดือน/วัน */
  if (!cand.length) return base;

  if (cand.length > 1 && base) {
    for (var i = 0; i < cand.length; i++) {
      if (cand[i].y === base.y && cand[i].m === base.m && cand[i].d === base.d) return cand[i];
    }
  }
  return cand[0];   /* กำกวมจริงๆ = เอา วัน/เดือน เว็ปยุโรป */
}

/** เวลาไทยของคู่นี้ = วัน-เวลาที่เขาโชว์ + FB_TZ_SHIFT ชม.
    อ่านไม่ออก = คืน null ปล่อยว่าง ห้ามเดาเวลาขึ้นมาเอง */
function fbWhenLocal_(dateIso, text, shift) {
  var d = fbTextDate_(text, dateIso);
  if (!d) return null;
  var m = /(\d{1,2}):(\d{2})\s*([AaPp])?/.exec(String(text || ''));
  if (!m) return null;
  var hh = Number(m[1]), mm = Number(m[2]), ap = (m[3] || '').toUpperCase();
  if (ap === 'P' && hh < 12) hh += 12;
  if (ap === 'A' && hh === 12) hh = 0;
  if (hh > 23 || mm > 59) return null;

  /* ไม่ได้ตั้งค่าไว้ = ใช้ 7 · ระวัง prop_ คืน '' ได้ ซึ่ง Number('') = 0 (เท่ากับไม่บวกเลย) */
  var h = (shift === undefined || shift === null || String(shift).trim() === '')
            ? FB_TZ_SHIFT : Number(shift);
  if (!isFinite(h)) h = FB_TZ_SHIFT;

  var t = Date.UTC(d.y, d.m - 1, d.d, hh, mm) + h * 3600000;
  var z = new Date(t);
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  return {
    date: z.getUTCFullYear() + '-' + p2(z.getUTCMonth() + 1) + '-' + p2(z.getUTCDate()),
    time: p2(z.getUTCHours()) + ':' + p2(z.getUTCMinutes())
  };
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

/** เปอร์เซ็นต์ทั้งชุด 1/X/2 -> "42/38/20" (เจ้าของสั่งให้โชว์ครบ ไม่ใช่ตัวเดียว)
    ไม่ครบ 3 ตัว = ปล่อยว่างทั้งช่อง ห้ามตัดมาครึ่งๆ ให้คนอ่านเดาเอง */
function fbPct3_(row) {
  var m = /class="[^"]*fprc[^"]*"[^>]*>([\s\S]{0,200}?)<\/div>/i.exec(String(row || ''));
  if (!m) return '';
  var nums = fbStrip_(m[1]).match(/\d{1,3}/g) || [];
  if (nums.length < 3) return '';
  return nums[0] + '/' + nums[1] + '/' + nums[2];
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

/* ---------- 3 ตลาดจากหน้าของคู่นั้นเอง ---------- */
/* เจ้าของสั่ง: "เอาแต่เรท Over · BTTS เอาแต่เรท YES · HT เอาทุกค่า"
   หน้าของคู่มีตารางแยกตามตลาด แต่ละแถวปักป้ายไว้ที่ปุ่มราคา:
       getHodd(this,<รหัสคู่>,'uo')  = สูง/ต่ำ 2.5
       getHodd(this,<รหัสคู่>,'gg')  = ทั้งสองทีมยิง
       getHodd(this,<รหัสคู่>,'ht1') = ครึ่งแรก 1X2
   วัดจากหน้าจริง 2 หน้า: ป้ายนี้โผล่หน้าละครั้งเดียวต่อ 1 ตลาด จึงชี้ตรงตัวได้เลย
   เลขที่ "โชว์อยู่" คือเรทของฝั่งที่เขาเดา (ตรงกันทั้ง 2 หน้า) อีกฝั่งซ่อนใน .haodd */
var FB_MKT_HEAD = 900;   /* ย้อนหาคำเดา/เปอร์เซ็นต์ — วัดแล้วไกลสุด 463 ตัวอักษร */
var FB_MKT_TAIL = 300;   /* เอาแค่ของแถวนี้ — วัดแล้ว haodd อยู่ที่ +60..64 ส่วนแถวถัดไป +1000 ขึ้นไป */

/** แกะ 1 ตลาด คืน { pred, probs, odds, alt } · ไม่เจอป้าย = null */
function fbMarket_(html, id, market) {
  var s = String(html || ''), key = String(id || '');
  if (!key) return null;
  var at = s.indexOf("getHodd(this," + key + ",'" + market + "')");
  if (at < 0) return null;
  var head = s.slice(Math.max(0, at - FB_MKT_HEAD), at);
  var tail = s.slice(at, at + FB_MKT_TAIL);

  var pred = '', fi = head.lastIndexOf('class="forepr');
  if (fi >= 0) {
    var pm = /<span>([\s\S]{0,60}?)<\/span>/i.exec(head.slice(fi));
    if (pm) pred = fbClean_(fbStrip_(pm[1]));
  }

  /* fbStrip_ เปลี่ยนแท็กเป็น "ช่องว่าง" เลขจึงไม่ติดกัน (12 17 71 ไม่ใช่ 121771) */
  var probs = [], ci = head.lastIndexOf('fprc');
  if (ci >= 0) {
    var blk = head.slice(ci), e = blk.indexOf('</div>');
    probs = fbStrip_(e >= 0 ? blk.slice(0, e) : blk).match(/\d{1,3}/g) || [];
  }

  var om = /^[^>]*>\s*([^<]{0,12}?)\s*<\/span>/.exec(tail);
  var odds = om ? fbClean_(om[1]) : '';

  var alt = [], hi = tail.indexOf('haodd');
  if (hi >= 0) {
    var hb = tail.slice(hi), he = hb.indexOf('</div>');
    if (he >= 0) hb = hb.slice(0, he);
    var re = /<span>([\s\S]{0,20}?)<\/span>/gi, x;
    while ((x = re.exec(hb))) { var v = fbClean_(fbStrip_(x[1])); if (v) alt.push(v); }
  }
  return { pred: pred, probs: probs, odds: odds, alt: alt };
}

/** เรทของ "ฝั่งที่เราอยากได้" (want = คำที่เขาใช้เรียกฝั่งนั้น เช่น Over / Yes)
    เขาเดาฝั่งเดียวกับเรา = เลขที่โชว์คือของเรา
    เขาเดาอีกฝั่ง       = ของเราคือตัวที่เหลือใน haodd หลังตัดเลขที่โชว์ออก
    ห้ามยึด "ตำแหน่ง" ใน haodd เพราะยังไม่ได้วัดว่ามันเรียงคงที่จริง
    อ่านคำเดาไม่ออก / ไม่มีอีกฝั่งให้เทียบ = คืนว่าง ดีกว่าเดาผิดฝั่ง (กฎข้อ 6) */
function fbSideOdds_(mkt, want) {
  if (!mkt) return '';
  var pred = String(mkt.pred || '').toLowerCase();
  if (!pred) return '';
  if (pred === String(want || '').toLowerCase()) return String(mkt.odds || '');
  var alt = (mkt.alt || []).slice(), hit = alt.indexOf(String(mkt.odds || ''));
  if (hit >= 0) alt.splice(hit, 1);
  return alt.length === 1 ? alt[0] : '';
}

/** ครึ่งแรก — เจ้าของสั่ง "เอาทุกค่า" = ผลที่เดา + เปอร์เซ็นต์ 1/X/2 + เรท
    เปอร์เซ็นต์ไม่ครบ 3 ตัว = ปล่อยว่างทั้งช่อง ไม่ตัดมาครึ่งๆ */
function fbHtOut_(mkt) {
  var out = { pred: '', pct: '', odds: '' };
  if (!mkt) return out;
  out.pred = String(mkt.pred || '');
  out.odds = String(mkt.odds || '');
  var p = mkt.probs || [];
  if (p.length >= 3) out.pct = p[0] + '/' + p[1] + '/' + p[2];
  return out;
}

/** ตลาด 2 ทาง (uo / gg) เรียง [ฝั่งลบ, ฝั่งบวก] เสมอ — วัดจากหัวตารางจริง:
    "Under/Over 2.5" กับ "No Yes" · ไม่ครบ 2 ตัว = ไม่รู้ว่าตัวไหนของใคร ปล่อยว่าง */
function fbSidePct_(mkt, idx) {
  if (!mkt) return '';
  var p = mkt.probs || [];
  return p.length === 2 ? String(p[idx]) : '';
}

/** ดับเบิลชานซ์ (dbc) — หัวตารางคือ "Prob. % 1X/2X/12 Pred"
    เขาให้เปอร์เซ็นต์ตัวเดียวคู่กับคำเดา 1 คำ · บางหน้าคำเดาเขียนติดกันแบบ "21"
    จดตามที่เห็น ห้ามแปลงเป็น 12/2X เอง (กฎข้อ 6 ห้ามเดา) */
function fbDbOut_(mkt) {
  var out = { pct: '', pred: '' };
  if (!mkt) return out;
  var p = mkt.probs || [];
  if (p.length >= 1) out.pct = String(p[0]);
  out.pred = String(mkt.pred || '');
  return out;
}

/** ครึ่งแรก/เต็มเวลา (ht) — หัวตารางคือ "HТ/FT Probability % Pred HT FT"
    แถวนี้มีคำเดา 2 ตัวติดกัน: ครึ่งแรกอยู่ในกล่อง prht แล้วตามด้วยเต็มเวลา
    fbMarket_ ย้อนหา forepr "ตัวท้าย" จึงได้แต่เต็มเวลา — ครึ่งแรกต้องอ่านเองที่นี่
    ได้ไม่ครบ 2 ตัว = ปล่อยว่าง ไม่โชว์ครึ่งเดียวให้เข้าใจผิดว่าเป็นทั้งคู่ */
function fbHtFt_(html, id) {
  var out = { pct: '', ht: '', ft: '' };
  var mkt = fbMarket_(html, id, 'ht');
  if (!mkt) return out;
  var p = mkt.probs || [];
  if (p.length >= 1) out.pct = String(p[0]);
  out.ft = String(mkt.pred || '');
  var s = String(html || ''), at = s.indexOf("getHodd(this," + String(id || '') + ",'ht')");
  if (at < 0) return out;
  var head = s.slice(Math.max(0, at - FB_MKT_HEAD), at);
  var hi = head.lastIndexOf('prht');
  if (hi >= 0) {
    var m = /class="[^"]*forepr[^"]*"[^>]*>([\s\S]{0,60}?)<\/span>/i.exec(head.slice(hi));
    if (m) out.ht = fbClean_(fbStrip_(m[1]));
  }
  return out;
}

/** เติมตลาดจากหน้าของคู่ลง snap — ไม่มีตลาดไหนก็ปล่อยช่องนั้นว่าง ห้ามทำของเดิมพัง */
function fbFillMarkets_(snap, html) {
  var id = snap['รหัสคู่'];
  var uo = fbMarket_(html, id, 'uo');
  snap['เรท Over'] = fbSideOdds_(uo, 'Over');
  snap['Over %'] = fbSidePct_(uo, 1);
  var gg = fbMarket_(html, id, 'gg');
  snap['เรท BTTS YES'] = fbSideOdds_(gg, 'Yes');
  snap['BTTS YES %'] = fbSidePct_(gg, 1);
  var ht = fbHtOut_(fbMarket_(html, id, 'ht1'));
  snap['HT เดาผล'] = ht.pred;
  snap['HT %'] = ht.pct;
  snap['HT เรท'] = ht.odds;
  var db = fbDbOut_(fbMarket_(html, id, 'dbc'));
  snap['DB %'] = db.pct;
  snap['DB เดาผล'] = db.pred;
  var hf = fbHtFt_(html, id);
  snap['HT/FT %'] = hf.pct;
  snap['HT/FT เดาผล'] = (hf.ht && hf.ft) ? (hf.ht + '/' + hf.ft) : '';
  return snap;
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
  var shown = fbWhenText_(w.raw);
  var src = fbDate_(w.raw);
  var thai = fbWhenLocal_(src, shown, prop_('FB_TZ_SHIFT'));
  return {
    'ช่อง': kind,
    'ลีก': fbLeague_(w.raw, row, id),
    /* ชื่อเต็มล้วนๆ (ว่างได้) — ตัวซ่อมแถวเก่าใช้ตัวนี้เท่านั้น ห้ามใช้ 'ลีก' ที่อาจเป็นตัวย่อ */
    'ลีกเต็ม': fbLeagueFull_(w.raw, id) || fbLeagueFull_(row, id),
    'ทีมเหย้า': t.home,
    'ทีมเยือน': t.away,
    'วันที่': thai ? thai.date : src,
    'เวลาเตะ': thai ? thai.time : '',   /* เวลาไทย · อ่านเวลาต้นทางไม่ออกก็ปล่อยว่าง ห้ามเดา */
    'เวลาที่เขาโชว์': shown,
    'เดาผล': wdl,
    'เดาสกอร์': fbScore_(row),
    'เปอร์เซ็นต์': fbPct_(row, wdl),
    '1X2 %': fbPct3_(row),
    'ราคา': fbOdds_(row),
    'รหัสคู่': id,
    'ลิงก์': fbMatchUrl_(w.raw),
    'อ่านทีมจาก': t.how
  };
}
/* ---------- ทางเน็ต ---------- */

function fbFetch_(url, via) {
  var head = {
    'User-Agent': FB_UA,
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9'
  };
  var target = url;
  if (via) {
    target = via + url;
    head['X-Return-Format'] = 'html';   /* ขาดบรรทัดนี้ = ได้ markdown อ่านไม่ออก */
    /* ทางอ้อมแบบไม่มีบัตร เขาจำกัดจำนวนครั้ง "ต่อ IP" ซึ่ง IP ของ Google ใช้ร่วมกันทั้งโลก
       ไม่มีบัตรจึงมีสิทธิ์โดนปฏิเสธ (429) เป็นพักๆ โดยที่ของเราไม่ได้ผิดอะไรเลย
       มีบัตรเมื่อไหร่ก็ใส่ที่ Script Property ชื่อ JINA_KEY — ไม่ใส่ก็ทำงานได้เหมือนเดิม
       (ห้ามเขียนบัตรลงไฟล์ ที่นี่อ่านจาก Property อย่างเดียว) */
    var jk = prop_('JINA_KEY');
    if (jk) head['Authorization'] = 'Bearer ' + jk;
  }
  var res = UrlFetchApp.fetch(target, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    headers: head
  });
  return { code: res.getResponseCode(), body: res.getContentText() };
}

/** ของที่ได้มา "ใช่หน้า forebet จริงไหม"
    กันเคสร้าย: Cloudflare ตอบ 200 แต่เป็นหน้าให้รอ/ให้กดยืนยัน ยาวเกิน 1000 ตัวเหมือนกัน
    ถ้าไม่เช็ก จะนับว่าสำเร็จแล้วไปตายตอนอ่าน = รายงานบอกว่า "อ่านไม่ออก" ทั้งที่ต้นเหตุคือโดนกั้น */
function fbLooksLikePage_(body) {
  var s = String(body || '');
  if (s.length < 1000) return false;
  return s.indexOf('itemprop="homeTeam"') >= 0 ||
         s.indexOf(FB_ANCHOR.FEATURED) >= 0 ||
         s.indexOf(FB_ANCHOR.POTD) >= 0;
}

/** ทางอ้อมที่จะใช้ — '' = ไม่อ้อม ('-' ใน Script Property คือเจ้าของสั่งปิด) */
function fbProxy_() {
  var proxy = prop_('FB_PROXY');
  if (proxy === null || proxy === undefined || proxy === '') proxy = FB_PROXY;
  return (proxy === '-') ? '' : proxy;
}

/** ไล่ยิงทีละทางจนกว่าจะได้ 200 ที่เป็นหน้าจริง — ทุกทางพังก็คืนอันสุดท้ายไปเป็นหลักฐาน */
function fbTryWays_(ways) {
  var last = { url: '', via: '', code: 0, body: '', trail: '', why: '' };
  /* จดผลของ "ทุกทาง" ไม่ใช่แค่ทางสุดท้าย — ของเดิมทับกันจนเหลือทางท้ายแถวทางเดียว
     รายงานจึงชี้ไปที่ "ยิงตรง" ทุกครั้ง ทั้งที่ต้นเหตุจริงอยู่ที่ทางอ้อมที่ลองไปก่อนหน้า
     รูปแบบสั้นๆ: อ้อม:429,ตรง:ล้ม — พอให้รู้ว่าใครปิดประตูใส่เรา */
  var trail = [];
  for (var k = 0; k < ways.length; k++) {
    var tag = ways[k].via ? 'อ้อม' : 'ตรง';
    try {
      var r = fbFetch_(ways[k].url, ways[k].via);
      var body = r.body || '';
      var real = fbLooksLikePage_(body);
      trail.push(tag + ':' + r.code + (r.code === 200 && !real ? '(ไม่ใช่หน้า)' : ''));
      last = { url: ways[k].url, via: ways[k].via, code: r.code, body: body,
               trail: trail.join(','), why: '' };
      if (r.code === 200 && real) return last;
    } catch (err) {
      var msg = String(err && err.message ? err.message : err);
      trail.push(tag + ':ล้ม');
      last = { url: ways[k].url, via: ways[k].via, code: -1, body: msg,
               trail: trail.join(','), why: msg.slice(0, 120) };
    }
  }
  last.trail = trail.join(',');
  return last;
}

function fbFetchAny_() {
  var urls = prop_('FOREBET_URL') ? [prop_('FOREBET_URL')] : FB_URLS;
  var proxy = fbProxy_();
  /* อ้อมก่อน แล้วค่อยยิงตรง — กลับทางจากของเดิมเพราะวัดจริงแล้วว่า IP ของ Google
     โดน Cloudflare ปิดประตู 403 "ทุกครั้ง" ยิงตรงก่อนจึงไม่ใช่ทางลัด แต่เป็นการทิ้งเวลาฟรี
     2 นัดต่อรอบ ซึ่งไปเบียดเวลาของหน้าที่ยังต้องเปิดต่ออีก 2 หน้า
     ยิงตรงยังเก็บไว้ท้ายแถว เผื่อวันหนึ่งเขาเลิกกั้น */
  var ways = [], i;
  if (proxy) for (i = 0; i < urls.length; i++) ways.push({ url: urls[i], via: proxy });
  for (i = 0; i < urls.length; i++) ways.push({ url: urls[i], via: '' });
  return fbTryWays_(ways);
}

/** เปิด "หน้าของคู่" 1 หน้า — ทางเดียวกับหน้าแรกเป๊ะ (ตรงก่อน ไม่ผ่านค่อยอ้อม)
    ลิงก์ของเขามีตัวอักษรนอก ASCII ได้ (boyacá-chicó...) ต้องเข้ารหัสก่อนส่ง ไม่งั้นยิงไม่ออก */
function fbFetchMatch_(url) {
  var u = String(url || '');
  if (!/^https:\/\/www\.forebet\.com\//.test(u)) return { code: 0, body: '', url: u, via: '' };
  try { u = encodeURI(u); } catch (err) { /* เข้ารหัสไม่ได้ก็ส่งของเดิม */ }
  var proxy = fbProxy_(), ways = [];
  if (proxy) ways.push({ url: u, via: proxy });   /* อ้อมก่อน เหตุผลเดียวกับหน้าแรก */
  ways.push({ url: u, via: '' });
  return fbTryWays_(ways);
}

/* ---------- ตามไปเปิดหน้าของคู่ เอา 1X2 กับสกอร์ที่เดา ---------- */

/** กล่องปักหมุดให้มาแค่ ทีม/ลีก/เวลา/ผลที่เขาเดา (1 X หรือ 2)
    "เปอร์เซ็นต์" กับ "สกอร์ที่เดา (0-?)" ไม่มีในกล่อง และคู่ปักหมุดก็ไม่โผล่ในตารางใหญ่ของหน้าแรก
    -> ต้องเปิดหน้าของคู่เอง แล้วอ่านจากแถวแรกที่เป็นตาราง 1X2

    ระวัง: หน้าของคู่มีคู่เดิมซ้ำหลายแถว (แท็บ 1X2 / Btts / Handicap / Corners / Cards)
    แถวแรกคือ 1X2 · แท็บอื่นเลขคนละความหมาย หยิบผิดแท็บ = เปอร์เซ็นต์มั่วแบบเนียนๆ
    จึงกันไว้ 2 ชั้น: ต้องเป็นแถวของ "คู่เดียวกัน" และต้องมีเลข 3 ตัว (1/X/2) เท่านั้น

    อ่านไม่ได้ = ปล่อยของเดิม ห้ามล้มทั้งงาน (กฎข้อ 1) */
function fbEnrich_(snap) {
  if (!snap) return snap;
  /* 3 ตลาดท้าย (Over/BTTS/HT) มีที่หน้าของคู่เท่านั้น หน้าแรกไม่มี
     จึงต้องเปิดหน้าคู่เสมอ ถึงจะข้ามได้ก็ต้องมีครบทั้ง 3 อย่าง */
  if (snap['เปอร์เซ็นต์'] && snap['เดาสกอร์'] && snap['HT เรท'] && snap['HT/FT %']) return snap;

  var url = snap['ลิงก์'];
  if (!url) { snap['เปิดหน้าคู่'] = 'ไม่มีลิงก์'; return snap; }

  var got;
  try { got = fbFetchMatch_(url); } catch (err) { got = { code: -1, body: '' }; }
  if (got.code !== 200 || !fbLooksLikePage_(got.body)) {
    snap['เปิดหน้าคู่'] = 'เปิดไม่ได้ (' + got.code + ')';
    return snap;
  }

  /* ต้องเติมก่อนด่าน fbRowById_ — ป้ายของตลาดฝังรหัสคู่ไว้ในตัวมันเอง
     จึงเป็นของคู่นี้แน่ ไม่ต้องรอด่านที่เอาไว้กันหยิบแถวผิดคู่ */
  fbFillMarkets_(snap, got.body);

  var row = fbRowById_(got.body, snap['รหัสคู่']);
  if (!row) { snap['เปิดหน้าคู่'] = 'ไม่เจอแถวของคู่นี้'; return snap; }

  var t = fbTeams_(row);
  if (!t || t.home !== snap['ทีมเหย้า'] || t.away !== snap['ทีมเยือน']) {
    snap['เปิดหน้าคู่'] = 'แถวที่เจอเป็นคนละคู่';   /* กันหยิบของคู่อื่นมาใส่ */
    return snap;
  }

  var wdl = snap['เดาผล'] || fbWdl_(row);
  if (!snap['เดาผล'] && wdl) snap['เดาผล'] = wdl;
  if (!snap['เดาสกอร์']) snap['เดาสกอร์'] = fbScore_(row);
  if (!snap['เปอร์เซ็นต์']) snap['เปอร์เซ็นต์'] = fbPct_(row, wdl);
  if (!snap['1X2 %']) snap['1X2 %'] = fbPct3_(row);
  if (!snap['ราคา']) snap['ราคา'] = fbOdds_(row);
  snap['เปิดหน้าคู่'] = 'ได้';
  return snap;
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
    'สร้างเมื่อ': stamp,
    'เรท Over': snap['เรท Over'],
    'เรท BTTS YES': snap['เรท BTTS YES'],
    'HT เดาผล': snap['HT เดาผล'],
    'HT %': snap['HT %'],
    'HT เรท': snap['HT เรท'],
    '1X2 %': snap['1X2 %'],
    'Over %': snap['Over %'],
    'BTTS YES %': snap['BTTS YES %'],
    'DB %': snap['DB %'],
    'DB เดาผล': snap['DB เดาผล'],
    'HT/FT %': snap['HT/FT %'],
    'HT/FT เดาผล': snap['HT/FT เดาผล']
  };
  var row = [];
  for (var i = 0; i < HEADERS.PICKS.length; i++) row.push(vals[HEADERS.PICKS[i]] === undefined ? '' : vals[HEADERS.PICKS[i]]);
  sh.appendRow(row);
  return vals['ID'];
}

/* ---------- ด่านกันลงซ้ำ ---------- */
/* เจ้าของสั่ง: "ห้ามลงชีตคู่ที่ซ้ำเด็ดขาด · ตรวจก่อนค่อยลง"
   ของเดิมเทียบแค่ "แถวล่าสุดของช่องเดียวกัน" ซึ่งรั่ว 3 ทาง:
     1) คู่ A -> คู่ B -> คู่ A กลับมา = ลงซ้ำ (เพราะแถวล่าสุดตอนนั้นเป็น B)
     2) คู่เดียวกันโผล่ทั้ง Featured และ Pick of the day = ลงซ้ำคนละช่อง
     3) รอบเดียวกันอ่านได้ 2 กล่องเป็นคู่เดียวกัน = ลงซ้ำในรอบเดียว
   ตอนนี้ดึงทุกครั้งที่เปิดหน้า ทั้ง 3 ทางเกิดจริงแน่ จึงเทียบกับ "ทั้งชีต" ไม่ใช่แถวเดียว */

/** วันที่จากชีต -> 'YYYY-MM-DD'
    ชีตคืนช่องวันที่มาเป็น Date ไม่ใช่ข้อความ (ถึงจะสั่ง TEXT_COLS ไว้ก็ตาม —
    แถวเก่าที่เคยลงก่อนสั่งก็ยังเป็น Date อยู่ดี) ถ้าเทียบเป็นข้อความตรงๆ
    จะได้ "Wed Aug 26 2026 ..." ซึ่งไม่มีวันตรงกับ "2026-08-26" -> ด่านกันซ้ำหลุดทันที */
function fbYmd_(v) {
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return v.getFullYear() + '-' + p2(v.getMonth() + 1) + '-' + p2(v.getDate());
  }
  var m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(v === null || v === undefined ? '' : v));
  return m ? m[0] : '';
}

/** เวลาจากชีต -> 'HH:MM' (ชีตกลืนเป็น Date ได้เหมือนกัน) */
function fbHm_(v) {
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return p2(v.getHours()) + ':' + p2(v.getMinutes());
  }
  var m = /^(\d{1,2}):(\d{2})/.exec(String(v === null || v === undefined ? '' : v).trim());
  return m ? p2(Number(m[1])) + ':' + m[2] : '';
}

/** กุญแจของคู่ = ทีมเหย้า|ทีมเยือน
    ไม่เอา 'ช่อง' มาเป็นส่วนของกุญแจ เพราะคู่เดียวกันโผล่คนละช่องก็ยังนับว่าซ้ำ
    ไม่เอา 'วันที่' มารวมด้วย เพราะหน้าเว็บเขาโชว์วันที่สลับ วัน/เดือน ได้ (วัดมาแล้ว)
    คู่เดียวกันจึงอาจได้วันคลาดกัน 1 วัน แล้วเล็ดลอดด่านไปลงซ้ำ
    ใช้รหัสคู่ไม่ได้ เพราะชีตไม่มีคอลัมน์นั้น (เจ้าของสั่งพักเรื่องเพิ่มคอลัมน์ไว้ก่อน) */
function fbKey_(o) {
  if (!o) return '';
  function n(v) { return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase(); }
  var h = n(o['ทีมเหย้า']), a = n(o['ทีมเยือน']);
  if (!h || !a) return '';
  return h + '|' + a;
}

/** มีคู่นี้ในชีตแล้วหรือยัง — ตรวจ "ทุกแถว" ไม่ใช่แถวล่าสุดของช่องนั้น
    นับว่าซ้ำเมื่อ ทีมตรงกัน และ (วันเดียวกัน หรือ ของเดิมยังไม่ถึงเวลาเตะ)
    -> คู่เดิมที่ยังไม่เตะ ห้ามลงซ้ำเด็ดขาด · ส่วนคู่ที่เตะจบไปแล้วนานๆ
       เจอกันใหม่รอบหน้า ยังลงได้ ไม่ถูกด่านนี้บล็อกทิ้ง
    อ่านชื่อทีมไม่ออก = ถือว่าซ้ำ (ไม่ลง) ดีกว่าลงขยะ */
/** ซ่อมช่อง "ลีก" ของแถวที่ลงชีตไปแล้ว — แก้ช่องเดียว ห้ามแตะคอลัมน์อื่น
    ทำไมยอมแตะแถวเก่า: ชื่อลีกไม่ใช่คำทำนายที่ต้องแช่เป็นภาพนิ่ง มันคือชื่อของคู่นั้นเอง
    ตอนที่กล่องปักหมุดส่งค่าว่างมา เราเลยได้ตัวย่อ `Co1` ติดชีตไป ทั้งที่ตารางใหญ่มี `Primera A`
    ด่านกันพัง: ชื่อใหม่ต้องมาจาก getstag ของตารางใหญ่ (ช่อง 'ลีกเต็ม') เท่านั้น
                ถ้ารอบนี้อ่านได้แค่ตัวย่อ = ไม่แตะ ของเดิมดีกว่าเสมอ */
function fbFixLeague_(snap) {
  var full = String((snap && snap['ลีกเต็ม']) || '').trim();
  var key = fbKey_(snap);
  if (!full || !key) return 0;
  var sh = sheetIfExists_(SHEETS.PICKS);
  if (!sh) return 0;
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return 0;
  var head = vals[0], col = -1;
  for (var c = 0; c < head.length; c++) if (String(head[c]) === 'ลีก') col = c;
  if (col < 0) return 0;
  var fixed = 0;
  for (var r = 1; r < vals.length; r++) {
    var o = {};
    for (var h = 0; h < head.length; h++) o[String(head[h])] = vals[r][h];
    if (fbKey_(o) !== key) continue;
    if (String(o['ลีก'] === null || o['ลีก'] === undefined ? '' : o['ลีก']).trim() === full) continue;
    sh.getRange(r + 1, col + 1, 1, 1).setValues([[full]]);
    fixed++;
  }
  return fixed;
}

/** ซ่อม "วันที่ / เวลาเตะ" ของแถวเก่า — ช่องที่ 2 ที่ยอมให้เขียนทับ ต่อจาก 'ลีก'
    เหตุผล: วันเพี้ยนไป 1 วัน = ดูผิดทั้งใบ (เจ้าของทักจริง 26 ส.ค. 69 คู่ Admira ขึ้นเป็น 27/8)
    แถวเก่าคำนวณใหม่จากในชีตไม่ได้ เพราะไม่มีช่องเก็บ 'เวลาที่เขาโชว์' -> ต้องรอรอบดึงใหม่มาซ่อมให้
    กันพลาด: ของใหม่ต้องมีค่า + ต้องไม่ตรงของเดิม + แถวที่มีสกอร์จริงแล้ว = จบไปแล้ว ห้ามแตะ */
function fbFixWhen_(snap) {
  var key = fbKey_(snap);
  var day = fbYmd_(snap && snap['วันที่']);
  var hm  = fbHm_(snap && snap['เวลาเตะ']);
  if (!key || (!day && !hm)) return 0;
  var sh = sheetIfExists_(SHEETS.PICKS);
  if (!sh) return 0;
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return 0;
  var head = vals[0], cd = -1, ct = -1;
  for (var c = 0; c < head.length; c++) {
    if (String(head[c]) === 'วันที่') cd = c;
    if (String(head[c]) === 'เวลาเตะ') ct = c;
  }
  if (cd < 0 && ct < 0) return 0;
  var fixed = 0;
  for (var r = 1; r < vals.length; r++) {
    var o = {};
    for (var h = 0; h < head.length; h++) o[String(head[h])] = vals[r][h];
    if (fbKey_(o) !== key) continue;
    if (String(o['สกอร์จริง'] === null || o['สกอร์จริง'] === undefined ? '' : o['สกอร์จริง']).trim()) continue;
    if (day && cd >= 0 && fbYmd_(o['วันที่']) !== day) {
      sh.getRange(r + 1, cd + 1, 1, 1).setValues([[day]]);
      fixed++;
    }
    if (hm && ct >= 0 && fbHm_(o['เวลาเตะ']) !== hm) {
      sh.getRange(r + 1, ct + 1, 1, 1).setValues([[hm]]);
      fixed++;
    }
  }
  return fixed;
}

function fbExists_(rows, snap, nowMs) {
  var key = fbKey_(snap);
  if (!key) return true;
  var now = nowMs || Date.now(), day = fbYmd_(snap && snap['วันที่']);
  for (var i = 0; i < (rows || []).length; i++) {
    if (fbKey_(rows[i]) !== key) continue;
    if (day && fbYmd_(rows[i]['วันที่']) === day) return true;
    var k = fbKickMs_(rows[i]);
    if (!k || k >= now) return true;      /* ของเดิมยังไม่เตะ = ตัวเดียวกัน */
  }
  return false;
}

/* ---------- งานจริง ---------- */

/** ดึง 1 รอบ — คืนรายงานว่าเกิดอะไรขึ้นบ้าง ไม่ throw ออกไปข้างนอก
    ล้มตรงไหนก็ตาม ของเก่าในชีตต้องไม่ถูกแตะ */
function fbSnapRun_() {
  var got = fbFetchAny_();
  var out = { ok: false, code: got.code, url: got.url, len: (got.body || '').length,
              trail: got.trail || '', why: got.why || '',
              added: [], skipped: [], fixed: [], missed: [] };
  out.via = got.via ? 'ผ่าน ' + got.via : 'ยิงตรง';
  /* ตรงนี้ตัดสินด้วย HTTP อย่างเดียวพอ — "หน้าใช่ไหม" เป็นเรื่องของ fbFetchAny_ ตอนเลือกทาง
     ถ้าเอามาตัดสินซ้ำตรงนี้ วันที่เขาแก้หน้าเว็บจะรายงานว่า "ดึงไม่ได้" ทั้งที่ดึงได้แต่แกะไม่ออก */
  if (got.code !== 200 || out.len < 1000) {
    out.error = 'ดึงหน้าเว็บไม่ได้ (' + got.code + ' · ' + out.via + ')';
    return fbSaveReport_(out);
  }

  var rows = readObjects_(SHEETS.PICKS);
  var stamp = nowIso_();
  var kinds = [FB_KIND.FEATURED, FB_KIND.POTD];
  for (var i = 0; i < kinds.length; i++) {
    var kind = kinds[i], snap;
    try { snap = fbParseOne_(got.body, kind); } catch (err) { snap = null; }
    if (!snap) { out.missed.push(kind); continue; }
    /* ตรวจก่อนค่อยลง — ตรวจ "ทั้งชีต" ไม่ใช่แค่แถวล่าสุดของช่องนี้
       และตรวจก่อนเปิดหน้าคู่ด้วย จะได้ไม่เสียเวลายิงเน็ตฟรีๆ กับคู่ที่มีอยู่แล้ว */
    if (fbExists_(rows, snap)) {
      out.skipped.push(kind);            /* คู่เดิม = ปล่อยของเก่าไว้ ห้ามเขียนทับ */
      /* ยกเว้นช่อง 'ลีก' ช่องเดียว — แถวเก่าที่ติดตัวย่อไว้ ให้มันซ่อมตัวเองได้ */
      try { var nf = fbFixLeague_(snap); if (nf) out.fixed.push(kind + ' ลีก=' + snap['ลีกเต็ม']); }
      catch (err) { /* ซ่อมไม่ได้ก็ช่างมัน ห้ามให้รอบนี้ล้ม */ }
      /* ช่องที่ 2: วัน-เวลาเตะ ที่เคยเพี้ยนไป 1 วัน ให้แถวเก่าซ่อมตัวเองด้วย */
      try { var nw = fbFixWhen_(snap); if (nw) out.fixed.push(kind + ' วันเวลา=' + snap['วันที่'] + ' ' + snap['เวลาเตะ']); }
      catch (err2) { /* เหมือนกัน ซ่อมไม่ได้ก็ปล่อย ห้ามให้รอบนี้ล้ม */ }
      continue;
    }
    /* เปอร์เซ็นต์กับสกอร์ที่เดา ไม่ได้อยู่ในกล่องปักหมุด ต้องตามลิงก์ไปเปิดหน้าของคู่เอา
       เติมไม่ได้ก็ลงเท่าที่มี ห้ามทิ้งคู่ทั้งคู่เพราะขาดตัวเลข */
    try { snap = fbEnrich_(snap); } catch (err) { /* ปล่อย ลงของเท่าที่อ่านได้ */ }
    try {
      var id = fbAppend_(snap, stamp);
      rows.push(snap);                   /* กันซ้ำในรอบเดียวกัน: 2 กล่องเป็นคู่เดียวกันได้ */
      out.added.push({ 'ช่อง': kind, id: id,
                       คู่: snap['ทีมเหย้า'] + ' VS ' + snap['ทีมเยือน'],
                       'อ่านทีมจาก': snap['อ่านทีมจาก'],
                       'เปิดหน้าคู่': snap['เปิดหน้าคู่'] || '' });
    } catch (err) {
      out.missed.push(kind + ' (เขียนชีตไม่ได้)');
    }
  }
  out.ok = true;
  return fbSaveReport_(out);
}

/* ---------- ดึงเองเมื่อของเก่า (ไม่พึ่ง trigger) ---------- */
/* ทำไมต้องมี: ทางติด trigger ขอสิทธิ์ script.scriptapp ที่ deployment นี้ไม่ได้ขอไว้
   ถ้าไปเพิ่มสิทธิ์ทีหลัง เจ้าของต้องกดอนุญาตใหม่ทั้งชุดจากมือถือ เสี่ยงพังของที่ใช้อยู่
   จึงให้ "ทางอ่านข้อมูล" เป็นคนดึงเองเมื่อภาพนิ่งเก่าเกินกำหนด — ไม่ใช้สิทธิ์เพิ่มเลย */
/* เจ้าของสั่ง "ทุกครั้งที่เปิด ข้อมูลต้องไปลงในชีต" -> 0 = ไม่มีคำว่าของยังใหม่อยู่ ดึงทุกครั้ง
   ตัวหน่วง 10 นาทีคงไว้ เพราะ 1 รอบยิงเน็ต 3 หน้า (หน้าแรก + หน้าของคู่ 2 คู่)
   ถ้าไม่หน่วงเลย คนกดรัวๆ จะได้หน้าเว็บที่ค้างรอโหลดทุกครั้ง และเสี่ยงโดนบล็อก */
var FB_STALE_HOURS = 0;    /* 0 = ถือว่าเก่าเสมอ ดึงใหม่ทุกครั้งที่เปิดหน้า */
var FB_RETRY_MIN = 10;     /* ยิงถี่กว่านี้ไม่ได้ กันหน้าเว็บค้างและกันโดนบล็อก */

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

/* ---------- กล่องดำ: จดว่ารอบล่าสุดเกิดอะไรขึ้น ---------- */
/* ทำไมต้องมี: รายงานของ fbSnapRun_ เดิมถูก "คายทิ้ง" ทุกครั้งที่ทางอ่านข้อมูลเรียกมัน
   พอเจ้าของบอกว่า "ไม่มีคู่เลย" จึงไม่มีใครรู้ว่าล้มตรงไหน — ดึงหน้าไม่ได้ / ดึงได้แต่แกะไม่ออก / คู่ซ้ำ
   จดไว้เป็น "ตัวเลขกับสาเหตุ" ล้วนๆ ไม่มีกุญแจ ไม่มีข้อมูลในชีต ไม่มีชื่อคู่
   แล้วเปิดให้ดูที่ ?p=ping ซึ่งเป็นทางที่ไม่ต้องใช้กุญแจ (กฎข้อ 3 จึงไม่ถูกละเมิด) */
function fbSaveReport_(out) {
  try {
    var rep = {
      at: nowIso_(),
      ok: !!(out && out.ok),
      code: out ? out.code : 0,
      via: out ? String(out.via || '') : '',
      len: out ? out.len : 0,
      added: (out && out.added) ? out.added.length : 0,
      trail: out ? String(out.trail || '') : '',
      why: out ? String(out.why || '') : '',
      skipped: (out && out.skipped) ? out.skipped.join(',') : '',
      fixed: (out && out.fixed) ? out.fixed.join(',') : '',
      missed: (out && out.missed) ? out.missed.join(',') : '',
      error: (out && out.error) ? String(out.error) : ''
    };
    PropertiesService.getScriptProperties().setProperty('FB_LAST_REPORT', JSON.stringify(rep));
  } catch (err) { /* จดไม่ได้ ห้ามทำให้งานหลักล้ม */ }
  return out;
}

function fbLastReport_() {
  try { return JSON.parse(prop_('FB_LAST_REPORT') || 'null'); }
  catch (err) { return null; }
}

/* รอบที่ล้ม ห้ามกินคิวยาวเท่ารอบที่สำเร็จ
   ของเดิมจดเวลา "ก่อน" วิ่ง แล้วใช้ 10 นาทีเท่ากันหมด แปลว่าพลาดครั้งเดียว = เงียบไป 10 นาทีเต็ม
   ทั้งที่เหตุที่พลาดส่วนใหญ่เป็นของชั่วคราว (โดนปฏิเสธเป็นพักๆ) เปิดใหม่อีกทีก็ผ่านแล้ว */
var FB_FAIL_MIN = 2;

function fbTryWait_() {
  var m = Number(prop_('FB_TRY_WAIT'));
  return (isNaN(m) || m <= 0) ? FB_RETRY_MIN : m;
}
function fbMarkWait_(min) {
  try { PropertiesService.getScriptProperties().setProperty('FB_TRY_WAIT', String(min)); }
  catch (err) { /* ปล่อย */ }
}

/** เรียกจากทางอ่านข้อมูล (?p=all)
    คืน true ถ้ามีของใหม่เข้าชีต — คนเรียกต้องอ่านชีตซ้ำ
    ห้าม throw เด็ดขาด หน้าเว็บต้องขึ้นได้เสมอ ถึง forebet จะล่มก็ตาม */
function fbAutoSnap_(pickRows, nowMs) {
  try {
    var now = nowMs || Date.now();
    if (!fbStale_(pickRows, now)) return false;
    var last = fbLastTry_();
    if (last && now - last < fbTryWait_() * 60000) return false;   /* เพิ่งลองไป ยังไม่ถึงคิว */
    /* จดก่อนวิ่ง = กันคนกดรัวระหว่างรอบก่อนหน้ายังไม่จบ แต่จดเป็นคิวสั้นไว้ก่อน
       ถ้ารอบนี้ดึงหน้าได้จริงค่อยขยับเป็นคิวเต็ม */
    fbMarkTry_(new Date(now).toISOString());
    fbMarkWait_(FB_FAIL_MIN);
    var r = fbSnapRun_();
    if (r && r.ok) fbMarkWait_(FB_RETRY_MIN);   /* ได้หน้ามาแล้ว = ไม่ต้องรีบกลับไปกวนเขา */
    return !!(r && r.added && r.added.length);
  } catch (err) {
    return false;
  }
}

/** ตัวส่องปัญหา — ใช้ตอนตัวอ่านอ่านไม่ออก จะได้รู้ว่าหน้าเว็บเขาหน้าตายังไง
    คายเฉพาะของสาธารณะจาก forebet ไม่มีข้อมูลของเจ้าของ แต่ยังกันด้วยกุญแจตามกฎข้อ 3 */
function fbProbe_() {
  var got = fbFetchAny_();
  var out = { code: got.code, url: got.url, via: got.via ? 'ผ่าน ' + got.via : 'ยิงตรง',
              len: (got.body || '').length, blocks: {} };
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

/* ---------- เอาเฉพาะคู่ที่ยังไม่ถึงเวลาแข่ง ---------- */
/* เจ้าของสั่ง: "เอาเฉพาะในชีตที่ยังไม่ถึงเวลาแข่งขันมาลงเว็บแอป"
   ชีตเก็บทุกอย่างไว้เหมือนเดิม (ไว้เกรดผลย้อนหลัง) แต่หน้าเว็บกรองตอนส่งออก */

/** เวลาเตะเป็นตัวเลข (ms) — 'วันที่'/'เวลาเตะ' ในชีตเป็นเวลาไทยแล้ว จึงต้องลบ 7 ชม. กลับเป็น UTC
    ห้ามใช้ FB_TZ_SHIFT ตรงนี้ แม้ตอนนี้มันจะเป็น 7 เหมือนกัน: คนละความหมายกัน
    (FB_TZ_SHIFT = "เวลาที่เขาโชว์ -> เวลาไทย" ของจริงตั้งทับไว้ที่ Script Property = 5)
    ถ้าวันหนึ่งไปแก้เลขตั้งต้นของ FB_TZ_SHIFT ตรงนี้จะเพี้ยนตามแบบเงียบๆ
    อ่านวันที่ไม่ออก = คืน 0 แปลว่า "ไม่รู้" ซึ่งกฎข้อ 6 (ห้ามเดา) ให้เก็บไว้ ไม่ใช่ตัดทิ้ง
    ไม่มีเวลาเตะ = ใช้ท้ายวันนั้น (23:59) เพื่อไม่ให้คู่ของวันนี้หายไปตั้งแต่เที่ยงคืน */
function fbKickMs_(row) {
  var d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fbYmd_(row && row['วันที่']));
  if (!d) return 0;
  var t = /^(\d{1,2}):(\d{2})$/.exec(fbHm_(row && row['เวลาเตะ']));
  var hh = t ? Number(t[1]) : 23, mm = t ? Number(t[2]) : 59;
  if (hh > 23 || mm > 59) { hh = 23; mm = 59; }
  return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), hh, mm) - TH_UTC_OFFSET * 3600000;
}

/** คู่ที่ยังไม่เตะ — อ่านเวลาไม่ออกก็ปล่อยผ่าน ห้ามทำของหายเพราะเดาไม่ถูก */
function fbUpcoming_(rows, nowMs) {
  var now = nowMs || Date.now(), out = [];
  for (var i = 0; i < (rows || []).length; i++) {
    var k = fbKickMs_(rows[i]);
    if (!k || k >= now) out.push(rows[i]);
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
