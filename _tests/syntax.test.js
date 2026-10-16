'use strict';
/* ทุกไฟล์ใน web/js ต้องแปลได้ — star-app.js ไม่มีเทสต์โหลดมันเลย
   เคยหลุดสตริงขึ้นบรรทัดจริงขึ้นเว็บ (16 ต.ค. 69) หน้าแกะดาวพังทั้งหน้า แต่เทสต์ยังผ่านครบ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'web', 'js');
fs.readdirSync(dir).filter((f) => f.endsWith('.js')).forEach((f) => {
  test('ไวยากรณ์ถูก: web/js/' + f, () => {
    new vm.Script(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
  });
});
