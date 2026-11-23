import { crc32, deflateSync } from 'node:zlib'

/**
 * Small but valid files, built in code: demo resources for the seed and fixtures for the tests.
 * Output is deterministic (same input, same bytes), so the seed can match them by hash.
 */

/** A one-page PDF showing `lines`, padded with a comment block to at least `minBytes` (the library refuses files under 10 KB). */
export function makePdf(lines: string[], minBytes = 12 * 1024) {
  const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&')
  const text = lines.map((l, i) => `BT /F1 ${i ? 12 : 18} Tf 72 ${720 - i * 26} Td (${esc(l)}) Tj ET`).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ]
  let out = '%PDF-1.4\n'
  for (let i = 0; out.length < minBytes; i++) out += `% SMUhub demo file, padding line ${String(i).padStart(4, '0')}: ${'-'.repeat(40)}\n`
  const offsets = objects.map((body, i) => { const at = out.length; out += `${i + 1} 0 obj\n${body}\nendobj\n`; return at })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** A striped RGB PNG in the colour `rgb`, with a text chunk that brings it to at least `minBytes`. */
export function makePng(rgb: [number, number, number], note: string, minBytes = 12 * 1024) {
  const w = 240, h = 160
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    const shade = Math.floor(y / 20) % 2 ? 1 : 0.8
    for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) raw[y * (w * 3 + 1) + 1 + x * 3 + c] = Math.round(rgb[c] * shade)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2 // 8-bit RGB
  const idat = chunk('IDAT', deflateSync(raw))
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const base = 8 + 25 + idat.length + 12 + 12 + 8 // signature, IHDR, IDAT, IEND, tEXt overhead, keyword
  let text = note
  while (base + text.length < minBytes) text += ` ${note}`
  return Buffer.concat([head, chunk('IHDR', ihdr), chunk('tEXt', Buffer.from(`Comment\0${text}`, 'latin1')), idat, chunk('IEND', Buffer.alloc(0))])
}

/** A ZIP archive (stored, no compression) of the given entries. Enough to build .docx/.pptx/.xlsx test files. */
export function makeZip(entries: { name: string; data: Buffer | string }[]) {
  const locals: Buffer[] = [], centrals: Buffer[] = []
  let offset = 0
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'), data = Buffer.from(e.data)
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42)
    locals.push(local, name, data); centrals.push(central, name)
    offset += 30 + name.length + data.length
  }
  const cd = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, end])
}

/** The skeleton of an Office file: `dir` is word/, ppt/ or xl/. Padded past 10 KB. */
export function makeOffice(dir: 'word/' | 'ppt/' | 'xl/', note: string, extra: { name: string; data: string }[] = []) {
  const main = { 'word/': 'document.xml', 'ppt/': 'presentation.xml', 'xl/': 'workbook.xml' }[dir]
  return makeZip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
    { name: `${dir}${main}`, data: `<?xml version="1.0" encoding="UTF-8"?><root><!-- ${note} ${'.'.repeat(12 * 1024)} --></root>` },
    ...extra,
  ])
}
