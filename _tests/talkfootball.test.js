/* talkfootball.test.js — /talkfootball (ย้ายมาจาก PIKTAX 27 ส.ค. 69)
   ข้อที่ต้องพิสูจน์:
     1. ยิงตรง ห้ามติด Referer ของ forebet (คนละเว็บ)
     2. คู่ที่จะเตะภายใน 1 ชม. ต้องไม่โผล่ และตอนไม่มีของต้องบอกเหตุผล
     3. หน้าเสริมล่ม = คอลัมน์นั้นเป็น '-' ไม่ใช่ทั้งคำสั่งพัง
     4. เกรดผล: คู่ที่กำลังเตะห้ามนับ · ไม่มีผล = ไม่บันทึก · สั่งซ้ำต้องไม่ลงซ้ำ
     5. /talkfootball ในแชทส่งครั้งเดียว และแป้นปุ่มติดไปด้วย */

const { loadGas, fakeResponse } = require('./gasEnv');
const { FakeSpreadsheetApp } = require('./fakeSheet');

const FILES = ['gas/Config.gs', 'gas/Compat.gs', 'gas/Sheets.gs', 'gas/Api.gs',
  'gas/Forebet.gs', 'gas/Live.gs', 'gas/Settle.gs', 'gas/Tg.gs',
  'gas/FabScan.gs', 'gas/TalkFootball.gs'];

const HOUR = 3600000;
const p2 = (n) => String(n).padStart(2, '0');

/** แถวตาราง talkfootball 7 ช่อง — เวลาเป็น UTC ตามที่เว็บส่งมาจริง */
function row(t, match, league, pct) {
  return '<tr><td>' + t.mmdd + ' ' + t.hhmm + '</td><td>' + match + '</td><td>' + league +
         '</td><td>50%</td><td>x</td><td>' + pct + '%</td><td>y</td></tr>';
}
function page(rows) { return '<table>' + rows.join('') + '</table>'; }

/** MM/DD HH:mm (UTC) ของเวลาที่ห่างจากตอนนี้ n ชั่วโมง */
function at(hours) {
  const d = new Date(Date.now() + hours * HOUR);
  return { mmdd: p2(d.getUTCMonth() + 1) + '/' + p2(d.getUTCDate()),
           hhmm: p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) };
}

function env(pages, opt) {
  opt = opt || {};
  const props = Object.assign({ SHEET_ID: 'S', TG_TOKEN: 'T', TG_CHAT: '111' }, opt.props || {});
  const http = [], sent = [];
  const g = loadGas(FILES, {
    SpreadsheetApp: new FakeSpreadsheetApp(opt.book || { PICKS: [['ID']] }),
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
        return fakeResponse(200, JSON.stringify({ ok: true, result: {} }));
      }
      const keys = Object.keys(pages || {});
      for (let i = 0; i < keys.length; i++) {
        if (u.indexOf(keys[i]) >= 0) {
          const v = pages[keys[i]];
          return typeof v === 'number' ? fakeResponse(v, '') : fakeResponse(200, v);
        }
      }
      return fakeResponse(404, '');
    } }
  });
  g.__http = http; g.__sent = sent; g.__props = props;
  return g;
}

/* ---------- 1. ตัวอ่านตาราง ---------- */
test('tfFetchRows_ ยิงตรง ไม่ติด Referer ของ forebet', () => {
  const g = env({ 'first-half-goals': page([row(at(5), 'A - B', 'L1', 95)]) });
  const rows = g.tfFetchRows_(g.TF_URL_HT);
  eq(rows.length, 1);
  eq(rows[0].match, 'A - B');
  eq(rows[0].pct, 95);
  const h = g.__http[0].opt.headers || {};
  eq(h.Referer, undefined);
  ok(String(h['User-Agent']).indexOf('Mozilla') === 0, 'ต้องมี User-Agent');
});

test('tfFetchRows_ ตัดคู่ซ้ำ เก็บอันที่ % สูงกว่า', () => {
  const t = at(5);
  const g = env({ 'first-half-goals': page([row(t, 'A - B', 'L1', 91), row(t, 'A - B', 'L1', 97)]) });
  const rows = g.tfFetchRows_(g.TF_URL_HT);
  eq(rows.length, 1);
  eq(rows[0].pct, 97);
});

test('tfClean_ ถอด entity และ &amp; ต้องถอดท้ายสุด', () => {
  eq(env({}).tfClean_('<td>Ol&#245;t &amp;#245; x</td>'), 'Olõt &#245; x');
});

/* ---------- 2. หน้าต่างเวลา + เหตุผลตอนไม่มีของ ---------- */
test('tfText_ หน้าต่างเวลาเริ่มที่ 1 ชม.ก่อนตอนกด (TF_LEAD_MIN ติดลบ)', () => {
  /* เจ้าของสั่ง 21 ก.ย. 69 ให้เร็วขึ้น 2 ชม. จาก +60 -> -60
     คู่ที่จวนเตะ/เพิ่งเตะ ต้องโผล่แล้ว ส่วนที่เตะไปนานต้องยังหายไป */
  const g = env({ 'first-half-goals': page([
    row(at(0.5), 'A - B', 'L1', 95), row(at(-0.5), 'C - D', 'L2', 96),
    row(at(-3), 'E - F', 'L3', 97)]) });
  const t = g.tfText_();
  ok(t.indexOf('A - B') >= 0, 'คู่ที่จวนเตะต้องโผล่แล้ว');
  ok(t.indexOf('C - D') >= 0, 'คู่ที่เพิ่งเตะต้องโผล่ด้วย');
  ok(t.indexOf('E - F') < 0, 'คู่ที่เตะไปนานแล้วต้องไม่โผล่');
});

test('tfText_ ไม่มีของ = บอกเหตุผลโดยเทียบกับเวลาเริ่มตาราง ไม่ใช่เวลาตอนกด', () => {
  /* กับดัก: พอ TF_LEAD_MIN ติดลบ ถ้าเผลอเทียบกับ "ตอนนี้" คู่ที่เพิ่งเตะจะถูกนับเป็นเหตุผล
     ทั้งที่มันโชว์อยู่ ทดสอบด้วยคู่ที่เตะไปนานแล้วล้วน ๆ */
  const g = env({ 'first-half-goals': page([row(at(-4), 'C - D', 'L2', 96)]) });
  const t = g.tfText_();
  ok(t.indexOf('C - D') < 0, t);
  ok(t.indexOf('ไม่มีบอลน่าสนใจ') >= 0, t);
  ok(t.indexOf('1 คู่เตะไปก่อน') >= 0, t);
});

test('tfText_ เว็บล่ม กับ แกะตารางไม่ออก เป็นคนละข้อความ', () => {
  const down = env({ 'first-half-goals': 503 }).tfText_();
  const junk = env({ 'first-half-goals': '<html>no table</html>' }).tfText_();
  ok(down.indexOf('ดึงข้อมูลไม่ได้') >= 0, down);
  ok(junk.indexOf('อ่านตาราง') >= 0, junk);
});

/* ---------- 1b. หน้ากั้นของ Cloudflare (บั๊กจริง 21 ก.ย. 69) ---------- */

test('ยิงตรงได้ 200 แต่ไม่มีแถว = ต้องอ้อมต่อ ไม่ใช่ยอมแพ้', () => {
  /* ใส่ r.jina.ai ไว้คีย์แรก = ทางอ้อมได้ตารางจริง ส่วนทางตรงได้หน้ากั้นเปล่า */
  const g = env({ 'r.jina.ai': page([row(at(5), 'A - B', 'L1', 95)]),
                  'first-half-goals': '<html>Just a moment...</html>' });
  const rows = g.tfFetchRows_(g.TF_URL_HT);
  eq(rows.length, 1);
  ok(g.TF_TRAIL.indexOf('ตรง:200/0แถว') >= 0, g.TF_TRAIL);
  ok(g.TF_TRAIL.indexOf('อ้อม:200/1แถว') >= 0, g.TF_TRAIL);
  /* ทางอ้อมต้องขอ html ไม่งั้นได้ markdown ที่ไม่มีตาราง */
  const via = g.__http.filter((h) => h.url.indexOf('r.jina.ai') >= 0)[0];
  eq(via.opt.headers['X-Return-Format'], 'html');
});

test('ทุกทางตัน = ข้อความบอกทางที่ลองด้วย', () => {
  const t = env({ 'first-half-goals': '<html>blocked</html>',
                  'r.jina.ai': '<html>blocked</html>' }).tfText_();
  ok(t.indexOf('อ่านตาราง') >= 0, t);
  ok(t.indexOf('ทางที่ลอง') >= 0, t);
});

test('tfParse_ กับหน้าจริงที่เซฟไว้', () => {
  const html = require('fs').readFileSync(
    require('path').join(__dirname, 'fixtures', 'talkfootball-real.html'), 'utf8');
  const rows = env({}).tfParse_(html);
  eq(rows.length, 4);                       /* หัวตารางไม่ถูกนับ */
  eq(rows[0].match, 'KFUM II - Ready');
  eq(rows[0].league, 'Norway 3rd Division, Group 1');
  eq(rows[0].pct, 100);
  /* เวลาต้องมาจาก microdata startDate (มีปีเต็ม) ไม่ใช่ข้อความ 09/21 */
  eq(new Date(rows[0].kickUtc).toISOString(), '2026-09-21T17:00:00.000Z');
});

test('หน้าเสริมล่ม = คอลัมน์นั้นเป็น - ไม่ใช่ทั้งคำสั่งพัง', () => {
  const g = env({ 'first-half-goals': page([row(at(5), 'A - B', 'L1', 95)]) });
  eq(g.tfSideMap_(g.TF_URL_SH), null);
  const t = g.tfText_();
  ok(t.indexOf('A - B') >= 0, 'คู่หลักต้องยังโชว์');
  ok(t.indexOf('SH -') >= 0, t);
  ok(t.indexOf('HT 95%') >= 0, t);
});

test('tfText_ เกณฑ์ 80% — ต่ำกว่านั้นไม่เอา (เจ้าของสั่งลดจาก 90 เมื่อ 21 ก.ย. 69)', () => {
  eq(env({}).TF_MIN_PCT, 80);
  const g = env({ 'first-half-goals': page([
    row(at(5), 'A - B', 'L1', 79), row(at(5), 'C - D', 'L2', 80)]) });
  const t = g.tfText_();
  ok(t.indexOf('A - B') < 0, '79% ต้องไม่โผล่');
  ok(t.indexOf('C - D') >= 0, '80% ต้องโผล่');
});

test('tfText_ คู่เกิน TF_MAX_ROWS = บอกว่าเหลืออีกกี่คู่ ไม่ใช่หายเงียบ', () => {
  const rows = [];
  for (let i = 0; i < 55; i++) rows.push(row(at(5 + i / 60), 'H' + i + ' - A' + i, 'L1', 95));
  const t = env({ 'first-half-goals': page(rows) }).tfText_();
  ok(t.indexOf('… อีก 5 คู่') >= 0, t.slice(-120));
});

/* ---------- 3. ตัวแกะสกอร์จริง (Compat.gs) ---------- */
function block(names, id, status, score) {
  return ['[' + names + ' 08/26/2026 7:00 PM](https://www.forebet.com/en/football/matches/some-slug-' + id + ')',
          '', '', status, '', score].join('\n');
}

test('fbParseScores_ เอาเฉพาะคู่ที่จบแล้ว คู่ที่กำลังเตะห้ามนับ', () => {
  const m = env({}).fbParseScores_([
    block('Alpha FCBeta FC', '111', '90', '**2 - 1**(1 - 0)'),
    block('Gamma FCDelta FC', '222', 'HT', '**2 - 0**')
  ].join('\n'));
  eq(String(m['#111']), '2,1,1,0');
  eq(m['#222'], undefined);
});

test('fbLookupScore_ หาเจอทั้งจาก id และจากชื่อ', () => {
  const g = env({});
  const m = g.fbParseScores_(block('Alpha FCBeta FC', '111', 'FT', '**3 - 3**(1 - 1)'));
  eq(String(g.fbLookupScore_(m, 'x', 'y', '111')), '3,3,1,1');
  eq(String(g.fbLookupScore_(m, 'Alpha FC', 'Beta FC', null)), '3,3,1,1');
  eq(g.fbLookupScore_(m, 'Nope', 'Nada', null), null);
});

/* ---------- 4. เกรดผลลงชีต ---------- */
function gradeEnv(scorePage, book) {
  const t = at(-4);                       // เตะไปแล้ว 4 ชม.
  return env({
    'first-half-goals': page([row(t, 'Alpha FC - Beta FC', 'L1', 95),
                              row(t, 'No Res A - No Res B', 'L2', 93)]),
    'second-half-goals': page([row(t, 'Alpha FC - Beta FC', 'L1', 80)]),
    'match-goals-over-2.5': page([row(t, 'Alpha FC - Beta FC', 'L1', 70)]),
    'btts': page([row(t, 'Alpha FC - Beta FC', 'L1', 60)]),
    'forebet.com': scorePage === undefined
      ? block('Alpha FCBeta FC', '111', 'FT', '**2 - 1**(1 - 0)') : scorePage
  }, { book: book });
}
const tfSheet = (g) => g.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TalkFootball');

test('tfGradeLog_ บันทึกเฉพาะคู่ที่มีผล และตัดสิน 4 ตลาดถูกต้อง', () => {
  const g = gradeEnv();
  const msg = g.tfGradeLog_();
  ok(msg.indexOf('บันทึก 1 คู่') >= 0, msg);
  ok(msg.indexOf('ยังไม่มีผล 1') >= 0, msg);

  const r = tfSheet(g).getRange(2, 1, 1, 16).getValues()[0];
  eq(r[2], 'Alpha FC');
  eq(r[3], 'Beta FC');
  eq(r[5], 95);
  eq(r[6], 80);
  eq(String(r[9]), '2-1');       // เต็มเวลา
  eq(String(r[10]), '1-0');      // ครึ่งแรก
  eq(r[11], 'ถูก');              // HT   : ครึ่งแรก 1 ลูก
  eq(r[12], 'ถูก');              // SH   : (2-1)-(1-0) = 1 ลูก
  eq(r[13], 'ถูก');              // OU2.5: รวม 3 ลูก
  eq(r[14], 'ถูก');              // BTTS : ยิงกันทั้งคู่
  ok(String(r[15]).indexOf('|Alpha FC - Beta FC') > 0, 'คีย์กันซ้ำ');
});

test('tfGradeLog_ ไม่มีสกอร์ครึ่งแรก = ปล่อยว่าง ห้ามเดา', () => {
  const g = gradeEnv(block('Alpha FCBeta FC', '111', 'FT', '**0 - 0**'));
  g.tfGradeLog_();
  const r = tfSheet(g).getRange(2, 1, 1, 16).getValues()[0];
  eq(String(r[10]), '');
  eq(r[11], '');                 // HT/SH ตัดสินไม่ได้
  eq(r[12], '');
  eq(r[13], 'ผิด');              // OU2.5 กับ BTTS ยังตัดสินได้
  eq(r[14], 'ผิด');
});

test('tfGradeLog_ สั่งซ้ำต้องไม่ลงซ้ำ', () => {
  const g = gradeEnv();
  g.tfGradeLog_();
  const before = tfSheet(g).getLastRow();
  const msg2 = g.tfGradeLog_();
  eq(tfSheet(g).getLastRow(), before);
  ok(msg2.indexOf('บันทึก 0 คู่') >= 0, msg2);
});

test('tfGradeLog_ ดึงผลจาก forebet ไม่ได้ = ไม่แตะชีตเลย', () => {
  const g = gradeEnv('');
  const msg = g.tfGradeLog_();
  ok(msg.indexOf('ดึงผลจาก Forebet ไม่ได้') >= 0, msg);
  const sh = tfSheet(g);
  ok(!sh || sh.getLastRow() <= 1, 'ห้ามมีแถวข้อมูล');
});

test('tfGradeLog_ เว็บ talkfootball ล่ม = บอกว่าดึงไม่ได้ ไม่ throw', () => {
  const g = env({ 'first-half-goals': 503 });
  ok(g.tfGradeLog_().indexOf('ดึงเว็บไม่ได้') >= 0);
});

/* ---------- สถิติย้อนหลัง ---------- */

const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
};
const daysAgo = (n) => {
  const d = new Date(Date.now() - n * 24 * HOUR);
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
};
/* แถวเต็ม 16 ช่อง — ตำแหน่ง 11..14 คือผล HT/SH/OU/BTTS */
function tfRow(date, marks, key) {
  return [date, '21:30', 'A', 'B', 'L', 95, 80, 70, 60, '2-1', '1-0',
          marks[0], marks[1], marks[2], marks[3], key];
}

test('tfStatsText_ ยังไม่มีแท็บ = บอกว่ายังไม่มีข้อมูล ไม่ใช่ 0%', () => {
  const g = env({});
  ok(g.tfStatsText_(30).indexOf('ยังไม่มีข้อมูล') >= 0);
});

test('tfStatsText_ นับถูก/ผิดแยกตลาด · ช่องว่างไม่นับเป็นผิด', () => {
  const g = env({}, { book: { PICKS: [['ID']], TalkFootball: [
    HEAD(),
    tfRow(today(), ['ถูก', '', 'ผิด', 'ถูก'], 'k1'),
    tfRow(daysAgo(2), ['ผิด', '', 'ผิด', 'ผิด'], 'k2')
  ] } });
  const t = g.tfStatsText_(30);
  ok(t.indexOf('2 คู่') >= 0, t);
  ok(t.indexOf('HT : 50% (1/2)') >= 0, t);
  ok(t.indexOf('SH : -') >= 0, 'ไม่มีข้อมูลครึ่งหลังเลย ต้องขีด ไม่ใช่ 0%\n' + t);
  ok(t.indexOf('OU2.5 : 0% (0/2)') >= 0, t);
  ok(t.indexOf('BTTS : 50% (1/2)') >= 0, t);
});

test('tfStatsText_ ตัดแถวที่เก่ากว่าช่วงที่ขอทิ้ง', () => {
  const g = env({}, { book: { PICKS: [['ID']], TalkFootball: [
    HEAD(),
    tfRow(today(), ['ถูก', 'ถูก', 'ถูก', 'ถูก'], 'k1'),
    tfRow(daysAgo(40), ['ผิด', 'ผิด', 'ผิด', 'ผิด'], 'k2')
  ] } });
  const t = g.tfStatsText_(7);
  ok(t.indexOf('1 คู่') >= 0, t);
  ok(t.indexOf('HT : 100% (1/1)') >= 0, t);
});

test('ช่องวันที่กลายเป็น Date ก็ยังเทียบช่วงเวลาได้ (ชีตชอบแปลงเอง)', () => {
  const g = env({}, { book: { PICKS: [['ID']], TalkFootball: [
    HEAD(),
    tfRow(new Date(), ['ถูก', 'ถูก', 'ถูก', 'ถูก'], 'k1')
  ] } });
  const t = g.tfStatsText_(30);
  ok(t.indexOf('1 คู่') >= 0, 'Date ต้องถูกแปลงก่อนเทียบ ไม่งั้นตกหมด\n' + t);
});

function HEAD() {
  return ['วันที่','เวลา','บ้าน','เยือน','ลีก','HT%','SH%','OU2.5%','BTTS%',
          'สกอร์','ครึ่งแรก','ผล HT','ผล SH','ผล OU2.5','ผล BTTS','คีย์'];
}

/* ---------- ทางเดินคำสั่งในบอท ---------- */

const msg = (text) => ({ message: { chat: { id: 111 }, text: text } });

test('/talkfootball ส่งใบเดียว พร้อมปุ่มลัดติดไปด้วย', () => {
  const g = env({
    'first-half-goals': page([row(at(3), 'Alpha FC - Beta FC', 'ลีกหนึ่ง', 95)]),
    'second-half-goals': 404, 'match-goals-over-2.5': 404, 'btts': 404
  });
  g.tgHandle_(msg('/talkfootball'));
  eq(g.__sent.length, 1, 'ต้องใบเดียว ไม่มีใบเปล่าตามหลัง');
  ok(g.__sent[0].text.indexOf('Alpha FC') >= 0, g.__sent[0].text);
  ok(String(g.__sent[0].reply_markup || '').indexOf('/talkfootball') >= 0, 'ปุ่มลัดต้องติดไปทุกใบ');
});

test('/talkfootball เว็บล่ม = บอกเหตุ ไม่ใช่เงียบ', () => {
  const g = env({ 'first-half-goals': 503 });
  g.tgHandle_(msg('/talkfootball'));
  eq(g.__sent.length, 1);
  ok(/ดึงข้อมูลไม่ได้|ดึงไม่ได้/.test(g.__sent[0].text), g.__sent[0].text);
});

test('/tfสถิติ 7 = อ่านสถิติ 7 วัน ไม่ตกช่องไม่รู้จัก', () => {
  const g = env({}, { book: { PICKS: [['ID']], TalkFootball: [
    HEAD(), tfRow(today(), ['ถูก', 'ถูก', 'ถูก', 'ถูก'], 'k1')
  ] } });
  g.tgHandle_(msg('/tfสถิติ 7'));
  eq(g.__sent.length, 1);
  ok(g.__sent[0].text.indexOf('7 วัน') >= 0, g.__sent[0].text);
  ok(!/ไม่เข้าใจ/.test(g.__sent[0].text), 'ต้องไม่ตกไปช่องคำสั่งไม่รู้จัก');
});

test('/tfสถิติ เฉยๆ = 30 วัน', () => {
  const g = env({});
  g.tgHandle_(msg('/tfสถิติ'));
  ok(/ยังไม่มีข้อมูล|30 วัน/.test(g.__sent[0].text), g.__sent[0].text);
});

test('เมนูกับปุ่มลัดมีคำสั่ง talkfootball', () => {
  const g = env({});
  ok(g.TG_MENU_.indexOf('talkfootball') >= 0, 'เมนู /help ต้องมี');
  const kb = JSON.stringify(g.tgKeyboard_());
  ok(kb.indexOf('/talkfootball') >= 0 && kb.indexOf('/tfสถิติ') >= 0, kb);
});
