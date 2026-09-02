/* stocks.test.js — /หุ้น (ย้ายมาจาก PIKTAX AbdulTools.gs 27 ส.ค. 69)
   ข้อที่ต้องพิสูจน์:
     1. ห้ามมีกุญแจฝังในโค้ด — ไม่ตั้ง TAVILY_KEY ต้องไม่ยิง tavily เลย
     2. tavily ล่ม/โควตาหมด/พัง = ตกไป DuckDuckGo ไม่ใช่ทั้งคำสั่งพัง
     3. DuckDuckGo หน้าเต็มแกะไม่ออก = ตกไปหน้า lite ไม่ใช่คืนค่าว่าง
     4. เน็ตพังทั้งสองทาง = บอกว่าพัง ไม่ใช่เงียบ
     5. คำค้นต้องมีวันที่ไทยเสมอ (กันผลค้างปี) และแยกไทย/สหรัฐถูก
     6. /หุ้น ในแชทส่งครั้งเดียว แป้นปุ่มติดไปด้วย */

const { loadGas, fakeResponse } = require('./gasEnv');
const { FakeSpreadsheetApp } = require('./fakeSheet');

const FILES = ['gas/Config.gs', 'gas/Compat.gs', 'gas/Sheets.gs', 'gas/Api.gs',
  'gas/Forebet.gs', 'gas/Live.gs', 'gas/Settle.gs', 'gas/Tg.gs',
  'gas/FabScan.gs', 'gas/TalkFootball.gs', 'gas/FabValue.gs',
  'gas/Web.gs', 'gas/Stocks.gs'];

/** opt.routes = { ชิ้นส่วนของ url: ข้อความ | เลข status | Error } */
function env(opt) {
  opt = opt || {};
  const props = Object.assign({ SHEET_ID: 'S', TG_TOKEN: 'T', TG_CHAT: '111' }, opt.props || {});
  const http = [], sent = [];
  const g = loadGas(FILES, {
    SpreadsheetApp: new FakeSpreadsheetApp({ PICKS: [['ID']] }),
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); },
      deleteProperty: (k) => { delete props[k]; }
    }) },
    UrlFetchApp: { fetch: (url, o) => {
      const u = String(url);
      http.push({ url: u, opt: o || {} });
      if (u.indexOf('api.telegram.org') >= 0) {
        sent.push(JSON.parse((o && o.payload) || '{}'));
        return fakeResponse(200, JSON.stringify({ ok: true, result: { message_id: 7 } }));
      }
      const routes = opt.routes || {};
      const keys = Object.keys(routes);
      for (let i = 0; i < keys.length; i++) {
        if (u.indexOf(keys[i]) >= 0) {
          const v = routes[keys[i]];
          if (v instanceof Error) throw v;
          return typeof v === 'number' ? fakeResponse(v, '') : fakeResponse(200, v);
        }
      }
      return fakeResponse(404, '');
    } }
  });
  g.__http = http; g.__sent = sent; g.__props = props;
  return g;
}

const TAVILY = JSON.stringify({
  answer: 'ตลาดหุ้นไทยวันนี้ปิดบวก',
  results: [{ title: 'SET ปิดบวก 5 จุด', content: '<b>ดัชนี</b> SET ปิดที่ 1,250', url: 'https://a.co/1' },
            { title: 'หุ้นเด่นวันนี้', content: 'PTT KBANK', url: 'https://a.co/2' }]
});

const DDG = '<div class="result__a" >หุ้นไทยวันนี้</a>' +
            '<span class="result__snippet" >SET บวก 5 จุด</a>' +
            '<div class="result__a" >หุ้นเด่น</a>' +
            '<span class="result__snippet" >PTT นำตลาด</a>';

/* ---------- คำค้น ---------- */

test('คำค้นไทยเป็นค่าตั้งต้น และมีวันที่ไทยติดไปเสมอ', () => {
  const g = env();
  const q = g.stQuery_('');
  ok(/^หุ้นเด่นวันนี้ SET หุ้นน่าสนใจ /.test(q), q);
  ok(/\d+\/\d+\/\d{4}$/.test(q), 'ต้องลงท้ายด้วยวันที่ d/M/yyyy: ' + q);
});

test('คำค้นตลาดสหรัฐเมื่อพิมพ์ us / โลก / ต่างประเทศ', () => {
  const g = env();
  ['us', 'US', 'global', 'โลก', 'ต่างประเทศ', 'nasdaq', 'สหรัฐ'].forEach((m) => {
    ok(g.stIsGlobal_(m), 'ควรเป็นตลาดนอก: ' + m);
    ok(/ตลาดหุ้นสหรัฐ/.test(g.stQuery_(m)), m);
  });
});

test('คำที่ไม่ใช่ตลาดนอก ต้องไม่หลุดไปสหรัฐ', () => {
  const g = env();
  ['', 'ไทย', 'set', 'ปตท'].forEach((m) => ok(!g.stIsGlobal_(m), m));
});

/* ---------- ไม่มีกุญแจ = ห้ามยิง tavily ---------- */

test('ไม่ตั้ง TAVILY_KEY = ไม่ยิง tavily เลย ไปหา DuckDuckGo ตรงๆ', () => {
  const g = env({ routes: { 'duckduckgo.com/html': DDG } });
  const out = g.webSearch_('หุ้น');
  eq(g.__http.filter((h) => /tavily/.test(h.url)).length, 0, 'ห้ามมีคีย์สำรองฝังในโค้ด');
  ok(/หุ้นไทยวันนี้ — SET บวก 5 จุด/.test(out), out);
});

test('คำค้นว่าง = บอกว่าไม่มีคำค้น ไม่ยิงเน็ต', () => {
  const g = env();
  eq(g.webSearch_(''), 'ไม่มีคำค้น');
  eq(g.__http.length, 0);
});

/* ---------- tavily ---------- */

test('มีกุญแจ = ใช้ tavily · ส่ง Bearer + คำถาม 5 ผล และคืนบทสรุปก่อน', () => {
  const g = env({ props: { TAVILY_KEY: 'tv-x' }, routes: { 'api.tavily.com': TAVILY } });
  const out = g.webSearch_('หุ้นไทย');
  const call = g.__http.filter((h) => /tavily/.test(h.url))[0];
  eq(call.opt.method, 'post');
  eq(call.opt.headers.Authorization, 'Bearer tv-x');
  const body = JSON.parse(call.opt.payload);
  eq(body.query, 'หุ้นไทย'); eq(body.max_results, 5);
  eq(body.include_answer, true); eq(body.search_depth, 'basic');
  ok(/^สรุป: ตลาดหุ้นไทยวันนี้ปิดบวก/.test(out), out);
  ok(/1\. SET ปิดบวก 5 จุด/.test(out), out);
  ok(/ดัชนี SET ปิดที่ 1,250/.test(out), 'แท็ก <b> ต้องถูกถอด: ' + out);
  ok(/https:\/\/a\.co\/2/.test(out), out);
});

test('tavily ตอบไม่ใช่ 200 = ตกไป DuckDuckGo', () => {
  const g = env({ props: { TAVILY_KEY: 'tv-x' },
                  routes: { 'api.tavily.com': 429, 'duckduckgo.com/html': DDG } });
  ok(/หุ้นไทยวันนี้/.test(g.webSearch_('หุ้น')));
  ok(g.__http.some((h) => /duckduckgo/.test(h.url)));
});

test('tavily พังกลางทาง = ตกไป DuckDuckGo ไม่ใช่ทั้งคำสั่งพัง', () => {
  const g = env({ props: { TAVILY_KEY: 'tv-x' },
                  routes: { 'api.tavily.com': new Error('เน็ตหลุด'), 'duckduckgo.com/html': DDG } });
  ok(/หุ้นเด่น — PTT นำตลาด/.test(g.webSearch_('หุ้น')));
});

test('tavily คืน JSON เสีย = ตกไป DuckDuckGo', () => {
  const g = env({ props: { TAVILY_KEY: 'tv-x' },
                  routes: { 'api.tavily.com': '<html>error</html>', 'duckduckgo.com/html': DDG } });
  ok(/หุ้นไทยวันนี้/.test(g.webSearch_('หุ้น')));
});

test('tavily ไม่มีผลเลย = ตกไป DuckDuckGo ไม่ใช่คืนค่าว่าง', () => {
  const g = env({ props: { TAVILY_KEY: 'tv-x' },
                  routes: { 'api.tavily.com': JSON.stringify({ results: [] }),
                            'duckduckgo.com/html': DDG } });
  ok(/หุ้นไทยวันนี้/.test(g.webSearch_('หุ้น')));
});

/* ---------- DuckDuckGo ---------- */

test('DuckDuckGo เอาได้มากสุด 6 ผล', () => {
  let big = '';
  for (let i = 1; i <= 9; i++) {
    big += '<a class="result__a" >หัวข้อ' + i + '</a><span class="result__snippet" >เนื้อ' + i + '</a>';
  }
  const g = env({ routes: { 'duckduckgo.com/html': big } });
  const lines = g.webSearch_('หุ้น').split('\n');
  eq(lines.length, 6);
  ok(/^1\. หัวข้อ1 — เนื้อ1$/.test(lines[0]), lines[0]);
  ok(/^6\. หัวข้อ6 — เนื้อ6$/.test(lines[5]), lines[5]);
});

test('หน้าเต็มแกะไม่ออก = ตกไปหน้า lite ไม่ใช่คืนค่าว่าง', () => {
  const g = env({ routes: { 'duckduckgo.com/html': '<html>หน้าเปลี่ยนโครงแล้ว</html>',
                            'lite.duckduckgo.com': '<p>ผลจากหน้า lite</p>' } });
  eq(g.webSearch_('หุ้น'), 'ผลจากหน้า lite');
  ok(g.__http.some((h) => /lite\.duckduckgo/.test(h.url)));
});

test('เน็ตพังทั้งสองทาง = บอกว่าค้นไม่สำเร็จ ไม่ใช่โยน error ออกไป', () => {
  const g = env({ routes: { 'duckduckgo.com': new Error('timeout') } });
  eq(g.webSearch_('หุ้น'), 'ค้นเว็บไม่สำเร็จ: timeout');
});

test('ถอดแท็กและ entity ออกจริง', () => {
  const g = env();
  eq(g.wbStrip_('<b>ก</b>&nbsp;<i>ข</i>'), 'ก ข');
  eq(g.wbStrip_('<script>x=1</script>เนื้อ'), 'เนื้อ');
  eq(g.wbStrip_('<style>a{}</style>เนื้อ'), 'เนื้อ');
  eq(g.wbStrip_('a &amp; b &quot;c&quot; &#39;d&#39; &lt;e&gt;'), 'a & b "c" \'d\' <e>');
  eq(g.wbStrip_(null), '');
});

/* ---------- การ์ด /หุ้น ---------- */

test('การ์ดตลาดไทย: หัว + วันที่ + คำเตือน + ทางไปตลาดนอก', () => {
  const g = env({ routes: { 'duckduckgo.com/html': DDG } });
  const t = g.stocksText_('');
  ok(/^📈 หุ้นเด่นวันนี้ · ตลาดไทย \(SET\) · \d+\/\d+\/\d{4}\n/.test(t), t);
  ok(/หุ้นไทยวันนี้ — SET บวก 5 จุด/.test(t), t);
  ok(/ℹ️ นี่คือผลค้นเว็บ ไม่ใช่คำแนะนำลงทุน/.test(t), 'ต้องมีคำเตือนเสมอ');
  ok(/พิมพ์  \/หุ้น us/.test(t), t);
});

test('การ์ดตลาดสหรัฐ: ไม่ต้องบอกทางไปตลาดนอกซ้ำ', () => {
  const g = env({ routes: { 'duckduckgo.com/html': DDG } });
  const t = g.stocksText_('us');
  ok(/· ตลาดสหรัฐ ·/.test(t), t);
  ok(!/\/หุ้น us/.test(t), 'อยู่ตลาดนอกแล้ว ไม่ต้องชวนซ้ำ');
  ok(/ℹ️ นี่คือผลค้นเว็บ/.test(t));
});

test('ผลค้นยาวเกิน ต้องตัด ไม่ให้เทเลแกรมตีกลับ', () => {
  const long = '<a class="result__a" >' + 'ก'.repeat(5000) + '</a><span class="result__snippet" >ข</a>';
  const g = env({ routes: { 'duckduckgo.com/html': long } });
  ok(g.stocksText_('').length < 3400);
});

/* ---------- ในแชท ---------- */

test('/หุ้น ในแชทส่งครั้งเดียว แป้นปุ่มติดไปด้วย', () => {
  const g = env({ routes: { 'duckduckgo.com/html': DDG } });
  g.tgHandle_({ message: { chat: { id: 111 }, text: '/หุ้น' } });
  eq(g.__sent.length, 1);
  ok(/📈 หุ้นเด่นวันนี้ · ตลาดไทย/.test(g.__sent[0].text), g.__sent[0].text);
  ok(!!g.__sent[0].reply_markup, 'แป้นปุ่มต้องติดไปทุกข้อความ');
});

test('/หุ้น us ในแชท = ตลาดสหรัฐ', () => {
  const g = env({ routes: { 'duckduckgo.com/html': DDG } });
  g.tgHandle_({ message: { chat: { id: 111 }, text: '/หุ้น us' } });
  ok(/· ตลาดสหรัฐ ·/.test(g.__sent[0].text), g.__sent[0].text);
});

test('/หุ้น พังต้องบอกว่าพัง ไม่ใช่เงียบ', () => {
  const g = env({ routes: { 'duckduckgo.com': new Error('boom') } });
  g.tgHandle_({ message: { chat: { id: 111 }, text: '/หุ้น' } });
  eq(g.__sent.length, 1);
  ok(/ค้นเว็บไม่สำเร็จ: boom/.test(g.__sent[0].text), g.__sent[0].text);
});

test('เมนูมี /หุ้น', () => {
  const g = env();
  ok(/\/หุ้น \[us\]/.test(g.TG_MENU_), g.TG_MENU_);
});
