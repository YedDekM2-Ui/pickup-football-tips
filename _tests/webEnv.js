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
    location: { hash: '', search: '', pathname: '/' },
    history: { replaceState: function () { /* ลบกุญแจออกจากแถบที่อยู่ */ } }
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
