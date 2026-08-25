// _tests/run.js — ตัวรันเทสต์แบบไม่พึ่ง lib ภายนอก · ใช้: node _tests/run.js
'use strict';
const fs = require('fs');
const path = require('path');

const cases = [];
let currentFile = '';

global.test = (name, fn) => cases.push({ file: currentFile, name, fn });
global.eq = (actual, expected, msg) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((msg || 'ไม่ตรงกัน') + '\n  ได้:   ' + a + '\n  ควรได้: ' + e);
};
global.ok = (v, msg) => { if (!v) throw new Error(msg || 'ควรเป็นจริง แต่ได้ ' + JSON.stringify(v)); };
global.throws = (fn, re, msg) => {
  try { fn(); } catch (e) {
    if (re && !re.test(e.message)) throw new Error((msg || 'ข้อความ error ไม่ตรง') + ': ' + e.message);
    return;
  }
  throw new Error(msg || 'ควรโยน error แต่ไม่โยน');
};

fs.readdirSync(__dirname)
  .filter((f) => f.endsWith('.test.js'))
  .sort()
  .forEach((f) => { currentFile = f; require(path.join(__dirname, f)); });

let pass = 0;
const fails = [];
cases.forEach((c) => {
  try { c.fn(); pass++; process.stdout.write('.'); }
  catch (e) { fails.push(c.file + ' › ' + c.name + '\n  ' + e.message); process.stdout.write('X'); }
});

console.log('\n\nผ่าน ' + pass + '/' + cases.length);
if (fails.length) {
  console.log('\nตก:\n' + fails.map((f) => '  ' + f).join('\n\n'));
  process.exit(1);
}
