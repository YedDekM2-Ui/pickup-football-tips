/**
 * TalkFootball.gs — /talkfootball : คำทำนายจากเว็บ talkfootball.co.uk อย่างเดียว
 * ย้ายมาจาก PIKTAX (talkfootball.gs) 27 ส.ค. 69 — บอทเก่าเหลือแค่ภาษี+กรรชัย
 *
 * กติกาเดิมที่เจ้าของสั่งไว้ ห้ามเปลี่ยน:
 *   - หน้า first-half-goals = "ตัวหลัก" เอาเฉพาะ 90-100%
 *   - อีก 3 หน้า (SH / OU2.5 / BTTS) = ตัวเสริม เกาะมาบรรทัดเดียวกัน · ไม่มี = "-"
 *   - เวลาเว็บเป็น UTC → ไทย = +7 (ปล่อยให้ TZ จัดการ) · เรียงเวลาเป็นหลัก แล้วค่อย %
 *   - ไม่มีคู่ถึง 90% → บอก "ไม่มีบอลน่าสนใจในตอนนี้" พร้อมเหตุผล
 *
 * ต่างจากของเดิม 3 อย่าง:
 *   1. ชีตผ่าน sheetEnsure_/sheetIfExists_ (SHEET_ID ของโปรเจกต์นี้) ไม่ใช่ openById ตรงๆ
 *   2. ไม่มี trigger (โปรเจกต์นี้ห้ามขอ scope script.scriptapp) → เกรดผลด้วยคำสั่ง/ลิงก์แทน
 *   3. เวลาใช้ TZ จาก Config.gs ไม่ฝัง 'Asia/Bangkok' ซ้ำ
 */

var TF_URL_HT   = 'https://talkfootball.co.uk/predictions/first-half-goals/';
var TF_URL_SH   = 'https://talkfootball.co.uk/predictions/second-half-goals/';
var TF_URL_25   = 'https://talkfootball.co.uk/predictions/match-goals-over-2.5/';
var TF_URL_BTTS = 'https://talkfootball.co.uk/predictions/btts/';
var TF_MIN_PCT  = 90;   // ตัวหลัก (HT) เอาเฉพาะ 90-100%
var TF_MAX_ROWS = 30;   // กันข้อความยาวเกินลิมิต Telegram (4096)

// ระยะเวลาล่วงหน้าขั้นต่ำ — คู่ที่จะเตะเร็วกว่านี้ไม่ต้องเอามาโชว์
// เจ้าของสั่ง 11 ส.ค. 69: "กดขอไปตอนไหน มันก็มีแต่ที่จะใกล้ถึง บอลน้อยๆมันดูไม่ทัน"
var TF_LEAD_MIN = 60;

/** ดึง+แปลงตารางทำนาย (ทุกหน้าใช้โครงตารางเดียวกัน 7 ช่อง)
    เว็บนี้ยิงตรงได้ ไม่ใช่ forebet ไม่ต้องอ้อม (และห้ามใส่ Referer ของ forebet) */
function tfFetchRows_(url) {
  var res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      'User-Agent': CP_UA,
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());

  var trs = res.getContentText().match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  var out = [];

  for (var i = 0; i < trs.length; i++) {
    var tds = trs[i].match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || [];
    if (tds.length < 7) continue;
    var c = tds.map(function (x) { return tfClean_(x); });

    // c[0]="07/31 13:00" c[1]="Vietnam - Singapore" c[2]=ลีก c[3]=%ฝั่งใช่ c[5]=ความมั่นใจ
    var dt = c[0].match(/^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
    if (!dt) continue;
    var pct = parseInt(String(c[5]).replace('%', ''), 10);
    if (isNaN(pct)) pct = parseInt(String(c[3]).replace('%', ''), 10);
    if (isNaN(pct)) continue;

    out.push({
      kickUtc: tfUtcMs_(+dt[1], +dt[2], +dt[3], +dt[4]),
      match: c[1], league: c[2], pct: pct
    });
  }

  // หน้าเว็บมีตารางซ้อนกันหลายชุด (คู่เด่นด้านบน + ตารางรวม) → คู่เดียวกันโผล่ 2 รอบ
  // ตัดซ้ำด้วย "เวลาเตะ + ชื่อคู่" เก็บอันที่ % สูงกว่าไว้
  var seen = {}, uniq = [];
  out.forEach(function (r) {
    var k = tfKey_(r);
    if (!(k in seen)) { seen[k] = uniq.length; uniq.push(r); }
    else if (r.pct > uniq[seen[k]].pct) uniq[seen[k]] = r;
  });
  return uniq;
}

function tfKey_(r) { return r.kickUtc + '|' + r.match; }

/** ดึงหน้าเสริม → map {key: %} · หน้าไหนล่มก็แค่คอลัมน์นั้นว่าง ไม่ทำทั้งคำสั่งพัง */
function tfSideMap_(url) {
  try {
    var m = {};
    tfFetchRows_(url).forEach(function (r) { m[tfKey_(r)] = r.pct; });
    return m;
  } catch (err) { return null; }
}

/** ถอดแท็ก + คืนอักขระจาก HTML entity (เว็บส่ง &#245; แทน õ ชื่อทีมยุโรปจะเพี้ยน) */
function tfClean_(s) {
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(parseInt(d, 10)); })
    .replace(/&quot;/g, '"').replace(/&rsquo;|&apos;/g, "'")
    .replace(/&amp;/g, '&')       // ต้องท้ายสุด กัน &amp;#245; ถอดสองชั้นผิด
    .replace(/\s+/g, ' ').trim();
}

/** เวลาเว็บ (UTC, มีแค่ MM/DD) → มิลลิวินาที · เดาปีเอง กันคาบเกี่ยวสิ้นปี */
function tfUtcMs_(mm, dd, hh, mi) {
  var now = new Date(), y = now.getUTCFullYear(), cur = now.getUTCMonth() + 1;
  if (cur === 12 && mm === 1) y += 1;         // ธ.ค. เห็นคู่ ม.ค. = ปีหน้า
  else if (cur === 1 && mm === 12) y -= 1;    // ม.ค. เห็นคู่ ธ.ค. = ปีที่แล้ว
  return Date.UTC(y, mm - 1, dd, hh, mi, 0);
}

/** ข้อความหลักของ /talkfootball */
function tfText_() {
  var rows;
  try {
    rows = tfFetchRows_(TF_URL_HT);   // ตัวหลัก — ล่มเมื่อไหร่คือจบ
  } catch (err) {
    return '⚽ talkfootball · ครึ่งแรกน่าจะมีสกอร์\n❌ ดึงข้อมูลไม่ได้: ' + err.message + '\nลองใหม่อีกครั้งนะ';
  }
  if (!rows.length) return '⚽ talkfootball · ครึ่งแรกน่าจะมีสกอร์\n❌ อ่านตารางจากเว็บไม่ได้ (หน้าเว็บอาจเปลี่ยนโครงสร้าง)';

  var nowMs   = Date.now();
  var startMs = nowMs + TF_LEAD_MIN * 60 * 1000;        // จุดเริ่มตาราง = อีก 1 ชม.ข้างหน้า
  var hit = rows.filter(function (r) {
    return r.pct >= TF_MIN_PCT && r.kickUtc >= startMs;
  }).sort(function (a, b) {
    return (a.kickUtc - b.kickUtc) || (b.pct - a.pct);  // เวลาเป็นหลัก แล้วค่อย %
  });

  var nowTh   = Utilities.formatDate(new Date(), TZ, 'HH:mm');
  var startTh = Utilities.formatDate(new Date(startMs), TZ, 'HH:mm');

  if (!hit.length) {
    // ไม่มีของให้โชว์ ต้องบอกให้ชัดว่าเพราะอะไร จะได้รู้ว่าไม่ใช่เว็บพัง
    var ok     = rows.filter(function (r) { return r.pct >= TF_MIN_PCT; });
    var soon   = ok.filter(function (r) { return r.kickUtc >= nowMs && r.kickUtc < startMs; }).length;
    var passed = ok.filter(function (r) { return r.kickUtc <  nowMs; }).length;
    var why = [];
    if (soon)   why.push(soon + ' คู่จะเตะภายใน ' + TF_LEAD_MIN + ' นาทีนี้ (ใกล้เกินไป)');
    if (passed) why.push(passed + ' คู่เตะไปแล้ว');
    return '⚽ talkfootball · ครึ่งแรกน่าจะมีสกอร์ · เวลาไทย ' + nowTh + '\n' +
           'ไม่มีบอลน่าสนใจในตอนนี้' +
           (why.length ? '\n(วันนี้มี ' + ok.length + ' คู่ที่ถึง ' + TF_MIN_PCT + '% — ' +
                         why.join(' · ') + ')' : '');
  }

  // ตัวเสริม — ดึงหลังคัดแล้ว จะได้ไม่เสียเวลาโหลดตอนที่ไม่มีคู่ให้โชว์
  var sh   = tfSideMap_(TF_URL_SH);
  var ou   = tfSideMap_(TF_URL_25);
  var btts = tfSideMap_(TF_URL_BTTS);

  // บอทนี้ส่งข้อความล้วน (tgSend_ ไม่ตั้ง parse_mode) → ห้ามใส่แท็ก HTML จะโชว์เป็นตัวอักษร
  var shown = hit.slice(0, TF_MAX_ROWS);
  var today = Utilities.formatDate(new Date(), TZ, 'dd/MM');
  var lines = ['⚽ talkfootball · เวลาไทย ' + nowTh + ' · เตะตั้งแต่ ' + startTh + ' ขึ้นไป', ''];

  shown.forEach(function (r) {
    var k   = tfKey_(r);
    var th  = Utilities.formatDate(new Date(r.kickUtc), TZ, 'HH:mm');
    var day = Utilities.formatDate(new Date(r.kickUtc), TZ, 'dd/MM');
    lines.push(th + (day === today ? '' : ' (' + day + ')') + '  ' + r.match +
               '  HT ' + r.pct + '% · SH ' + tfPct_(sh, k) +
               ' · OU2.5 ' + tfPct_(ou, k) + ' · BTTS ' + tfPct_(btts, k));
  });
  return lines.join('\n');
}

/** ค่าคอลัมน์เสริม · ไม่มีคู่นี้ในหน้านั้น (หรือหน้านั้นล่ม) = "-" ตามที่เจ้าของสั่ง */
function tfPct_(map, key) {
  if (!map || !(key in map)) return '-';
  return map[key] + '%';
}

// ============================================================
// สถิติของเว็บนี้โดยเฉพาะ — แยกตารางจาก PICKS ของ forebet
//   เอา "ผลสกอร์จริง" จาก Forebet (fbParseScores_ ใน Compat.gs)
//   มาตัดสิน 4 ตลาดของ talkfootball: HT / SH / OU2.5 / BTTS
//   ⚠️ คู่ไหนยังไม่มีผล = ไม่บันทึก (เจ้าของสั่งชัด) → ตารางนี้มีแต่แถวที่ตัดสินได้แล้ว
//
//   ควรสั่งเกรดวันละครั้งตอนเช้า: หน้า talkfootball โชว์เป็น "วันตาม UTC"
//   06:00 ไทย = 23:00 UTC ของเมื่อวาน → หน้าเว็บยังเป็นวันเดิม เห็นคู่ที่เตะจบครบทั้งวัน
//   โปรเจกต์นี้ไม่มี trigger (ห้ามขอ scope script.scriptapp) → สั่งเอง /tfเกรด หรือ ?p=tfgrade
// ============================================================

var TF_SCORE_URLS = [
  'https://www.forebet.com/en/football-tips-and-predictions-for-today/asian-handicap/finished',
  'https://www.forebet.com/en/football-tips-and-predictions-for-today/predictions-1x2/finished',
  'https://www.forebet.com/en/football-predictions-from-yesterday'
];

/** รวม 4 หน้าเป็นคู่ละ 1 ก้อน — ยึดหน้า HT เป็นหลัก */
function tfCollect_() {
  var base = tfFetchRows_(TF_URL_HT);
  var sh = tfSideMap_(TF_URL_SH), ou = tfSideMap_(TF_URL_25), bt = tfSideMap_(TF_URL_BTTS);
  return base.filter(function (r) { return r.pct >= TF_MIN_PCT; })
             .map(function (r) {
    var k = tfKey_(r);
    return { key: k, kickUtc: r.kickUtc, match: r.match, league: r.league,
             ht: r.pct,
             sh: sh && (k in sh) ? sh[k] : '',
             ou: ou && (k in ou) ? ou[k] : '',
             bt: bt && (k in bt) ? bt[k] : '' };
  });
}

/** ตัดสิน + บันทึกลงแท็บ TalkFootball · คืนข้อความสรุปสั้นๆ */
function tfGradeLog_() {
  var rows;
  try { rows = tfCollect_(); } catch (err) { return 'tf: ดึงเว็บไม่ได้ ' + err.message; }
  if (!rows.length) return 'tf: ไม่มีคู่ ' + TF_MIN_PCT + '%+ บนหน้าเว็บรอบนี้';

  var sheet = sheetEnsure_(SHEETS.TF, HEADERS.TF);

  // คีย์ที่บันทึกไปแล้ว — กันบันทึกซ้ำเวลาสั่งหลายรอบ
  var have = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 16, sheet.getLastRow() - 1, 1).getValues()
         .forEach(function (v) { have[String(v[0])] = 1; });
  }

  // สกอร์จริงจาก Forebet (จบแล้ววันนี้ + เมื่อวานทั้งวัน)
  var scores = {};
  TF_SCORE_URLS.forEach(function (u) {
    var one = fbParseScores_(fbFetchForebetText_(u));
    for (var k in one) if (!(k in scores)) scores[k] = one[k];
  });
  if (!Object.keys(scores).length) return 'tf: ดึงผลจาก Forebet ไม่ได้เลย (ยังไม่บันทึก)';

  var add = [], noResult = 0;
  rows.forEach(function (r) {
    if (have[r.key]) return;
    var p = r.match.split(' - ');
    if (p.length < 2) return;
    var home = p[0].trim(), away = p.slice(1).join(' - ').trim();
    var sc = fbLookupScore_(scores, home, away, null);
    if (!sc) { noResult++; return; }                 // ยังไม่มีผล → ไม่บันทึก (เจ้าของสั่ง)

    var hg = sc[0], ag = sc[1], hh = sc[2], ha = sc[3];
    var hasHalf = (hh != null && ha != null);
    // HT = ครึ่งแรกมีสกอร์ไหม · SH = เต็มเวลาลบครึ่งแรก (ต้องมีสกอร์ครึ่งแรกถึงตัดสินได้)
    // Forebet ไม่ให้สกอร์ครึ่งแรก = ปล่อยว่าง ห้ามเดา (เดี๋ยวสถิติเพี้ยน)
    add.push([
      Utilities.formatDate(new Date(r.kickUtc), TZ, 'yyyy-MM-dd'),
      Utilities.formatDate(new Date(r.kickUtc), TZ, 'HH:mm'),
      home, away, r.league,
      r.ht, r.sh, r.ou, r.bt,
      hg + '-' + ag, hasHalf ? (hh + '-' + ha) : '',
      hasHalf ? tfMark_(hh + ha >= 1) : '',
      hasHalf ? tfMark_((hg - hh) + (ag - ha) >= 1) : '',
      r.ou === '' ? '' : tfMark_(hg + ag >= 3),
      r.bt === '' ? '' : tfMark_(hg >= 1 && ag >= 1),
      r.key
    ]);
  });

  if (add.length) sheet.getRange(sheet.getLastRow() + 1, 1, add.length, 16).setValues(add);
  return 'tf: บันทึก ' + add.length + ' คู่ (ยังไม่มีผล ' + noResult + ' · เคยบันทึกแล้ว ' +
         (rows.length - add.length - noResult) + ')';
}

function tfMark_(ok) { return ok ? 'ถูก' : 'ผิด'; }

/** สรุปความแม่นย้อนหลัง N วัน จากแถวที่เกรดไว้แล้ว */
function tfStatsText_(days) {
  days = parseInt(days, 10) || 30;
  var sh = sheetIfExists_(SHEETS.TF);
  if (!sh || sh.getLastRow() < 2) return '📊 talkfootball · ยังไม่มีข้อมูล (รอเกรดผลรอบแรก)';
  var since = Utilities.formatDate(new Date(Date.now() - days * 86400000), TZ, 'yyyy-MM-dd');
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 15).getValues();
  var box = { HT: [0, 0], SH: [0, 0], 'OU2.5': [0, 0], BTTS: [0, 0] };
  var keys = ['HT', 'SH', 'OU2.5', 'BTTS'], n = 0;
  v.forEach(function (r) {
    // ชีตอาจคืนคอลัมน์วันที่มาเป็น Date ถ้าฟอร์แมต '@' หลุด → แปลงก่อนเทียบเสมอ
    var d = (r[0] instanceof Date) ? Utilities.formatDate(r[0], TZ, 'yyyy-MM-dd') : String(r[0]);
    if (d < since) return;
    n++;
    for (var i = 0; i < 4; i++) {
      var cell = String(r[11 + i] || '');
      if (cell === 'ถูก') { box[keys[i]][0]++; box[keys[i]][1]++; }
      else if (cell === 'ผิด') { box[keys[i]][1]++; }
    }
  });
  var L = ['📊 ความแม่น talkfootball ' + days + ' วัน (คู่ HT ' + TF_MIN_PCT + '%+ · ' + n + ' คู่)'];
  keys.forEach(function (k) {
    var b = box[k];
    L.push('  ' + k + ' : ' + (b[1] ? Math.round(b[0] / b[1] * 100) + '% (' + b[0] + '/' + b[1] + ')' : '-'));
  });
  return L.join('\n');
}
