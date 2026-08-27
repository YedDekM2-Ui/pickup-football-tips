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
function env(props, bets) {
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
        createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } }) }
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

test('พิมพ์มั่ว = ตอบเมนู ไม่เงียบ', () => {
  const g = env({ TG_TOKEN: 'T', TG_CHAT: '111' });
  const out = g.tgHandle_(msg(111, 'อยากได้เงิน'));
  eq(out.indexOf('ไม่เข้าใจ'), 0, 'ต้องบอกก่อนว่าไม่เข้าใจ');
  ok(out.indexOf('/สรุป') > 0, 'แล้วต่อด้วยเมนู');
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
