/* Live.gs — เวลาเตะตัวจริง เอามาจากฟีด LiveScore (ของเดิมที่ FABEL5 ใช้มานาน)

   ทำไมต้องมีไฟล์นี้:
   เวลาที่ forebet โชว์บนหน้าเว็บ "ไม่ใช่เวลาคงที่" — เขาปรับตามโซนของเครื่องที่ยิงเข้าไปดู
   เราอ้อมผ่าน jina เครื่องมันอยู่คนละที่กันแต่ละรอบ เวลาที่ได้เลยขยับไปมา
   แล้วโค้ดเก่าดันไปบวก FB_TZ_SHIFT ทับอีก = เพี้ยนซ้ำสอง (เจอจริง: โชว์ 02:00 ทั้งที่เตะ 23:00)

   ฟีด LiveScore ให้ Esd มาเป็น "เวลา UTC" ตายตัว ไม่ขึ้นกับว่าใครยิงจากไหน
   ไทย = UTC + 7 จบ ไม่ต้องเดา ไม่ต้องตั้งค่าอะไรเพิ่ม

   กฎของไฟล์นี้:
   1. จับคู่ไม่ได้ หรือ จับได้เกิน 1 คู่ = คืน null แล้วให้ของเดิมทำงานต่อ ห้ามเดาให้
   2. ยิงเน็ตพังทั้งดุ้น = คืน null เงียบๆ ห้ามทำให้รอบดึงล่มทั้งรอบ
*/

var LS_URL_ = 'https://prod-cdn-mev-api.livescore.com/v1/api/app/date/soccer/';
var LS_TH_SHIFT_ = 7;   /* ไทยเร็วกว่า UTC 7 ชม. — ค่าคงที่ของโลก ไม่ใช่ค่าปรับได้ */

/* คำท้ายชื่อทีมที่แต่ละเว็บใส่ไม่เหมือนกัน — ตัดทิ้งก่อนเทียบ (ยกมาจาก live_api.py ของเดิม) */
var LS_DROP_ = { fc:1, afc:1, cf:1, sc:1, ac:1, 'if':1, fk:1, sk:1, bk:1, cd:1, ud:1,
                 us:1, as:1, ss:1, cs:1, club:1, calcio:1, de:1, the:1, team:1 };

/* ชื่อเมืองที่สองเว็บเขียนคนละภาษา (ยกมาจากของเดิม) */
var LS_ALIAS_ = {
  praha:'prague', muenchen:'munich', munchen:'munich', wien:'vienna', moskva:'moscow',
  roma:'rome', milano:'milan', torino:'turin', napoli:'naples', genova:'genoa',
  firenze:'florence', koeln:'cologne', koln:'cologne', sevilla:'seville',
  lisboa:'lisbon', bucuresti:'bucharest', beograd:'belgrade', warszawa:'warsaw',
  kobenhavn:'copenhagen', athina:'athens', bruxelles:'brussels', antwerpen:'antwerp',
  gent:'ghent', den:'the'
};

/** ตัดชื่อทีมให้เหลือแก่น: ตัวเล็ก เอาแต่ตัวอักษร/เลข ตัดคำต่อท้าย แล้วแปลชื่อเมือง
    "OH Leuven W" -> "oh leuven w" · "Sparta Praha" -> "sparta prague" */
function lsNorm_(s) {
  var raw = String(s === null || s === undefined ? '' : s).toLowerCase();
  raw = raw.replace(/[à-å]/g, 'a').replace(/[è-ë]/g, 'e')
           .replace(/[ì-ï]/g, 'i').replace(/[ò-ö]/g, 'o')
           .replace(/[ù-ü]/g, 'u').replace(/ñ/g, 'n').replace(/ç/g, 'c');
  raw = raw.replace(/[^a-z0-9]+/g, ' ').trim();
  if (!raw) return '';
  var parts = raw.split(/\s+/), out = [], i, w;
  for (i = 0; i < parts.length; i++) {
    w = parts[i];
    if (LS_DROP_[w]) continue;
    if (LS_ALIAS_[w]) w = LS_ALIAS_[w];
    out.push(w);
  }
  /* ตัดหมดเกลี้ยง = ชื่อมันสั้นมากอยู่แล้ว เอาของเดิมไป ดีกว่าคืนค่าว่าง */
  return out.length ? out.join(' ') : raw;
}

/** คู่นี้บอลหญิงไหม — กันจับข้ามทีมชาย/ทีมหญิงชื่อเดียวกัน (Barcelona W กับ Barcelona) */
function lsIsW_(s) {
  var t = String(s === null || s === undefined ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  return /(^| )(w|women|womens|ladies|fem|femenino|feminine|feminin|frauen|dames)( |$)/.test(t);
}

/** ชื่อสองอันนี้คือทีมเดียวกันไหม — เข้มไว้ก่อน ยอมพลาดดีกว่าจับผิดคู่
    ตรงเป๊ะ หรือ อันหนึ่งอยู่ในอีกอัน (และยาวพอจะไม่ใช่เรื่องบังเอิญ) */
function lsSameTeam_(a, b) {
  var x = lsNorm_(a), y = lsNorm_(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 5 && y.indexOf(x) >= 0) return true;
  if (y.length >= 5 && x.indexOf(y) >= 0) return true;
  return false;
}

/** สกอร์จากฟีด — ไม่มี/ไม่ใช่เลข = '' ไม่ใช่ 0 ("0-0" กับ "ยังไม่มีสกอร์" คนละเรื่อง) */
function lsScoreNum_(v) {
  if (v === null || v === undefined || v === '') return '';
  var n = Number(v);
  return (isNaN(n) || n < 0 || Math.floor(n) !== n) ? '' : n;
}

/** ดึงคู่ทั้งวันจากฟีด — คืน [] ถ้าพัง (ห้าม throw ออกไปทำรอบดึงล่ม) */
function lsFetchDay_(ymd) {
  var out = [];
  try {
    var res = UrlFetchApp.fetch(LS_URL_ + ymd + '/0', { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return out;
    var j = JSON.parse(res.getContentText());
    var stages = j.Stages || [];
    for (var s = 0; s < stages.length; s++) {
      var evs = stages[s].Events || [];
      for (var e = 0; e < evs.length; e++) {
        var ev = evs[e];
        var h = (ev.T1 && ev.T1[0]) ? ev.T1[0].Nm : '';
        var a = (ev.T2 && ev.T2[0]) ? ev.T2[0].Nm : '';
        var esd = String(ev.Esd || '');
        if (!h || !a || esd.length !== 14) continue;
        /* สกอร์กับสถานะติดมาด้วยในฟีดเดียวกัน — เอามาใช้ตอนคิดผลบิล (Settle.gs)
           Tr1/Tr2 = สกอร์ · Eps = 'FT' จบแล้ว / 'HT' พักครึ่ง / '67' นาทีที่ 67
           ยังไม่จบ = เก็บมาเฉยๆ ไม่มีใครเอาไปคิดผล */
        out.push({ h: h, a: a, esd: esd, c: String(stages[s].Cnm || ''),
                   hs: lsScoreNum_(ev.Tr1), as: lsScoreNum_(ev.Tr2),
                   st: String(ev.Eps || '') });
      }
    }
  } catch (err) { return []; }
  return out;
}

/** Esd "20260826180000" = เวลา UTC -> เวลาไทย {date:'YYYY-MM-DD', time:'HH:MM'} */
function lsEsdToThai_(esd) {
  var s = String(esd || '');
  if (!/^\d{14}$/.test(s)) return null;
  var t = Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)),
                   Number(s.slice(8, 10)), Number(s.slice(10, 12))) + LS_TH_SHIFT_ * 3600000;
  var z = new Date(t);
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  return {
    date: z.getUTCFullYear() + '-' + p2(z.getUTCMonth() + 1) + '-' + p2(z.getUTCDate()),
    time: p2(z.getUTCHours()) + ':' + p2(z.getUTCMinutes())
  };
}

/** วันรอบๆ วันที่เดาไว้ 3 วัน — คู่ดึกเวลายุโรปไปโผล่คนละวันใน UTC */
function lsDays_(ymdIso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymdIso || ''));
  var base = m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Date.now();
  var out = [], k, z;
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  for (k = -1; k <= 1; k++) {
    z = new Date(base + k * 86400000);
    out.push('' + z.getUTCFullYear() + p2(z.getUTCMonth() + 1) + p2(z.getUTCDate()));
  }
  return out;
}

/** เวลาเตะไทยตัวจริงของคู่นี้ — หาไม่เจอ/เจอหลายคู่ = null (ให้ของเดิมทำงานต่อ) */
function lsWhenThai_(home, away, ymdIso, pool) {
  var rows = pool || lsPool_(ymdIso), qw = lsIsW_(home) || lsIsW_(away);
  var both = null, nb = 0, one = null, no = 0, i, r, h, a;
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    /* บอลหญิงกับบอลชายชื่อทีมซ้ำกัน — หยิบผิดฝั่งคือเวลาคนละคู่ไปเลย */
    if (qw !== (lsIsW_(r.h) || lsIsW_(r.a) || lsIsW_(r.c))) continue;
    h = lsSameTeam_(home, r.h); a = lsSameTeam_(away, r.a);
    if (h && a) { both = r; nb++; }
    else if (h || a) { one = r; no++; }
  }
  /* ตรงทั้งสองทีม = เอาเลย */
  if (nb === 1) return lsEsdToThai_(both.esd);
  if (nb > 1) return null;
  /* สองเว็บเขียนชื่อทีมคนละอย่าง (OH Leuven W / Oud-Heverlee Leuven)
     ตรงข้างเดียวก็เอาได้ แต่ต้องมีคู่เดียวใน 3 วันนั้น ไม่งั้นคือเดา */
  if (no === 1) return lsEsdToThai_(one.esd);
  return null;
}

/** ดึง 3 วันมารวมกัน (ดึงซ้ำวันเดิมในรอบเดียวกันไม่ต้องยิงใหม่) */
var LS_CACHE_ = {};
/* กล่องดำของฟีดนี้ — ถูกบล็อกเมื่อไหร่จะได้รู้ ไม่ใช่เงียบแล้วกลับไปใช้เวลาเพี้ยนแบบเดิม
   เก็บแค่ "วันไหน ได้กี่คู่" ไม่มีชื่อคู่ ไม่มีกุญแจ (เปิดดูที่ ?p=ping ได้) */
var LS_LOG_ = [];
function lsPool_(ymdIso) {
  var days = lsDays_(ymdIso), out = [], i, d;
  for (i = 0; i < days.length; i++) {
    d = days[i];
    if (!LS_CACHE_[d]) {
      LS_CACHE_[d] = lsFetchDay_(d);
      LS_LOG_.push(d + '=' + LS_CACHE_[d].length);
    }
    out = out.concat(LS_CACHE_[d]);
  }
  return out;
}

/* ---------- สกอร์จบเกม (ให้ Settle.gs เอาไปคิดผลบิล) ----------
   เข้มกว่าเวลาเตะอีกชั้น เพราะคิดผิด = ตัวเลขเงินในสมุดผิด แก้ทีหลังไม่รู้ตัว
   เงื่อนไขครบทุกข้อถึงจะคืนสกอร์:
     1. ตรงทั้งสองทีม (ตรงข้างเดียวไม่เอา ต่างจาก lsWhenThai_ ที่ยอมได้)
     2. เจอคู่เดียวใน 3 วันนั้น
     3. Eps = 'FT' เท่านั้น — ยังเตะอยู่/พักครึ่ง/เลื่อน/ยกเลิก = ไม่คิด
        ต่อเวลา (AET) ก็ไม่คิด เพราะราคาที่แทงเป็นราคา 90 นาที ฟีดให้สกอร์รวมต่อเวลามา */
function lsScoreOf_(home, away, ymdIso, pool) {
  var rows = pool || lsPool_(ymdIso), qw = lsIsW_(home) || lsIsW_(away);
  var hit = null, n = 0, i, r;
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    if (qw !== (lsIsW_(r.h) || lsIsW_(r.a) || lsIsW_(r.c))) continue;
    if (!lsSameTeam_(home, r.h) || !lsSameTeam_(away, r.a)) continue;
    hit = r; n++;
  }
  if (n !== 1) return null;
  if (String(hit.st || '').toUpperCase() !== 'FT') return null;
  if (hit.hs === '' || hit.as === '') return null;
  return { hs: hit.hs, as: hit.as };
}
