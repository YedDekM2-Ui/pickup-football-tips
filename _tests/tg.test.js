/* tg.test.js — บอทเทเลแกรม
   ข้อที่ต้องพิสูจน์:
     1. คนอื่นทัก = เงียบสนิท (ไม่ตอบ ไม่บอกว่ามีบอทอยู่)
     2. ยังไม่ตั้ง TG_CHAT = บอกเลขห้องอย่างเดียว ไม่ยอมทำงานอื่น
     3. ถอดสกอร์ไม่ออก = ไม่เดา
     4. ไม่มีกุญแจ TG_HOOK_KEY = ปิดตาย ไม่ใช่เปิดหมด
     5. ห้ามคาย url ของ webhook กลับออกมา (ในนั้นมีกุญแจ) */

const { loadGas, fakeResponse } = require('./gasEnv');
const { FakeSpreadsheetApp } = require('./fakeSheet');

const HEAD_BETS = ['ID','Parent_ID','Bill_Type','วันที่','ลีก','ทีมเหย้า','ทีมเยือน',
  'ทีมที่เลือก','คู่แข่ง','ตลาด','แฮนดิแคป','เส้น','ทายสกอร์','ราคา','เงิน','เวลาเตะ',
  'สถานะ','สกอร์เหย้า','สกอร์เยือน','ผล','กำไร','Telegram_Message_ID','กุญแจกันซ้ำ',
  'สร้างเมื่อ','อัปเดตเมื่อ'];

function bet(o) {
  const g = { 'ID':'B1', 'Parent_ID':'', 'Bill_Type':'MAIN', 'วันที่':'2026-08-25', 'ลีก':'EPL',
    'ทีมเหย้า':'Arsenal', 'ทีมเยือน':'Chelsea', 'ทีมที่เลือก':'Arsenal', 'คู่แข่ง':'Chelsea',
    'ตลาด':'AH', 'แฮนดิแคป':0, 'เส้น':'', 'ทายสกอร์':'', 'ราคา':1.78, 'เงิน':300,
    'เวลาเตะ':'2026-08-25T21:45:00+07:00', 'สถานะ':'รอเตะ', 'สกอร์เหย้า':'', 'สกอร์เยือน':'',
    'ผล':'', 'กำไร':'', 'Telegram_Message_ID':'', 'กุญแจกันซ้ำ':'', 'สร้างเมื่อ':'', 'อัปเดตเมื่อ':'' };
  return Object.assign(g, o);
}

/** env — props ตั้งเองได้ · จดทุกครั้งที่บอทยิงออกไปที่ __sent */
function env(props, bets, extra) {
  const p = Object.assign({ SHEET_ID: 'S' }, props || {});
  const sent = [];
  const book = { BETS: [HEAD_BETS].concat((bets || []).map(b => HEAD_BETS.map(h => b[h]))) };
  const g = loadGas(
    ['gas/Config.gs','gas/Sheets.gs','gas/Api.gs','gas/Forebet.gs','gas/Live.gs','gas/Settle.gs','gas/Tg.gs'],
    {
      SpreadsheetApp: new FakeSpreadsheetApp(book),
      PropertiesService: { getScriptProperties: () => ({
        getProperty: (k) => (k in p ? p[k] : null),
        setProperty: (k, v) => { p[k] = String(v); },
        deleteProperty: (k) => { delete p[k]; }
      }) },
      UrlFetchApp: { fetch: (url, opt) => {
        sent.push({ url: String(url), body: JSON.parse((opt && opt.payload) || '{}') });
        return fakeResponse(200, JSON.stringify({ ok: true, result: {} }));
      } },
      Utilities: { formatDate: () => '2026-08-27T10:00:00' },
      CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
      ContentService: { MimeType: { JSON: 'json' },
        createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } })
      },
      ...(extra || {})
    });
  g.__sent = sent;
  return g;
}

function msg(chatId, text) { return { message: { chat: { id: chatId }, text: text } }; }

/* ---------- ด่านเจ้าของ ---------- */

test('คนอื่นทัก = เงียบสนิท ไม่ยิงอะไรออกไปเลย', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  eq(g.tgHandle_(msg(999, '/สรุป')), '', 'ต้องคืนค่าว่าง');
  eq(g.__sent.length, 0, 'ห้ามส่งอะไรกลับไปหาคนแปลกหน้า');
});

test('ยังไม่ตั้ง TG_CHAT = บอกเลขห้อง แล้วจบ ไม่ทำคำสั่งอื่น', () => {
  const g = env({ TG_TOKEN: 'T' });
  const out = g.tgHandle_(msg(555, '/สรุป'));
  ok(out.indexOf('TG_CHAT') >= 0, 'ต้องบอกชื่อ property ที่ต้องไปตั้ง');
  ok(out.indexOf('555') >= 0, 'ต้องบอกเลขห้อง');
  ok(out.indexOf('กำไร') < 0, 'ห้ามเผลอตอบสรุปให้คนที่ยังไม่รู้ว่าเป็นใคร');
  eq(g.__sent.length, 1);
});

test('ข้อความไม่มี message = เงียบ ไม่พัง', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  eq(g.tgHandle_({}), '');
  eq(g.tgHandle_(null), '');
});

/* ---------- ถอดสกอร์ ---------- */

test('ถอดสกอร์ได้ตามรูปแบบที่บอกไว้', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  eq(g.tgParseScore_('B7 2-1'), { id: 'B7', h: '2', a: '1' });
  eq(g.tgParseScore_('B7 2 - 1'), { id: 'B7', h: '2', a: '1' }, 'มีช่องว่างคร่อมขีดก็ได้');
  eq(g.tgParseScore_('B7 0:0'), { id: 'B7', h: '0', a: '0' }, 'ใช้ทวิภาคได้');
  eq(g.tgParseScore_('B7 10-11'), { id: 'B7', h: '10', a: '11' }, 'สองหลักได้');
});

test('ถอดไม่ออก = null ไม่เดา', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  eq(g.tgParseScore_('สวัสดี'), null);
  eq(g.tgParseScore_('B7'), null, 'มีแต่รหัส ไม่มีสกอร์');
  eq(g.tgParseScore_('2-1'), null, 'มีแต่สกอร์ ไม่รู้ว่าใบไหน');
  eq(g.tgParseScore_('B7 2-1 ชนะ'), null, 'มีอย่างอื่นต่อท้าย = ไม่แน่ใจ อย่าเดา');
  eq(g.tgParseScore_(''), null);
});

test('พิมพ์มั่ว = บอกว่าไม่เข้าใจ ไม่เงียบ', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  const out = g.tgHandle_(msg(111, 'อยากได้เงิน'));
  eq(out.indexOf('ไม่เข้าใจ'), 0, 'ต้องบอกก่อนว่าไม่เข้าใจ');
  ok(out.indexOf('/help') > 0, 'แล้วชี้ทางไปดูเมนู');
});

/* ---------- คำสั่งอ่านข้อมูล ---------- */

test('/บิล เอาเฉพาะใบแม่ที่ยังไม่รู้ผล', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [
    bet({ ID: 'B1' }),
    bet({ ID: 'B2', 'ผล': 'WIN_FULL' }),
    bet({ ID: 'B3', Parent_ID: 'B1' })
  ]);
  const out = g.tgHandle_(msg(111, '/บิล'));
  ok(out.indexOf('B1') >= 0, 'ใบแม่ที่ยังไม่รู้ผลต้องขึ้น');
  ok(out.indexOf('B2') < 0, 'ใบที่รู้ผลแล้วไม่ต้องขึ้น');
  ok(out.indexOf('B3') < 0, 'ใบลูกคิดรวมในใบแม่แล้ว ไม่ต้องขึ้นซ้ำ');
  ok(out.indexOf('1 ใบ') >= 0, 'ต้องนับถูก');
});

test('/บิล ไม่มีอะไรค้าง = บอกตรงๆ', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [bet({ ID: 'B1', 'ผล': 'PUSH' })]);
  ok(g.tgHandle_(msg(111, '/บิล')).indexOf('ไม่มีบิลค้าง') >= 0);
});

test('/สรุป ยังไม่มีใบรู้ผล = บอกว่ายังไม่มีอะไรให้สรุป', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [bet({ ID: 'B1' })]);
  ok(g.tgHandle_(msg(111, '/สรุป')).indexOf('ยังไม่มีบิลที่รู้ผล') >= 0);
});

test('/สรุป บอกกำไรพร้อมเครื่องหมาย', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [
    bet({ ID: 'B1', 'ผล': 'WIN_FULL', 'กำไร': 234, 'เงิน': 300 })
  ]);
  const out = g.tgHandle_(msg(111, '/สรุป'));
  ok(out.indexOf('+234') >= 0, 'กำไรบวกต้องมีเครื่องหมาย + ให้เห็นชัด');
  ok(out.indexOf('300') >= 0, 'ต้องบอกยอดที่ลงไปด้วย');
});

test('/id บอกเลขห้อง', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  ok(g.tgHandle_(msg(111, '/id')).indexOf('111') >= 0);
});

test('/start /help /เมนู = เมนูเดียวกัน', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  eq(g.tgHandle_(msg(111, '/start')), g.TG_MENU_);
  eq(g.tgHandle_(msg(111, '/help')), g.TG_MENU_);
  eq(g.tgHandle_(msg(111, '/เมนู')), g.TG_MENU_);
});

/* ---------- ใส่สกอร์ผ่านแชท ---------- */

test('พิมพ์สกอร์ = ลงผลจริงในชีต', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [
    bet({ ID: 'B1', 'ตลาด': 'AH', 'แฮนดิแคป': 0, 'ทีมที่เลือก': 'Arsenal', 'ราคา': 1.9, 'เงิน': 100 })
  ]);
  const out = g.tgHandle_(msg(111, 'B1 2-1'));
  ok(out.indexOf('ลงผลแล้ว') >= 0, 'ต้องบอกว่าลงแล้ว');
  ok(out.indexOf('ชนะเต็ม') >= 0, 'ต้องแปลผลเป็นภาษาคน');
  const rows = g.readObjects_('BETS');
  eq(rows[0]['ผล'], 'WIN_FULL', 'ต้องเขียนลงชีตจริง');
});

test('รหัสบิลไม่มีในชีต = บอกเหตุผล ไม่พัง', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [bet({ ID: 'B1' })]);
  const out = g.tgHandle_(msg(111, 'B9 2-1'));
  ok(out.indexOf('ลงผลไม่ได้') >= 0);
  ok(out.indexOf('B9') >= 0, 'ต้องบอกว่าใบไหนที่หาไม่เจอ');
});

test('ใบที่มีผลแล้ว = ไม่ทับของเดิม', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [
    bet({ ID: 'B1', 'ผล': 'WIN_FULL', 'กำไร': 90 })
  ]);
  const out = g.tgHandle_(msg(111, 'B1 0-3'));
  ok(out.indexOf('ลงไม่ได้') >= 0);
  ok(out.indexOf('มีผลแล้ว') >= 0, 'ต้องบอกว่าเพราะมีผลอยู่แล้ว');
  eq(g.readObjects_('BETS')[0]['ผล'], 'WIN_FULL', 'ของเดิมต้องไม่ถูกแตะ');
});

/* ---------- ผูก webhook ---------- */

test('ไม่มี TG_HOOK_KEY = ผูกไม่ได้ ไม่ยิงออกไปเลย', () => {
  const g = env({ TG_TOKEN: 'T' });
  const r = g.tgSetHook_('https://example.com/exec');
  ok(!r.ok);
  ok(String(r.error || '').indexOf('TG_HOOK_KEY') >= 0, 'ต้องบอกว่าขาดอะไร');
  eq(g.__sent.length, 0);
});

test('ไม่มีโทเคน / ไม่มีที่อยู่ = ผูกไม่ได้', () => {
  const g1 = env({ TG_HOOK_KEY: 'x' });
  ok(!g1.tgSetHook_('https://example.com/exec').ok);
  eq(g1.__sent.length, 0);
  const g2 = env({ TG_TOKEN: 'T', TG_HOOK_KEY: 'x' });
  ok(!g2.tgSetHook_('').ok, 'ไม่บอกที่อยู่ exec ก็ผูกไม่ได้');
  eq(g2.__sent.length, 0);
});

test('ผูกสำเร็จ ต้องไม่คายกุญแจกลับมาให้ใครเห็น', () => {
  const g = env({ TG_TOKEN: 'T', TG_HOOK_KEY: 'ลับสุดยอด' });
  const r = g.tgSetHook_('https://example.com/exec');
  ok(r.ok, 'ต้องผูกได้');
  const j = JSON.stringify(r);
  ok(j.indexOf('ลับสุดยอด') < 0, 'ห้ามมีกุญแจในคำตอบ');
  ok(j.indexOf('example.com') < 0, 'ห้ามคายที่อยู่ webhook เพราะกุญแจติดอยู่ในนั้น');
  eq(g.__sent[0].body.url,
     'https://example.com/exec?p=tg&s=' + encodeURIComponent('ลับสุดยอด'),
     'ที่ส่งให้เทเลแกรมต้องมีกุญแจติดไป');
});

/* 2 ก.ย. 69: บอทเงียบ แล้วท่าแก้คือ "ผูก webhook ใหม่" ซึ่งต้องพิมพ์ที่อยู่ exec ยาว ๆ จากมือถือ
   ตัวสคริปต์ถามตัวเองไม่ได้ว่าที่อยู่ตัวเองคืออะไร (ต้องใช้สิทธิ์ที่จะบังคับให้กดอนุญาตใหม่ทั้งชุด)
   เลยให้มันจำไว้ตอนผูกสำเร็จครั้งแรกแทน */
test('ผูกสำเร็จแล้วต้องจำที่อยู่ไว้ ครั้งหน้ากดเปล่า ๆ ก็ผูกได้', () => {
  const g = env({ TG_TOKEN: 'T', TG_HOOK_KEY: 'x' });
  ok(g.tgSetHook_('https://example.com/exec').ok);
  eq(g.prop_('EXEC_URL'), 'https://example.com/exec', 'ต้องจำที่อยู่ไว้');
  const r2 = g.tgSetHook_('');
  ok(r2.ok, 'ครั้งที่ 2 ไม่ต้องบอกที่อยู่ก็ได้');
  eq(g.__sent[1].body.url, 'https://example.com/exec?p=tg&s=x', 'ต้องใช้ที่อยู่ที่จำไว้');
});

test('ผูกไม่สำเร็จ ห้ามจำที่อยู่ผิด ๆ ไว้', () => {
  const g = env({ TG_HOOK_KEY: 'x' });            /* ไม่มีโทเคน = ผูกไม่ได้ */
  ok(!g.tgSetHook_('https://ผิด/exec').ok);
  eq(!!g.prop_('EXEC_URL'), false, 'ห้ามจำ');
});

test('tgHookUrl_ ไม่มีกุญแจ = คืนค่าว่าง', () => {
  const g = env({ TG_TOKEN: 'T' });
  eq(g.tgHookUrl_('https://example.com/exec'), '');
});

test('tgHookInfo_ ไม่คายที่อยู่', () => {
  const g = env({ TG_TOKEN: 'T', TG_HOOK_KEY: 'ลับสุดยอด' });
  g.UrlFetchApp.fetch = () => fakeResponse(200, JSON.stringify({
    ok: true, result: { url: 'https://example.com/exec?p=tg&s=ลับสุดยอด', pending_update_count: 0 }
  }));
  const j = JSON.stringify(g.tgHookInfo_());
  ok(j.indexOf('ลับสุดยอด') < 0, 'ห้ามมีกุญแจ');
  ok(j.indexOf('example.com') < 0, 'ห้ามมีที่อยู่');
});

/* ---------- ทางเข้า ?p=tg ---------- */

const post_ = (g, q, body) =>
  JSON.parse(g.doPost({ parameter: q, postData: { contents: JSON.stringify(body || {}) } }).getContent());

test('?p=tg ไม่มี TG_HOOK_KEY = ไม่ทำอะไรเลย', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [bet({ ID: 'B1' })]);
  eq(post_(g, { p: 'tg', s: 'อะไรก็ได้' }, msg(111, 'B1 2-1')).ok, false);
  eq(g.__sent.length, 0, 'ห้ามตอบใคร');
  eq(g.readObjects_('BETS')[0]['ผล'], '', 'ชีตต้องไม่ถูกแตะ');
});

test('?p=tg กุญแจผิด = ไม่ทำอะไรเลย', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111', TG_HOOK_KEY: 'ถูก' }, [bet({ ID: 'B1' })]);
  eq(post_(g, { p: 'tg', s: 'ผิด' }, msg(111, 'B1 2-1')).ok, false);
  eq(g.readObjects_('BETS')[0]['ผล'], '');
});

test('?p=tg กุญแจถูก = ทำงานได้โดยไม่ต้องมี APP_KEY', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111', TG_HOOK_KEY: 'ถูก', APP_KEY: 'KK' },
                [bet({ ID: 'B1', 'แฮนดิแคป': -0.5 })]);
  eq(post_(g, { p: 'tg', s: 'ถูก' }, msg(111, 'B1 2-1')).ok, true);
  eq(g.readObjects_('BETS')[0]['ผล'], 'WIN_FULL');
  eq(g.__sent.length, 1, 'ต้องตอบกลับไปในแชท');
});

test('?p=tg ข้างในพัง ก็ยังต้องตอบ 200 ไม่งั้นเทเลแกรมยิงซ้ำ', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111', TG_HOOK_KEY: 'ถูก' });
  g.tgHandle_ = () => { throw new Error('พังกลางทาง'); };
  eq(post_(g, { p: 'tg', s: 'ถูก' }, msg(111, '/สรุป')).ok, true);
});

test('?p=me บอกชื่อบอท ไม่คายโทเคน', () => {
  const g = env({ TG_TOKEN: 'โทเคนลับ' });
  g.UrlFetchApp.fetch = () => fakeResponse(200, JSON.stringify({
    ok: true, result: { username: 'pickup_tips_bot', first_name: 'Pickup' }
  }));
  const r = g.tgMe_();
  eq(r['ชื่อบอท'], '@pickup_tips_bot');
  eq(r['ลิงก์เปิดแชท'], 'https://t.me/pickup_tips_bot');
  ok(JSON.stringify(r).indexOf('โทเคนลับ') < 0, 'ห้ามมีโทเคนในคำตอบ');
});

test('?p=me ไม่มีโทเคน = บอกเหตุผล ไม่พัง', () => {
  const g = env({});
  const r = g.tgMe_();
  ok(!r.ok);
  ok(String(r.error).indexOf('TG_TOKEN') >= 0);
  eq(g.__sent.length, 0);
});

/* ---------- ตั้งเจ้าของผ่านลิงก์ (?p=setchat) ---------- */

test('setchat: เลขถูก = เขียน TG_CHAT + ทักไปทดสอบ', () => {
  const g = env({ TG_TOKEN: 'tok' });
  const r = g.tgSetChat_('123456789');
  ok(r.ok, 'ต้องสำเร็จ');
  eq(g.tgChat_(), '123456789');
  eq(g.__sent.length, 1);
  eq(String(g.__sent[0].body.chat_id), '123456789');
});

test('setchat: เลขมั่ว = ไม่เขียนอะไรเลย ไม่ยิงออก', () => {
  const g = env({ TG_TOKEN: 'tok', TG_CHAT: '999999999' });
  ['', 'abc', '12', 'ห้องผม', '12 34'].forEach((bad) => {
    const r = g.tgSetChat_(bad);
    ok(!r.ok, 'ต้องไม่ผ่าน: ' + bad);
  });
  eq(g.tgChat_(), '999999999');   // ของเดิมต้องไม่ถูกทับ
  eq(g.__sent.length, 0);
});

test('setchat: ทักไม่เข้า = บอกให้ไปกด Start ก่อน', () => {
  const g = env({ TG_TOKEN: 'tok' });
  g.UrlFetchApp.fetch = () => fakeResponse(403, JSON.stringify(
    { ok: false, description: 'Forbidden: bot was blocked by the user' }));
  const r = g.tgSetChat_('123456789');
  ok(!r.ok);
  eq(r['ตั้งแล้ว'], true);
  ok(String(r.error).indexOf('Start') >= 0, 'ต้องบอกทางแก้');
});

test('setchat: ห้องกลุ่ม (เลขติดลบ) ตั้งได้', () => {
  const g = env({ TG_TOKEN: 'tok' });
  ok(g.tgSetChat_('-1001234567890').ok);
  eq(g.tgChat_(), '-1001234567890');
});


/* ---------- ด่านกันเด้งซ้ำ (update_id) ---------- */

/** แคชจริงในหน่วยความจำ — ของเดิมในไฟล์นี้ get() คืน null ตลอด ด่านเลยไม่เคยทำงาน */
function memCache() {
  const box = {};
  return { CacheService: { getScriptCache: () => ({
    get: (k) => (k in box ? box[k] : null),
    put: (k, v) => { box[k] = String(v); }
  }) } };
}

test('เทเลแกรมยิงข้อความเดิมซ้ำ = ตอบครั้งเดียว', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [], memCache());
  const u = { update_id: 77, message: { chat: { id: 111 }, text: '/id' } };
  ok(g.tgHandle_(u).indexOf('111') >= 0, 'ครั้งแรกต้องตอบ');
  eq(g.tgHandle_(u), '', 'ครั้งที่สองต้องเงียบ');
  eq(g.tgHandle_(u), '', 'ยิงอีกกี่รอบก็ต้องเงียบ');
  eq(g.__sent.length, 1, 'ต้องส่งออกไปแค่ครั้งเดียว');
});

test('คนละ update_id = ตอบทั้งคู่ ไม่ใช่กันมั่ว', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [], memCache());
  g.tgHandle_({ update_id: 1, message: { chat: { id: 111 }, text: '/id' } });
  g.tgHandle_({ update_id: 2, message: { chat: { id: 111 }, text: '/id' } });
  eq(g.__sent.length, 2);
});

test('แคชล่ม = ยังตอบได้ ไม่ใช่บอทใบ้', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [],
    { CacheService: { getScriptCache: () => { throw new Error('แคชล่ม'); } } });
  ok(g.tgHandle_({ update_id: 9, message: { chat: { id: 111 }, text: '/id' } }).indexOf('111') >= 0);
});

test('พิมพ์มั่ว = ตอบสั้น ไม่กางเมนูทั้งใบใส่หน้า', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [], memCache());
  const out = g.tgHandle_({ update_id: 5, message: { chat: { id: 111 }, text: 'อิอิ' } });
  ok(out.indexOf('/help') >= 0, 'ต้องบอกทางไปดูเมนู');
  ok(out.indexOf('/สรุป') < 0, 'ห้ามกางเมนูทั้งใบ');
  ok(out.length < 60, 'ต้องสั้น');
});

test('/help ยังกางเมนูเต็มใบเหมือนเดิม', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [], memCache());
  ok(g.tgHandle_({ update_id: 6, message: { chat: { id: 111 }, text: '/help' } }).indexOf('/สรุป') >= 0);
});

/* ---------- setchat ตั้งซ้ำ ---------- */

test('ตั้งเลขห้องเดิมซ้ำ = ไม่ทักซ้ำ (แท็บมือถือรีเฟรชเองก็ไม่เด้ง)', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111111' });
  const r = g.tgSetChat_('111111');
  eq(r.ok, true);
  eq(g.__sent.length, 0, 'ห้ามส่งข้อความทดสอบซ้ำ');
});

test('ตั้งเลขห้องใหม่ = ทักหนึ่งครั้ง', () => {
  const g = env({ TG_TOKEN: 'T' });
  eq(g.tgSetChat_('222222').ok, true);
  eq(g.__sent.length, 1);
});

/* ---------- สวิตช์ปิดบอท ---------- */

test('ปิดบอท = ถอน webhook ทิ้ง พร้อมล้างคิวค้าง', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  const r = g.tgOffHook_();
  eq(r.ok, true);
  eq(r['ปิดแล้ว'], true);
  ok(g.__sent[0].url.indexOf('deleteWebhook') >= 0, 'ต้องเรียก deleteWebhook');
  eq(g.__sent[0].body.drop_pending_updates, true, 'ต้องล้างคิวด้วย ไม่งั้นเปิดกลับมาของเก่าเด้งตาม');
});

test('ยังไม่ตั้งโทเคน = ปิดไม่ได้ บอกเหตุ ไม่เงียบ', () => {
  const g = env({});
  eq(g.tgOffHook_().ok, false);
});

/* ---------- /picktips — ทีเด็ดที่คัดแล้ว ----------
   ข้อที่ต้องพิสูจน์:
     1. ต่ำกว่าเกณฑ์ต้องหายไป (ไม่ใช่โชว์แล้วให้คนอ่านกรองเอง)
     2. ไม่มีอะไรผ่าน = พูดตรงๆ ห้ามลดเกณฑ์เองให้มีของโชว์
     3. TIP_MIN_PCT ขยับเกณฑ์ได้จริงจาก property (เจ้าของแก้จากมือถือ)
     4. ปุ่มลัดต้องติดไปกับข้อความทุกครั้ง ไม่งั้นปุ่มหายกลางทาง */

const HEAD_PICKS_T = ['ID','วันที่','ช่อง','ลีก','ทีมเหย้า','ทีมเยือน','เวลาเตะ',
  'เดาผล','เดาสกอร์','เปอร์เซ็นต์','ราคา','สกอร์จริง','ถูกผิด','สร้างเมื่อ',
  'เรท Over','เรท BTTS YES','HT เดาผล','HT %','HT เรท',
  '1X2 %','Over %','BTTS YES %','DB %','DB เดาผล','HT/FT %','HT/FT เดาผล'];

const NOW_T = Date.parse('2026-08-27T10:00:00+07:00');

function pk(o) {
  const g = {};
  HEAD_PICKS_T.forEach(h => { g[h] = ''; });
  g['วันที่'] = '2026-08-27'; g['เวลาเตะ'] = '21:45'; g['ช่อง'] = 'LIST';
  g['ลีก'] = 'EPL'; g['ทีมเหย้า'] = 'Arsenal'; g['ทีมเยือน'] = 'Chelsea';
  return Object.assign(g, o);
}

/** env ที่มีชีต PICKS ด้วย — ตัวบนสุดของไฟล์นี้มีแต่ BETS */
function envPick(props, picks) {
  const p = Object.assign({ SHEET_ID: 'S' }, props || {});
  const sent = [];
  const g = loadGas(
    ['gas/Config.gs','gas/Sheets.gs','gas/Api.gs','gas/Forebet.gs','gas/Live.gs','gas/Settle.gs','gas/Tg.gs'],
    {
      SpreadsheetApp: new FakeSpreadsheetApp({
        BETS: [HEAD_BETS],
        PICKS: [HEAD_PICKS_T].concat((picks || []).map(x => HEAD_PICKS_T.map(h => x[h]))),
        TEAMS: [['ชื่ออังกฤษ','ชื่อไทย']]
      }),
      PropertiesService: { getScriptProperties: () => ({
        getProperty: (k) => (k in p ? p[k] : null),
        setProperty: (k, v) => { p[k] = String(v); },
        deleteProperty: (k) => { delete p[k]; }
      }) },
      UrlFetchApp: { fetch: (url, opt) => {
        sent.push({ url: String(url), body: JSON.parse((opt && opt.payload) || '{}') });
        return fakeResponse(200, JSON.stringify({ ok: true, result: {} }));
      } },
      Utilities: { formatDate: () => '2026-08-27T10:00:00' },
      CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
      ContentService: { MimeType: { JSON: 'json' },
        createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } })
      }
    });
  g.__sent = sent;
  return g;
}

test('ทีเด็ด: ต่ำกว่าเกณฑ์หายไป สูงกว่าเกณฑ์อยู่', () => {
  const g = envPick({}, [
    pk({ 'ทีมเหย้า':'Arsenal', 'เดาผล':'1', 'เปอร์เซ็นต์':82 }),
    pk({ 'ทีมเหย้า':'Fulham', 'เดาผล':'1', 'เปอร์เซ็นต์':41 })
  ]);
  const out = g.tgPickTips_(NOW_T);
  ok(out.indexOf('Arsenal') >= 0, 'ตัวที่ผ่านต้องอยู่');
  ok(out.indexOf('Fulham') < 0, 'ตัวที่ไม่ถึงเกณฑ์ต้องไม่โผล่');
  ok(out.indexOf('82') >= 0, 'ต้องบอกเปอร์เซ็นต์ที่ใช้ตัดสิน');
});

test('ทีเด็ด: ไม่มีอะไรผ่าน = บอกตรงๆ พร้อมเกณฑ์ ห้ามเงียบหรือลดเกณฑ์เอง', () => {
  const g = envPick({}, [pk({ 'เดาผล':'1', 'เปอร์เซ็นต์':50 })]);
  const out = g.tgPickTips_(NOW_T);
  ok(out.indexOf('70') >= 0, 'ต้องบอกเกณฑ์ที่ใช้');
  ok(out.indexOf('Arsenal') < 0, 'ห้ามแอบโชว์ตัวที่ไม่ผ่าน');
});

test('ทีเด็ด: TIP_MIN_PCT ขยับเกณฑ์ได้จริง', () => {
  const rows = [pk({ 'เดาผล':'1', 'เปอร์เซ็นต์':63 })];
  ok(g_ok(envPick({}, rows).tgPickTips_(NOW_T)) === false, 'เกณฑ์ 70 = ไม่ผ่าน');
  ok(g_ok(envPick({ TIP_MIN_PCT: '60' }, rows).tgPickTips_(NOW_T)) === true, 'ตั้ง 60 แล้วต้องผ่าน');
});
function g_ok(out) { return out.indexOf('Arsenal') >= 0; }

test('ทีเด็ด: เรียงจากมั่นใจสุดลงมา ไม่ใช่เรียงตามเวลา', () => {
  const g = envPick({}, [
    pk({ 'ทีมเหย้า':'Aaa', 'เวลาเตะ':'18:00', 'เดาผล':'1', 'เปอร์เซ็นต์':74 }),
    pk({ 'ทีมเหย้า':'Bbb', 'เวลาเตะ':'23:00', 'เดาผล':'1', 'เปอร์เซ็นต์':91 })
  ]);
  const out = g.tgPickTips_(NOW_T);
  ok(out.indexOf('Bbb') < out.indexOf('Aaa'), 'ตัวมั่นใจกว่าต้องอยู่บน');
});

test('ทีเด็ด: ตลาดอื่นก็คัดได้ ไม่ได้ดูแต่ 1X2', () => {
  const g = envPick({}, [pk({ 'ทีมเหย้า':'Leeds', 'เปอร์เซ็นต์':40, 'BTTS YES %':88 })]);
  const out = g.tgPickTips_(NOW_T);
  ok(out.indexOf('Leeds') >= 0, 'ผ่านด้วยตลาดทั้งคู่ยิง');
  ok(out.indexOf('88') >= 0);
});

test('ทีเด็ด: มีบรรทัดกำกับว่ายังไม่ใช่สถิติที่วัดผลแล้ว', () => {
  const g = envPick({}, [pk({ 'เดาผล':'1', 'เปอร์เซ็นต์':82 })]);
  ok(g.tgPickTips_(NOW_T).indexOf('forebet') >= 0, 'ห้ามให้อ่านเป็นทีเด็ดที่พิสูจน์แล้ว');
});

test('ทีเด็ด: คู่ที่เตะไปแล้วไม่เอามาโชว์', () => {
  const g = envPick({}, [pk({ 'ทีมเหย้า':'Old', 'วันที่':'2026-08-20', 'เดาผล':'1', 'เปอร์เซ็นต์':95 })]);
  ok(g.tgPickTips_(NOW_T).indexOf('Old') < 0);
});

test('ปุ่มลัดติดไปกับข้อความทุกครั้ง', () => {
  const g = envPick({ TG_TOKEN: 'T', TG_CHAT: '111' }, []);
  g.tgSend_('111', 'ทดสอบ');
  const kb = JSON.parse(g.__sent[0].body.reply_markup);
  eq(kb.is_persistent, true, 'ปุ่มต้องไม่หายหลังกด');
  eq(kb.resize_keyboard, true);
  const flat = JSON.stringify(kb.keyboard);
  ok(flat.indexOf('/picktips') >= 0, 'ต้องมีปุ่มทีเด็ด');
  ok(flat.indexOf('/บิล') >= 0);
});

test('เมนูบอกคำสั่ง /picktips ด้วย', () => {
  const g = envPick({ TG_TOKEN: 'T', TG_CHAT: '111' }, []);
  ok(g.tgHandle_({ message: { chat: { id: 111 }, text: '/help' } }).indexOf('/picktips') >= 0);
});

test('พิมพ์ /picktips แล้วได้ใบทีเด็ด ไม่ใช่เมนู', () => {
  const g = envPick({ TG_TOKEN: 'T', TG_CHAT: '111' },
    [pk({ 'ทีมเหย้า':'Arsenal', 'เดาผล':'1', 'เปอร์เซ็นต์':82 })]);
  /* ต้องส่ง NOW_T เข้าไปด้วย — ไม่ส่ง tgHandle_ จะใช้ Date.now() ของเครื่องจริง
     พอวันจริงเลยวันแข่งในข้อมูลทดสอบ คู่จะถูกกรองทิ้ง เทสต์ตกเองตามปฏิทิน */
  const out = g.tgHandle_({ message: { chat: { id: 111 }, text: '/picktips' } }, NOW_T);
  ok(out.indexOf('Arsenal') >= 0);
});

/* ---------- ไล่ปัญหา "กดปุ่มแล้วบอทเงียบ" ----------
   บอทเงียบสนิทได้หลายทาง และทุกทางอยู่ "ก่อน" โค้ดตอบข้อความ ดูจากในโค้ดไม่เห็น
   จึงต้องมีทางถามสภาพจากข้างนอกได้ โดยไม่ต้องใช้กุญแจ APP_KEY (เจ้าของอยู่บนมือถือ) */

test('tgDiag_ บอกได้ว่ากุญแจฮุกที่ฝากไว้กับเทเลแกรม ไม่ตรงกับกุญแจตอนนี้', () => {
  const g = env({ TG_TOKEN: 'T', TG_HOOK_KEY: 'ดอกใหม่', TG_CHAT: '111' });
  g.UrlFetchApp.fetch = () => fakeResponse(200, JSON.stringify({
    ok: true, result: { url: 'https://example.com/exec?p=tg&s=' + encodeURIComponent('ดอกเก่า'),
                        pending_update_count: 7, last_error_message: '' }
  }));
  const d = g.tgDiag_();
  eq(d.ok, true);
  eq(d['ผูกอยู่'], true, 'ผูกอยู่จริง แต่คนละดอก');
  eq(d['กุญแจตรง'], false, 'ต้องจับได้ว่าไม่ตรง');
  eq(d['คิวค้าง'], 7);
});

test('tgDiag_ กุญแจตรง = จริง เมื่อฝากดอกเดียวกันไว้', () => {
  const g = env({ TG_TOKEN: 'T', TG_HOOK_KEY: 'ดอกเดียวกัน', TG_CHAT: '111' });
  g.UrlFetchApp.fetch = () => fakeResponse(200, JSON.stringify({
    ok: true, result: { url: 'https://example.com/exec?p=tg&s=' + encodeURIComponent('ดอกเดียวกัน') }
  }));
  const d = g.tgDiag_();
  eq(d['กุญแจตรง'], true);
  eq(d['ตั้งเจ้าของแล้ว'], true);
});

test('tgDiag_ webhook หลุด = ผูกอยู่ เท็จ', () => {
  const g = env({ TG_TOKEN: 'T', TG_HOOK_KEY: 'k' });
  g.UrlFetchApp.fetch = () => fakeResponse(200, JSON.stringify({ ok: true, result: { url: '' } }));
  const d = g.tgDiag_();
  eq(d['ผูกอยู่'], false);
  eq(d['ตั้งเจ้าของแล้ว'], false, 'ยังไม่ตั้ง TG_CHAT ก็ต้องบอก — เป็นอีกทางที่ทำให้เงียบ');
});

test('tgDiag_ ห้ามคายโทเคน เลขห้อง หรือที่อยู่ webhook', () => {
  const g = env({ TG_TOKEN: 'โทเคนลับ', TG_HOOK_KEY: 'กุญแจลับ', TG_CHAT: '123456789' });
  g.UrlFetchApp.fetch = () => fakeResponse(200, JSON.stringify({
    ok: true, result: { url: 'https://example.com/exec?p=tg&s=' + encodeURIComponent('กุญแจลับ') }
  }));
  const j = JSON.stringify(g.tgDiag_());
  ok(j.indexOf('โทเคนลับ') < 0, 'ห้ามมีโทเคน');
  ok(j.indexOf('กุญแจลับ') < 0, 'ห้ามมีกุญแจ');
  ok(j.indexOf('123456789') < 0, 'ห้ามมีเลขห้อง');
  ok(j.indexOf('example.com') < 0, 'ห้ามมีที่อยู่');
});

test('ยังไม่ตั้งโทเคน = tgDiag_ ต้องบอกเหตุ ไม่ใช่พัง', () => {
  const g = env({});
  const d = g.tgDiag_();
  eq(d.ok, false);
  eq(d['ตั้งโทเคนแล้ว'], false);
});

test('?p=ping&tg=1 = ดูสภาพบอทได้โดยไม่ต้องมีกุญแจ APP_KEY', () => {
  const g = env({ TG_TOKEN: 'T', TG_HOOK_KEY: 'k', TG_CHAT: '111', APP_KEY: 'ss1234' });
  g.UrlFetchApp.fetch = () => fakeResponse(200, JSON.stringify({
    ok: true, result: { url: 'https://example.com/exec?p=tg&s=k' }
  }));
  const raw = g.doGet({ parameter: { p: 'ping', tg: '1' } }).getContent();
  const r = JSON.parse(raw);
  eq(r.ok, true);
  eq(r['เทเลแกรม']['กุญแจตรง'], true);
  ok(raw.indexOf('ss1234') < 0, 'ห้ามคายกุญแจหน้าเว็บ');
  ok(raw.indexOf('example.com') < 0, 'ห้ามคายที่อยู่ webhook');
});

test('ping ธรรมดา (ไม่ใส่ tg=1) ต้องไม่ไปกวนเทเลแกรม', () => {
  const g = env({ TG_TOKEN: 'T', TG_HOOK_KEY: 'k', TG_CHAT: '111' });
  let hit = 0;   /* นับเฉพาะที่ยิงหาเทเลแกรม — ping ปกติมันออกไปดึง forebet อยู่แล้ว */
  g.UrlFetchApp.fetch = (u) => { if (String(u).indexOf('api.telegram.org') >= 0) hit++;
    return fakeResponse(200, JSON.stringify({ ok: true, result: {} })); };
  const r = JSON.parse(g.doGet({ parameter: { p: 'ping' } }).getContent());
  eq(r.ok, true);
  eq(r['เทเลแกรม'], undefined);
  eq(hit, 0, 'ห้ามยิงหาเทเลแกรมทุกครั้งที่มีคน ping');
});

/* ---------- กล่องดำ: สายจากเทเลแกรมมาถึงไหนแล้วตาย ----------
   บทเรียน 2 ก.ย. 69: บอทเงียบสนิท แต่ทุกอย่างที่ดูจากข้างนอกบอกว่า "ตั้งครบแล้ว"
   (โทเคนใช้ได้ · กุญแจตรง · ผูก webhook อยู่) แยกไม่ออกว่าเทเลแกรมไม่ได้ยิงมา
   หรือยิงมาแล้วตกด่านไหน — ต้องให้มันจดรอยไว้เอง */

test('คนอื่นทัก = จดรอยว่าตกด่าน "ไม่ใช่เจ้าของ" และเก็บเลขห้องไว้ให้ตั้งทีหลัง', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  g.tgHandle_(msg(999, '/บิล'));
  const h = g.tgLastHit_();
  eq(h['จุด'], 'ไม่ใช่เจ้าของ', 'ต้องรู้ว่าตายเพราะเลขห้องไม่ตรง');
  eq(g.prop_('TG_LASTCHAT'), '999', 'ต้องเก็บห้องที่เพิ่งทักไว้');
});

test('เจ้าของทัก = จดรอยว่า "ถึงตัวตอบ"', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  g.tgHandle_(msg(111, '/เมนู'));
  eq(g.tgLastHit_()['จุด'], 'ถึงตัวตอบ', 'ถึงตัวตอบแล้วต้องจดว่าถึง');
});

test('ข้อความซ้ำ = จดรอยว่า "ข้อความซ้ำ" ไม่ใช่เงียบหาย', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' }, [], {
    CacheService: { getScriptCache: () => ({ get: () => '1', put() {} }) }
  });
  g.tgHandle_(Object.assign({ update_id: 7 }, msg(111, '/บิล')));
  eq(g.tgLastHit_()['จุด'], 'ข้อความซ้ำ', 'โดนด่านกันซ้ำต้องรู้');
  eq(g.__sent.length, 0, 'ข้อความซ้ำห้ามตอบ');
});

test('ยังไม่เคยมีสายเข้า = บอกว่าไม่เคย ไม่ใช่พัง', () => {
  const g = env({ TG_TOKEN: 'T' });
  eq(g.tgLastHit_()['เคยมีสายเข้า'], false, 'ยังไม่มีรอย = ยังไม่เคยมีใครยิงเข้ามา');
});

test('?p=setchat&id=last = ตั้งห้องที่เพิ่งทักเป็นเจ้าของ (เลขห้องหาจากมือถือยาก)', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  g.tgHandle_(msg(220022, '/บิล'));             /* ห้องจริงของเจ้าของ แต่ TG_CHAT ตั้งผิดไว้ */
  const r = g.tgSetChat_('last');
  eq(r.ok, true, 'ต้องตั้งได้');
  eq(g.prop_('TG_CHAT'), '220022', 'ต้องกลายเป็นห้องที่เพิ่งทัก');
});

test('setchat&id=last ตอนยังไม่มีใครทัก = บอกให้ไปทักก่อน ไม่ใช่ตั้งค่าเปล่า', () => {
  const g = env({ TG_TOKEN: 'T' });
  const r = g.tgSetChat_('last');
  eq(r.ok, false, 'ไม่มีของให้ตั้ง ต้องไม่บอกว่าสำเร็จ');
  eq(!!g.prop_('TG_CHAT'), false, 'ห้ามตั้งค่าเปล่าทับ');
});

test('รอยที่คายออกทาง ping ห้ามมีเลขห้องติดไปด้วย', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  g.tgHandle_(msg(987654321, '/บิล'));
  const s = JSON.stringify(g.tgLastHit_());
  eq(s.indexOf('987654321'), -1, 'เลขห้องต้องอยู่แค่ในพร็อพเพอร์ตี้ ไม่ออกหน้าจอ');
});

/* ---------- ล้างคิวค้างเอง (tgFixQueue_) ----------
   Apps Script ตอบ POST เป็น 302 เสมอ เทเลแกรมนับว่าส่งไม่ถึง แล้วยิงซ้ำไม่เลิก
   คิวโตขึ้นทีละใบจนของใหม่ไปต่อท้ายของเก่า = พิมพ์อะไรไปบอทก็เงียบ
   ตัวนี้ล้างคิวให้ แต่การล้างทิ้งของที่ยังไม่ได้อ่านไปด้วย เงื่อนไขจึงต้องแน่น */

/** mock เทเลแกรม: getWebhookInfo คืนคิวตามสั่ง · setWebhook ตอบ ok และจดไว้ให้ตรวจ */
function tgq(props, pending) {
  const g = env(Object.assign({ TG_TOKEN: 'T', TG_HOOK_KEY: 'k' }, props || {}));
  g.__sw = [];
  g.UrlFetchApp.fetch = (url, opt) => {
    const u = String(url), b = JSON.parse((opt && opt.payload) || '{}');
    if (u.indexOf('getWebhookInfo') >= 0) {
      return fakeResponse(200, JSON.stringify({ ok: true, result: {
        url: 'https://example.com/exec?p=tg&s=k',
        pending_update_count: pending,
        last_error_message: 'Wrong response from the webhook: 302 Found' } }));
    }
    if (u.indexOf('setWebhook') >= 0) { g.__sw.push(b); return fakeResponse(200, JSON.stringify({ ok: true, result: true })); }
    return fakeResponse(200, JSON.stringify({ ok: true, result: {} }));
  };
  return g;
}

test('คิวยังไม่ถึงเกณฑ์ = ไม่ล้าง', () => {
  const g = tgq({ EXEC_URL: 'https://example.com/exec' }, 2);
  const r = g.tgFixQueue_();
  eq(r.ok, true);
  eq(r['คิวค้าง'], 2);
  eq(r['ล้าง'], false, 'คิวน้อย ๆ ปล่อยไว้ เดี๋ยวมันไปเอง');
  eq(g.__sw.length, 0, 'ห้ามยิง setWebhook');
});

test('คิวตัน + เงียบมานาน = ล้าง และต้องสั่งทิ้งคิวเก่าไปด้วย', () => {
  const g = tgq({ EXEC_URL: 'https://example.com/exec' }, 12);
  const r = g.tgFixQueue_();
  eq(r['ล้าง'], true);
  eq(r['คิวค้าง'], 12);
  eq(g.__sw.length, 1, 'ต้องผูก webhook ใหม่ 1 ครั้ง');
  eq(g.__sw[0].drop_pending_updates, true, 'ไม่สั่งทิ้ง = คิวเดิมยังตันเหมือนเดิม');
  eq(String(g.prop_('TG_FIX_AT') || '').length > 0, true, 'ต้องจดเวลาไว้กันล้างรัว');
});

test('เพิ่งมีสายเข้าเมื่อกี้ = ห้ามล้าง (ของกำลังไหล ล้างแล้วข้อความหาย)', () => {
  const g = tgq({ EXEC_URL: 'https://example.com/exec' }, 12);
  g.PropertiesService.getScriptProperties().setProperty('TG_LASTHIT',
    JSON.stringify({ 'เมื่อ': new Date().toISOString(), 'จุด': 'ข้อความ' }));
  const r = g.tgFixQueue_();
  eq(r['ล้าง'], false);
  eq(g.__sw.length, 0);
});

test('เพิ่งล้างไปเมื่อกี้ = ไม่ล้างซ้ำ (เรียกทุก 5 นาทีก็ไม่รัว)', () => {
  const g = tgq({ EXEC_URL: 'https://example.com/exec', TG_FIX_AT: String(Date.now() - 60 * 1000) }, 12);
  const r = g.tgFixQueue_();
  eq(r['ล้าง'], false);
  eq(g.__sw.length, 0);
});

test('เกินรอบพักแล้ว = ล้างได้อีก', () => {
  const g = tgq({ EXEC_URL: 'https://example.com/exec', TG_FIX_AT: String(Date.now() - 30 * 60 * 1000) }, 12);
  eq(g.tgFixQueue_()['ล้าง'], true);
});

test('ยังไม่รู้ที่อยู่เว็บแอป = บอกเหตุ ไม่ผูก webhook มั่ว', () => {
  const g = tgq({}, 12);
  const r = g.tgFixQueue_();
  eq(r.ok, false, 'ผูกด้วยที่อยู่ว่าง = บอทตายสนิท ต้องไม่ทำ');
  eq(g.__sw.length, 0);
});

test('force=1 = ล้างทันทีแม้คิวน้อย (ไว้กดเองจากมือถือ)', () => {
  const g = tgq({ EXEC_URL: 'https://example.com/exec', TG_FIX_AT: String(Date.now()) }, 1);
  eq(g.tgFixQueue_('1')['ล้าง'], true);
});

test('tgFixQueue_ ห้ามคายที่อยู่ webhook หรือกุญแจ', () => {
  const g = tgq({ EXEC_URL: 'https://example.com/exec', TG_HOOK_KEY: 'กุญแจลับ' }, 12);
  const j = JSON.stringify(g.tgFixQueue_());
  ok(j.indexOf('กุญแจลับ') < 0, 'ห้ามมีกุญแจ');
  ok(j.indexOf('example.com') < 0, 'ห้ามมีที่อยู่');
});

test('?p=hookfix ต้องมีกุญแจ', () => {
  const g = tgq({ EXEC_URL: 'https://example.com/exec', APP_KEY: 'ss1234' }, 12);
  const bad = JSON.parse(g.doGet({ parameter: { p: 'hookfix' } }).getContent());
  eq(bad.ok, false, 'ไม่มีกุญแจต้องไม่ผ่าน');
  eq(g.__sw.length, 0);
  const good = JSON.parse(g.doGet({ parameter: { p: 'hookfix', k: 'ss1234' } }).getContent());
  eq(good['ล้าง'], true);
});
