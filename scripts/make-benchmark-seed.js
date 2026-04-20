const fs = require("fs");
const path = require("path");

function parse(file, symbol) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const r = j.chart.result[0];
  const ts = r.timestamp;
  const closes = r.indicators.quote[0].close;
  const rows = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null) continue;
    const d = new Date(ts[i] * 1000).toISOString().slice(0, 10);
    rows.push({ symbol, date: d, close: Number(c.toFixed(4)) });
  }
  return rows;
}

const root = "C:\\Users\\JENSON RADJAWALI\\dev\\aeternum-tracker";
const jk = parse(path.join(root, "jkse.json"), "^JKSE");
const gs = parse(path.join(root, "gspc.json"), "^GSPC");
const all = [...jk, ...gs];
console.log("Total rows:", all.length, "| ^JKSE:", jk.length, "| ^GSPC:", gs.length);

// Chunk into batches for Supabase SQL
const CHUNK = 500;
const chunks = [];
for (let i = 0; i < all.length; i += CHUNK) chunks.push(all.slice(i, i + CHUNK));
console.log("Chunks:", chunks.length);

chunks.forEach((chunk, idx) => {
  const values = chunk
    .map((r) => `('${r.symbol}','${r.date}',${r.close})`)
    .join(",\n");
  const sql = `INSERT INTO benchmark_history (symbol, snapshot_date, close) VALUES\n${values}\nON CONFLICT (symbol, snapshot_date) DO UPDATE SET close = EXCLUDED.close;\n`;
  fs.writeFileSync(path.join(root, `seed-chunk-${idx}.sql`), sql);
});
console.log("Wrote", chunks.length, "chunk files");
