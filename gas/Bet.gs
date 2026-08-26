/* Bet.gs — ทางเขียน "บิลของเราเอง" ลงชีต BETS

   นี่คือครึ่งที่หายไปของโปรเจกต์: หน้า 2 กับหน้า 3 อ่านชีต BETS ได้มานานแล้ว
   แต่ไม่เคยมีทางเอาบิลเข้าไปเลย สองหน้านั้นเลยว่างตลอด

   กฎของไฟล์นี้
   1. ทางเขียน BETS มีทางเดียวคือ betAdd_ ห้ามมีใครไปเขียนเองที่อื่น
   2. ของที่กรอกมาไม่ครบ = ไม่ลงชีต แล้วบอกเป็นภาษาคนว่าขาดอะไร
      (แถวขยะในชีตแก้ยากกว่ากรอกใหม่)
   3. ราคา/แฮนดิแคป/เส้น/สกอร์ ห้ามปัด ห้ามแปลง — เก็บตามสลิปเป๊ะ (กฎข้อ 6)
   4. OCR ไม่มีสิทธิ์ลงชีตเอง มันแค่ "อ่านมาให้ดู" แล้วเจ้าของกดยืนยัน
      รูปเบลอแล้วลงเงียบๆ อันตรายกว่าพิมพ์เอง */

function betS_(v) { return String(v === null || v === undefined ? '' : v).trim(); }

/** ตัวเลขจากสลิป: ตัด ',' ที่คั่นหลักออก
    ว่าง = '' ไม่ใช่ 0 — "แฮนดิแคป 0" กับ "ไม่ได้กรอกแฮนดิแคป" คนละเรื่องกัน */
function betNum_(v) {
  var s = betS_(v).replace(/,/g, '');
  if (s === '') return '';
  var n = Number(s);
  return isNaN(n) ? '' : n;
}

/** ชื่อตลาดจากปากคน/จาก OCR ให้กลายเป็นรหัสที่หน้า 2 รู้จัก
    หน้า 2 รู้จักแค่ 4 ตัวนี้ (page-mybet.js marketLine) นอกนั้นมันจะโชว์เป็นรหัสดิบ */
function betMarket_(v) {
  var s = betS_(v).toUpperCase().replace(/[\s_-]/g, '');
  if (s === 'AH' || s === 'HDP' || s === 'HANDICAP') return 'AH';
  if (s === 'OVERUNDER' || s === 'OU' || s === 'OVER' || s === 'UNDER') return 'OVER_UNDER';
  if (s === 'DRAW' || s === 'X') return 'DRAW';
  if (s === 'CORRECTSCORE' || s === 'CS') return 'CORRECT_SCORE';
  var t = betS_(v);
  if (t.indexOf('แฮน') >= 0 || t.indexOf('ต่อ') >= 0) return 'AH';
  if (t.indexOf('สูง') >= 0 || t.indexOf('ต่ำ') >= 0) return 'OVER_UNDER';
  if (t.indexOf('เสมอ') >= 0) return 'DRAW';
  if (t.indexOf('สกอร์') >= 0) return 'CORRECT_SCORE';
  return betS_(v).toUpperCase();
}

/** วันเวลาเตะเป็น ISO +07:00 — หน้า 2 เอาไปนับถอยหลังด้วย Date.parse ต้องเป็นเวลาไทยเสมอ
    รับได้ทั้ง ISO เต็ม / '2026-08-27' + '00:00' / '27/8/2026' + '00:00'
    อ่านไม่ออก = คืน '' แล้วให้ betNorm_ ไปฟ้องเอง ห้ามเดาวันให้เจ้าของ */
function betWhenIso_(ymd, hm) {
  var d = betS_(ymd), t = betS_(hm);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(d)) return d.slice(0, 16) + ':00+07:00';
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d);
  if (!m) {
    var e = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d);   /* วัน/เดือน/ปี แบบที่เจ้าของเขียนเอง */
    if (e) m = [d, e[3], e[2], e[1]];
  }
  if (!m) return '';
  var k = /^(\d{1,2}):(\d{2})$/.exec(t);
  var hh = k ? Number(k[1]) : 0, mi = k ? Number(k[2]) : 0;
  if (hh > 23 || mi > 59) return '';
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  return m[1] + '-' + p2(Number(m[2])) + '-' + p2(Number(m[3])) +
         'T' + p2(hh) + ':' + p2(mi) + ':00+07:00';
}

/** กุญแจกันซ้ำ — กันส่งรูปเดิมสองที / กดปุ่มบันทึกรัว
    ใส่ราคากับเงินเข้าไปด้วย เพราะ "แทงคู่เดิมเพิ่มอีกไม้คนละราคา" เป็นเรื่องปกติ
    ถ้าไม่ใส่ ระบบจะไปบล็อกไม้ที่สองของเจ้าของเอง */
function betKey_(n) {
  return [n['วันที่'], n['ทีมเหย้า'], n['ทีมเยือน'], n['ตลาด'],
          n['ทีมที่เลือก'], n['แฮนดิแคป'], n['เส้น'], n['ทายสกอร์'],
          n['ราคา'], n['เงิน'], n['Parent_ID']].join('|');
}

/** จัดของที่กรอกมาให้เข้ารูป + ฟ้องเป็นภาษาคนถ้าขาด
    ฟ้องทีเดียวให้ครบทุกช่องที่ขาด ไม่ใช่ฟ้องทีละช่องให้กรอกใหม่หลายรอบ */
function betNorm_(o) {
  o = o || {};
  var miss = [];
  var n = {
    'Parent_ID': betS_(o['Parent_ID']),
    'Bill_Type': betS_(o['Bill_Type']) || (betS_(o['Parent_ID']) ? 'SUB' : 'MAIN'),
    'ลีก': betS_(o['ลีก']),
    'ทีมเหย้า': betS_(o['ทีมเหย้า']),
    'ทีมเยือน': betS_(o['ทีมเยือน']),
    'ทีมที่เลือก': betS_(o['ทีมที่เลือก']),
    'ตลาด': betMarket_(o['ตลาด']),
    'แฮนดิแคป': betNum_(o['แฮนดิแคป']),
    'เส้น': betNum_(o['เส้น']),
    'ทายสกอร์': betS_(o['ทายสกอร์']),
    'ราคา': betNum_(o['ราคา']),
    'เงิน': betNum_(o['เงิน'])
  };
  n['เวลาเตะ'] = betWhenIso_(o['วันที่'], o['เวลา'] === undefined ? o['เวลาเตะ'] : o['เวลา']);
  n['วันที่'] = n['เวลาเตะ'] ? n['เวลาเตะ'].slice(0, 10) : '';

  if (!n['ทีมเหย้า']) miss.push('ทีมเหย้า');
  if (!n['ทีมเยือน']) miss.push('ทีมเยือน');
  if (!n['เวลาเตะ']) miss.push('วันเวลาเตะ');
  if (n['ราคา'] === '' || n['ราคา'] <= 1) miss.push('ราคา (ต้องมากกว่า 1)');
  if (n['เงิน'] === '' || n['เงิน'] <= 0) miss.push('เงินที่แทง');
  if (!n['ตลาด']) miss.push('ตลาด');

  if (n['ตลาด'] === 'AH') {
    if (!n['ทีมที่เลือก']) miss.push('ทีมที่เลือก');
    if (n['แฮนดิแคป'] === '') miss.push('แฮนดิแคป');
  }
  if (n['ตลาด'] === 'OVER_UNDER' && n['เส้น'] === '') miss.push('เส้นสูง/ต่ำ');
  if (n['ตลาด'] === 'CORRECT_SCORE' && !n['ทายสกอร์']) miss.push('สกอร์ที่ทาย');

  /* ทีมที่เลือกต้องเป็นทีมใดทีมหนึ่งในคู่นี้ ไม่งั้นหน้า 2 จะโชว์ชื่อทีมที่ไม่มีอยู่ในคู่ */
  if (n['ทีมที่เลือก'] && n['ทีมที่เลือก'] !== n['ทีมเหย้า'] && n['ทีมที่เลือก'] !== n['ทีมเยือน']) {
    miss.push('ทีมที่เลือกต้องเป็น "' + n['ทีมเหย้า'] + '" หรือ "' + n['ทีมเยือน'] + '"');
  }
  n['คู่แข่ง'] = n['ทีมที่เลือก'] === n['ทีมเหย้า'] ? n['ทีมเยือน']
              : (n['ทีมที่เลือก'] === n['ทีมเยือน'] ? n['ทีมเหย้า'] : '');

  if (miss.length) throw new Error('กรอกไม่ครบ: ' + miss.join(' · '));
  n['กุญแจกันซ้ำ'] = betKey_(n);
  return n;
}

function betNewId_(now) {
  return 'B' + Utilities.formatDate(now || new Date(), TZ, 'yyyyMMddHHmmss');
}

/** ลงบิลจริง
    ซ้ำ = ไม่ลงซ้ำ แต่บอกว่าของเดิมอยู่รหัสไหน (opt.force ทับได้ ถ้าตั้งใจแทงซ้ำเป๊ะๆ จริง) */
function betAdd_(o, opt) {
  opt = opt || {};
  var n = betNorm_(o);
  var rows = readObjects_(SHEETS.BETS);
  var i;
  if (!opt.force) {
    for (i = 0; i < rows.length; i++) {
      if (betS_(rows[i]['กุญแจกันซ้ำ']) === n['กุญแจกันซ้ำ']) {
        return { ok: true, dup: true, id: betS_(rows[i]['ID']),
                 error: 'บิลนี้ลงไปแล้ว (' + betS_(rows[i]['ID']) + ') ไม่ได้ลงซ้ำให้' };
      }
    }
  }
  /* บิลย่อยต้องมีบิลแม่จริง ไม่งั้นมันจะไปโผล่เป็นบิลเดี่ยวลอยๆ ที่หน้า 2 (nestBets_) */
  if (n['Parent_ID']) {
    var found = false;
    for (i = 0; i < rows.length; i++) if (betS_(rows[i]['ID']) === n['Parent_ID']) { found = true; break; }
    if (!found) throw new Error('ไม่มีบิลแม่รหัส ' + n['Parent_ID'] + ' ในชีต');
  }
  var stamp = nowIso_();
  n['ID'] = betS_(o['ID']) || betNewId_(new Date());
  n['สถานะ'] = STATUS.WAIT;
  n['Telegram_Message_ID'] = betS_(o['Telegram_Message_ID']);
  n['สร้างเมื่อ'] = stamp;
  n['อัปเดตเมื่อ'] = stamp;

  var sh = sheetEnsure_(SHEETS.BETS, HEADERS.BETS);
  var arr = [];
  for (var c = 0; c < HEADERS.BETS.length; c++) {
    var h = HEADERS.BETS[c];
    arr.push(n[h] === undefined ? '' : n[h]);
  }
  sh.appendRow(arr);
  return { ok: true, dup: false, id: n['ID'], bet: n };
}

/* ---------- อ่านสลิปจากรูป ----------
   OCR อ่านมาให้ "กรอกให้ล่วงหน้า" เท่านั้น ไม่มีสิทธิ์ลงชีตเอง
   ตัวอ่านห้ามโยน error เด็ดขาด — อ่านไม่ออกก็คืนช่องว่างไป ให้คนกรอกเอง
   รูปเบลอแล้วลงชีตเงียบๆ อันตรายกว่าปล่อยให้พิมพ์เอง */

/** คุยกับ Google Vision ด้วย API key (ไม่ต้องขอสิทธิ์ OAuth เพิ่ม เพราะเรามี external_request อยู่แล้ว)
    กุญแจอยู่ใน Script Property 'VISION_KEY' เท่านั้น ห้ามฝังในไฟล์ */
function betVisionText_(b64) {
  var key = prop_('VISION_KEY');
  if (!key) throw new Error('ยังไม่ได้ตั้งกุญแจ VISION_KEY');
  var img = String(b64 || '').replace(/^data:[^;]*;base64,/, '');
  if (!img) throw new Error('ไม่มีรูป');
  var res = UrlFetchApp.fetch('https://vision.googleapis.com/v1/images:annotate?key=' + encodeURIComponent(key), {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      requests: [{ image: { content: img }, features: [{ type: 'TEXT_DETECTION' }] }]
    })
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code !== 200) throw new Error('Vision ตอบ ' + code);
  var j = JSON.parse(body);
  var r = (j.responses && j.responses[0]) ? j.responses[0] : {};
  if (r.error && r.error.message) throw new Error('Vision: ' + r.error.message);
  return (r.fullTextAnnotation && r.fullTextAnnotation.text) ? r.fullTextAnnotation.text : '';
}

/** แกะข้อความสลิปแบบหลวมๆ — ได้เท่าไหร่เอาเท่านั้น ห้าม throw
    ทุกช่องที่คืนไป เจ้าของเห็นในฟอร์มก่อนกดบันทึกเสมอ */
function betParse_(text) {
  var out = { 'ลีก': '', 'ทีมเหย้า': '', 'ทีมเยือน': '', 'วันที่': '', 'เวลา': '',
              'ตลาด': '', 'ทีมที่เลือก': '', 'แฮนดิแคป': '', 'เส้น': '',
              'ทายสกอร์': '', 'ราคา': '', 'เงิน': '' };
  var s = String(text || '');
  if (!s) return out;
  var lines = s.split(/\r?\n/), i, ln;

  /* คู่แข่งขัน: บรรทัดที่มี vs / VS / v. คั่นกลาง */
  for (i = 0; i < lines.length; i++) {
    var mm = /^(.{2,40}?)\s+(?:vs?\.?|VS|V)\s+(.{2,40}?)$/.exec(lines[i].trim());
    if (mm) { out['ทีมเหย้า'] = mm[1].trim(); out['ทีมเยือน'] = mm[2].trim();
              if (i > 0 && !out['ลีก']) out['ลีก'] = lines[i - 1].trim(); break; }
  }

  for (i = 0; i < lines.length; i++) {
    ln = lines[i];
    if (!out['วันที่']) {
      var d1 = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(ln);
      var d2 = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(ln);
      if (d1) out['วันที่'] = d1[0];
      else if (d2) out['วันที่'] = d2[0];
    }
    if (!out['เวลา']) {
      var t1 = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(ln);
      if (t1) out['เวลา'] = t1[0];
    }
  }

  /* ตลาด: ดูจากคำที่โผล่ในสลิป */
  if (/สูง|ต่ำ|over|under|o\/u/i.test(s)) out['ตลาด'] = 'OVER_UNDER';
  if (/แฮน|ต่อ|handicap|\bah\b|hdp/i.test(s)) out['ตลาด'] = 'AH';
  if (/เสมอ|\bdraw\b/i.test(s)) out['ตลาด'] = 'DRAW';
  if (/สกอร์ตรง|correct\s*score/i.test(s)) out['ตลาด'] = 'CORRECT_SCORE';

  if (out['ตลาด'] === 'OVER_UNDER') {
    var ou = /(สูง|ต่ำ|over|under)\s*([0-9]+(?:\.[0-9]+)?)/i.exec(s);
    if (ou) {
      var v = Number(ou[2]);
      out['เส้น'] = /ต่ำ|under/i.test(ou[1]) ? -v : v;      /* ลบ = ต่ำ (หน้า 2 อ่านแบบนี้) */
    }
  }
  if (out['ตลาด'] === 'AH') {
    var ah = /([+-]\s*[0-9]+(?:\.[0-9]+)?)/.exec(s);
    if (ah) out['แฮนดิแคป'] = Number(ah[1].replace(/\s+/g, ''));
  }
  if (out['ตลาด'] === 'CORRECT_SCORE') {
    var cs = /\b(\d)\s*[-:]\s*(\d)\b/.exec(s);
    if (cs) out['ทายสกอร์'] = cs[1] + '-' + cs[2];
  }

  /* ราคา: เลขทศนิยมท้ายเครื่องหมาย @ หรือหลังคำว่าราคา/odds */
  var od = /(?:@|ราคา|odds?)\s*([0-9]+\.[0-9]+)/i.exec(s);
  if (od) out['ราคา'] = Number(od[1]);

  /* เงิน: หลังคำว่าเดิมพัน/แทง/stake/bet — เอาเลขที่มีคอมม่าได้ */
  var st = /(?:เดิมพัน|แทง|ยอด|stake|bet)\s*[:：]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/i.exec(s);
  if (st) out['เงิน'] = Number(st[1].replace(/,/g, ''));

  return out;
}

/** ทางที่หน้าเว็บเรียกตอนส่งรูปเข้ามา — คืนช่องที่กรอกให้ล่วงหน้า ไม่แตะชีต */
function betOcr_(b64) {
  var text = betVisionText_(b64);
  return { ok: true, text: text, fields: betParse_(text) };
}
