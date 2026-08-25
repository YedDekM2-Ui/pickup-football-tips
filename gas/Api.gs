/* Api.gs — ท่อส่งข้อมูลออกให้หน้าเว็บ อ่านอย่างเดียว
   หน้าเว็บไม่มีกุญแจอะไรเลย ที่นี่จึงห้ามส่งอะไรที่เป็นความลับออกไป */

function nowIso_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss") + '+07:00';
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function r2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function teamMap_() {
  var rows = readObjects_(SHEETS.TEAMS), m = {};
  for (var i = 0; i < rows.length; i++) {
    var en = String(rows[i]['ชื่ออังกฤษ'] || '').trim();
    if (en) m[en] = String(rows[i]['ชื่อไทย'] || '').trim();
  }
  return m;
}

function th_(tmap, en) {
  var k = String(en === null || en === undefined ? '' : en).trim();
  return (tmap && tmap[k]) ? tmap[k] : '';
}

function betOut_(r, tmap) {
  return {
    'ID': String(r['ID'] || ''),
    'Parent_ID': String(r['Parent_ID'] || ''),
    'Bill_Type': String(r['Bill_Type'] || 'MAIN'),
    'วันที่': String(r['วันที่'] || ''),
    'ลีก': String(r['ลีก'] || ''),
    'เหย้า': String(r['ทีมเหย้า'] || ''), 'เหย้าไทย': th_(tmap, r['ทีมเหย้า']),
    'เยือน': String(r['ทีมเยือน'] || ''), 'เยือนไทย': th_(tmap, r['ทีมเยือน']),
    'ทีมที่เลือก': String(r['ทีมที่เลือก'] || ''),
    'ทีมที่เลือกไทย': th_(tmap, r['ทีมที่เลือก']),
    'ตลาด': String(r['ตลาด'] || ''),
    'แฮนดิแคป': r['แฮนดิแคป'] === '' ? '' : Number(r['แฮนดิแคป']),
    'เส้น': r['เส้น'] === '' ? '' : Number(r['เส้น']),
    'ทายสกอร์': String(r['ทายสกอร์'] || ''),
    'ราคา': Number(r['ราคา']) || 0,
    'เงิน': Number(r['เงิน']) || 0,
    'เวลาเตะ': String(r['เวลาเตะ'] || ''),
    'สถานะ': String(r['สถานะ'] || STATUS.WAIT),
    'สกอร์เหย้า': r['สกอร์เหย้า'] === '' ? '' : Number(r['สกอร์เหย้า']),
    'สกอร์เยือน': r['สกอร์เยือน'] === '' ? '' : Number(r['สกอร์เยือน']),
    'ผล': String(r['ผล'] || ''),
    'กำไร': r['กำไร'] === '' ? '' : Number(r['กำไร'])
    /* ตั้งใจไม่ส่ง: Telegram_Message_ID, กุญแจกันซ้ำ, สร้างเมื่อ, อัปเดตเมื่อ */
  };
}

function nestBets_(rows, tmap) {
  var byId = {}, tops = [], kids = [], i;
  for (i = 0; i < rows.length; i++) {
    var b = betOut_(rows[i], tmap);
    if (b['Parent_ID'] === '') { b.subs = []; byId[b['ID']] = b; tops.push(b); }
    else kids.push(b);
  }
  for (i = 0; i < kids.length; i++) {
    var k = kids[i], p = byId[k['Parent_ID']];
    if (p) p.subs.push(k);
    else { k.subs = []; tops.push(k); }   /* หาแม่ไม่เจอ = เด้งขึ้นมา ห้ามหายเงียบ */
  }
  for (i = 0; i < tops.length; i++) {
    var t = tops[i], money = Number(t['เงิน']) || 0, gain = Number(t['กำไร']) || 0;
    for (var s = 0; s < t.subs.length; s++) {
      money += Number(t.subs[s]['เงิน']) || 0;
      gain  += Number(t.subs[s]['กำไร']) || 0;
    }
    t['รวมเงิน'] = r2_(money);
    t['รวมกำไร'] = r2_(gain);
  }
  return tops;
}

function ledgerStats_(rows) {
  var done = [], i;
  for (i = 0; i < rows.length; i++) {
    if (String(rows[i]['ผล'] || '') !== '') done.push(rows[i]);
  }
  var profit = 0, staked = 0, win = 0, push = 0, byDay = {};
  for (i = 0; i < done.length; i++) {
    var r = done[i], res = String(r['ผล']);
    profit += Number(r['กำไร']) || 0;
    staked += Number(r['เงิน']) || 0;
    if (res === RESULT.WIN_FULL) win += 1;
    else if (res === RESULT.WIN_HALF) win += 0.5;
    else if (res === RESULT.PUSH) push += 1;
    var d = String(r['วันที่'] || '');
    byDay[d] = (byDay[d] || 0) + (Number(r['กำไร']) || 0);
  }
  var days = Object.keys(byDay).sort(), run = 0, curve = [];
  for (i = 0; i < days.length; i++) {
    run += byDay[days[i]];
    curve.push({ 'วันที่': days[i], 'สะสม': r2_(run) });
  }
  var denom = done.length - push;
  return {
    'กำไรสะสม': r2_(profit),
    'ลงไปทั้งหมด': r2_(staked),
    'จำนวนใบ': done.length,
    'อัตราชนะ': denom > 0 ? Math.round((win / denom) * 1000) / 1000 : null,
    'เส้นกราฟ': curve
  };
}

function pickOut_(r, tmap) {
  return {
    'id': String(r['ID'] || ''),
    'ช่อง': String(r['ช่อง'] || ''),
    'ลีก': String(r['ลีก'] || ''),
    'เหย้า': String(r['ทีมเหย้า'] || ''), 'เหย้าไทย': th_(tmap, r['ทีมเหย้า']),
    'เยือน': String(r['ทีมเยือน'] || ''), 'เยือนไทย': th_(tmap, r['ทีมเยือน']),
    'เวลาเตะ': String(r['เวลาเตะ'] || ''),
    'เปอร์เซ็นต์': Number(r['เปอร์เซ็นต์']) || 0,
    'ราคา': Number(r['ราคา']) || 0
  };
}

function payloadAll_() {
  var tmap = teamMap_();
  var betRows = readObjects_(SHEETS.BETS);
  var pickRows = readObjects_(SHEETS.PICKS);
  var picks = [];
  for (var i = 0; i < pickRows.length; i++) picks.push(pickOut_(pickRows[i], tmap));
  return {
    ok: true,
    at: nowIso_(),
    picks: picks,
    bets: nestBets_(betRows, tmap),
    ledger: ledgerStats_(betRows)
  };
}

function doGet(e) {
  try {
    var p = (e && e.parameter && e.parameter.p) ? String(e.parameter.p) : 'all';
    if (p === 'ping') return jsonOut_({ ok: true, at: nowIso_() });
    return jsonOut_(payloadAll_());
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}
