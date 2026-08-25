'use strict';
/**
 * ชีตปลอมที่เลียนแบบ "นิสัยจริง" ของ Google Sheets:
 *   ค่าที่เขียนลงเซลล์ซึ่งยังไม่ได้ตั้งฟอร์แมต '@' จะถูกกลืน
 *     '0480'       → 480          (เลข 0 หน้าหาย)
 *     '2026-07-28' → Date object  (เทียบ String() ไม่มีวันตรง)
 * ทำแบบนี้เพื่อให้เทสต์จับบั๊กตัวจริงได้ ไม่ใช่ผ่านเพราะชีตปลอมใจดีเกินไป
 */
function fakeSheet(headers) {
  const rows = [headers.slice()];
  const fmt = {};                                   // fmt['r,c'] = '@'
  const coerce = (v, key) => {
    if (fmt[key] === '@') return v;
    if (typeof v !== 'string') return v;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00');
    if (/^\d+$/.test(v)) return Number(v);
    return v;
  };
  return {
    rows,
    getName: () => 'fake',
    getMaxRows: () => Math.max(rows.length, 1),
    getMaxColumns: () => headers.length,
    getLastRow: () => rows.length,
    insertRowsAfter: () => {},
    insertColumnsAfter: () => {},
    appendRow: (r) => {
      const at = rows.length + 1;
      rows.push(r.map((v, i) => coerce(v, `${at},${i + 1}`)));
    },
    getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
    getRange: (r, c, nr, nc) => ({
      setNumberFormat: (f) => {
        for (let i = 0; i < nr; i++) for (let k = 0; k < nc; k++) fmt[`${r + i},${c + k}`] = f;
      },
      clearContent: () => {
        for (let i = 0; i < nr; i++) if (rows[r + i - 1]) rows[r + i - 1] = [];
      },
      getValues: () => {
        const out = [];
        for (let i = 0; i < nr; i++) out.push((rows[r + i - 1] || []).slice(c - 1, c - 1 + nc));
        return out;
      },
      setValues: (vals) => {
        for (let i = 0; i < nr; i++) {
          while (rows.length < r + i) rows.push([]);
          const target = rows[r + i - 1];
          for (let k = 0; k < nc; k++) target[c - 1 + k] = coerce(vals[i][k], `${r + i},${c + k}`);
        }
      }
    })
  };
}

module.exports = { fakeSheet };
