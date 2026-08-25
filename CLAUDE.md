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
| 4 | หน้า 2 (MY BET) ห้ามโชว์ เปอร์เซ็นต์ / สกอร์ที่เดา / Bet ID / เรื่อง OCR-เทเลแกรม-ชีต **และห้ามโชว์ยอดเงินที่แทง** (โชว์ได้แค่กำไร/ขาดทุน) | ผิดสเปกข้อ 10 · เงินไปโผล่ผิดหน้า |
| 4b | **ยอดเงินที่ OCR อ่านได้ ลงหน้า 3 (LEDGER) ที่เดียว** — หน้า 1/2 ห้ามแตะเรื่องยอด | ยอดกระจายหลายหน้า แล้วนับซ้ำ |
| 4c | ป้าย **LIVE กระพริบเฉพาะ `source === 'สด'`** เท่านั้น · แคช/ตัวอย่าง = OFFLINE/DEMO | ราคาค้างดูเหมือนราคาสด แล้วตัดสินใจผิด |
| 5 | ทางที่แค่อ่านชีต ใช้ `sheetIfExists_` (ไม่มีชีตคืน null) — `sheetEnsure_` ใช้เฉพาะทางเขียน | สร้างชีตเปล่าทิ้งไว้ (เคยพลาดใน PIKTAX) |
| 6 | ราคา แฮนดิแคป สกอร์ เวลา ห้ามแปลง ห้ามปัด | ตัวเลขไม่ตรงสลิป |

## สถานะขึ้นจริง (25 ส.ค. 69)

- โค้ดครบงาน 1–8 · เทสต์ `ผ่าน 96/96`
- ชีตสร้างแล้ว (3 แท็บ) · หลังบ้าน **LIVE v2** · `?p=ping` และ `?p=all` ยิงผ่านแล้ว
- **ด่านกุญแจ**: `doGet` ต้องมี `?k=` ตรงกับ Script Property `APP_KEY` — ยังไม่ตั้ง = ปฏิเสธทุกอย่าง (ห้าม default เป็นเปิดหมด) · เจ้าของตั้งค่าแล้ว 25 ส.ค. 69 ยิงผ่านจริง (ค่ากุญแจไม่มีใครรู้นอกจากเจ้าของ)
  - `?p=ping` เปิดโล่งได้ แต่ต้องไม่มีข้อมูลติดออกไป
  - หน้าเว็บรับกุญแจจาก `?k=` ครั้งเดียว เก็บ localStorage `pickup.key.v1` แล้วลบออกจากแถบที่อยู่ · **กุญแจห้ามอยู่ในไฟล์ repo**
- หน้าเว็บ **LIVE** → `https://yeddekm2-ui.github.io/pickup-football-tips/` (ยิงครบ 10 ไฟล์ ได้ 200 ทั้งหมด 25 ส.ค. 69)
  - repo `YedDekM2-Ui/pickup-football-tips` (public) · โทเคน `D:\Projects\.gas-creds\github-pickup.token.txt`
  - ⚠️ **Pages เลือกโฟลเดอร์ได้แค่ `/ (root)` กับ `/docs`** — ไม่มี `/web` ให้เลือก จึงดันข้างใน `web/` ไปเป็นสาขา `gh-pages` แทน (GitHub เปิด Pages ให้เองอัตโนมัติ)
  - ⚠️ โทเคนมีสิทธิ์ Pages แค่ **อ่าน** (POST /pages = 403) — สั่งเปิด/สลับสาขา Pages ผ่าน API ไม่ได้ ต้องกดในหน้า Settings
- **ค้างที่เจ้าของ**: BotFather / rotate คีย์ Vision
- ทำต่อที่ Step 7 (เทสต์บนไอโฟน) ของ `docs/superpowers/plans/2026-08-25-pickup-web-and-data.md`

## แก้แล้วขึ้นยังไง

1. `node _tests/run.js` ต้องเขียวหมดก่อน
2. หลังบ้าน: `node "C:\Users\jazza\.claude\skills\gas\scripts\push.js" "D:\Projects\t.seeedz\pickup-football-tips\gas" "ข้อความ version"`
   (**ต้องชี้ที่โฟลเดอร์ `gas` ไม่ใช่รากโปรเจกต์** — `.scriptId`/`.deployId` กับไฟล์ `.gs` อยู่ในนั้น)
3. หน้าเว็บ: คอมมิต → push `main` → **แล้วต้องดัน `web/` ขึ้น `gh-pages` ด้วย (ไม่งั้นหน้าเว็บไม่เปลี่ยน)**
   ```powershell
   $t = (Get-Content "D:\Projects\.gas-creds\github-pickup.token.txt" -Raw).Trim()
   $u = "https://x-access-token:$t@github.com/YedDekM2-Ui/pickup-football-tips.git"
   git push $u main:main
   git subtree push --prefix=web $u gh-pages
   ```
   (โทเคนห้ามเขียนลง `.git/config` — ใส่ใน URL ตอน push เท่านั้น)
4. ยิงเน็ตต้องใช้ PowerShell `Invoke-WebRequest` (Bash tool บนเครื่องนี้ออกเน็ตไม่ได้)

## ไฟล์สำคัญ

| ไฟล์ | หน้าที่ |
|---|---|
| `gas/Api.gs` | `doGet` คาย JSON ก้อนเดียว + จัดบิลย่อย + สถิติ |
| `gas/Sheets.gs` | เปิด/อ่าน/สร้างแท็บชีต |
| `gas/Setup.gs` | `setupSheets()` รันครั้งเดียวตอนตั้งระบบ |
| `web/js/fmt.js` | ฟอร์แมตทุกอย่างที่โชว์บนจอ |
| `web/js/page-*.js` | ปั้น HTML ของแต่ละหน้า (คืนเป็น string เพื่อให้เทสต์ได้) |
