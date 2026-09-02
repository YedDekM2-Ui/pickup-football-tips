// _tests/gasEnv.js — โหลดไฟล์ .gs เข้ามารันใน Node พร้อม stub ของ Google APIs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/** formatDate แบบย่อ — รองรับเฉพาะรูปแบบที่ PIKTAX ใช้จริง */
function formatDate(d, tz, fmt) {
  const p = (n, w) => String(n).padStart(w || 2, '0');
  return String(fmt)
    .replace(/yyyy/g, d.getFullYear())
    .replace(/MM/g, p(d.getMonth() + 1))
    .replace(/dd/g, p(d.getDate()))
    .replace(/HH/g, p(d.getHours()))
    .replace(/mm/g, p(d.getMinutes()))
    .replace(/ss/g, p(d.getSeconds()))
    /* d/M ตัวเดียว (ไม่เติม 0) — ต้องมาทีหลัง dd/MM เสมอ
       ของที่แทนไปแล้วเหลือแต่ตัวเลข จึงไม่ชนกัน */
    .replace(/M/g, d.getMonth() + 1)
    .replace(/d/g, d.getDate());
}

/**
 * loadGas - โหลดไฟล์ .gs ตามลำดับที่ส่งมา แล้วคืน sandbox
 * stubs: ทับ global ตัวไหนก็ได้ เช่น { UrlFetchApp: {...} }
 */
function loadGas(files, stubs) {
  const props = {};
  const cache = {};
  const logs = [];

  const sandbox = {
    console,
    JSON, Math, Date, String, Number, Array, Object, RegExp, Error, parseFloat, parseInt, isNaN,
    encodeURIComponent, decodeURIComponent, Boolean, Function,
    Logger: { log: (m) => logs.push(String(m)) },
    __logs: logs,
    __props: props,
    __cache: cache,
    Utilities: {
      formatDate,
      sleep: () => {},
      getUuid: () => 'uuid-test',
      base64Encode: (s) => Buffer.from(String(s), 'utf8').toString('base64'),
      base64Decode: (s) => Array.from(Buffer.from(String(s), 'base64'))
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = String(v); },
        setProperties: (o) => { Object.keys(o).forEach((k) => { props[k] = String(o[k]); }); },
        deleteProperty: (k) => { delete props[k]; }
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (k in cache ? cache[k] : null),
        put: (k, v) => { cache[k] = String(v); },
        remove: (k) => { delete cache[k]; }
      })
    },
    UrlFetchApp: {
      fetch: () => { throw new Error('UrlFetchApp.fetch ไม่ได้ถูก stub ในเทสต์นี้'); }
    },
    SpreadsheetApp: {
      openById: () => { throw new Error('SpreadsheetApp ไม่ได้ถูก stub ในเทสต์นี้'); },
      getActiveSpreadsheet: () => { throw new Error('SpreadsheetApp ไม่ได้ถูก stub ในเทสต์นี้'); }
    },
    DriveApp: {
      getFileById: () => { throw new Error('DriveApp ไม่ได้ถูก stub ในเทสต์นี้'); }
    },
    ScriptApp: {
      getProjectTriggers: () => [],
      newTrigger: () => { throw new Error('ScriptApp.newTrigger ไม่ได้ถูก stub ในเทสต์นี้'); }
    }
  };

  Object.assign(sandbox, stubs || {});
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  files.forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    vm.runInContext(src, sandbox, { filename: f });
  });
  return sandbox;
}

/** ตัวช่วยสร้าง response ปลอมของ UrlFetchApp */
function fakeResponse(code, text) {
  return { getResponseCode: () => code, getContentText: () => text };
}

module.exports = { loadGas, fakeResponse, formatDate };
