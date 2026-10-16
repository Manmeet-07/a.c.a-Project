/* eslint-disable @typescript-eslint/no-require-imports */
const { parentPort, workerData } = require('node:worker_threads');
const PDFParser = require('pdf2json');
const parser = new PDFParser();
let settled = false;
function finish(message) {
  if (settled) return;
  settled = true;
  try { parentPort.postMessage(message); }
  finally { parser.removeAllListeners(); parser.destroy(); }
}
parser.on('pdfParser_dataError', () => finish({ error: 'Could not read this PDF' }));
parser.on('pdfParser_dataReady', data => {
  try {
    if (!Array.isArray(data.Pages) || data.Pages.length > 20) return finish({ error: 'Resumes must contain at most 20 pages' });
    const lines = [];
    let remaining = 100000;
    for (const page of data.Pages) {
      const rows = new Map();
      for (const item of page.Texts || []) {
        if (rows.size >= 2000) break;
        const y = Math.round(item.y * 10) / 10;
        const row = rows.get(y) || [];
        if (row.length < 500) row.push(item);
        rows.set(y, row);
      }
      for (const [, row] of [...rows].sort((a, b) => a[0] - b[0])) {
        let line = '';
        for (const item of row.sort((a, b) => a.x - b.x)) {
          for (const run of (item.R || []).slice(0, 500)) {
            let text = String(run.T).slice(0, remaining * 3);
            try { text = decodeURIComponent(text); } catch {}
            line += text.slice(0, remaining - line.length);
            if (line.length >= remaining) break;
          }
          if (line.length >= remaining) break;
          line += ' ';
        }
        line = line.slice(0, remaining).replace(/\s+/g, ' ').trim();
        if (line) { lines.push(line); remaining -= line.length + 1; }
        if (remaining <= 0 || lines.length >= 2000) return finish({ lines });
      }
    }
    finish({ lines });
  } catch { finish({ error: 'Could not extract PDF text' }); }
});
try {
  // pdf2json may read the backing ArrayBuffer; pooled Buffer offsets corrupt it.
  const input = workerData.pdf;
  const bytes = Buffer.alloc(input.length);
  bytes.set(input);
  parser.parseBuffer(bytes);
}
catch { finish({ error: 'Could not read this PDF' }); }
