/* Settle.gs — คิดผลบิล: สกอร์จบเกม -> แพ้/ชนะ/คืนทุน -> กำไรเป็นตัวเลข

   นี่คือชิ้นที่หายไปของสมุดบัญชี: ก่อนหน้านี้ทุกบิลลงไปแล้วค้างที่ "รอเตะ" ตลอดกาล
   หน้า 3 เลยโชว์ 0 ทุกช่อง ทั้งที่มีบิลเต็มชีต

   กฎของไฟล์นี้
   1. คิดไม่ออก = ไม่แตะแถวนั้น (คืน null) ห้ามเดาผลเด็ดขาด
      บิลค้าง "รอเตะ" แก้ทีหลังได้ แต่ตัวเลขเงินที่ผิดไปแล้วไม่มีใครรู้ตัว
   2. ทางเขียนผลมีทางเดียวคือ stlWrite_ และเขียนได้แค่ 6 ช่อง
      (สถานะ · สกอร์เหย้า · สกอร์เยือน · ผล · กำไร · อัปเดตเมื่อ) ห้ามแตะช่องอื่นของแถวเก่า
   3. มีผลแล้วไม่เขียนทับ ต้องสั่ง force มาเท่านั้น
   4. ราคา/แฮนดิแคป/เส้น/สกอร์ ห้ามปัด — ปัดได้อย่างเดียวคือ "กำไร" ทศนิยม 2 ตำแหน่ง
*/

/** ครึ่งลูก = เส้นแบ่งของบอลลูกครึ่ง (0.25/0.75) — ชนะครึ่ง/แพ้ครึ่งเกิดตรงนี้ */
var STL_Q_ = 0.25;

function stlR2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/** ตัวเลขจากชีต — ว่าง/ไม่ใช่เลข = '' (ไม่ใช่ 0) */
function stlNum_(v) {
  if (v === null || v === undefined) return '';
  var s = String(v).trim().replace(/,/g, '');
  if (s === '') return '';
  var n = Number(s);
  return isNaN(n) ? '' : n;
}

/** สกอร์ต้องเป็นจำนวนเต็มไม่ติดลบเท่านั้น — '' คือ "ยังไม่รู้สกอร์" */
function stlGoal_(v) {
  var n = stlNum_(v);
  if (n === '' || n < 0 || Math.floor(n) !== n) return '';
  return n;
}

/** ระยะห่างจากเส้น -> ผลแพ้ชนะ (ใช้ร่วมกันทั้งแฮนดิแคปและสูง/ต่ำ)
      > +0.25  ชนะเต็ม
      = +0.25  ชนะครึ่ง (ได้ครึ่งเดียว)
      =  0     คืนทุน
      = -0.25  แพ้ครึ่ง (เสียครึ่งเดียว)
      < -0.25  แพ้เต็ม */
function stlVerdict_(margin) {
  var m = Number(margin);
  if (isNaN(m)) return '';
  if (m > STL_Q_) return RESULT.WIN_FULL;
  if (m === STL_Q_) return RESULT.WIN_HALF;
  if (m === 0) return RESULT.PUSH;
  if (m === -STL_Q_) return RESULT.LOSS_HALF;
  if (m < -STL_Q_) return RESULT.LOSS_FULL;
  /* เหลือช่วง 0 < |m| < 0.25 ซึ่งเกิดไม่ได้กับเส้นบอลจริง (เส้นเป็นทวีคูณของ 0.25 เสมอ)
     มาถึงตรงนี้ = ข้อมูลแปลก ไม่คิดให้ ดีกว่าคิดมั่ว */
  return '';
}

/** กำไรจริงเป็นเงิน — ราคาแบบทศนิยม (1.78 = ได้กำไร 0.78 เท่าของเงินแทง)
    ตรวจกับใบจริง 300@1.78 : ชนะเต็ม +234 · ชนะครึ่ง +117 · แพ้ครึ่ง -150 · แพ้เต็ม -300 */
function stlProfit_(result, stake, odds) {
  var s = Number(stake) || 0, o = Number(odds) || 0;
  var win = s * (o - 1);
  if (result === RESULT.WIN_FULL) return stlR2_(win);
  if (result === RESULT.WIN_HALF) return stlR2_(win / 2);
  if (result === RESULT.PUSH) return 0;
  if (result === RESULT.LOSS_HALF) return stlR2_(-s / 2);
  if (result === RESULT.LOSS_FULL) return stlR2_(-s);
  return '';
}

/** ระยะห่างจากเส้นของบิลใบนี้ — คิดไม่ได้ = null
    (ตลาดที่ไม่มีเส้น เช่น เสมอ/สกอร์ตรง ไม่ผ่านทางนี้) */
function stlMargin_(bet, hs, as) {
  var mkt = String((bet && bet['ตลาด']) || '').trim();
  if (mkt === 'AH') {
    var pick = String(bet['ทีมที่เลือก'] || '').trim();
    var home = String(bet['ทีมเหย้า'] || '').trim();
    var away = String(bet['ทีมเยือน'] || '').trim();
    var hdp = stlNum_(bet['แฮนดิแคป']);
    if (hdp === '') return null;
    if (pick && pick === home) return (hs - as) + hdp;
    if (pick && pick === away) return (as - hs) + hdp;
    return null;                       /* ทีมที่เลือกไม่ใช่ทีมในคู่นี้ = ข้อมูลเพี้ยน ไม่คิด */
  }
  if (mkt === 'OVER_UNDER') {
    var line = stlNum_(bet['เส้น']);
    if (line === '') return null;
    /* เส้นบวก = แทงสูง · เส้นลบ = แทงต่ำ (ตรงกับที่หน้า 2 โชว์ใน marketLine) */
    var total = hs + as, abs = Math.abs(line);
    return line >= 0 ? (total - abs) : (abs - total);
  }
  return null;
}

/** คิดผลบิลใบเดียว — คืน null แปลว่า "คิดไม่ได้ อย่าแตะแถวนี้" */
function stlOne_(bet, hs, as) {
  var h = stlGoal_(hs), a = stlGoal_(as);
  if (h === '' || a === '') return null;
  var mkt = String((bet && bet['ตลาด']) || '').trim();
  var stake = stlNum_(bet['เงิน']), odds = stlNum_(bet['ราคา']);
  if (stake === '' || odds === '' || stake <= 0 || odds <= 1) return null;

  var res = '';
  if (mkt === 'AH' || mkt === 'OVER_UNDER') {
    var m = stlMargin_(bet, h, a);
    if (m === null) return null;
    res = stlVerdict_(m);
  } else if (mkt === 'DRAW') {
    res = (h === a) ? RESULT.WIN_FULL : RESULT.LOSS_FULL;
  } else if (mkt === 'CORRECT_SCORE') {
    var g = /^\s*(\d+)\s*[-:]\s*(\d+)\s*$/.exec(String(bet['ทายสกอร์'] || ''));
    if (!g) return null;
    res = (Number(g[1]) === h && Number(g[2]) === a) ? RESULT.WIN_FULL : RESULT.LOSS_FULL;
  } else {
    return null;                       /* ตลาดที่ระบบยังไม่รู้จัก = ให้เจ้าของใส่ผลเอง */
  }
  if (!res) return null;

  return {
    'สถานะ': STATUS.DONE,
    'สกอร์เหย้า': h,
    'สกอร์เยือน': a,
    'ผล': res,
    'กำไร': stlProfit_(res, stake, odds)
  };
}

/* ---------- ทางเขียนลงชีต ---------- */

var STL_COLS_ = ['สถานะ', 'สกอร์เหย้า', 'สกอร์เยือน', 'ผล', 'กำไร'];

/** ใส่สกอร์ให้บิล + บิลย่อยของมันทุกใบ (คู่เดียวกัน สกอร์เดียวกัน)
    opt.force = เขียนทับใบที่มีผลแล้ว (ใส่สกอร์ผิดแล้วมาแก้)
    ไม่เจอรหัส = โยน error ให้รู้ตัว · บางใบคิดไม่ได้ = ข้ามใบนั้น ใบอื่นลงตามปกติ */
function stlWrite_(id, hs, as, opt) {
  opt = opt || {};
  var want = String(id || '').trim();
  if (!want) throw new Error('ไม่ได้บอกรหัสบิล');
  var h = stlGoal_(hs), a = stlGoal_(as);
  if (h === '' || a === '') throw new Error('สกอร์ต้องเป็นจำนวนเต็ม เช่น 2 กับ 1');

  var sh = sheetIfExists_(SHEETS.BETS);
  if (!sh) return { ok: false, error: 'ยังไม่มีชีต ' + SHEETS.BETS, 'ลง': 0 };
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return { ok: false, error: 'ยังไม่มีบิลในชีต', 'ลง': 0 };

  var head = vals[0], col = {}, c;
  for (c = 0; c < head.length; c++) col[String(head[c])] = c;
  var need = STL_COLS_.concat(['อัปเดตเมื่อ', 'ID', 'Parent_ID']);
  for (c = 0; c < need.length; c++) {
    if (col[need[c]] === undefined) {
      return { ok: false, error: 'ชีตไม่มีคอลัมน์ ' + need[c], 'ลง': 0 };
    }
  }

  var stamp = nowIso_(), done = [], skip = [], found = false, r, k, o;
  for (r = 1; r < vals.length; r++) {
    o = {};
    for (k = 0; k < head.length; k++) o[String(head[k])] = vals[r][k];
    var rid = String(o['ID'] || '').trim();
    var pid = String(o['Parent_ID'] || '').trim();
    if (rid !== want && pid !== want) continue;
    found = true;

    if (!opt.force && String(o['ผล'] || '').trim() !== '') {
      skip.push(rid + ' (มีผลแล้ว)');
      continue;
    }
    var v = stlOne_(o, h, a);
    if (!v) { skip.push(rid + ' (คิดผลไม่ได้)'); continue; }

    for (c = 0; c < STL_COLS_.length; c++) {
      sh.getRange(r + 1, col[STL_COLS_[c]] + 1, 1, 1).setValues([[v[STL_COLS_[c]]]]);
    }
    sh.getRange(r + 1, col['อัปเดตเมื่อ'] + 1, 1, 1).setValues([[stamp]]);
    done.push({ ID: rid, 'ผล': v['ผล'], 'กำไร': v['กำไร'] });
  }
  if (!found) throw new Error('ไม่มีบิลรหัส ' + want + ' ในชีต');
  return { ok: true, 'ลง': done.length, 'ใบ': done, 'ข้าม': skip };
}

/* ---------- ตรวจผลเองอัตโนมัติ ----------
   ไม่มี trigger (ใส่ scope script.scriptapp ไม่ได้ เจ้าของต้องกดอนุญาตใหม่ทั้งชุด)
   ใช้วิธีเดียวกับที่ Forebet ใช้อยู่: เปิดหน้าเว็บทีไร ก็เก็บงานค้างให้ทีนั้น */

var STL_WAIT_MIN_ = 115;    /* เตะจบจริง ~105 นาที เผื่อทดเจ็บ + เวลาที่ฟีดกว่าจะอัปเดต */
var STL_MAX_ = 30;          /* ยิงฟีดหนักเกินทำหน้าเว็บอืด — เอาแค่ 30 ใบต่อรอบ */

/** เวลาเตะในชีต -> มิลลิวินาที (อ่านไม่ออก = 0 แปลว่าอย่าเพิ่งไปยุ่ง) */
function stlKickMs_(v) {
  if (v instanceof Date) return v.getTime();
  var s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) return 0;
  var t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

/** เก็บงานค้าง: บิลที่เตะจบแล้วแต่ยังไม่มีผล -> ไปถามฟีดว่าจบกี่ต่อกี่
    ฟีดไม่ตอบ / จับคู่ไม่ได้ / ยังไม่ FT = ข้ามเงียบๆ รอบหน้าค่อยว่ากัน */
function stlAutoRun_(nowMs) {
  var now = nowMs || Date.now();
  var rows = readObjects_(SHEETS.BETS);
  var seen = {}, todo = [], i, o;
  for (i = 0; i < rows.length; i++) {
    o = rows[i];
    if (String(o['ผล'] || '').trim() !== '') continue;
    if (String(o['Parent_ID'] || '').trim() !== '') continue;   /* บิลย่อยลงพร้อมบิลแม่อยู่แล้ว */
    var kick = stlKickMs_(o['เวลาเตะ']);
    if (!kick || now - kick < STL_WAIT_MIN_ * 60000) continue;
    var id = String(o['ID'] || '').trim();
    if (!id || seen[id]) continue;
    seen[id] = 1;
    todo.push(o);
    if (todo.length >= STL_MAX_) break;
  }

  var out = { 'ตรวจ': todo.length, 'ลง': 0, 'ยังไม่จบ': 0, 'พลาด': [] };
  for (i = 0; i < todo.length; i++) {
    o = todo[i];
    var sc = null;
    try {
      sc = lsScoreOf_(o['ทีมเหย้า'], o['ทีมเยือน'], String(o['วันที่'] || '').slice(0, 10));
    } catch (e) { sc = null; }
    if (!sc) { out['ยังไม่จบ']++; continue; }
    try {
      var w = stlWrite_(o['ID'], sc.hs, sc.as);
      out['ลง'] += (w && w['ลง']) || 0;
    } catch (e2) {
      out['พลาด'].push(String(o['ID']) + ': ' + e2.message);
    }
  }
  return out;
}

/** เรียกจากหน้าเว็บ — กันยิงฟีดรัวตอนกดรีเฟรชถี่ๆ (เว้นอย่างน้อย 10 นาที)
    ไม่มีบิลค้างเลย = ไม่แตะเน็ตสักครั้ง */
var STL_TICK_MIN_ = 10;
function stlAutoTick_(nowMs) {
  var now = nowMs || Date.now();
  var cache = CacheService.getScriptCache();
  var last = Number(cache.get('stl.tick') || 0);
  if (last && now - last < STL_TICK_MIN_ * 60000) return null;
  cache.put('stl.tick', String(now), STL_TICK_MIN_ * 120);
  try { return stlAutoRun_(now); } catch (e) { return { 'พลาด': [String(e.message)] }; }
}
