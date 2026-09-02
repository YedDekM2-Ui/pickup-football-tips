/* Api.gs — ท่อส่งข้อมูลออกให้หน้าเว็บ อ่านอย่างเดียว
   หน้าเว็บไม่มีกุญแจอะไรเลย ที่นี่จึงห้ามส่งอะไรที่เป็นความลับออกไป */

function nowIso_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss") + '+07:00';
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* คายข้อความดิบตามที่ฟังก์ชันคืนมา ไม่ห่อ ไม่แปลง
   มีไว้ให้ 3 ทางที่ "สคริปต์" กิน ไม่ใช่คน (fbhist / fbcrit = JSON · f5dump = JSONL)
   ห่อเมื่อไหร่ฝั่งที่กินต้องแกะ 2 ชั้น — ของเดิมในบอทเก่าคายดิบ ต้องคายดิบเหมือนกัน */
function textOut_(str) {
  return ContentService.createTextOutput(String(str == null ? '' : str));
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

/** ชีตกลืนข้อความเป็น Date ได้ (เช่น "3-1" -> 1 มี.ค. / "02:18" -> 30 ธ.ค. 1899)
    ค่าที่โดนกลืนแล้ว "ย้อนกลับไม่ได้" (1 มี.ค. เป็นได้ทั้ง 3-1 และ 1-3) จึงปล่อยว่าง
    ห้ามเดาให้ — กฎข้อ 6
    ใครเติมกลับ: fbFixMarkets_ ใน Forebet.gs (คู่ปักหมุดโดนด่านกันซ้ำเด้ง ไม่ได้เติมเองอัตโนมัติ) */
function noDate_(v) {
  if (v instanceof Date) return '';
  return String(v === null || v === undefined ? '' : v);
}

/** เวลาที่ลงแถว — ถ้าชีตกลืนเป็น Date ก็แปลงกลับเป็นข้อความเวลาไทยให้หน้าเว็บอ่านออก */
function stamp_(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return Utilities.formatDate(v, TZ, "yyyy-MM-dd'T'HH:mm:ss") + '+07:00';
  }
  return String(v === null || v === undefined ? '' : v);
}

function pickOut_(r, tmap) {
  return {
    'id': String(r['ID'] || ''),
    'ช่อง': String(r['ช่อง'] || ''),
    'ลีก': String(r['ลีก'] || ''),
    'เหย้า': String(r['ทีมเหย้า'] || ''), 'เหย้าไทย': th_(tmap, r['ทีมเหย้า']),
    'เยือน': String(r['ทีมเยือน'] || ''), 'เยือนไทย': th_(tmap, r['ทีมเยือน']),
    /* วัน/เวลา ต้องผ่านตัวแปลงเสมอ ไม่งั้นแถวที่ชีตกลืนเป็น Date จะโชว์ "30 ธ.ค. 42" */
    'วันที่': fbYmd_(r['วันที่']),
    'เวลาเตะ': fbHm_(r['เวลาเตะ']),
    'เดาผล': String(r['เดาผล'] || ''),
    'เดาสกอร์': noDate_(r['เดาสกอร์']),
    'เปอร์เซ็นต์': Number(r['เปอร์เซ็นต์']) || 0,
    'ราคา': Number(r['ราคา']) || 0,
    'ดึงเมื่อ': stamp_(r['สร้างเมื่อ']),   /* คู่ปักหมุดต้องบอกได้ว่าภาพนี้ของตอนไหน */
    /* ตลาดจากหน้าของคู่ — เรทกับเปอร์เซ็นต์ส่งเป็น "ข้อความ" ตามที่เขาโชว์ (+150/-208) ห้ามแปลงเป็นตัวเลข */
    'เรทOver': noDate_(r['เรท Over']),
    'เรทBTTSYes': noDate_(r['เรท BTTS YES']),
    'HTเดาผล': noDate_(r['HT เดาผล']),
    'HTเปอร์เซ็นต์': noDate_(r['HT %']),
    'HTเรท': noDate_(r['HT เรท']),
    '1X2เปอร์เซ็นต์': noDate_(r['1X2 %']),
    'Overเปอร์เซ็นต์': noDate_(r['Over %']),
    'BTTSเปอร์เซ็นต์': noDate_(r['BTTS YES %']),
    'DBเปอร์เซ็นต์': noDate_(r['DB %']),
    'DBเดาผล': noDate_(r['DB เดาผล']),
    'HTFTเปอร์เซ็นต์': noDate_(r['HT/FT %']),
    'HTFTเดาผล': noDate_(r['HT/FT เดาผล'])
  };
}

/* nowMs = เวลาที่ใช้ตัดสินว่า "ยังไม่ถึงเวลาเตะ" — ปกติไม่ต้องส่ง (ใช้เวลาจริง)
   มีไว้ให้เทสต์ตรึงเวลาได้ ไม่งั้นเทสต์จะพังเองเมื่อวันเปลี่ยน */
function payloadAll_(nowMs) {
  var now = nowMs || Date.now();
  var tmap = teamMap_();
  var betRows = readObjects_(SHEETS.BETS);
  var pickRows = readObjects_(SHEETS.PICKS);
  /* ภาพนิ่งเก่าเกินกำหนด = ไปดึงใหม่ตรงนี้เลย (ไม่พึ่ง trigger เพราะ deployment นี้ไม่ได้ขอสิทธิ์ไว้)
     ดึงไม่ได้ก็ผ่าน — ของเก่าต้องขึ้นเหมือนเดิม */
  if (fbAutoSnap_(pickRows, now)) pickRows = readObjects_(SHEETS.PICKS);
  /* หน้าเว็บเอาเฉพาะคู่ที่ยังไม่ถึงเวลาแข่ง (เจ้าของสั่ง) — ชีตยังเก็บของเก่าไว้ครบเหมือนเดิม */
  var live = fbUpcoming_(pickRows, now);
  var picks = [];
  for (var i = 0; i < live.length; i++) picks.push(pickOut_(live[i], tmap));
  return {
    ok: true,
    at: nowIso_(),
    picks: picks,
    pinned: fbPinned_(live, tmap),       /* Featured / Pick of the day ที่ยังไม่เตะ */
    bets: nestBets_(betRows, tmap),
    ledger: ledgerStats_(betRows)
  };
}

/* ด่านกุญแจ — เว็บแอปเปิดให้ Anyone เข้าถึง (จำเป็น) กุญแจจึงเป็นด่านเดียวที่กันคนอื่น
   ตั้งค่าที่ Project Settings > Script Properties ชื่อ APP_KEY เท่านั้น ห้ามเขียนลงไฟล์
   ยังไม่ตั้ง = ปิดตาย ไม่ใช่เปิดหมด (บทเรียน ADMIN_KEY ของ PIKTAX) */
function keyOk_(q) {
  var want = prop_('APP_KEY');
  if (!want) return false;
  return String((q && q.k) || '') === want;
}

function doGet(e) {
  try {
    var q = (e && e.parameter) ? e.parameter : {};
    var p = q.p ? String(q.p) : 'all';
    /* ping = ทางเดียวที่ไม่ต้องใช้กุญแจ จึงคายได้แค่ของที่ไม่ใช่ความลับ
       พ่วง "กล่องดำ" ของรอบดึงล่าสุดมาด้วย (รหัส HTTP / ไปทางไหน / ได้กี่คู่ / พลาดเพราะอะไร)
       ไม่มีชื่อคู่ ไม่มีข้อมูลในชีต ไม่มีกุญแจ — มีไว้ให้ไล่ปัญหาได้โดยไม่ต้องขอกุญแจจากเจ้าของ
       และให้มันออกไปดึงเองได้ด้วย ถ้าถึงคิวแล้ว: ของที่ดึงมาเป็นของสาธารณะจาก forebet ล้วนๆ
       ตัวหน่วง (2 นาทีเมื่อล้ม / 10 นาทีเมื่อสำเร็จ) เป็นตัวกันคนกดรัวอยู่แล้ว จึงเปิดทางนี้ได้ */
    if (p === 'ping') {
      try { fbAutoSnap_(readObjects_(SHEETS.PICKS), Date.now()); } catch (err) { /* ping ต้องตอบได้เสมอ */ }
      var alog = '';
      try { alog = PropertiesService.getScriptProperties().getProperty('AUTH_LOG') || ''; } catch (err) { alog = ''; }
      return jsonOut_({ ok: true, at: nowIso_(), กดอนุญาตล่าสุด: alog, ดึงล่าสุด: fbLastReport_() });
    }
    if (!keyOk_(q)) return jsonOut_({ ok: false, needKey: true, error: 'ต้องใส่กุญแจ' });
    /* 2 ทางนี้ต้องอยู่หลังด่านกุญแจ — มันยิงเน็ตออกและเขียนชีต ไม่ใช่ทางอ่านเฉยๆ */
    if (p === 'snap') {
      return jsonOut_(fbSnapRun_());
    }
    if (p === 'fbprobe') return jsonOut_(fbProbe_());
    /* ---------- talkfootball ----------
       tfgrade = เกรดผลของเมื่อวาน/วันนี้ลงแท็บ TalkFootball (ยิงเน็ต+เขียนชีต จึงอยู่หลังกุญแจ)
       โปรเจกต์นี้ไม่มี trigger — เจ้าของกดลิงก์นี้เอง ควรกดวันละครั้งตอนเช้า
       tftext/tfstat = ดูข้อความเดียวกับที่บอทตอบ โดยไม่ต้องกวนแชท */
    if (p === 'tfgrade') return jsonOut_({ ok: true, ผล: tfGradeLog_() });
    if (p === 'tftext')  return jsonOut_({ ok: true, ข้อความ: tfText_() });
    if (p === 'tfstat')  return jsonOut_({ ok: true, ข้อความ: tfStatsText_(q.d || 30) });
    /* ---------- ใบค่าคุ้มก่อนเกม (fb_value.py ยิงเข้ามา) ----------
       3 ทางนี้เป็นทางของ "ตัวเฝ้าบน GitHub Actions" ไม่ใช่ของคน
       fvalert = ส่งใบ+จดชีต · fvpending = ถามว่าค้างใบไหน · fvgrade = เติมผล
       อยู่หลังกุญแจทั้งหมด เพราะมันส่งข้อความออกและเขียนชีต */
    if (p === 'fvalert')   return jsonOut_({ ok: true, ผล: fvAlert_(q.text, q.meta) });
    if (p === 'fvpending') return jsonOut_({ ok: true, ค้าง: fvPending_() });
    if (p === 'fvgrade')   return jsonOut_({ ok: true, ผล: fvGrade_(q.data) });
    if (p === 'fvstat')    return jsonOut_({ ok: true, ข้อความ: fvStatsText_() });
    /* ---------- ใบเตือนบอลสด FABEL5 (ย้ายมาจากบอทเก่า) ----------
       ทางของ "ตัวเฝ้าบน GitHub Actions" ไม่ใช่ของคน — อยู่หลังกุญแจทั้งหมด
       เพราะมันส่งข้อความออกหาเจ้าของและเขียนชีต
       f5alert = ส่งใบ+จดชีต · f5stamp = จดนาทีที่ลูกมา · f5grade = เติมผลจากสกอร์จบ
       f5del   = ลบใบทดสอบที่ทำ % เพี้ยน · f5poke = สะกิด workflow ให้ตื่น
       f5stat/f5report = ดูข้อความเดียวกับที่บอทตอบ โดยไม่ต้องกวนแชท
       f5dump  = คาย JSONL ดิบ ห้ามห่อ (ฝั่งที่กินคือสคริปต์) */
    if (p === 'f5alert')  return jsonOut_({ ok: true, ผล: f5Alert_(q.text, q.meta) });
    if (p === 'f5stamp')  return jsonOut_({ ok: true, ผล: f5Stamp_(q.data) });
    if (p === 'f5grade')  return jsonOut_({ ok: true, ผล: f5Grade_(q.data) });
    if (p === 'f5del')    return jsonOut_({ ok: true, ผล: f5Del_(q.id) });
    if (p === 'f5stat')   return jsonOut_({ ok: true, ข้อความ: f5StatsText_() });
    if (p === 'f5report') return jsonOut_({ ok: true, ข้อความ: f5ReportText_(String(q.force || '') === '1') });
    if (p === 'f5poke')   return jsonOut_({ ok: true, ผล: f5Poke() });
    if (p === 'f5dump')   return textOut_(f5Dump_(String(q.since || '')));
    /* ---------- ทีเด็ดก่อนเกม FootballTips (ย้ายมาจากบอทเก่า) ----------
       fbgrade = ดึงสกอร์จริงมาเติมคอลัมน์ "ผล" (ยิงเน็ต+เขียนชีต)
       fbstat  = ข้อความเดียวกับที่บอทตอบ /สถิติบอล
       fbhist/fbcrit = ของดิบให้ตัวคัดบอลเอาไปคิดเกณฑ์เอง — คาย JSON ดิบ ห้ามห่อ
       ทางลงรายการทีเด็ดอยู่ที่ doPost (?p=fbtips) เพราะส่งมาทีละหลายสิบคู่ */
    if (p === 'fbgrade') return jsonOut_({ ok: true, ผล: fbtGradeTips_() });
    if (p === 'fbstat')  return jsonOut_({ ok: true, ข้อความ: fbtStatsText_(q.d || 30) });
    if (p === 'fbhist')  return textOut_(fbtHistoryJson_(String(q.fbhist || q.d || '')));
    if (p === 'fbcrit')  return textOut_(fbtCritJson_(q.d || 45));
    /* ---------- คิดผลบิล ----------
       score = ใส่สกอร์เอง (ทางหลัก เจ้าของพิมพ์เองได้เสมอ ไม่ต้องรอฟีด)
       settle = สั่งให้มันไล่หาสกอร์จบเกมเองรอบเดียว (ทางเสริม)
       ทั้ง 2 ทางอยู่หลังด่านกุญแจ เพราะมันเขียนตัวเลขเงินลงชีต */
    if (p === 'score') {
      return jsonOut_(stlWrite_(q.id, q.h, q.a, { force: String(q.force || '') === '1' }));
    }
    if (p === 'settle') return jsonOut_(stlAutoRun_());
    /* ---------- ผูก/ตรวจ webhook เทเลแกรม ----------
       ต้องส่งที่อยู่ exec มาเอง (?url=...) เพราะ ScriptApp.getService().getUrl()
       ขอ scope script.scriptapp ซึ่งโปรเจกต์นี้ไม่ใส่โดยตั้งใจ
       ทั้ง 2 ทางไม่คายที่อยู่ webhook กลับมา เพราะในนั้นมีกุญแจ TG_HOOK_KEY ติดอยู่ */
    if (p === 'me') return jsonOut_(tgMe_());
    if (p === 'setchat') return jsonOut_(tgSetChat_(String(q.id || '')));
  if (p === 'hook') return jsonOut_(tgSetHook_(String(q.url || '')));
    if (p === 'hookinfo') return jsonOut_(tgHookInfo_());
    if (p === 'hookoff') return jsonOut_(tgOffHook_());   /* สวิตช์ปิดบอท กดจากมือถือได้ */
    /* เปิดหน้าเว็บ = ถือโอกาสไล่คิดผลบิลที่เตะจบแล้ว (มีตัวหน่วง 10 นาทีในตัว)
       โปรเจกต์นี้ไม่มี trigger โดยตั้งใจ งานอัตโนมัติจึงเกาะรอบเปิดหน้าเว็บแทน
       พังตรงนี้ห้ามลามไปทำให้หน้าเว็บไม่ขึ้น */
    try { stlAutoTick_(); } catch (err) { /* คิดผลไม่ได้ก็แค่ยังไม่คิด */ }
    return jsonOut_(payloadAll_());
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ---------- ทางเขียน: ลงบิลจากหน้าเว็บ ----------
   ส่งมาแบบ POST body เป็น JSON (content-type ปล่อยเป็น text/plain ฝั่งหน้าเว็บ
   เบราว์เซอร์จะได้ไม่ต้องยิง preflight ซึ่ง GAS ไม่รองรับ)
   ด่านกุญแจอันเดียวกับ doGet — ไม่มีกุญแจ = ไม่ให้เขียน */
function doPost(e) {
  try {
    var q = (e && e.parameter) ? e.parameter : {};
    var body = {};
    try {
      if (e && e.postData && e.postData.contents) body = JSON.parse(e.postData.contents) || {};
    } catch (er) { return jsonOut_({ ok: false, error: 'อ่านข้อมูลที่ส่งมาไม่ออก' }); }

    /* ---------- สายเข้าจากเทเลแกรม ----------
       ต้องอยู่ก่อนด่าน APP_KEY เพราะที่อยู่ webhook ไปนอนอยู่บนเซิร์ฟเวอร์เทเลแกรม
       เอากุญแจหน้าเว็บไปฝากไว้ที่นั่นไม่ได้ — มันมีกุญแจของตัวเอง TG_HOOK_KEY
       ยังไม่ตั้งกุญแจ = ปิดตาย (บทเรียน ADMIN_KEY ของ PIKTAX)
       ตอบ 200 เสมอ ไม่งั้นเทเลแกรมยิงซ้ำจนข้อความเด้งซ้อน */
    if (String(q.p || body.p || '') === 'tg') {
      var hk = prop_('TG_HOOK_KEY');
      if (!hk || String(q.s || '') !== hk) return jsonOut_({ ok: false });
      try { tgHandle_(body); } catch (er2) { /* พังก็ต้องตอบ 200 */ }
      return jsonOut_({ ok: true });
    }

    if (!keyOk_({ k: q.k || body.k || '' })) {
      return jsonOut_({ ok: false, needKey: true, error: 'ต้องใส่กุญแจ' });
    }
    var p = String(q.p || body.p || '');
    if (p === 'ocr') return jsonOut_(betOcr_(body.image));
    if (p === 'bet') return jsonOut_(betAdd_(body.bet || {}, { force: !!body.force }));
    /* ใส่สกอร์จากหน้าเว็บ — ทางเดียวกับ ?p=score แต่ยิงจากหน้าจอมือถือได้ตรงๆ */
    if (p === 'score') return jsonOut_(stlWrite_(body.id, body.h, body.a, { force: !!body.force }));
    /* ลงทีเด็ด FootballTips ทีละชุด — ตัวคัดบอลบน GitHub Actions ยิงเข้ามา
       รับ 2 ทรง: { p:'fbtips', rows:[...] } ของใหม่ และ { fbtips:[...] } ของเดิมในบอทเก่า
       (ของเดิมยังต้องใช้ได้ ไม่งั้นต้องไปแก้สคริปต์ฝั่งโน้นพร้อมกัน)
       ต่างจากบอทเก่าตรงที่ทางนี้อยู่หลังด่านกุญแจ — ฝั่งยิงเก็บกุญแจใน secret อยู่แล้ว */
    if (p === 'fbtips' || body.fbtips) {
      return jsonOut_({ ok: true, ผล: fbtLog_(body.fbtips || body.rows || [], String(body.day || '')) });
    }
    return jsonOut_({ ok: false, error: 'ไม่รู้จักคำสั่ง ' + p });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}
