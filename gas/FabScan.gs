/*******************************************************
 * FabScan.gs — สแกนหาคู่จาก Live coef. (หน้า /en/values) แบบ "กดขอทีไรก็เด้งมา"
 *
 * ⚠️ ใช้ prefix fs* — ห้ามชนกับ f5* (Fabel5.gs) · fb* (FootballTips.gs) · fv* (FabValue.gs)
 *
 * มีไว้ทำไม: เจ้าของเปิด forebet ในแอปมือถือแล้ว "Live coef." หายทั้งคอลัมน์
 *   ตัวนี้ดึงมาให้ครบ + เอาค่าที่ใช้คัดบอลครึ่งแรกมาต่อท้ายการ์ด แล้วยิงเข้า Telegram
 *   → ไม่ต้องเปิดคอม ไม่ต้องรอ trigger กดเมื่อไหร่ก็ได้
 *
 * 🧮 เลขทุกตัวบนการ์ดวัดกับหน้า forebet จริงมาแล้ว (สคริปต์พิสูจน์อยู่ใน scratchpad)
 *     Live coef. + % เต็มเวลา + สกอร์ + ลูกเฉลี่ย = แกะจาก markdown หน้า /en/values  ตรง 64/64
 *     ครึ่งแรก 1/X/2 + เรท        = ฟีด tp=ht   (Pred_*_HT · best_odd_ht)          ตรง 70/70 · 42/42
 *     HT/FT %                     = P(ครึ่งแรก) × P(เต็มเวลา) ปัดปกติ               ตรง 36/36 · 22/22
 *     Double % + ป้าย             = รวม 2 ฝั่งสูงสุด เรียงมาก→น้อย                   ตรง 39/39 · 21/21
 *     Double เรท                  = ฟีด tp=dbc (odds_dbc)                          ตรง 19/19 · 11/12
 *       (ชุดหลังคือวัดซ้ำกับโค้ด JS ตัวนี้ตรงๆ 17 ส.ค. 69 — ไม่ใช่วัดกับ python แล้วเชื่อว่าพอร์ตถูก
 *        1 คู่ที่ไม่ตรงคือฟีดไม่มี odds_dbc ทั้งที่หน้าเว็บมี → การ์ดเว้นว่าง ไม่ได้โชว์เลขผิด)
 *     BTTS % + เรท                = ฟีด tp=bts (Pred_gg · odds_gg_y)
 *   ❗ ช่องไหน forebet ไม่มีค่า = ไม่โชว์ ห้ามคิดเลขมาเติมเอง (เลขผิด = เสียเงินจริง)
 *******************************************************/

var FS_VALUES_URL = 'https://www.forebet.com/en/values';

// หน้าต่างเวลา (ชั่วโมง) — เจ้าของสั่ง "บรรทัดแรกเวลา ให้เริ่มจากเวลาก่อนกดขอได้ 6 ชม"
var FS_BACK_HOURS  = 6;    // ย้อนหลังได้ 6 ชม. (คู่ที่เพิ่งเตะ ยังมีราคาให้ไล่)
var FS_AHEAD_HOURS = 24;   // ล่วงหน้า 24 ชม.
var FS_MAX_CARDS   = 40;   // กันยิงยาวเป็นสิบข้อความ
var FS_FEED_DAYS   = 2;    // ดึงฟีดกี่วัน (วันนี้ + อีกกี่วัน) — ยิ่งมากยิ่งช้า

// เกณฑ์ไฮไลท์ — มาจากคำเจ้าของเอง "30% ขึ้น ค่อนข้างดีเลย หาหน้าแทงได้เยอะมาก"
var FS_LC_HOT = 40;
var FS_LC_OK  = 30;

/** ดึงหน้าเว็บผ่าน Jina (ได้ markdown) — หน้า /en/values ไม่มีฟีด JSON ต้องอ่านหน้าเอา
 *  ลอง 3 รอบ: Jina ตกบ่อย (เจอจริงตอนเทสต์ v191) แต่รอบถัดไปมักติด → กดขอครั้งเดียวต้องได้ */
function fsFetchMd_(url) {
  var via = fbProxy_();
  if (!via) return '';                         /* เจ้าของสั่งปิดทางอ้อม (FB_PROXY='-') = ไม่ต้องลอง */
  var last = '';
  for (var i = 0; i < 3; i++) {
    if (i) Utilities.sleep(1200);
    try {
      var r = cpGet_(url, via, true);          /* md=true: ต้องได้ markdown ตัวแกะข้างล่างอ่านแบบนั้น */
      if (r.code === 200) {
        var t = r.body;
        if (t && t.length > 5000) return t;    // สั้นผิดปกติ = หน้าเออเร่อของทางอ้อม
        last = 'สั้นผิดปกติ ' + (t ? t.length : 0);
      } else last = 'HTTP ' + r.code;
    } catch (e) { last = e.message; }
  }
  logEvent_('ERROR', 'fsFetchMd_ ล้ม 3 รอบ (' + last + '): ' + url);
  return '';
}

/** แกะแถวคู่บอลจาก markdown หน้า /en/values
 *  🐞 บั๊กที่เคยเจอ: ชื่อทีมมีวงเล็บ เช่น .../sulaibikhat-sahel-(kuw)-2487402
 *     ถ้าใช้ [^)]*? จะหยุดที่ ) ตัวแรก → จับ id ไม่ได้ ตกทั้งแถว → ต้องใช้ .*? + lookahead */
function fsParseValues_(t) {
  var out = [];
  if (!t) return out;
  // 🐞 บั๊กที่ 2 (17 ส.ค. 69): เวลาในป้ายลิงก์เปลี่ยนเป็น 12 ชม. "4:00 PM" (เดิม "16:00")
  //    ถ้าบังคับรูปแบบเวลาในตัวจับ → ตกทั้งหน้า 0 คู่ → จับแค่ id ไว้ก่อน เวลาแกะทีหลังแบบไม่บังคับ
  //    (เวลาเตะจริงใช้ DATE_BAH จากฟีดอยู่แล้ว ป้ายนี้เป็นแค่จุดอ้างอิงตำแหน่งแถว)
  var LINK = /\[([^\]]*?)\]\(https:\/\/www\.forebet\.com\/en\/football\/matches\/.*?-(\d+)\)(?=\s|$)/g;
  var hits = [], m;
  while ((m = LINK.exec(t)) !== null) {
    var lab = String(m[1]).trim();
    var dm = lab.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)$/i);
    hits.push({
      nm: dm ? lab.slice(0, dm.index).trim() : lab,
      dt: dm ? dm[1] : '', hm: dm ? dm[2] : '',
      id: m[2], s: m.index, e: LINK.lastIndex
    });
  }
  for (var i = 0; i < hits.length; i++) {
    var h = hits[i];
    var tail = t.slice(h.e, (i + 1 < hits.length) ? hits[i + 1].s : h.e + 400);
    var cut = tail.search(/!\[Image \d+\]\(https:\/\/www\.forebet\.com\/images\/fc\//);   // ธงลีกแถวถัดไป = เส้นตัด
    if (cut >= 0) tail = tail.slice(0, cut);
    var p  = tail.match(/\n\s*(\d{1,3}) (\d{1,3}) (\d{1,3})\s*\n/);
    if (!p) continue;
    var pr = tail.match(/\n\s*([12X]) (\d+)-(\d+)\s*\n/);
    var ga = tail.match(/\n\s*(\d+\.\d+)\s*\n/);
    var pcts = tail.match(/-?\d{1,3}%/g);
    if (!pcts || !pcts.length) continue;
    out.push({
      id: h.id, nm: h.nm, ko: h.dt + ' ' + h.hm,
      p: [+p[1], +p[2], +p[3]],
      pred: pr ? pr[1] : '',
      hs: pr ? +pr[2] : null, gs: pr ? +pr[3] : null,
      co: ga ? parseFloat(ga[1]) : null,
      lc: parseInt(String(pcts[pcts.length - 1]).replace('%', ''), 10)
    });
  }
  return out;
}

/** ฟีด getrs.php ตาม tp — โครง JSON แต่ละ tp ไม่เหมือนกัน หาช่องที่เป็น list ของ object เอง */
function fsFeedRows_(text) {
  if (!text) return [];
  var i = String(text).indexOf('[[');
  if (i < 0) return [];
  var s = String(text).slice(i), arr = null;
  try { arr = JSON.parse(s); } catch (e) {
    var j = s.lastIndexOf(']]');                  // ผ่าน Jina มีขยะต่อท้ายได้ → ตัดถึงวงเล็บปิดตัวท้าย
    if (j > 0) { try { arr = JSON.parse(s.slice(0, j + 2)); } catch (e2) { return []; } }
  }
  if (!arr) return [];
  var parts = (arr instanceof Array) ? arr : [arr];
  for (var k = 0; k < parts.length; k++) {
    var p = parts[k];
    if (p instanceof Array && p.length && p[0] && typeof p[0] === 'object' && !(p[0] instanceof Array)) return p;
  }
  return [];
}

/** ฟีดของ tp ที่ต้องใช้ (tp=1x2 ไม่มีครึ่งแรก · tp=ht ไม่มีเรทเต็มเวลา/ลูกเฉลี่ย → ต้องดึงหลายตัวมาต่อกัน) */
function fsFeed_(tp, dateStr) {
  var url = 'https://www.forebet.com/scripts/getrs.php?ln=en&tp=' + tp + '&in=' + dateStr + '&ord=0&tz=%2B420&tzs=0&tze=0';
  return fsFeedRows_(fbFetchJsonText_(url));
}

/** 'yyyy-MM-dd HH:mm:ss' ของฟีด (เขตเวลา +07:00 เพราะยิง tz=%2B420) → มิลลิวินาที */
function fsKoMs_(s) {
  var m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 7, +m[5]);
}

function fsI_(v) { var n = parseInt(String(v), 10); return isNaN(n) ? null : n; }
function fsF_(v) { var n = parseFloat(String(v)); return isNaN(n) ? null : n; }

var FS_SIDE = { '1': 'เจ้าบ้าน', 'X': 'เสมอ', '2': 'ทีมเยือน' };
var FS_IDX  = { '1': 0, 'X': 1, '2': 2 };

/** การ์ด 1 คู่ — แถวสุดท้ายคือกลุ่มครึ่งแรก (เจ้าของสั่ง: ไว้ล่างสุด จะสแกนบอลยิงครึ่งแรกได้ไว) */
function fsCard_(v, m, b, d, o) {
  var p = [fsI_(m.Pred_1), fsI_(m.Pred_X), fsI_(m.Pred_2)];
  var h = [fsI_(m.Pred_1_HT), fsI_(m.Pred_X_HT), fsI_(m.Pred_2_HT)];
  if (p[0] === null || p[1] === null || p[2] === null) return '';

  var L = [];
  var flag = (v.lc >= FS_LC_HOT) ? ' 💎' : (v.lc >= FS_LC_OK ? ' 🔥' : '');
  var ko = String(m.DATE_BAH || '').slice(5, 16);
  L.push('⚽ ' + (m.HOST_NAME || '') + ' vs ' + (m.GUEST_NAME || ''));
  L.push('   ' + (m.short_tag || '') + ' · เตะ ' + ko + (v.lc ? ' · ค่าคุ้ม ' + v.lc + '%' + flag : ''));

  var oi = FS_IDX[v.pred];
  var of_ = (o && oi !== undefined) ? fsF_([o.best_odd_1, o.best_odd_X, o.best_odd_2][oi]) : null;
  L.push('เต็มเวลา  1 ' + p[0] + '%  X ' + p[1] + '%  2 ' + p[2] + '%   → ทาย ' + v.pred +
         ' (' + (FS_SIDE[v.pred] || '') + ')' + (of_ ? ' @' + of_.toFixed(2) : ''));

  var gav = m.goalsavg || (b && b.goalsavg) || (d && d.goalsavg) || v.co;
  var gg = b ? fsI_(b.Pred_gg) : null, ogg = b ? fsF_(b.odds_gg_y) : null;
  var sc = (m.host_sc_pr !== undefined && m.host_sc_pr !== '') ? (m.host_sc_pr + '-' + m.guest_sc_pr)
         : (v.hs !== null ? (v.hs + '-' + v.gs) : '');
  L.push('สกอร์ ' + sc + (gav ? ' · ลูกเฉลี่ย ' + gav : '') +
         (gg ? ' · ยิงกันสองฝั่ง ' + gg + '%' + (ogg ? ' @' + ogg.toFixed(2) : '') : ''));

  // ── กลุ่มครึ่งแรก (แถวสุดท้าย) ────────────────────────────────────────────
  if (h[0] !== null && h[1] !== null && h[2] !== null) {
    var hi = (h[0] >= h[1] && h[0] >= h[2]) ? 0 : (h[1] >= h[2] ? 1 : 2);
    var fi = (p[0] >= p[1] && p[0] >= p[2]) ? 0 : (p[1] >= p[2] ? 1 : 2);
    var lo = (p[0] <= p[1] && p[0] <= p[2]) ? 0 : (p[1] <= p[2] ? 1 : 2);
    var keep = [0, 1, 2].filter(function (x) { return x !== lo; })
                        .sort(function (a2, b2) { return p[b2] - p[a2]; });
    var dcLab = keep.map(function (x) { return '1X2'.charAt(x); }).join('');
    var dcPct = p[keep[0]] + p[keep[1]];
    var hfLab = '1X2'.charAt(hi) + '/' + '1X2'.charAt(fi);
    var hfPct = Math.round(h[hi] * p[fi] / 100);
    var oht = fsF_(m.best_odd_ht), ohf = fsF_(m.odds_ht_ft), odc = d ? fsF_(d.odds_dbc) : null;

    L.push('┈┈ ครึ่งแรก ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈');
    L.push('ครึ่งแรก  1 ' + h[0] + '%  X ' + h[1] + '%  2 ' + h[2] + '%   → ' + '1X2'.charAt(hi) +
           (oht ? ' @' + oht.toFixed(2) : ''));
    L.push('HT/FT   ' + hfLab + '  ' + hfPct + '%' + (ohf ? '  @' + ohf.toFixed(2) : ''));
    L.push('Double  ' + dcLab + '  ' + dcPct + '%' + (odc ? '  @' + odc.toFixed(2) : ''));
  }
  return L.join('\n');
}

/** สร้างข้อความทั้งชุด (คืนเป็น array ของข้อความ ≤4096 ตัวอักษร)
 *  opt: { back, ahead, days, max, min } — ทุกตัวไม่ใส่ก็ได้ */
function fsScanText_(opt) {
  opt = opt || {};
  var back  = (opt.back  !== undefined && opt.back  !== '') ? +opt.back  : FS_BACK_HOURS;
  var ahead = (opt.ahead !== undefined && opt.ahead !== '') ? +opt.ahead : FS_AHEAD_HOURS;
  var days  = (opt.days  !== undefined && opt.days  !== '') ? +opt.days  : FS_FEED_DAYS;
  var max   = (opt.max   !== undefined && opt.max   !== '') ? +opt.max   : FS_MAX_CARDS;
  var minLc = (opt.min   !== undefined && opt.min   !== '') ? +opt.min   : 0;

  // แยก 2 เหตุผลให้ชัด: ดึงไม่ได้ กับ ดึงได้แต่แกะไม่ออก (หน้าเปลี่ยนโครง) — คนละวิธีแก้
  var md = fsFetchMd_(FS_VALUES_URL);
  if (!md) return ['⚠️ ดึงหน้า Live coef. ไม่ได้ (ลองแล้ว 3 รอบ forebet/Jina ไม่ตอบ) — กดขอใหม่อีกที'];
  var vals = fsParseValues_(md);
  if (!vals.length) return ['⚠️ ดึงหน้ามาได้ (' + md.length + ' ตัวอักษร) แต่แกะตารางไม่ออก — หน้า forebet อาจเปลี่ยนโครง'];

  var H = {}, B = {}, D = {}, O = {};
  var d0 = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  for (var k = 0; k < days; k++) {
    var ds = fbDayShift_(d0, k);
    fsFeed_('ht',  ds).forEach(function (r) { H[String(r.id)] = r; });
    fsFeed_('bts', ds).forEach(function (r) { B[String(r.id)] = r; });
    fsFeed_('dbc', ds).forEach(function (r) { D[String(r.id)] = r; });
    fsFeed_('1x2', ds).forEach(function (r) { O[String(r.id)] = r; });
  }

  var now = Date.now(), lo = now - back * 3600000, hi = now + ahead * 3600000;
  var pick = [];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i], m = H[v.id];
    if (!m || v.lc < minLc) continue;
    var t = fsKoMs_(m.DATE_BAH);
    if (!t || t < lo || t > hi) continue;
    pick.push(v);
  }
  pick.sort(function (a, b) { return b.lc - a.lc; });

  var head = '📊 Live coef. — ' + Utilities.formatDate(new Date(), TZ, 'dd/MM HH:mm') +
             '\nหน้าเว็บมี ' + vals.length + ' คู่ · อยู่ในช่วง -' + back + '/+' + ahead + ' ชม. ' + pick.length + ' คู่' +
             (pick.length > max ? ' (โชว์ ' + max + ')' : '') +
             '\n💎 = ค่าคุ้ม ' + FS_LC_HOT + '%+ · 🔥 = ' + FS_LC_OK + '%+';

  var msgs = [], cur = head, n = 0;
  for (var j = 0; j < pick.length && n < max; j++) {
    var vv = pick[j];
    var c = fsCard_(vv, H[vv.id], B[vv.id], D[vv.id], O[vv.id]);
    if (!c) continue;
    n++;
    if (cur.length + c.length + 2 > 3900) { msgs.push(cur); cur = ''; }
    cur += (cur ? '\n\n' : '') + c;
  }
  if (!n) cur += '\n\n— ไม่มีคู่ในช่วงเวลานี้ —';
  msgs.push(cur);
  return msgs;
}

/** ยิงเข้า Telegram (ยาวเกิน 4096 = แตกหลายข้อความ) */
function fsScanSend_(chatId, opt) {
  var msgs = fsScanText_(opt);
  for (var i = 0; i < msgs.length; i++) {
    tgSend_(chatId, msgs[i]);   /* บอทนี้ปุ่มติดไปทุกข้อความอยู่แล้ว (ดู tgSend_) */
  }
  return true;
}

/** คำสั่งจาก Telegram — /หาคู่ [เลข] · เลขท้าย = ค่าคุ้มขั้นต่ำ เช่น "/หาคู่ 30" */
function fsHandleCmd_(chatId, text) {
  var mn = String(text || '').match(/(\d{1,3})/);
  // ดึง 9 หน้าอ้อม Jina ใช้เวลาจริง ~60 วิ → ต้องตอบรับก่อน ไม่งั้นเหมือนบอทค้าง
  tgSend_(chatId, '🔎 กำลังดึง Live coef. จาก forebet… (ราวๆ 1 นาที)');
  return fsScanSend_(chatId, { min: mn ? +mn[1] : 0 });
}
