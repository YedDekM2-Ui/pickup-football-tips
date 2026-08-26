# Pickup Football Tips — แผนที่ 1: หน้าเว็บ + ชีต + ท่อ JSON (เฟส 1-3)

> ✅ **แผนนี้จบแล้ว 25 ส.ค. 69** — งาน 1-9 ขึ้นจริงครบ · เทสต์ `ผ่าน 108/108` · หลังบ้าน GAS **LIVE v4** · หน้าเว็บ **LIVE** `https://yeddekm2-ui.github.io/pickup-football-tips/` · คอมมิตสุดท้าย `5156443`
>
> ช่องติ๊กข้างล่างปล่อยว่างไว้ตามเดิม — ไม่ติ๊กย้อนหลัง เพราะบางข้อเจ้าของเช็กเองบนไอโฟน ผมยืนยันแทนไม่ได้ · สถานะจริงดูที่ `CLAUDE.md`
>
> งานต่อไปอยู่ที่แผน 2 (เฟส 4-7 ของสเปก: บอท + OCR) — ติดที่เจ้าของต้องทำเอง: BotFather + rotate คีย์ Vision

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ได้เว็บ 3 หน้า (FOREBET / MY BET / LEDGER) เปิดจากไอโฟน Safari แล้วอ่านข้อมูลจริงจากชีตผ่าน Google Apps Script ได้ — ยังไม่มีบอท ยังไม่มี OCR

**Architecture:** ไฟล์ static ล้วนบน GitHub Pages (ไม่มี build step ไม่มี framework) เรียก `doGet` ของ GAS โปรเจกต์ใหม่ที่คาย JSON ก้อนเดียวจบ · ข้อมูลอยู่ในไฟล์ Google Sheets ใหม่ 3 แท็บ (`PICKS` `BETS` `TEAMS`) · ฟังก์ชันที่คิดเลขและปั้น HTML เป็นฟังก์ชันบริสุทธิ์ทั้งหมด เทสต์ด้วย Node ได้โดยไม่ต้องมีเบราว์เซอร์และไม่ต้องต่อเน็ต

**Tech Stack:** Google Apps Script (V8) · Google Sheets · HTML/CSS/JS ล้วน (ES5-safe, ไม่มี module, ไม่มี npm) · ตัวรันเทสต์ท้องถิ่น `node _tests/run.js` แบบเดียวกับ PIKTAX

**Spec:** `docs/superpowers/specs/2026-08-25-pickup-football-tips-design.md`

## Global Constraints

ค่าพวกนี้คัดมาจากสเปกตรงๆ ทุกงานในแผนนี้ต้องไม่ละเมิด:

- **คนละบอท คนละ GAS project คนละไฟล์ชีตกับ PIKTAX** · ห้ามเรียก `?ff=` หรือ endpoint ใดๆ ของ PIKTAX
- **ห้ามแตะ/ห้ามลบ** `BetSlip.gs` `BetGate.gs` `BetRules.gs` `BetTeam.gs` ใน PIKTAX
- **โทเคน / คีย์ / ไอดีชีต อยู่ใน Script Properties เท่านั้น** ห้ามเขียนลงไฟล์ ห้ามคอมมิต ห้ามพิมพ์ในแชต
- **ไม่มี Python ไม่มี GitHub Actions ไม่มี build step** — หน้าเว็บต้องเปิดตรงจากไฟล์ได้เลย
- **ปุ่มแตะได้ไม่ต่ำกว่า 44px** · นิ้วโป้งกดถึงทุกปุ่ม
- **เวลาใช้ UTC+7 เสมอ** (ห้ามพึ่ง timezone ของเครื่อง) · **นับถอยหลังห้ามติดลบ** — เตะแล้วขึ้น `สด` จบแล้วขึ้น `จบการแข่งขัน`
- **ราคา แฮนดิแคป สกอร์ เวลา ห้ามแปลง ห้ามปัด** ต้องตรงกับสลิปเป๊ะ
- **แปลชื่อทีมไม่เจอ = โชว์ชื่ออังกฤษเดิม** ห้ามทับศัพท์เอง
- **หน้า 2 (MY BET) ห้ามโชว์:** บทวิเคราะห์ Forebet · สกอร์ที่ Forebet เดา · เปอร์เซ็นต์ · อะไรที่พูดถึง OCR/เทเลแกรม/ชีต · Bet ID
- **หน้า 2 เป็นธีมดอสเขียว · หน้า 1 กับ 3 เป็นดำ-พรีเมียม** (ไม่ใช่เขียวทั้งแอป)
- **ทางที่แค่อ่านชีต ห้ามสร้างชีตเปล่าทิ้งไว้** (บทเรียนจาก PIKTAX กฎข้อ 5) — อ่านใช้ `sheetIfExists_` เขียนใช้ `sheetEnsure_`
- **`node _tests/run.js` ต้องเขียวหมดก่อน push ทุกครั้ง**
- ชื่อสถานะและชื่อผลใช้ค่าคงที่พวกนี้เท่านั้น:
  - สถานะ: `รอเตะ` · `สด` · `จบ`
  - ผล: `WIN_FULL` · `WIN_HALF` · `PUSH` · `LOSS_HALF` · `LOSS_FULL` · `` (ว่าง = ยังไม่รู้ผล)
  - ตลาด: `AH` · `OVER_UNDER` · `CORRECT_SCORE` · `DRAW`
  - ชนิดบิล: `MAIN` · `SUB`
  - ช่อง PICKS: `FEATURED` · `PICKOFDAY`

## โครงไฟล์

```
pickup-football-tips/
  CLAUDE.md                  คู่มือสั้นสำหรับ AI ตัวถัดไป (กฎเหล็ก + วิธี push)
  .gitignore                 กันคีย์/ของชั่วคราวหลุดขึ้น repo
  gas/                       โค้ดหลังบ้าน (push ขึ้น GAS project ใหม่)
    appsscript.json          timeZone Asia/Bangkok + webapp ANYONE_ANONYMOUS
    Config.gs                ชื่อชีต หัวคอลัมน์ ค่าคงที่ อ่าน Script Properties
    Sheets.gs                เปิดไฟล์ชีต / อ่านแถวเป็น object / สร้างแท็บ
    Setup.gs                 setupSheets() ครั้งเดียวจบ — สร้างไฟล์ชีต+3 แท็บ
    Api.gs                   doGet → JSON ก้อนเดียว + จัดบิลย่อย + สถิติบัญชี
  web/                       หน้าเว็บ (GitHub Pages ชี้มาที่โฟลเดอร์นี้)
    index.html               โครงหน้าเดียว + แถบล่าง 3 ปุ่ม
    css/base.css             โทเคนสี ดำ-พรีเมียม + แถบล่าง + การ์ด (หน้า 1,3)
    css/dos.css              ธีมดอสเขียว + ลายน้ำ Pickup (หน้า 2 เท่านั้น)
    js/fmt.js                ฟอร์แมตเงิน/แฮนดิแคป/ราคา/เวลา UTC+7/นับถอยหลัง
    js/mock.js               ข้อมูลปลอมของเฟส 1 (ใช้เป็นของสำรองตอนเน็ตล่มด้วย)
    js/api.js                ดึง JSON + แคช localStorage + บอกสถานะออฟไลน์
    js/page-forebet.js       ปั้น HTML หน้า 1
    js/page-mybet.js         ปั้น HTML หน้า 2
    js/page-ledger.js        ปั้น HTML หน้า 3 + กราฟ SVG
    js/app.js                router (hash) + mount + แถบล่าง
  _tests/
    run.js                   ตัวรันเทสต์ (ไม่พึ่ง lib ภายนอก)
    gasEnv.js                โหลด .gs เข้า Node พร้อม stub ของ Google APIs
    fakeSheet.js             ชีตปลอมที่งับค่าเหมือนของจริง
    webEnv.js                โหลด web/js/*.js เข้า Node พร้อม stub localStorage/fetch
    fmt.test.js  web.test.js  gas.test.js
  docs/superpowers/
    specs/2026-08-25-pickup-football-tips-design.md
    plans/2026-08-25-pickup-web-and-data.md   (ไฟล์นี้)
```

**เหตุผลที่แยกแบบนี้:** ไฟล์ที่เปลี่ยนพร้อมกันอยู่ด้วยกัน — หน้าเว็บหนึ่งหน้า = ไฟล์ js หนึ่งไฟล์ + ท่อนของมันใน css · ฟังก์ชันคิดเลขทุกตัวไม่แตะ DOM เลย จึงเทสต์ใน Node ได้ทั้งหมด

## หัวคอลัมน์ชีต (ล็อกไว้ตรงนี้ ทุกงานอ้างชุดนี้)

**PICKS** (14 ช่อง)
```
ID · วันที่ · ช่อง · ลีก · ทีมเหย้า · ทีมเยือน · เวลาเตะ · เดาผล · เดาสกอร์ · เปอร์เซ็นต์ · ราคา · สกอร์จริง · ถูกผิด · สร้างเมื่อ
```

**BETS** (25 ช่อง)
```
ID · Parent_ID · Bill_Type · วันที่ · ลีก · ทีมเหย้า · ทีมเยือน · ทีมที่เลือก · คู่แข่ง · ตลาด · แฮนดิแคป · เส้น · ทายสกอร์ · ราคา · เงิน · เวลาเตะ · สถานะ · สกอร์เหย้า · สกอร์เยือน · ผล · กำไร · Telegram_Message_ID · กุญแจกันซ้ำ · สร้างเมื่อ · อัปเดตเมื่อ
```
- `แฮนดิแคป` ใช้เฉพาะตลาด `AH` · `เส้น` ใช้เฉพาะ `OVER_UNDER` · `ทายสกอร์` ใช้เฉพาะ `CORRECT_SCORE`
- บิลแม่ `Parent_ID` ว่าง + `Bill_Type` = `MAIN` · บิลย่อยใส่ ID ของแม่ + `SUB`
- `กำไร` เก็บเป็น **ตัวเลข** ไม่ใช่ข้อความ · ยอดคืนไม่เก็บ (คิดตอนแสดง)

**TEAMS** (2 ช่อง)
```
ชื่ออังกฤษ · ชื่อไทย
```

## รูปร่าง JSON ที่ GAS คายออกมา (ล็อกไว้ตรงนี้)

```json
{
  "ok": true,
  "at": "2026-08-25T14:05:00+07:00",
  "picks": [
    { "id":"PK-1", "ช่อง":"FEATURED", "ลีก":"Serie A", "เหย้า":"Inter", "เยือน":"Milan",
      "เหย้าไทย":"อินเตอร์", "เยือนไทย":"มิลาน", "เวลาเตะ":"2026-08-25T21:45:00+07:00",
      "เดาผล":"1", "เดาสกอร์":"2-1", "เปอร์เซ็นต์":56, "ราคา":1.95 }
  ],
  "bets": [
    { "id":"BT-1", "ชนิด":"MAIN", "ตลาด":"AH", "ลีก":"Colombia Primera A",
      "เหย้า":"Once Caldas", "เยือน":"Junior", "เหย้าไทย":"อองเซ กัลดาส", "เยือนไทย":"จูเนียร์",
      "ทีมที่เลือก":"Once Caldas", "ทีมที่เลือกไทย":"อองเซ กัลดาส", "คู่แข่ง":"Junior", "คู่แข่งไทย":"จูเนียร์",
      "แฮนดิแคป":0.5, "เส้น":"", "ทายสกอร์":"", "ราคา":1.95, "เงิน":300,
      "เวลาเตะ":"2026-08-26T08:00:00+07:00", "สถานะ":"จบ",
      "สกอร์เหย้า":1, "สกอร์เยือน":1, "ผล":"WIN_FULL", "กำไร":285,
      "subs":[ { "id":"BT-2", "ชนิด":"SUB", "ตลาด":"OVER_UNDER", "เส้น":1.5, "ราคา":1.72,
                 "เงิน":100, "ผล":"WIN_FULL", "กำไร":72 } ],
      "รวมเงิน":400, "รวมกำไร":357 }
  ],
  "ledger": {
    "กำไรสะสม":357, "ลงไปทั้งหมด":400, "จำนวนใบ":2, "อัตราชนะ":1,
    "เส้นกราฟ":[ { "วันที่":"2026-08-26", "สะสม":357 } ]
  }
}
```

**นิยาม `อัตราชนะ`** = `(จำนวน WIN_FULL + 0.5 × จำนวน WIN_HALF) ÷ (ใบที่รู้ผลแล้ว − ใบที่ PUSH)` · ถ้าตัวหารเป็น 0 ให้คืน `null` แล้วหน้าเว็บโชว์ `—`

---

### Task 1: โครงโปรเจกต์ + ตัวรันเทสต์ + ตัวฟอร์แมต

**Files:**
- Create: `.gitignore` · `CLAUDE.md`
- Create: `_tests/run.js` · `_tests/gasEnv.js` · `_tests/fakeSheet.js` · `_tests/webEnv.js`
- Create: `web/js/fmt.js`
- Test: `_tests/fmt.test.js`

**Interfaces:**
- Consumes: ไม่มี (งานแรก)
- Produces:
  - `loadGas(files, stubs) -> sandbox` และ `fakeResponse(code, text)` จาก `_tests/gasEnv.js`
  - `fakeSheet(headers) -> sheetObj` จาก `_tests/fakeSheet.js`
  - `loadWeb(files, stubs) -> sandbox` จาก `_tests/webEnv.js`
  - `web/js/fmt.js` ประกาศฟังก์ชัน global พวกนี้:
    - `fmtMoney(n) -> string` เช่น `1234.5` → `"1,234.50"`
    - `fmtSigned(n) -> string` เช่น `234` → `"+234.00"` · `-150` → `"-150.00"` · `0` → `"0.00"`
    - `fmtHandicap(h) -> string` เช่น `0` → `"0"` · `0.5` → `"+0.5"` · `-0.25` → `"-0.25"`
    - `fmtOdds(o) -> string` เช่น `1.9` → `"1.90"` · `6.161` → `"6.161"` (ห้ามปัดทิ้ง)
    - `thDate(iso) -> string` เช่น `"2026-08-25T21:45:00+07:00"` → `"25 ส.ค. 69"`
    - `thTime(iso) -> string` → `"21:45"`
    - `countdownText(iso, status, nowMs) -> string` → `"อีก 3 ชม. 12 น."` / `"สด"` / `"จบการแข่งขัน"`

- [ ] **Step 1: สร้างโฟลเดอร์ + git init + ไฟล์กันหลุด**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
git init
mkdir -p gas web/css web/js _tests
printf '%s\n' 'node_modules/' '_scratch/' '*.token' '*.key.txt' '.scriptId' '.deployId' > .gitignore
```

- [ ] **Step 2: คัดลอกตัวรันเทสต์จาก PIKTAX (ของที่พิสูจน์แล้ว 194 เทสต์)**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
cp "D:/Projects/t.seeedz/PIKTAX/_tests/run.js"       _tests/run.js
cp "D:/Projects/t.seeedz/PIKTAX/_tests/gasEnv.js"    _tests/gasEnv.js
cp "D:/Projects/t.seeedz/PIKTAX/_tests/fakeSheet.js" _tests/fakeSheet.js
```

- [ ] **Step 3: เขียน `_tests/webEnv.js`**

```javascript
// _tests/webEnv.js — โหลดไฟล์ web/js/*.js เข้ามารันใน Node พร้อม stub ของเบราว์เซอร์
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/**
 * loadWeb - โหลดไฟล์ js ตามลำดับที่ส่งมา แล้วคืน sandbox
 * ไฟล์ใน web/js ต้องประกาศเป็น function ธรรมดาที่ระดับบนสุด (ไม่มี module/import)
 * เพราะหน้าเว็บโหลดด้วย <script> ตรงๆ ไม่มีขั้นตอน build
 */
function loadWeb(files, stubs) {
  const store = {};
  const sandbox = {
    console, JSON, Math, Date, String, Number, Array, Object, RegExp, Error,
    parseFloat, parseInt, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, Boolean, Function,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    },
    __store: store,
    fetch: () => Promise.reject(new Error('fetch ไม่ได้ถูก stub ในเทสต์นี้')),
    location: { hash: '' }
  };
  Object.assign(sandbox, stubs || {});
  sandbox.__ls = () => sandbox.localStorage;   /* ให้เทสต์ยัดของเสียเข้าแคชได้ */
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  files.forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(src, sandbox, { filename: f });
  });
  return sandbox;
}

module.exports = { loadWeb };
```

- [ ] **Step 4: เขียนเทสต์ที่ต้องตก `_tests/fmt.test.js`**

```javascript
'use strict';
const { loadWeb } = require('./webEnv');

const w = loadWeb(['web/js/fmt.js']);

test('fmtMoney ใส่คอมมาและทศนิยม 2 ตำแหน่งเสมอ', () => {
  eq(w.fmtMoney(1234.5), '1,234.50');
  eq(w.fmtMoney(300), '300.00');
  eq(w.fmtMoney(-150), '-150.00');
  eq(w.fmtMoney(0), '0.00');
});

test('fmtSigned ใส่เครื่องหมายบวกให้กำไร', () => {
  eq(w.fmtSigned(234), '+234.00');
  eq(w.fmtSigned(-150), '-150.00');
  eq(w.fmtSigned(0), '0.00');
});

test('fmtHandicap ศูนย์ไม่มีเครื่องหมาย ที่เหลือมีเสมอ', () => {
  eq(w.fmtHandicap(0), '0');
  eq(w.fmtHandicap(0.5), '+0.5');
  eq(w.fmtHandicap(-0.25), '-0.25');
  eq(w.fmtHandicap(1), '+1');
  eq(w.fmtHandicap(-1.25), '-1.25');
});

test('fmtOdds ห้ามปัดทศนิยมที่สลิปให้มา', () => {
  eq(w.fmtOdds(1.9), '1.90');
  eq(w.fmtOdds(1.95), '1.95');
  eq(w.fmtOdds(6.161), '6.161');
  eq(w.fmtOdds(10), '10.00');
});

test('thDate อ่านเป็นเวลาไทยเสมอ ไม่พึ่ง timezone ของเครื่อง', () => {
  eq(w.thDate('2026-08-25T21:45:00+07:00'), '25 ส.ค. 69');
  // 2026-08-25T18:30Z = 26 ส.ค. 01:30 ตามเวลาไทย → ต้องข้ามวัน
  eq(w.thDate('2026-08-25T18:30:00Z'), '26 ส.ค. 69');
});

test('thTime อ่านเป็นเวลาไทยเสมอ', () => {
  eq(w.thTime('2026-08-25T21:45:00+07:00'), '21:45');
  eq(w.thTime('2026-08-25T18:30:00Z'), '01:30');
});

test('countdownText ยังไม่เตะ = นับถอยหลัง', () => {
  const kick = '2026-08-25T21:45:00+07:00';
  const now = Date.parse('2026-08-25T18:33:00+07:00');
  eq(w.countdownText(kick, 'รอเตะ', now), 'อีก 3 ชม. 12 น.');
});

test('countdownText เหลือไม่ถึงชั่วโมง = บอกเป็นนาที', () => {
  const kick = '2026-08-25T21:45:00+07:00';
  const now = Date.parse('2026-08-25T21:20:00+07:00');
  eq(w.countdownText(kick, 'รอเตะ', now), 'อีก 25 น.');
});

test('countdownText เตะไปแล้วห้ามติดลบ', () => {
  const kick = '2026-08-25T21:45:00+07:00';
  const now = Date.parse('2026-08-25T22:30:00+07:00');
  eq(w.countdownText(kick, 'รอเตะ', now), 'สด');
  eq(w.countdownText(kick, 'สด', now), 'สด');
});

test('countdownText จบแล้วขึ้นจบ ไม่ว่าเวลาจะเป็นเท่าไหร่', () => {
  const kick = '2026-08-25T21:45:00+07:00';
  eq(w.countdownText(kick, 'จบ', Date.parse('2026-08-25T18:00:00+07:00')), 'จบการแข่งขัน');
  eq(w.countdownText(kick, 'จบ', Date.parse('2026-08-26T09:00:00+07:00')), 'จบการแข่งขัน');
});

test('เวลาที่อ่านไม่ได้ ต้องไม่ทำให้พัง', () => {
  eq(w.thDate(''), '');
  eq(w.thTime('อะไรไม่รู้'), '');
  eq(w.countdownText('', 'รอเตะ', Date.now()), '');
});
```

- [ ] **Step 5: รันให้เห็นว่าตก**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: ตกทุกข้อ ด้วยข้อความประมาณ `w.fmtMoney is not a function`

- [ ] **Step 6: เขียน `web/js/fmt.js` ให้ผ่าน**

```javascript
/* fmt.js — แปลงตัวเลข/เวลาเป็นข้อความสำหรับหน้าจอ
   กฎ: เวลาทุกตัวคิดเป็น UTC+7 เสมอ ไม่พึ่ง timezone ของเครื่อง
        ราคา/แฮนดิแคป/สกอร์ ห้ามปัดทิ้ง */
'use strict';

var TH_MONTH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
var TZ_MS = 7 * 60 * 60 * 1000;

/** คืน Date ที่เลื่อนไป UTC+7 แล้ว — ต้องอ่านค่าด้วย getUTC* เท่านั้น */
function thShift_(iso) {
  if (iso === null || iso === undefined || iso === '') return null;
  var t = Date.parse(iso);
  if (isNaN(t)) return null;
  return new Date(t + TZ_MS);
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function fmtMoney(n) {
  var v = Number(n);
  if (isNaN(v)) return '0.00';
  var neg = v < 0;
  var s = Math.abs(v).toFixed(2);
  var parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + parts[0] + '.' + parts[1];
}

function fmtSigned(n) {
  var v = Number(n);
  if (isNaN(v)) return '0.00';
  return (v > 0 ? '+' : '') + fmtMoney(v);
}

function fmtHandicap(h) {
  var v = Number(h);
  if (isNaN(v)) return '';
  if (v === 0) return '0';
  var s = String(Math.abs(v));
  return (v > 0 ? '+' : '-') + s;
}

function fmtOdds(o) {
  var v = Number(o);
  if (isNaN(v)) return '';
  var dec = (String(v).split('.')[1] || '').length;
  return v.toFixed(Math.max(2, dec));
}

function thDate(iso) {
  var d = thShift_(iso);
  if (!d) return '';
  var be = d.getUTCFullYear() + 543;
  return d.getUTCDate() + ' ' + TH_MONTH[d.getUTCMonth()] + ' ' + String(be).slice(-2);
}

function thTime(iso) {
  var d = thShift_(iso);
  if (!d) return '';
  return pad2_(d.getUTCHours()) + ':' + pad2_(d.getUTCMinutes());
}

/** สถานะมาก่อนเวลาเสมอ — จบแล้วก็คือจบ ไม่ว่านาฬิกาจะว่าอะไร */
function countdownText(iso, status, nowMs) {
  if (status === 'จบ') return 'จบการแข่งขัน';
  var t = Date.parse(iso);
  if (isNaN(t)) return '';
  if (status === 'สด') return 'สด';
  var left = t - Number(nowMs);
  if (left <= 0) return 'สด';
  var mins = Math.floor(left / 60000);
  var hrs = Math.floor(mins / 60);
  if (hrs > 0) return 'อีก ' + hrs + ' ชม. ' + (mins % 60) + ' น.';
  return 'อีก ' + mins + ' น.';
}
```

- [ ] **Step 7: รันให้เขียว**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `ผ่าน 11/11`

- [ ] **Step 8: เขียน `CLAUDE.md`**

```markdown
# Pickup Football Tips — อ่านก่อนแตะโค้ด

สมุดบันทึกแทงบอลส่วนตัวคนเดียว ใช้จากไอโฟน Safari · แยกขาดจาก PIKTAX
สเปก: `docs/superpowers/specs/2026-08-25-pickup-football-tips-design.md`
แผน: `docs/superpowers/plans/`

## กฎเหล็ก

| # | กฎ | ถ้าพัง |
|---|---|---|
| 1 | คนละบอท คนละ GAS project คนละชีตกับ PIKTAX · ห้ามเรียก `?ff=` ของ PIKTAX | สลิปบอลไหลเข้าบัญชีภาษี / PIKTAX ล่มแล้วลามมา |
| 2 | ห้ามแตะ `BetSlip.gs` `BetGate.gs` `BetRules.gs` `BetTeam.gs` ใน PIKTAX | ด่านกันสลิปบอลปนบัญชีพัง |
| 3 | คีย์/โทเคน/ไอดีชีต อยู่ใน Script Properties เท่านั้น | คีย์หลุด |
| 4 | หน้า 2 (MY BET) ห้ามโชว์ เปอร์เซ็นต์ / สกอร์ที่เดา / Bet ID / เรื่อง OCR-เทเลแกรม-ชีต | ผิดสเปกข้อ 10 |
| 5 | ทางที่แค่อ่านชีต ใช้ `sheetIfExists_` (ไม่มีชีตคืน null) — `sheetEnsure_` ใช้เฉพาะทางเขียน | สร้างชีตเปล่าทิ้งไว้ (เคยพลาดใน PIKTAX) |
| 6 | ราคา แฮนดิแคป สกอร์ เวลา ห้ามแปลง ห้ามปัด | ตัวเลขไม่ตรงสลิป |

## แก้แล้วขึ้นยังไง

1. `node _tests/run.js` ต้องเขียวหมดก่อน
2. หลังบ้าน: `node "C:\Users\jazza\.claude\skills\gas\scripts\push.js" "D:\Projects\t.seeedz\pickup-football-tips" "ข้อความ version"`
3. หน้าเว็บ: คอมมิตแล้ว push ขึ้น GitHub — Pages ชี้ที่โฟลเดอร์ `web/`
4. ยิงเน็ตต้องใช้ PowerShell `Invoke-WebRequest` (Bash tool บนเครื่องนี้ออกเน็ตไม่ได้)

## ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| `gas/Api.gs` | `doGet` คาย JSON ก้อนเดียว + จัดบิลย่อย + สถิติ |
| `gas/Sheets.gs` | เปิด/อ่าน/สร้างแท็บชีต |
| `gas/Setup.gs` | `setupSheets()` รันครั้งเดียวตอนตั้งระบบ |
| `web/js/fmt.js` | ฟอร์แมตทุกอย่างที่โชว์บนจอ |
| `web/js/page-*.js` | ปั้น HTML ของแต่ละหน้า (คืนเป็น string เพื่อให้เทสต์ได้) |
```

- [ ] **Step 9: คอมมิต**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
git add .gitignore CLAUDE.md _tests web/js/fmt.js
git commit -m "chore: วางโครงโปรเจกต์ + ตัวรันเทสต์ + ตัวฟอร์แมตเวลา/เงิน"
```

---

### Task 2: โครงหน้าเว็บ + แถบล่าง 3 ปุ่ม + ธีมดำพรีเมียม (ข้อมูลปลอม)

**Files:**
- Create: `web/index.html` · `web/css/base.css` · `web/js/mock.js` · `web/js/app.js`
- Test: `_tests/web.test.js`

**Interfaces:**
- Consumes: `fmt.js` จาก Task 1
- Produces:
  - `MOCK` (object) จาก `web/js/mock.js` — รูปร่างเดียวกับ JSON ที่ GAS จะคายใน Task 7 เป๊ะ
  - `routeOf(hash) -> 'forebet'|'mybet'|'ledger'` จาก `app.js`
  - `renderNav(active) -> string` จาก `app.js`

- [ ] **Step 1: เขียนเทสต์ที่ต้องตก — สร้าง `_tests/web.test.js`**

```javascript
'use strict';
const { loadWeb } = require('./webEnv');

const w = loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/app.js']);

test('routeOf รู้จัก 3 หน้า และของแปลกให้ตกมาที่หน้าแรก', () => {
  eq(w.routeOf('#forebet'), 'forebet');
  eq(w.routeOf('#mybet'), 'mybet');
  eq(w.routeOf('#ledger'), 'ledger');
  eq(w.routeOf(''), 'forebet');
  eq(w.routeOf('#อะไรไม่รู้'), 'forebet');
});

test('renderNav มีครบ 3 ปุ่ม และปุ่มที่เปิดอยู่ถูกทำเครื่องหมาย', () => {
  const html = w.renderNav('mybet');
  ok(html.indexOf('#forebet') >= 0, 'ต้องมีลิงก์หน้า 1');
  ok(html.indexOf('#mybet') >= 0, 'ต้องมีลิงก์หน้า 2');
  ok(html.indexOf('#ledger') >= 0, 'ต้องมีลิงก์หน้า 3');
  ok(html.indexOf('nav-on') >= 0, 'ต้องมีคลาสบอกปุ่มที่เปิดอยู่');
  eq((html.match(/nav-on/g) || []).length, 1, 'ต้องมีปุ่มที่เปิดอยู่ใบเดียว');
  ok(/nav-on[^>]*href="#mybet"|href="#mybet"[^>]*nav-on/.test(html), 'nav-on ต้องอยู่บนปุ่ม mybet');
});

test('ข้อมูลปลอมมีรูปร่างเดียวกับของจริง', () => {
  ok(Array.isArray(w.MOCK.picks), 'picks ต้องเป็น array');
  ok(Array.isArray(w.MOCK.bets), 'bets ต้องเป็น array');
  ok(w.MOCK.ledger && typeof w.MOCK.ledger === 'object', 'ต้องมี ledger');
  ok(w.MOCK.picks.length >= 2 && w.MOCK.picks.length <= 4, 'การ์ด Forebet ต้อง 2-4 ใบ');
  const main = w.MOCK.bets[0];
  ok(Array.isArray(main.subs), 'บิลแม่ต้องมีช่อง subs');
  eq(main['ชนิด'], 'MAIN');
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: ตกที่ `ENOENT ... web/js/mock.js`

- [ ] **Step 3: เขียน `web/js/mock.js`**

```javascript
/* mock.js — ข้อมูลปลอมรูปร่างเดียวกับที่ GAS จะคายออกมาจริง
   ใช้ตอนเฟส 1 (ยังไม่มีหลังบ้าน) และใช้เป็นของสำรองตอนดึงของจริงไม่ได้ */
'use strict';

var MOCK = {
  ok: true,
  at: '2026-08-25T14:05:00+07:00',
  picks: [
    { id: 'PK-1', 'ช่อง': 'FEATURED', 'ลีก': 'Serie A',
      'เหย้า': 'Inter', 'เยือน': 'Milan', 'เหย้าไทย': 'อินเตอร์', 'เยือนไทย': 'มิลาน',
      'เวลาเตะ': '2026-08-25T21:45:00+07:00', 'เดาผล': '1', 'เดาสกอร์': '2-1',
      'เปอร์เซ็นต์': 56, 'ราคา': 1.95 },
    { id: 'PK-2', 'ช่อง': 'PICKOFDAY', 'ลีก': 'Colombia Primera A',
      'เหย้า': 'Once Caldas', 'เยือน': 'Junior', 'เหย้าไทย': 'อองเซ กัลดาส', 'เยือนไทย': 'จูเนียร์',
      'เวลาเตะ': '2026-08-26T08:00:00+07:00', 'เดาผล': 'X', 'เดาสกอร์': '1-1',
      'เปอร์เซ็นต์': 41, 'ราคา': 3.20 }
  ],
  bets: [
    { id: 'BT-1', 'ชนิด': 'MAIN', 'ตลาด': 'AH', 'ลีก': 'Colombia Primera A',
      'เหย้า': 'Once Caldas', 'เยือน': 'Junior', 'เหย้าไทย': 'อองเซ กัลดาส', 'เยือนไทย': 'จูเนียร์',
      'ทีมที่เลือก': 'Once Caldas', 'ทีมที่เลือกไทย': 'อองเซ กัลดาส',
      'คู่แข่ง': 'Junior', 'คู่แข่งไทย': 'จูเนียร์',
      'แฮนดิแคป': 0.5, 'เส้น': '', 'ทายสกอร์': '', 'ราคา': 1.95, 'เงิน': 300,
      'เวลาเตะ': '2026-08-26T08:00:00+07:00', 'สถานะ': 'จบ',
      'สกอร์เหย้า': 1, 'สกอร์เยือน': 1, 'ผล': 'WIN_FULL', 'กำไร': 285,
      subs: [
        { id: 'BT-2', 'ชนิด': 'SUB', 'ตลาด': 'OVER_UNDER', 'แฮนดิแคป': '', 'เส้น': 1.5,
          'ทายสกอร์': '', 'ราคา': 1.72, 'เงิน': 100, 'ผล': 'WIN_FULL', 'กำไร': 72 },
        { id: 'BT-3', 'ชนิด': 'SUB', 'ตลาด': 'DRAW', 'แฮนดิแคป': '', 'เส้น': '',
          'ทายสกอร์': '', 'ราคา': 6.161, 'เงิน': 50, 'ผล': 'WIN_FULL', 'กำไร': 258.05 }
      ],
      'รวมเงิน': 450, 'รวมกำไร': 615.05 },
    { id: 'BT-4', 'ชนิด': 'MAIN', 'ตลาด': 'AH', 'ลีก': 'Serie A',
      'เหย้า': 'Inter', 'เยือน': 'Milan', 'เหย้าไทย': 'อินเตอร์', 'เยือนไทย': 'มิลาน',
      'ทีมที่เลือก': 'Milan', 'ทีมที่เลือกไทย': 'มิลาน',
      'คู่แข่ง': 'Inter', 'คู่แข่งไทย': 'อินเตอร์',
      'แฮนดิแคป': 0.25, 'เส้น': '', 'ทายสกอร์': '', 'ราคา': 1.88, 'เงิน': 300,
      'เวลาเตะ': '2026-08-25T21:45:00+07:00', 'สถานะ': 'รอเตะ',
      'สกอร์เหย้า': '', 'สกอร์เยือน': '', 'ผล': '', 'กำไร': 0,
      subs: [], 'รวมเงิน': 300, 'รวมกำไร': 0 }
  ],
  ledger: {
    'กำไรสะสม': 615.05, 'ลงไปทั้งหมด': 450, 'จำนวนใบ': 3, 'อัตราชนะ': 1,
    'เส้นกราฟ': [
      { 'วันที่': '2026-08-24', 'สะสม': -150 },
      { 'วันที่': '2026-08-25', 'สะสม': 120.5 },
      { 'วันที่': '2026-08-26', 'สะสม': 615.05 }
    ]
  }
};
```

- [ ] **Step 4: เขียน `web/js/app.js`**

```javascript
/* app.js — router แบบ hash + แถบล่าง + ตัวเปิดหน้า
   ไม่มี framework ไม่มี build — โหลดด้วย <script> ตามลำดับใน index.html */
'use strict';

var ROUTES = ['forebet', 'mybet', 'ledger'];
var NAV_LABEL = { forebet: 'FOREBET', mybet: 'MY BET', ledger: 'LEDGER' };

function routeOf(hash) {
  var h = String(hash || '').replace(/^#/, '');
  return ROUTES.indexOf(h) >= 0 ? h : 'forebet';
}

function renderNav(active) {
  var items = ROUTES.map(function (r) {
    var cls = 'nav-item' + (r === active ? ' nav-on' : '');
    return '<a class="' + cls + '" href="#' + r + '">' + NAV_LABEL[r] + '</a>';
  });
  return '<nav class="nav">' + items.join('') + '</nav>';
}

/** เลือกตัวปั้นหน้าตาม route — ฟังก์ชันพวกนี้มาจาก page-*.js */
function renderPage(route, data, nowMs) {
  if (route === 'mybet') return renderMyBet(data, nowMs);
  if (route === 'ledger') return renderLedger(data);
  return renderForebet(data, nowMs);
}

/** ผูกกับ DOM — ส่วนนี้ไม่มีเทสต์ เพราะมันแค่เอา string ไปแปะ
    Task 8 จะมาแทนที่ mount_ ด้วยตัวที่ดึงของจริง */
function mount_() {
  if (typeof document === 'undefined') return;
  var route = routeOf(location.hash);
  document.body.className = 'page-' + route;
  document.getElementById('app').innerHTML = renderPage(route, MOCK, Date.now());
  document.getElementById('nav').innerHTML = renderNav(route);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('hashchange', mount_);
  window.addEventListener('DOMContentLoaded', mount_);
}
```

- [ ] **Step 5: เขียน `web/index.html`**

```html
<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Pickup</title>
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/dos.css">
</head>
<body class="page-forebet">
  <main id="app"></main>
  <div id="nav"></div>
  <script src="js/fmt.js"></script>
  <script src="js/mock.js"></script>
  <script src="js/page-forebet.js"></script>
  <script src="js/page-mybet.js"></script>
  <script src="js/page-ledger.js"></script>
  <script src="js/api.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

`page-*.js` กับ `api.js` ยังไม่มีในงานนี้ — สร้างเป็นไฟล์ที่มีแค่ `'use strict';` ไปก่อน แล้วงานถัดไปค่อยเติม (หน้าเว็บจะได้ไม่พังกลางทาง)

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
for f in page-forebet page-mybet page-ledger api; do printf "'use strict';\n" > "web/js/$f.js"; done
```

- [ ] **Step 6: เขียน `web/css/base.css`**

```css
/* base.css — ธีมดำพรีเมียมสำหรับหน้า 1 และ 3 + แถบล่างที่ใช้ร่วมทุกหน้า */
:root {
  --bg: #0b0d10;
  --card: #14171c;
  --line: #232830;
  --ink: #e8eaed;
  --ink-dim: #98a0ad;
  --gold: #d4af37;
  --green: #24c07a;
  --red: #e0483d;
  --nav-h: 62px;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Thai", sans-serif;
  padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom));
  -webkit-text-size-adjust: 100%;
}
#app { padding: 14px 14px 4px; max-width: 720px; margin: 0 auto; }

.nav {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
  display: flex; background: #0f1216; border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom);
}
.nav-item {
  flex: 1; min-height: 44px; height: var(--nav-h);
  display: flex; align-items: center; justify-content: center;
  color: var(--ink-dim); text-decoration: none;
  font-size: 13px; letter-spacing: .08em; font-weight: 600;
}
.nav-on { color: var(--gold); box-shadow: inset 0 2px 0 var(--gold); }

.card {
  background: var(--card); border: 1px solid var(--line); border-radius: 14px;
  padding: 14px; margin-bottom: 12px;
}
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.muted { color: var(--ink-dim); font-size: 12px; }
.big { font-size: 20px; font-weight: 700; }
.btn {
  display: block; width: 100%; min-height: 44px; line-height: 44px;
  text-align: center; border-radius: 12px; border: 1px solid var(--line);
  background: #191d23; color: var(--ink); text-decoration: none; font-weight: 600;
}
.pos { color: var(--green); }
.neg { color: var(--red); }
.stale { color: var(--gold); font-size: 12px; margin-bottom: 8px; }
.curve { display: block; margin: 8px 0; }
```

- [ ] **Step 7: รันเทสต์ให้เขียว**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `ผ่าน 14/14`

- [ ] **Step 8: คอมมิต**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
git add web _tests/web.test.js
git commit -m "feat: โครงหน้าเว็บ 3 หน้า + แถบล่าง + ธีมดำ (ข้อมูลปลอม)"
```

---
### Task 3: หน้า 1 FOREBET — การ์ดคู่บอล

**Files:**
- Modify: `web/js/page-forebet.js` (ตอนนี้มีแค่ `'use strict';`)
- Modify: `_tests/web.test.js` (เติมเทสต์ท้ายไฟล์)

**Interfaces:**
- Consumes: `fmt.js` (`thDate` `thTime` `countdownText` `fmtOdds`) · `MOCK`
- Produces:
  - `teamTh(en, th) -> string` — แปลไม่เจอคืนชื่ออังกฤษเดิม
  - `esc_(s) -> string` — กันอักขระ HTML
  - `pickCard(p, nowMs) -> string`
  - `renderForebet(data, nowMs) -> string`

- [ ] **Step 1: เขียนเทสต์ที่ต้องตก (เติมท้าย `_tests/web.test.js`)**

```javascript
const f = loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/page-forebet.js']);

test('teamTh ไม่มีชื่อไทย = ใช้ชื่ออังกฤษ ห้ามทับศัพท์เอง', () => {
  eq(f.teamTh('Once Caldas', 'อองเซ กัลดาส'), 'อองเซ กัลดาส');
  eq(f.teamTh('Once Caldas', ''), 'Once Caldas');
  eq(f.teamTh('Once Caldas', null), 'Once Caldas');
  eq(f.teamTh('Once Caldas', undefined), 'Once Caldas');
});

test('esc_ กันโค้ดหลุดเข้า HTML', () => {
  eq(f.esc_('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
  eq(f.esc_('a & b'), 'a &amp; b');
  eq(f.esc_(''), '');
  eq(f.esc_(null), '');
});

test('pickCard โชว์ครบ ทีม/เวลา/เปอร์เซ็นต์/ราคา และนับถอยหลัง', () => {
  const now = Date.parse('2026-08-25T18:33:00+07:00');
  const html = f.pickCard(f.MOCK.picks[0], now);
  ok(html.indexOf('อินเตอร์') >= 0, 'ต้องมีชื่อไทยทีมเหย้า');
  ok(html.indexOf('มิลาน') >= 0, 'ต้องมีชื่อไทยทีมเยือน');
  ok(html.indexOf('21:45') >= 0, 'ต้องมีเวลาเตะ');
  ok(html.indexOf('56%') >= 0, 'ต้องมีเปอร์เซ็นต์');
  ok(html.indexOf('1.95') >= 0, 'ต้องมีราคา');
  ok(html.indexOf('อีก 3 ชม. 12 น.') >= 0, 'ต้องมีนับถอยหลัง');
});

test('renderForebet เรียงเปอร์เซ็นต์มากไปน้อย และไม่เกิน 4 ใบ', () => {
  const many = { picks: [], bets: [], ledger: {} };
  for (let i = 0; i < 9; i++) {
    many.picks.push(Object.assign({}, f.MOCK.picks[0], { id: 'PK-' + i, 'เปอร์เซ็นต์': i * 10 }));
  }
  const html = f.renderForebet(many, Date.now());
  eq((html.match(/class="card pick"/g) || []).length, 4);
  ok(html.indexOf('80%') >= 0, 'ใบเปอร์เซ็นต์สูงสุดต้องติดมา');
  ok(html.indexOf('>0%<') === -1, 'ใบเปอร์เซ็นต์ต่ำสุดต้องถูกตัด');
  const iHi = html.indexOf('80%'), iLo = html.indexOf('50%');
  ok(iHi < iLo, 'ใบเปอร์เซ็นต์สูงต้องอยู่บนกว่า');
});

test('renderForebet ไม่มีคู่ = บอกตรงๆ ไม่ใช่หน้าขาว', () => {
  const html = f.renderForebet({ picks: [], bets: [], ledger: {} }, Date.now());
  ok(html.indexOf('ยังไม่มีคู่ของรอบนี้') >= 0);
});

test('renderForebet มีปุ่มกรอกเองเสมอ และปุ่มสูงพอให้นิ้วโป้งกด', () => {
  ok(f.renderForebet(f.MOCK, Date.now()).indexOf('กรอกเอง') >= 0);
  ok(f.renderForebet({ picks: [], bets: [], ledger: {} }, Date.now()).indexOf('กรอกเอง') >= 0);
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `f.teamTh is not a function`

- [ ] **Step 3: เขียน `web/js/page-forebet.js`**

```javascript
/* page-forebet.js — หน้า 1: คู่ที่ Forebet คัดมา
   ทุกฟังก์ชันคืนเป็น string ไม่แตะ DOM เพื่อให้เทสต์ใน Node ได้ */
'use strict';

var MAX_CARDS = 4;

/** แปลไม่เจอ = โชว์ชื่ออังกฤษเดิม (สเปกข้อ 11 — ห้ามทับศัพท์เอง) */
function teamTh(en, th) {
  var t = (th === null || th === undefined) ? '' : String(th).trim();
  return t !== '' ? t : String(en === null || en === undefined ? '' : en);
}

function esc_(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function pickCard(p, nowMs) {
  var home = esc_(teamTh(p['เหย้า'], p['เหย้าไทย']));
  var away = esc_(teamTh(p['เยือน'], p['เยือนไทย']));
  var pct = Number(p['เปอร์เซ็นต์']);
  var cd = countdownText(p['เวลาเตะ'], 'รอเตะ', nowMs);
  return '' +
    '<div class="card pick">' +
      '<div class="row"><span class="muted">' + esc_(p['ลีก']) + '</span>' +
        '<span class="muted">' + esc_(thDate(p['เวลาเตะ'])) + ' ' + esc_(thTime(p['เวลาเตะ'])) + '</span></div>' +
      '<div class="big">' + home + ' <span class="muted">พบ</span> ' + away + '</div>' +
      '<div class="row">' +
        '<span class="pick-pct">' + (isNaN(pct) ? '' : pct + '%') + '</span>' +
        '<span class="pick-odds">' + esc_(fmtOdds(p['ราคา'])) + '</span>' +
      '</div>' +
      '<div class="muted">' + esc_(cd) + '</div>' +
    '</div>';
}

function renderForebet(data, nowMs) {
  var picks = (data && data.picks ? data.picks : []).slice();
  picks.sort(function (a, b) { return Number(b['เปอร์เซ็นต์']) - Number(a['เปอร์เซ็นต์']); });
  picks = picks.slice(0, MAX_CARDS);

  var head = '<div class="muted">ข้อมูลรอบ ' + esc_(thTime(data && data.at)) + '</div>';
  var body = picks.length
    ? picks.map(function (p) { return pickCard(p, nowMs); }).join('')
    : '<div class="card"><div class="big">ยังไม่มีคู่ของรอบนี้</div>' +
      '<div class="muted">รอบถัดไปอีกไม่นาน หรือกรอกเองได้เลย</div></div>';

  return head + body + '<a class="btn" href="#mybet">กรอกเอง</a>';
}
```

- [ ] **Step 4: เติม css ของหน้า 1 ท้าย `web/css/base.css`**

```css
.pick .big { margin: 6px 0 8px; }
.pick-pct { color: var(--gold); font-weight: 700; font-size: 18px; }
.pick-odds { color: var(--ink-dim); font-variant-numeric: tabular-nums; }
```

- [ ] **Step 5: รันให้เขียว**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `ผ่าน 20/20`

- [ ] **Step 6: คอมมิต**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
git add web/js/page-forebet.js web/css/base.css _tests/web.test.js
git commit -m "feat: หน้า 1 FOREBET การ์ดคู่บอล เรียงเปอร์เซ็นต์ ตัดที่ 4 ใบ"
```

---

### Task 4: หน้า 2 MY BET — สลิปธีมดอส + บิลย่อย + ด่านกันของต้องห้าม

**Files:**
- Modify: `web/js/page-mybet.js`
- Create: `web/css/dos.css`
- Modify: `_tests/web.test.js`

**Interfaces:**
- Consumes: `fmt.js` · `teamTh` `esc_` จาก `page-forebet.js`
- Produces:
  - `resultBadge(code) -> string`
  - `marketLine(b) -> string`
  - `betSlip(b, nowMs) -> string`
  - `renderMyBet(data, nowMs) -> string`

**หมายเหตุ:** เทสต์ "ของต้องห้าม" ในงานนี้คือหัวใจของทั้งงาน — สเปกข้อ 10 ห้ามหน้านี้โชว์บทวิเคราะห์ Forebet / สกอร์ที่เดา / เปอร์เซ็นต์ / Bet ID / อะไรที่พูดถึง OCR-เทเลแกรม-ชีต เทสต์นี้ยัดของต้องห้ามใส่ข้อมูลแล้วยืนยันว่ามันไม่โผล่ใน HTML

- [ ] **Step 1: เขียนเทสต์ที่ต้องตก (เติมท้าย `_tests/web.test.js`)**

```javascript
const wm = loadWeb(['web/js/fmt.js', 'web/js/mock.js',
                    'web/js/page-forebet.js', 'web/js/page-mybet.js']);

test('resultBadge ครบ 5 ผล + ยังไม่รู้ผล', () => {
  ok(wm.resultBadge('WIN_FULL').indexOf('ชนะเต็ม') >= 0);
  ok(wm.resultBadge('WIN_HALF').indexOf('ชนะครึ่ง') >= 0);
  ok(wm.resultBadge('PUSH').indexOf('คืนทุน') >= 0);
  ok(wm.resultBadge('LOSS_HALF').indexOf('แพ้ครึ่ง') >= 0);
  ok(wm.resultBadge('LOSS_FULL').indexOf('แพ้เต็ม') >= 0);
  ok(wm.resultBadge('').indexOf('รอผล') >= 0);
  const classes = ['WIN_FULL','WIN_HALF','PUSH','LOSS_HALF','LOSS_FULL','']
    .map(c => (wm.resultBadge(c).match(/r-[a-z]+/) || [''])[0]);
  eq(new Set(classes).size, 6, 'ทั้ง 6 แบบต้องคนละสี');
});

test('marketLine เขียนแต่ละตลาดเป็นภาษาคน', () => {
  eq(wm.marketLine({ 'ตลาด':'AH', 'ทีมที่เลือก':'Milan', 'ทีมที่เลือกไทย':'มิลาน', 'แฮนดิแคป':0.25 }),
     'มิลาน +0.25');
  eq(wm.marketLine({ 'ตลาด':'OVER_UNDER', 'เส้น':1.5 }), 'สูง 1.5');
  eq(wm.marketLine({ 'ตลาด':'OVER_UNDER', 'เส้น':-2.5 }), 'ต่ำ 2.5');
  eq(wm.marketLine({ 'ตลาด':'DRAW' }), 'เสมอ');
  eq(wm.marketLine({ 'ตลาด':'CORRECT_SCORE', 'ทายสกอร์':'2-1' }), 'สกอร์ตรง 2-1');
});

test('betSlip โชว์เงิน ราคา ผล และบิลย่อยครบ', () => {
  const html = wm.betSlip(wm.MOCK.bets[0], Date.now());
  ok(html.indexOf('อองเซ กัลดาส') >= 0, 'ต้องมีทีมที่เลือก');
  ok(html.indexOf('+0.5') >= 0, 'ต้องมีแฮนดิแคป');
  ok(html.indexOf('1.95') >= 0, 'ต้องมีราคา');
  ok(html.indexOf('300.00') >= 0, 'ต้องมีเงินที่ลง');
  ok(html.indexOf('ชนะเต็ม') >= 0, 'ต้องมีผล');
  ok(html.indexOf('สูง 1.5') >= 0, 'ต้องมีบิลย่อยใบที่ 1');
  ok(html.indexOf('เสมอ') >= 0, 'ต้องมีบิลย่อยใบที่ 2');
  ok(html.indexOf('6.161') >= 0, 'ราคาบิลย่อยห้ามปัด');
  ok(html.indexOf('450.00') >= 0, 'ต้องมียอดรวมเงินทั้งคู่');
  ok(html.indexOf('+615.05') >= 0, 'ต้องมียอดรวมกำไรทั้งคู่');
});

test('หน้า 2 ห้ามหลุดของต้องห้าม (กฎเหล็กสเปกข้อ 10)', () => {
  const dirty = Object.assign({}, wm.MOCK.bets[0], {
    'เปอร์เซ็นต์': 56,
    'เดาสกอร์': '2-1',
    'บทวิเคราะห์': 'Forebet บอกว่าเจ้าบ้านฟอร์มดี',
    'Telegram_Message_ID': 9911,
    'กุญแจกันซ้ำ': 'KEY-XYZ'
  });
  const html = wm.betSlip(dirty, Date.now());
  eq(html.indexOf('BT-1'), -1, 'ห้ามโชว์ Bet ID');
  eq(html.indexOf('56%'), -1, 'ห้ามโชว์เปอร์เซ็นต์');
  eq(html.indexOf('2-1'), -1, 'ห้ามโชว์สกอร์ที่ Forebet เดา');
  eq(html.indexOf('Forebet'), -1, 'ห้ามโชว์บทวิเคราะห์');
  eq(html.indexOf('9911'), -1, 'ห้ามโชว์เลขข้อความเทเลแกรม');
  eq(html.indexOf('KEY-XYZ'), -1, 'ห้ามโชว์กุญแจกันซ้ำ');
});

test('betSlip ห้ามโชว์แฮนดิแคปของฝั่งตรงข้าม', () => {
  const b = Object.assign({}, wm.MOCK.bets[1]);
  b['แฮนดิแคป'] = 0.5;
  const html = wm.betSlip(b, Date.now());
  ok(html.indexOf('+0.5') >= 0, 'ต้องมีแฮนดิแคปฝั่งที่เลือก');
  eq(html.indexOf('-0.5'), -1, 'ห้ามโชว์แฮนดิแคปฝั่งตรงข้าม');
});

test('renderMyBet มีลายน้ำและกรอบธีมดอส', () => {
  const html = wm.renderMyBet(wm.MOCK, Date.now());
  ok(html.indexOf('dos-wrap') >= 0, 'ต้องมีกรอบธีมดอส');
  ok(html.indexOf('dos-mark') >= 0, 'ต้องมีลายน้ำ');
  ok(html.indexOf('Pickup') >= 0, 'ลายน้ำต้องเขียนว่า Pickup');
});

test('renderMyBet ไม่มีบิล = บอกตรงๆ', () => {
  const html = wm.renderMyBet({ picks: [], bets: [], ledger: {} }, Date.now());
  ok(html.indexOf('ยังไม่มีบิล') >= 0);
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `wm.resultBadge is not a function`

- [ ] **Step 3: เขียน `web/js/page-mybet.js`**

```javascript
/* page-mybet.js — หน้า 2: สลิปของเราเอง ธีมดอสเขียว
   กฎเหล็ก (สเปกข้อ 10): หน้านี้ห้ามโชว์ Bet ID / เปอร์เซ็นต์ / สกอร์ที่ Forebet เดา /
   บทวิเคราะห์ / อะไรที่พูดถึง OCR-เทเลแกรม-ชีต
   วิธีกัน: ปั้น HTML จากช่องที่ระบุชื่อทีละช่องเท่านั้น ห้ามวนลูปทั้ง object */
'use strict';

var RESULT_MAP = {
  WIN_FULL:  { t: '✓ ชนะเต็ม',  c: 'r-winfull' },
  WIN_HALF:  { t: '✓ ชนะครึ่ง', c: 'r-winhalf' },
  PUSH:      { t: '= คืนทุน',   c: 'r-push' },
  LOSS_HALF: { t: '✗ แพ้ครึ่ง', c: 'r-losshalf' },
  LOSS_FULL: { t: '✗ แพ้เต็ม',  c: 'r-lossfull' }
};

function resultBadge(code) {
  var r = RESULT_MAP[code] || { t: '⏳ รอผล', c: 'r-pending' };
  return '<span class="badge ' + r.c + '">' + r.t + '</span>';
}

function marketLine(b) {
  var m = b['ตลาด'];
  if (m === 'AH') {
    return teamTh(b['ทีมที่เลือก'], b['ทีมที่เลือกไทย']) + ' ' + fmtHandicap(b['แฮนดิแคป']);
  }
  if (m === 'OVER_UNDER') {
    var v = Number(b['เส้น']);
    if (isNaN(v)) return 'สูง/ต่ำ';
    return (v >= 0 ? 'สูง ' : 'ต่ำ ') + Math.abs(v);
  }
  if (m === 'DRAW') return 'เสมอ';
  if (m === 'CORRECT_SCORE') return 'สกอร์ตรง ' + String(b['ทายสกอร์'] || '');
  return String(m || '');
}

function subLine_(s) {
  return '<div class="sub">' +
    '<span class="sub-m">' + esc_(marketLine(s)) + '</span> ' +
    '<span class="sub-o">@' + esc_(fmtOdds(s['ราคา'])) + '</span> ' +
    '<span class="sub-b">' + esc_(fmtMoney(s['เงิน'])) + '</span> ' +
    resultBadge(s['ผล']) +
    '<span class="sub-p">' + esc_(fmtSigned(s['กำไร'])) + '</span>' +
  '</div>';
}

function betSlip(b, nowMs) {
  var home = esc_(teamTh(b['เหย้า'], b['เหย้าไทย']));
  var away = esc_(teamTh(b['เยือน'], b['เยือนไทย']));
  var subs = (b.subs || []).map(subLine_).join('');
  var score = (String(b['สกอร์เหย้า']) !== '' && b['สกอร์เหย้า'] !== undefined &&
               b['สกอร์เหย้า'] !== null)
    ? '<div class="slip-score">' + esc_(b['สกอร์เหย้า']) + ' - ' + esc_(b['สกอร์เยือน']) + '</div>'
    : '';
  var sum = (b.subs && b.subs.length)
    ? '<div class="slip-sum">รวม ' + esc_(fmtMoney(b['รวมเงิน'])) + ' → ' +
      '<b>' + esc_(fmtSigned(b['รวมกำไร'])) + '</b></div>'
    : '';

  return '' +
    '<div class="slip">' +
      '<div class="slip-top">' + esc_(b['ลีก']) + ' · ' + esc_(thDate(b['เวลาเตะ'])) + '</div>' +
      '<div class="slip-teams">' + home + ' พบ ' + away + '</div>' +
      score +
      '<div class="slip-kick">' + esc_(thTime(b['เวลาเตะ'])) + ' · ' +
        esc_(countdownText(b['เวลาเตะ'], b['สถานะ'], nowMs)) + '</div>' +
      '<div class="main">' +
        '<span class="main-m">' + esc_(marketLine(b)) + '</span> ' +
        '<span class="main-o">@' + esc_(fmtOdds(b['ราคา'])) + '</span> ' +
        '<span class="main-b">' + esc_(fmtMoney(b['เงิน'])) + '</span> ' +
        resultBadge(b['ผล']) +
        '<span class="main-p">' + esc_(fmtSigned(b['กำไร'])) + '</span>' +
      '</div>' +
      subs +
      sum +
    '</div>';
}

function renderMyBet(data, nowMs) {
  var bets = (data && data.bets ? data.bets : []);
  var body = bets.length
    ? bets.map(function (b) { return betSlip(b, nowMs); }).join('')
    : '<div class="slip"><div class="slip-teams">ยังไม่มีบิล</div>' +
      '<div class="slip-kick">ส่งสลิปเข้าบอทหรือกรอกเองได้เลย</div></div>';
  return '<div class="dos-wrap"><div class="dos-mark">Pickup</div>' + body + '</div>';
}
```

- [ ] **Step 4: เขียน `web/css/dos.css`**

```css
/* dos.css — ธีมดอสเขียว ใช้เฉพาะหน้า MY BET เท่านั้น
   หน้า 1 กับ 3 ยังเป็นดำ-พรีเมียมของ base.css */
body.page-mybet { background: #000; }

.dos-wrap {
  position: relative; overflow: hidden;
  background: #000; color: #33ff66;
  border: 1px solid #1c7a3a; border-radius: 10px; padding: 14px;
  font-family: "SF Mono", Menlo, Consolas, "Courier New", monospace;
  font-size: 14px; line-height: 1.6;
  text-shadow: 0 0 6px rgba(51, 255, 102, .35);
}
.dos-mark {
  position: absolute; top: 38%; left: 50%;
  transform: translate(-50%, -50%) rotate(-18deg);
  font-size: 68px; font-weight: 800; letter-spacing: .1em;
  color: #33ff66; opacity: .07; pointer-events: none; white-space: nowrap;
}
.slip { position: relative; z-index: 1; border-bottom: 1px dashed #1c7a3a; padding: 10px 0; }
.slip:last-child { border-bottom: 0; }
.slip-top { opacity: .7; font-size: 12px; }
.slip-teams { font-size: 16px; font-weight: 700; margin: 2px 0; }
.slip-score { font-size: 22px; font-weight: 800; letter-spacing: .06em; }
.slip-kick { opacity: .75; font-size: 12px; margin-bottom: 6px; }
.main, .sub { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 30px; }
.sub { opacity: .9; padding-left: 14px; }
.sub::before { content: "└ "; opacity: .6; }
.main-p, .sub-p { margin-left: auto; font-weight: 700; }
.slip-sum { margin-top: 6px; padding-top: 6px; border-top: 1px dotted #1c7a3a; }

.badge { border: 1px solid currentColor; border-radius: 4px; padding: 0 6px; font-size: 12px; }
.r-winfull  { color: #33ff66; }
.r-winhalf  { color: #9bff5a; }
.r-push     { color: #cfcfcf; }
.r-losshalf { color: #ffb14a; }
.r-lossfull { color: #ff5a4a; }
.r-pending  { color: #6fe3ff; }
```

- [ ] **Step 5: รันให้เขียว**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `ผ่าน 27/27`

- [ ] **Step 6: คอมมิต**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
git add web/js/page-mybet.js web/css/dos.css _tests/web.test.js
git commit -m "feat: หน้า 2 MY BET ธีมดอส + บิลย่อย + ด่านกันของต้องห้ามหลุด"
```

---

### Task 5: หน้า 3 LEDGER — สรุปยอด + กราฟกำไรสะสม

**Files:**
- Modify: `web/js/page-ledger.js`
- Modify: `web/css/base.css`
- Modify: `_tests/web.test.js`

**Interfaces:**
- Consumes: `fmt.js` · `teamTh` `esc_` · `marketLine` `resultBadge`
- Produces:
  - `segColor(v) -> string`
  - `curveSvg(points, w, h) -> string`
  - `renderLedger(data) -> string`

- [ ] **Step 1: เขียนเทสต์ที่ต้องตก (เติมท้าย `_tests/web.test.js`)**

```javascript
const wl = loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/page-forebet.js',
                    'web/js/page-mybet.js', 'web/js/page-ledger.js']);

test('segColor แดงเมื่อติดลบ เขียวเมื่อบวกหรือศูนย์', () => {
  eq(wl.segColor(-1), 'var(--red)');
  eq(wl.segColor(0), 'var(--green)');
  eq(wl.segColor(5), 'var(--green)');
});

test('curveSvg เส้นแบน (ทุกจุดเท่ากัน) ต้องไม่หารด้วยศูนย์', () => {
  const svg = wl.curveSvg([{ 'วันที่':'2026-08-01','สะสม':100 },
                           { 'วันที่':'2026-08-02','สะสม':100 }], 300, 90);
  ok(svg.indexOf('<svg') === 0);
  ok(svg.indexOf('NaN') === -1, 'ห้ามมี NaN หลุดเข้า svg');
  ok(svg.indexOf('Infinity') === -1);
});

test('curveSvg จุดเดียวก็ยังวาดได้ ไม่พัง', () => {
  const svg = wl.curveSvg([{ 'วันที่':'2026-08-01','สะสม':-50 }], 300, 90);
  ok(svg.indexOf('<svg') === 0);
  ok(svg.indexOf('NaN') === -1);
});

test('curveSvg ไม่มีจุดเลย = ไม่วาด', () => {
  eq(wl.curveSvg([], 300, 90), '');
});

test('curveSvg แต่ละท่อนใช้สีตามค่าปลายท่อน + มีเส้นศูนย์', () => {
  const svg = wl.curveSvg([{ 'วันที่':'2026-08-24','สะสม':100 },
                           { 'วันที่':'2026-08-25','สะสม':-150 },
                           { 'วันที่':'2026-08-26','สะสม':615.05 }], 300, 90);
  ok(svg.indexOf('var(--red)') >= 0, 'ท่อนที่จบต่ำกว่าศูนย์ต้องแดง');
  ok(svg.indexOf('var(--green)') >= 0, 'ท่อนที่จบเหนือศูนย์ต้องเขียว');
  ok(svg.indexOf('stroke-dasharray') >= 0, 'ต้องมีเส้นศูนย์แบบประ');
  eq((svg.match(/<line /g) || []).length, 3, 'จุด 3 = ท่อน 2 + เส้นศูนย์ 1');
});

test('renderLedger โชว์ตัวเลขสรุปครบ', () => {
  const html = wl.renderLedger(wl.MOCK);
  ok(html.indexOf('+615.05') >= 0, 'กำไรสะสม');
  ok(html.indexOf('450.00') >= 0, 'ลงไปทั้งหมด');
  ok(html.indexOf('100%') >= 0, 'อัตราชนะ');
  ok(html.indexOf('<svg') >= 0, 'ต้องมีกราฟ');
});

test('renderLedger อัตราชนะเป็น null = ขีด ไม่ใช่ NaN', () => {
  const d = { picks: [], bets: [], ledger: { 'กำไรสะสม':0, 'ลงไปทั้งหมด':0,
    'จำนวนใบ':0, 'อัตราชนะ':null, 'เส้นกราฟ':[] } };
  const html = wl.renderLedger(d);
  ok(html.indexOf('—') >= 0, 'ต้องโชว์ขีด');
  eq(html.indexOf('NaN'), -1);
});

test('renderLedger เรียงบิลใหม่สุดขึ้นก่อน', () => {
  const html = wl.renderLedger(wl.MOCK);
  const iNew = html.indexOf('อองเซ กัลดาส');   // เตะ 26 ส.ค.
  const iOld = html.indexOf('อินเตอร์');        // เตะ 25 ส.ค.
  ok(iNew < iOld, 'บิลที่เตะทีหลังต้องอยู่บนกว่า');
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `wl.segColor is not a function`

- [ ] **Step 3: เขียน `web/js/page-ledger.js`**

```javascript
/* page-ledger.js — หน้า 3: สรุปยอดรวม + กราฟกำไรสะสม
   กราฟวาดเป็น SVG เองทั้งหมด ไม่พึ่ง lib — จะได้ไม่มีอะไรต้องโหลดจากเน็ต */
'use strict';

function segColor(v) { return Number(v) < 0 ? 'var(--red)' : 'var(--green)'; }

function curveSvg(points, w, h) {
  var pts = points || [];
  if (!pts.length) return '';

  var vals = pts.map(function (p) { return Number(p['สะสม']) || 0; });
  var hi = Math.max.apply(null, vals.concat([0]));
  var lo = Math.min.apply(null, vals.concat([0]));
  var span = (hi - lo) || 1;              // เส้นแบน = ไม่หารด้วยศูนย์
  var pad = 6;
  var innerH = h - pad * 2;

  function y_(v) { return pad + (hi - v) / span * innerH; }
  function x_(i) { return pts.length === 1 ? w / 2 : (i / (pts.length - 1)) * w; }

  var zeroY = y_(0).toFixed(1);
  var parts = ['<line x1="0" y1="' + zeroY + '" x2="' + w + '" y2="' + zeroY +
               '" stroke="#3a4150" stroke-width="1" stroke-dasharray="4 4"/>'];

  if (pts.length === 1) {
    var cx = x_(0).toFixed(1), cy = y_(vals[0]).toFixed(1);
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + segColor(vals[0]) + '"/>');
  } else {
    for (var i = 1; i < pts.length; i++) {
      parts.push('<line x1="' + x_(i - 1).toFixed(1) + '" y1="' + y_(vals[i - 1]).toFixed(1) +
                 '" x2="' + x_(i).toFixed(1) + '" y2="' + y_(vals[i]).toFixed(1) +
                 '" stroke="' + segColor(vals[i]) + '" stroke-width="2" stroke-linecap="round"/>');
    }
  }

  return '<svg class="curve" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h +
         '" preserveAspectRatio="none">' + parts.join('') + '</svg>';
}

function rateText_(r) {
  if (r === null || r === undefined || r === '') return '—';
  var v = Number(r);
  if (isNaN(v)) return '—';
  return Math.round(v * 1000) / 10 + '%';
}

function ledgerRow_(b) {
  return '<div class="lg-row">' +
    '<div class="lg-left">' +
      '<div>' + esc_(teamTh(b['เหย้า'], b['เหย้าไทย'])) + ' พบ ' +
                esc_(teamTh(b['เยือน'], b['เยือนไทย'])) + '</div>' +
      '<div class="muted">' + esc_(thDate(b['เวลาเตะ'])) + ' · ' + esc_(marketLine(b)) + '</div>' +
    '</div>' +
    '<div class="lg-right ' + (Number(b['รวมกำไร']) < 0 ? 'neg' : 'pos') + '">' +
      esc_(fmtSigned(b['รวมกำไร'])) +
    '</div>' +
  '</div>';
}

function renderLedger(data) {
  var lg = (data && data.ledger) ? data.ledger : {};
  var bets = (data && data.bets ? data.bets : []).slice();
  bets.sort(function (a, b) {
    return (Date.parse(b['เวลาเตะ']) || 0) - (Date.parse(a['เวลาเตะ']) || 0);
  });

  var profit = Number(lg['กำไรสะสม']) || 0;
  var head = '<div class="card">' +
    '<div class="muted">กำไรสะสม</div>' +
    '<div class="lg-big ' + (profit < 0 ? 'neg' : 'pos') + '">' + esc_(fmtSigned(profit)) + '</div>' +
    curveSvg(lg['เส้นกราฟ'], 320, 90) +
    '<div class="row"><span class="muted">ลงไปทั้งหมด</span><span>' +
      esc_(fmtMoney(lg['ลงไปทั้งหมด'])) + '</span></div>' +
    '<div class="row"><span class="muted">จำนวนใบที่รู้ผลแล้ว</span><span>' +
      esc_(String(lg['จำนวนใบ'] === undefined ? 0 : lg['จำนวนใบ'])) + '</span></div>' +
    '<div class="row"><span class="muted">อัตราชนะ</span><span>' +
      esc_(rateText_(lg['อัตราชนะ'])) + '</span></div>' +
  '</div>';

  var list = bets.length
    ? '<div class="card">' + bets.map(ledgerRow_).join('') + '</div>'
    : '<div class="card"><div class="muted">ยังไม่มีบิล</div></div>';

  return head + list;
}
```

- [ ] **Step 4: เติม css หน้า 3 ท้าย `web/css/base.css`**

```css
.lg-big { font-size: 30px; font-weight: 800; margin: 2px 0 4px; font-variant-numeric: tabular-nums; }
.lg-row { display: flex; justify-content: space-between; align-items: center;
          gap: 10px; min-height: 44px; border-bottom: 1px solid var(--line); }
.lg-row:last-child { border-bottom: 0; }
.lg-right { font-weight: 700; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 5: รันให้เขียว**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `ผ่าน 35/35`

- [ ] **Step 6: เปิดดูด้วยตาจริง (เฟส 1 จบตรงนี้)**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips/web" && python -m http.server 8123
```
เปิด `http://localhost:8123/` แล้วเช็ก 4 ข้อ:
1. แถบล่างสลับหน้าได้ทั้ง 3 หน้า
2. หน้า 2 เป็นเขียวบนดำ + เห็นลายน้ำ `Pickup` จางๆ + บิลย่อยเยื้องเข้าไปมี `└`
3. หน้า 3 มีกราฟ เส้นเปลี่ยนสีตรงที่ข้ามศูนย์
4. ย่อหน้าต่างให้แคบเท่าจอมือถือ แล้วปุ่มยังกดง่าย ไม่มีอะไรล้นขอบ

- [ ] **Step 7: คอมมิต**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
git add web/js/page-ledger.js web/css/base.css _tests/web.test.js
git commit -m "feat: หน้า 3 LEDGER สรุปยอด + กราฟกำไรสะสม SVG"
```

---
### Task 6: ฝั่ง GAS — ตั้งค่า + ชีต

**Files:**
- Create: `gas/Config.gs` · `gas/Sheets.gs` · `gas/Setup.gs` · `gas/appsscript.json`
- Create: `_tests/gas.test.js`

**Interfaces:**
- Consumes: ตัวรันเทสต์จาก Task 1 (`loadGas` จาก `gasEnv.js` · `FakeSpreadsheetApp` จาก `fakeSheet.js`)
- Produces:
  - `TZ` `SHEETS` `HEADERS` `TEXT_COLS` `RESULT` `STATUS` (ค่าคงที่)
  - `prop_(key) -> string`
  - `sheetIfExists_(name) -> Sheet|null` — **ห้ามสร้างชีต** (บทเรียน `abdulSheetIfExists_`)
  - `sheetEnsure_(name, headers) -> Sheet` — ทางเขียนเท่านั้นที่สร้างได้
  - `readObjects_(name) -> Array<Object>`
  - `setupSheets() -> string` (คืน URL ของสเปรดชีต)

- [ ] **Step 1: เขียนเทสต์ที่ต้องตก (`_tests/gas.test.js`)**

```javascript
const { loadGas } = require('./gasEnv');
const { FakeSpreadsheetApp } = require('./fakeSheet');

function env(book) {
  const app = new FakeSpreadsheetApp(book);
  return loadGas(['gas/Config.gs', 'gas/Sheets.gs'], {
    SpreadsheetApp: app,
    __book: () => app.book,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => ({ SHEET_ID: 'SHEET-TEST' })[k] || null,
        setProperty: () => {}
      })
    }
  });
}

test('sheetIfExists_ ไม่มีชีต = คืน null ห้ามสร้างชีตเปล่า', () => {
  const g = env({});
  eq(g.sheetIfExists_('PICKS'), null);
  eq(Object.keys(g.__book().sheets).length, 0, 'ห้ามมีชีตงอกมา');
});

test('readObjects_ ชีตไม่มี = คืนอาเรย์ว่าง ไม่ throw', () => {
  eq(env({}).readObjects_('BETS').length, 0);
});

test('readObjects_ แปลงหัวตารางเป็นคีย์ และข้ามแถวว่างล้วน', () => {
  const g = env({ TEAMS: [['ชื่ออังกฤษ','ชื่อไทย'], ['Milan','มิลาน'], ['',''], ['Inter','อินเตอร์']] });
  const rows = g.readObjects_('TEAMS');
  eq(rows.length, 2);
  eq(rows[0]['ชื่อไทย'], 'มิลาน');
  eq(rows[1]['ชื่ออังกฤษ'], 'Inter');
});

test('sheetEnsure_ สร้างชีตพร้อมหัวตารางครบตามที่ล็อกไว้', () => {
  const g = env({});
  g.sheetEnsure_('TEAMS', g.HEADERS.TEAMS);
  const s = g.__book().sheets['TEAMS'];
  ok(s, 'ต้องมีชีตใหม่');
  eq(s.rows[0].join('|'), 'ชื่ออังกฤษ|ชื่อไทย');
});

test('ช่องที่ต้องเป็นข้อความ ถูกบังคับ format @ ไม่งั้นชีตกินเลข 0 หน้า', () => {
  const g = env({});
  g.sheetEnsure_('BETS', g.HEADERS.BETS);
  const s = g.__book().sheets['BETS'];
  g.TEXT_COLS.BETS.forEach(name => {
    const i = g.HEADERS.BETS.indexOf(name) + 1;
    ok(s.textCols.indexOf(i) >= 0, 'ช่อง ' + name + ' ต้องเป็น @');
  });
});

test('อ่านค่าที่ตั้ง @ แล้ว ต้องได้ข้อความเดิม ไม่โดนแปลงเป็นเลข/วันที่', () => {
  const g = env({});
  const s = g.sheetEnsure_('BETS', g.HEADERS.BETS);
  const row = g.HEADERS.BETS.map(() => '');
  row[g.HEADERS.BETS.indexOf('ID')] = '0480';
  row[g.HEADERS.BETS.indexOf('วันที่')] = '2026-08-25';
  s.appendRow(row);
  const out = g.readObjects_('BETS')[0];
  eq(out['ID'], '0480', 'ห้ามกลายเป็น 480');
  eq(typeof out['วันที่'], 'string', 'ห้ามกลายเป็น Date');
});

test('sheetId_ ไม่ได้ตั้งค่า = ด่าออกมาเป็นภาษาคน ไม่ใช่ปล่อยพัง', () => {
  const g = loadGas(['gas/Config.gs', 'gas/Sheets.gs'], {
    SpreadsheetApp: new FakeSpreadsheetApp({}),
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) }
  });
  throws(() => g.sheetId_(), /SHEET_ID/);
});

test('หัวตารางทั้ง 3 ชีตตรงตามที่ล็อกไว้ในแผน', () => {
  const g = env({});
  eq(g.HEADERS.PICKS.length, 14);
  eq(g.HEADERS.BETS.length, 25);
  eq(g.HEADERS.TEAMS.length, 2);
  eq(g.HEADERS.BETS[0], 'ID');
  eq(g.HEADERS.BETS[1], 'Parent_ID');
  eq(g.HEADERS.BETS[2], 'Bill_Type');
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `Cannot find module` หรือหาไฟล์ `gas/Config.gs` ไม่เจอ

- [ ] **Step 3: เขียน `gas/Config.gs`**

```javascript
/* Config.gs — ค่าคงที่ทั้งโปรเจกต์ ที่เดียว
   ห้ามมีกุญแจอะไรในไฟล์นี้ ทุกอย่างที่เป็นความลับอยู่ใน Script Properties */
var TZ = 'Asia/Bangkok';

var SHEETS = { PICKS: 'PICKS', BETS: 'BETS', TEAMS: 'TEAMS' };

var HEADERS = {
  PICKS: ['ID','วันที่','ช่อง','ลีก','ทีมเหย้า','ทีมเยือน','เวลาเตะ',
          'เดาผล','เดาสกอร์','เปอร์เซ็นต์','ราคา','สกอร์จริง','ถูกผิด','สร้างเมื่อ'],
  BETS:  ['ID','Parent_ID','Bill_Type','วันที่','ลีก','ทีมเหย้า','ทีมเยือน',
          'ทีมที่เลือก','คู่แข่ง','ตลาด','แฮนดิแคป','เส้น','ทายสกอร์','ราคา','เงิน',
          'เวลาเตะ','สถานะ','สกอร์เหย้า','สกอร์เยือน','ผล','กำไร',
          'Telegram_Message_ID','กุญแจกันซ้ำ','สร้างเมื่อ','อัปเดตเมื่อ'],
  TEAMS: ['ชื่ออังกฤษ','ชื่อไทย']
};

/* ช่องที่ต้องบังคับเป็นข้อความ ไม่งั้นชีตกิน 0 หน้า / แปลงเป็นวันที่เอง */
var TEXT_COLS = {
  PICKS: ['ID','วันที่','เวลาเตะ','เดาสกอร์','สกอร์จริง','สร้างเมื่อ'],
  BETS:  ['ID','Parent_ID','วันที่','เวลาเตะ','ทายสกอร์','กุญแจกันซ้ำ','สร้างเมื่อ','อัปเดตเมื่อ'],
  TEAMS: []
};

var RESULT = { WIN_FULL:'WIN_FULL', WIN_HALF:'WIN_HALF', PUSH:'PUSH',
               LOSS_HALF:'LOSS_HALF', LOSS_FULL:'LOSS_FULL' };
var STATUS = { WAIT:'รอเตะ', LIVE:'สด', DONE:'จบ' };

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}
```

- [ ] **Step 4: เขียน `gas/Sheets.gs`**

```javascript
/* Sheets.gs — ทางเข้าออกชีตทางเดียวของทั้งโปรเจกต์
   กฎ: ทางอ่านห้ามสร้างชีต (sheetIfExists_) ทางเขียนเท่านั้นที่สร้างได้ (sheetEnsure_) */

function sheetId_() {
  var id = prop_('SHEET_ID');
  if (!id) throw new Error('ยังไม่ได้ตั้งค่า SHEET_ID ใน Script Properties — รัน setupSheets() ก่อน');
  return id;
}

function book_() { return SpreadsheetApp.openById(sheetId_()); }

/** ทางอ่านอย่างเดียว ไม่มีชีต = null ห้ามสร้างชีตเปล่าทิ้งไว้ */
function sheetIfExists_(name) {
  return book_().getSheetByName(name) || null;
}

function sheetEnsure_(name, headers) {
  var bk = book_();
  var sh = bk.getSheetByName(name);
  if (!sh) {
    sh = bk.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    var texts = TEXT_COLS[name] || [];
    for (var i = 0; i < texts.length; i++) {
      var col = headers.indexOf(texts[i]) + 1;
      if (col > 0) sh.getRange(1, col, 2000, 1).setNumberFormat('@');
    }
  }
  return sh;
}

function readObjects_(name) {
  var sh = sheetIfExists_(name);
  if (!sh) return [];
  var vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  var head = vals[0], out = [];
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r], blank = true;
    for (var c = 0; c < row.length; c++) {
      if (String(row[c] === null || row[c] === undefined ? '' : row[c]).trim() !== '') { blank = false; break; }
    }
    if (blank) continue;
    var o = {};
    for (var h = 0; h < head.length; h++) o[String(head[h])] = row[h];
    out.push(o);
  }
  return out;
}
```

- [ ] **Step 5: เขียน `gas/Setup.gs` (รันมือครั้งเดียว)**

```javascript
/* Setup.gs — รันมือครั้งเดียวตอนตั้งระบบ
   ถ้ายังไม่มี SHEET_ID มันสร้างสเปรดชีตให้เอง เจ้าของไม่ต้องไปสร้าง/ก๊อป ID เอง */
function setupSheets() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  if (!id) {
    var ss = SpreadsheetApp.create('Pickup Football Tips — ฐานข้อมูล');
    id = ss.getId();
    props.setProperty('SHEET_ID', id);
  }
  sheetEnsure_(SHEETS.PICKS, HEADERS.PICKS);
  sheetEnsure_(SHEETS.BETS,  HEADERS.BETS);
  sheetEnsure_(SHEETS.TEAMS, HEADERS.TEAMS);
  var url = SpreadsheetApp.openById(id).getUrl();
  Logger.log('ชีตพร้อมแล้ว: ' + url);
  return url;
}
```

- [ ] **Step 6: เขียน `gas/appsscript.json`**

```json
{
  "timeZone": "Asia/Bangkok",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" }
}
```

- [ ] **Step 7: รันให้เขียว**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `ผ่าน 43/43`

- [ ] **Step 8: คอมมิต**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
git add gas/ _tests/gas.test.js
git commit -m "feat: ฝั่ง GAS ตั้งค่า + ทางเข้าออกชีต fail-closed"
```

---

### Task 7: ฝั่ง GAS — ท่อส่งข้อมูลออก `doGet`

**Files:**
- Create: `gas/Api.gs`
- Modify: `_tests/gas.test.js`

**Interfaces:**
- Consumes: `Config.gs` · `Sheets.gs`
- Produces:
  - `nowIso_() -> string`
  - `teamMap_() -> Object`
  - `nestBets_(rows, tmap) -> Array` — บิลย่อยเข้าไปอยู่ใน `subs[]` ของบิลแม่
  - `ledgerStats_(rows) -> Object`
  - `payloadAll_() -> Object` (รูปร่างตามที่ล็อกไว้หัวแผน)
  - `doGet(e) -> TextOutput`

- [ ] **Step 1: เขียนเทสต์ที่ต้องตก (เติมท้าย `_tests/gas.test.js`)**

```javascript
function apiEnv(book) {
  return loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Api.gs'], {
    SpreadsheetApp: new FakeSpreadsheetApp(book),
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => k === 'SHEET_ID' ? 'S' : null }) },
    Utilities: { formatDate: () => '2026-08-25T18:00:00' },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: t => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } })
    }
  });
}
function betRow(o) {
  const g = { 'ID':'', 'Parent_ID':'', 'Bill_Type':'MAIN', 'วันที่':'2026-08-25', 'ลีก':'', 
    'ทีมเหย้า':'', 'ทีมเยือน':'', 'ทีมที่เลือก':'', 'คู่แข่ง':'', 'ตลาด':'AH', 'แฮนดิแคป':0,
    'เส้น':'', 'ทายสกอร์':'', 'ราคา':1.9, 'เงิน':100, 'เวลาเตะ':'2026-08-25T21:45:00+07:00',
    'สถานะ':'จบ', 'สกอร์เหย้า':1, 'สกอร์เยือน':0, 'ผล':'WIN_FULL', 'กำไร':90,
    'Telegram_Message_ID':'', 'กุญแจกันซ้ำ':'', 'สร้างเมื่อ':'', 'อัปเดตเมื่อ':'' };
  return Object.assign(g, o);
}
function bookOf(bets, teams) {
  return {
    BETS: [HEAD_BETS].concat(bets.map(b => HEAD_BETS.map(h => b[h]))),
    TEAMS: [['ชื่ออังกฤษ','ชื่อไทย']].concat(teams || [])
  };
}
const HEAD_BETS = ['ID','Parent_ID','Bill_Type','วันที่','ลีก','ทีมเหย้า','ทีมเยือน',
  'ทีมที่เลือก','คู่แข่ง','ตลาด','แฮนดิแคป','เส้น','ทายสกอร์','ราคา','เงิน','เวลาเตะ',
  'สถานะ','สกอร์เหย้า','สกอร์เยือน','ผล','กำไร','Telegram_Message_ID','กุญแจกันซ้ำ',
  'สร้างเมื่อ','อัปเดตเมื่อ'];

test('nestBets_ บิลย่อยเข้าไปอยู่ใต้บิลแม่ ไม่โผล่เป็นใบเดี่ยว', () => {
  const g = apiEnv(bookOf([
    betRow({ 'ID':'B1' }),
    betRow({ 'ID':'B2', 'Parent_ID':'B1', 'Bill_Type':'SUB', 'เงิน':150, 'กำไร':-150 })
  ]));
  const out = g.nestBets_(g.readObjects_('BETS'), {});
  eq(out.length, 1, 'ต้องเหลือใบแม่ใบเดียวบนสุด');
  eq(out[0].subs.length, 1);
  eq(out[0]['รวมเงิน'], 250);
  eq(out[0]['รวมกำไร'], -60);
});

test('nestBets_ บิลย่อยที่หาแม่ไม่เจอ ต้องเด้งขึ้นมาเป็นใบเดี่ยว ห้ามหายเงียบ', () => {
  const g = apiEnv(bookOf([ betRow({ 'ID':'B9', 'Parent_ID':'ไม่มีจริง', 'Bill_Type':'SUB' }) ]));
  const out = g.nestBets_(g.readObjects_('BETS'), {});
  eq(out.length, 1);
  eq(out[0]['ID'], 'B9');
});

test('nestBets_ เติมชื่อไทยจากตาราง TEAMS แปลไม่เจอปล่อยว่าง', () => {
  const g = apiEnv(bookOf([ betRow({ 'ID':'B1', 'ทีมเหย้า':'Milan', 'ทีมเยือน':'Nowhere FC' }) ],
                          [['Milan','มิลาน']]));
  const out = g.nestBets_(g.readObjects_('BETS'), g.teamMap_());
  eq(out[0]['เหย้าไทย'], 'มิลาน');
  eq(out[0]['เยือนไทย'], '');
});

test('ledgerStats_ นับชนะครึ่งเป็นครึ่งใบ', () => {
  const g = apiEnv(bookOf([]));
  const s = g.ledgerStats_([
    { 'ผล':'WIN_FULL', 'เงิน':100, 'กำไร':90, 'วันที่':'2026-08-01' },
    { 'ผล':'WIN_HALF', 'เงิน':100, 'กำไร':45, 'วันที่':'2026-08-01' },
    { 'ผล':'LOSS_FULL','เงิน':100, 'กำไร':-100,'วันที่':'2026-08-02' }
  ]);
  eq(s['จำนวนใบ'], 3);
  eq(s['ลงไปทั้งหมด'], 300);
  eq(s['กำไรสะสม'], 35);
  eq(s['อัตราชนะ'], 0.5, '(1 + 0.5) ÷ 3');
});

test('ledgerStats_ คืนทุนไม่นับเป็นใบที่แพ้ ต้องตัดออกจากตัวหาร', () => {
  const g = apiEnv(bookOf([]));
  const s = g.ledgerStats_([
    { 'ผล':'WIN_FULL','เงิน':100,'กำไร':90,'วันที่':'2026-08-01' },
    { 'ผล':'PUSH',    'เงิน':100,'กำไร':0, 'วันที่':'2026-08-01' }
  ]);
  eq(s['อัตราชนะ'], 1, '1 ÷ (2 − 1 คืนทุน)');
});

test('ledgerStats_ ยังไม่มีใบที่รู้ผล = อัตราชนะเป็น null ไม่ใช่ NaN', () => {
  const g = apiEnv(bookOf([]));
  const s = g.ledgerStats_([{ 'ผล':'', 'เงิน':100, 'กำไร':'', 'วันที่':'2026-08-01' }]);
  eq(s['จำนวนใบ'], 0);
  eq(s['อัตราชนะ'], null);
});

test('ledgerStats_ เส้นกราฟเป็นยอดสะสม เรียงวันเก่าไปใหม่', () => {
  const g = apiEnv(bookOf([]));
  const s = g.ledgerStats_([
    { 'ผล':'LOSS_FULL','เงิน':100,'กำไร':-100,'วันที่':'2026-08-02' },
    { 'ผล':'WIN_FULL', 'เงิน':100,'กำไร':90, 'วันที่':'2026-08-01' },
    { 'ผล':'WIN_FULL', 'เงิน':100,'กำไร':90, 'วันที่':'2026-08-03' }
  ]);
  eq(s['เส้นกราฟ'].map(p => p['วันที่']).join(','), '2026-08-01,2026-08-02,2026-08-03');
  eq(s['เส้นกราฟ'].map(p => p['สะสม']).join(','), '90,-10,80');
});

test('doGet?p=ping ตอบได้ตั้งแต่ยังไม่มีข้อมูล', () => {
  const g = apiEnv({});
  const j = JSON.parse(g.doGet({ parameter: { p: 'ping' } }).getContent());
  eq(j.ok, true);
});

test('doGet พังต้องตอบเป็น JSON ok:false ไม่ใช่หน้า error ของกูเกิล', () => {
  const g = loadGas(['gas/Config.gs', 'gas/Sheets.gs', 'gas/Api.gs'], {
    SpreadsheetApp: new FakeSpreadsheetApp({}),
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    Utilities: { formatDate: () => '2026-08-25T18:00:00' },
    ContentService: { MimeType: { JSON: 'json' },
      createTextOutput: t => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } }) }
  });
  const j = JSON.parse(g.doGet({ parameter: {} }).getContent());
  eq(j.ok, false);
  ok(String(j.error).indexOf('SHEET_ID') >= 0, 'ต้องบอกสาเหตุจริง');
});

test('payloadAll_ ได้รูปร่างตามที่ล็อกไว้', () => {
  const g = apiEnv(bookOf([ betRow({ 'ID':'B1' }) ]));
  const p = g.payloadAll_();
  eq(p.ok, true);
  ok(Array.isArray(p.picks) && Array.isArray(p.bets));
  ok(typeof p.at === 'string' && p.at.indexOf('+07:00') > 0, 'เวลาเป็น +07:00');
  ok(p.ledger && 'อัตราชนะ' in p.ledger);
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```

- [ ] **Step 3: เขียน `gas/Api.gs`**

```javascript
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
```

- [ ] **Step 4: รันให้เขียว**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `ผ่าน 53/53`

- [ ] **Step 5: คอมมิต**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
git add gas/Api.gs _tests/gas.test.js
git commit -m "feat: doGet ส่งข้อมูลให้หน้าเว็บ + บิลย่อยซ้อน + สรุปยอด"
```

---

### Task 8: ต่อหน้าเว็บเข้ากับข้อมูลจริง + แคชกันเน็ตช้า

**Files:**
- Create: `web/js/api.js`
- Modify: `web/js/app.js` · `web/index.html` · `_tests/web.test.js`

**Interfaces:**
- Produces:
  - `API_URL` (เว้นว่างไว้ก่อน เติมตอน deploy)
  - `saveCache(d)` / `loadCache() -> Object|null` — พังยังไงก็ห้าม throw
  - `pickData(fresh, cached) -> { data, source }` — ลำดับความเชื่อ สด → แคช → ตัวอย่าง
  - `staleNote(source, atMs) -> string`
  - `fetchAll_() -> Promise<Object|null>`

- [ ] **Step 1: เขียนเทสต์ที่ต้องตก (เติมท้าย `_tests/web.test.js`)**

```javascript
const a = loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/api.js']);

test('ไม่มีอะไรเลย = ใช้ข้อมูลตัวอย่าง หน้าไม่ขาว', () => {
  const r = a.pickData(null, null);
  eq(r.source, 'ตัวอย่าง');
  ok(r.data.bets.length > 0);
});

test('มีแคช เน็ตล่ม = ใช้แคช', () => {
  const r = a.pickData(null, { ok: true, at: '2026-08-25T10:00:00+07:00', picks: [], bets: [], ledger: {} });
  eq(r.source, 'แคช');
});

test('ได้ของสด = ใช้ของสด ทับแคช', () => {
  const fresh = { ok: true, at: '2026-08-25T18:00:00+07:00', picks: [], bets: [], ledger: {} };
  eq(a.pickData(fresh, { ok: true, bets: [1] }).source, 'สด');
});

test('เซิร์ฟเวอร์ตอบ ok:false ห้ามนับเป็นของสด', () => {
  const bad = { ok: false, error: 'พัง' };
  eq(a.pickData(bad, { ok: true, at: 'x', picks: [], bets: [], ledger: {} }).source, 'แคช');
  eq(a.pickData(bad, null).source, 'ตัวอย่าง');
});

test('แคชเสีย อ่านแล้วห้ามพังทั้งหน้า', () => {
  a.__ls().setItem('pickup.data.v1', '{ไม่ใช่ json');
  eq(a.loadCache(), null);
});

test('เขียนแคชตอนที่เครื่องไม่ให้เขียน ก็ห้ามพัง', () => {
  const b = loadWeb(['web/js/fmt.js', 'web/js/mock.js', 'web/js/api.js'], {
    localStorage: { getItem() { throw new Error('เต็ม'); }, setItem() { throw new Error('เต็ม'); } }
  });
  b.saveCache({ ok: true });
  eq(b.loadCache(), null);
});

test('แคชเขียนแล้วอ่านกลับได้เหมือนเดิม', () => {
  a.saveCache({ ok: true, at: 'now', picks: [], bets: [], ledger: {} });
  eq(a.loadCache().at, 'now');
});

test('staleNote บอกที่มาของข้อมูลเป็นภาษาคน', () => {
  ok(a.staleNote('สด', Date.now()).indexOf('ล่าสุด') >= 0);
  ok(a.staleNote('แคช', Date.now()).indexOf('ออฟไลน์') >= 0);
  ok(a.staleNote('ตัวอย่าง', Date.now()).indexOf('ตัวอย่าง') >= 0);
});
```

- [ ] **Step 2: รันให้เห็นว่าตก**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```

- [ ] **Step 3: เขียน `web/js/api.js`**

```javascript
/* api.js — ทางเดียวที่หน้าเว็บคุยกับเซิร์ฟเวอร์
   บทเรียนจาก TimeTrack: เปิดแอปต้องเห็นของทันที ห้ามรอเน็ต → อ่านแคชก่อนเสมอ */
'use strict';

var API_URL = '';                       /* เติมตอน deploy (Task 9) */
var CACHE_KEY = 'pickup.data.v1';

function saveCache(d) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), d: d })); }
  catch (e) { /* เครื่องไม่ให้เขียน ก็แค่ไม่มีแคช ไม่ต้องพัง */ }
}

function loadCache() {
  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    return (o && o.d) ? o.d : null;
  } catch (e) { return null; }
}

function pickData(fresh, cached) {
  if (fresh && fresh.ok === true) return { data: fresh, source: 'สด' };
  if (cached && cached.ok === true) return { data: cached, source: 'แคช' };
  return { data: MOCK, source: 'ตัวอย่าง' };
}

function staleNote(source, atMs) {
  if (source === 'สด') return 'ล่าสุด ' + thTime(new Date(Number(atMs)).toISOString());
  if (source === 'แคช') return 'ออฟไลน์ — ของที่จำไว้ล่าสุด';
  return 'ข้อมูลตัวอย่าง — ยังไม่ได้ต่อเซิร์ฟเวอร์';
}

function fetchAll_() {
  if (!API_URL) return Promise.resolve(null);
  return fetch(API_URL + '?p=all', { method: 'GET' })
    .then(function (r) { return r.json(); })
    .catch(function () { return null; });
}
```

- [ ] **Step 4: แก้ `web/js/app.js` ให้ขึ้นจากแคชก่อน แล้วค่อยทับด้วยของสด**

เพิ่มท้ายไฟล์ (แทนที่ตัวเรียก `mount_()` เดิม):

```javascript
var STATE = { data: MOCK, source: 'ตัวอย่าง', at: Date.now() };

function boot_() {
  var picked = pickData(null, loadCache());
  STATE.data = picked.data; STATE.source = picked.source;
  mount_();                                   /* ขึ้นจอทันที ไม่รอเน็ต */

  fetchAll_().then(function (fresh) {
    var p = pickData(fresh, loadCache());
    if (fresh && fresh.ok === true) saveCache(fresh);
    STATE.data = p.data; STATE.source = p.source; STATE.at = Date.now();
    mount_();                                 /* ได้ของสดค่อยทับ */
  });
}

if (typeof window !== 'undefined' && window.document) {
  window.addEventListener('hashchange', mount_);
  boot_();
}
```

และใน `mount_()` ให้แปะบรรทัดที่มาของข้อมูลไว้บนสุด:

```javascript
document.getElementById('note').textContent = staleNote(STATE.source, STATE.at);
```

- [ ] **Step 5: แก้ `web/index.html` ให้โหลด `api.js` ก่อน `app.js`**

```html
<div id="note" class="muted note"></div>
<div id="app"></div>
<nav id="nav" class="nav"></nav>

<script src="js/fmt.js"></script>
<script src="js/mock.js"></script>
<script src="js/api.js"></script>
<script src="js/page-forebet.js"></script>
<script src="js/page-mybet.js"></script>
<script src="js/page-ledger.js"></script>
<script src="js/app.js"></script>
```

- [ ] **Step 6: รันให้เขียว**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips" && node _tests/run.js
```
คาดว่า: `ผ่าน 61/61`

- [ ] **Step 7: คอมมิต**

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
git add web/js/api.js web/js/app.js web/index.html _tests/web.test.js
git commit -m "feat: ต่อข้อมูลจริง + แคชกันเน็ตช้า เปิดแอปเห็นของทันที"
```

---

### Task 9: ขึ้นจริง — GAS + GitHub Pages

**Files:**
- Modify: `web/js/api.js` (เติม `API_URL`)
- Create: `.gas-creds` ไม่มีในโปรเจกต์นี้ — ใช้ของกลางที่ `D:\Projects\.gas-creds\`

**⚠️ ของที่เจ้าของต้องทำเอง ก่อนเริ่มงานนี้ (ทำผ่านมือถือได้ทั้งหมด):**

1. สร้าง repo เปล่าชื่อ `pickup-football-tips` บน GitHub (public)
2. ออกโทเคนใหม่แบบ fine-grained ให้ repo นั้น สิทธิ์ **Contents: Read and write** + **Pages: Read and write** แล้วเซฟลงไฟล์ `D:\Projects\.gas-creds\github-pickup.token`
   (โทเคน 2 ตัวที่มีอยู่เป็นแบบผูก repo เดิม สร้าง repo ใหม่ไม่ได้)
3. ตั้ง Pages: Settings → Pages → Source `Deploy from a branch` → branch `main` โฟลเดอร์ `/web`

- [ ] **Step 1: สร้างโปรเจกต์ GAS ใหม่**

```powershell
$tok = (Get-Content "D:\Projects\.gas-creds\access_token.txt" -Raw).Trim()
Invoke-RestMethod -Method Post -Uri "https://script.googleapis.com/v1/projects" `
  -Headers @{ Authorization = "Bearer $tok" } -ContentType "application/json" `
  -Body '{"title":"Pickup Football Tips"}' | Select-Object scriptId
```
เอา `scriptId` ที่ได้ใส่ไฟล์ `D:\Projects\t.seeedz\pickup-football-tips\.scriptId`

- [ ] **Step 2: ดันโค้ดขึ้น GAS**

```bash
node "C:\Users\jazza\.claude\skills\gas\scripts\push.js" "D:\Projects\t.seeedz\pickup-football-tips" "v1 ตั้งต้น"
```

- [ ] **Step 3: เจ้าของรัน `setupSheets()` ครั้งเดียว**

เปิด script.google.com → โปรเจกต์ `Pickup Football Tips` → เลือกฟังก์ชัน `setupSheets` → กด Run → อนุญาตสิทธิ์ → ดู Execution log จะได้ URL ของชีต

- [ ] **Step 4: deploy เป็นเว็บแอป แล้วเช็กว่ามันหายใจ**

Deploy → New deployment → Web app → Execute as **Me** → Who has access **Anyone** → Deploy → ก๊อป URL `/exec`

```powershell
Invoke-WebRequest "https://script.google.com/macros/s/<deployId>/exec?p=ping" |
  Select-Object -ExpandProperty Content
```
คาดว่า: `{"ok":true,"at":"2026-08-25T..+07:00"}`
(ถ้าได้ 404 มั่ว — บทเรียนจาก PIKTAX v203 — ยิงซ้ำอีกรอบ ไม่ต้องรื้อ)

- [ ] **Step 5: ลองข้อมูลจริง 1 ชุด**

พิมพ์มือลงชีต `BETS` 1 ใบแม่ + 1 ใบย่อย (`Parent_ID` ชี้ไปที่ `ID` ของใบแม่) และ `TEAMS` 1 แถว แล้วยิง:

```powershell
Invoke-WebRequest "https://script.google.com/macros/s/<deployId>/exec?p=all" |
  Select-Object -ExpandProperty Content
```
ต้องเห็น: ใบย่อยอยู่ใน `subs[]` ของใบแม่ · มี `รวมเงิน`/`รวมกำไร` · ชื่อไทยเข้ามาแล้ว · **ไม่มี** `กุญแจกันซ้ำ` กับ `Telegram_Message_ID` หลุดออกมา

- [ ] **Step 6: เติม `API_URL` แล้วดันขึ้น GitHub**

แก้ `web/js/api.js` บรรทัดเดียว:
```javascript
var API_URL = 'https://script.google.com/macros/s/<deployId>/exec';
```

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
git add web/js/api.js && git commit -m "chore: ต่อ API จริง"
git remote add origin https://github.com/<user>/pickup-football-tips.git
git branch -M main && git push -u origin main
```

- [x] **Step 7: เช็กบนมือถือจริง (เฟส 1-3 จบตรงนี้)**

เปิด `https://<user>.github.io/pickup-football-tips/` บน iPhone แล้วไล่ 5 ข้อ:

1. สลับได้ครบ 3 หน้า ไม่มีหน้าไหนขาว
2. หน้า 2 เขียวบนดำ + ลายน้ำ `Pickup` + บิลย่อยเยื้องมี `└`
3. เลขหน้า 3 ตรงกับที่กรอกในชีต
4. **เปิดโหมดเครื่องบินแล้วเปิดแอปใหม่** — ต้องยังเห็นของเดิม + แถบบนเขียนว่า `ออฟไลน์`
5. เปิด Safari → Share → Add to Home Screen → เปิดจากไอคอน แล้วเช็กซ้ำข้อ 1-4
   (บทเรียน TimeTrack: Safari กับแอปโฮมเก็บ localStorage คนละที่ ต้องเช็กสองทาง)

**ถ้าเจอ CORS** (คอนโซลฟ้อง `blocked by CORS policy`): `/exec` มัน 302 ไป googleusercontent.com ซึ่งบางทีไม่ส่ง header กลับมา ทางแก้คือเติม JSONP ใน `doGet`:

```javascript
if (e && e.parameter && e.parameter.callback) {
  return ContentService.createTextOutput(
    String(e.parameter.callback) + '(' + JSON.stringify(payloadAll_()) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
```
**อย่าเพิ่งใส่ไว้ก่อน** — ใส่ต่อเมื่อเจอจริง ไม่งั้นเพิ่มทางเข้าที่ไม่มีใครเทสต์

- [x] **Step 8: คอมมิตปิดเฟส** — ✅ ปิดแล้ว 26 ส.ค. 69 (คอมมิต `582cd86` ดันขึ้น main แล้ว · GAS LIVE v6 · เทสต์ 125/125)

```bash
cd "D:/Projects/t.seeedz/pickup-football-tips"
git add -A && git commit -m "chore: เฟส 1-3 ขึ้นจริงแล้ว"
git push
```

---

## จบแผนนี้แล้วได้อะไร

- เว็บ 3 หน้าใช้งานได้จริงบนมือถือ ต่อชีตจริง ปิดเน็ตยังเปิดดูได้
- ฝั่งเซิร์ฟเวอร์อ่านชีตออกมาเป็น JSON พร้อมบิลย่อยซ้อนและสรุปยอด
- เทสต์ 61 ตัวที่รันได้โดยไม่ต้องมีเน็ต ไม่ต้องเปิดเบราว์เซอร์

## ยังไม่มีในแผนนี้ (ไปแผน 2 กับ 3)

- **แผน 2** (สเปกเฟส 4-7): บอทเทเลแกรม · อ่านสลิปด้วย Vision · คิดผลแฮนดิแคป · ลงบิลย่อยจากแชต
  ⛔ ติดที่เจ้าของต้องสร้างบอทกับ BotFather + rotate กุญแจ Vision ที่หลุดก่อน
- **แผน 3** (สเปกเฟส 8 กับ 10): ดูด Forebet ผ่าน trigger GAS · ปลดของเก่าทิ้ง
  หมายเหตุ: เฟส 9 (กราฟหน้า 3) ทำเสร็จในแผนนี้แล้วที่ Task 5 — แผน 3 ไม่ต้องทำซ้ำ
