import { deflateSync, inflateRawSync, inflateSync } from "node:zlib";

export type DocumentSigner = {
  role: "supervisor" | "dosen";
  name: string;
  signedAt: string;
};

type ZipEntry = { name: string; data: Buffer };

const PDF_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const fromBase64 = (value: string) => {
  const clean = value.replace(/^data:[^;]+;base64,/i, "").replace(/\s/g, "");
  return Buffer.from(clean, "base64");
};

const xmlEscape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function decodePng(value: string) {
  const png = fromBase64(value);
  if (!png.subarray(0, 8).equals(PDF_SIGNATURE)) throw new Error("Format gambar tanda tangan tidak valid.");
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (!width || !height || bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error("Gambar tanda tangan harus berupa PNG RGBA 8-bit.");
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = Buffer.alloc(height * stride);
  let sourceOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[sourceOffset++];
    const rowOffset = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const rawValue = raw[sourceOffset++];
      const left = column >= 4 ? rgba[rowOffset + column - 4] : 0;
      const above = row > 0 ? rgba[rowOffset - stride + column] : 0;
      const aboveLeft = row > 0 && column >= 4 ? rgba[rowOffset - stride + column - 4] : 0;
      const value = filter === 0 ? rawValue : filter === 1 ? rawValue + left : filter === 2 ? rawValue + above : filter === 3 ? rawValue + Math.floor((left + above) / 2) : rawValue + paeth(left, above, aboveLeft);
      rgba[rowOffset + column] = value & 0xff;
    }
  }
  const rgb = Buffer.alloc(width * height * 3);
  const alpha = Buffer.alloc(width * height);
  let rgbOffset = 0;
  let alphaOffset = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    rgb[rgbOffset++] = rgba[i];
    rgb[rgbOffset++] = rgba[i + 1];
    rgb[rgbOffset++] = rgba[i + 2];
    alpha[alphaOffset++] = rgba[i + 3];
  }
  return { width, height, rgb, alpha };
}

function findDictionaryEnd(value: string, start: number) {
  let depth = 0;
  for (let index = start; index < value.length - 1; index += 1) {
    const pair = value.slice(index, index + 2);
    if (pair === "<<") {
      depth += 1;
      index += 1;
    } else if (pair === ">>") {
      depth -= 1;
      index += 1;
      if (depth === 0) return index + 1;
    }
  }
  return value.length;
}

function addImageToResources(resources: string, imageName: string, imageId: number) {
  const xobjectMatch = /\/XObject\s*<</.exec(resources);
  if (xobjectMatch) {
    const dictStart = resources.indexOf("<<", xobjectMatch.index);
    const dictEnd = findDictionaryEnd(resources, dictStart);
    const dictionary = resources.slice(dictStart, dictEnd);
    const insertAt = dictionary.lastIndexOf(">>");
    const updated = `${dictionary.slice(0, insertAt)} /${imageName} ${imageId} 0 R ${dictionary.slice(insertAt)}`;
    return resources.slice(0, dictStart) + updated + resources.slice(dictEnd);
  }
  const insertAt = resources.lastIndexOf(">>");
  return `${resources.slice(0, insertAt)} /XObject << /${imageName} ${imageId} 0 R >> ${resources.slice(insertAt)}`;
}

function updatePageResources(pageBody: string, imageName: string, imageId: number, objectMap: Map<number, string>, updates: Array<{ id: number; body: string }>) {
  const resourceReference = /\/Resources\s+(\d+)\s+(\d+)\s+R/.exec(pageBody);
  if (resourceReference) {
    const resourceId = Number(resourceReference[1]);
    const existing = objectMap.get(resourceId);
    if (existing) updates.push({ id: resourceId, body: addImageToResources(existing, imageName, imageId) });
    return pageBody;
  }
  const resourceStart = /\/Resources\s*<</.exec(pageBody);
  if (resourceStart) {
    const dictStart = pageBody.indexOf("<<", resourceStart.index);
    const dictEnd = findDictionaryEnd(pageBody, dictStart);
    return pageBody.slice(0, dictStart) + addImageToResources(pageBody.slice(dictStart, dictEnd), imageName, imageId) + pageBody.slice(dictEnd);
  }
  const insertAt = pageBody.lastIndexOf(">>");
  return `${pageBody.slice(0, insertAt)} /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> ${pageBody.slice(insertAt)}`;
}

function updatePageContents(pageBody: string, contentId: number) {
  const arrayMatch = /\/Contents\s*\[([\s\S]*?)\]/.exec(pageBody);
  if (arrayMatch) return pageBody.replace(arrayMatch[0], `/Contents [${arrayMatch[1]} ${contentId} 0 R]`);
  const referenceMatch = /\/Contents\s+(\d+\s+\d+\s+R)/.exec(pageBody);
  if (referenceMatch) return pageBody.replace(referenceMatch[0], `/Contents [${referenceMatch[1]} ${contentId} 0 R]`);
  const insertAt = pageBody.lastIndexOf(">>");
  return `${pageBody.slice(0, insertAt)} /Contents ${contentId} 0 R ${pageBody.slice(insertAt)}`;
}

function pdfObject(id: number, body: string) {
  return Buffer.from(`${id} 0 obj\n${body}\nendobj\n`, "latin1");
}

function signPdf(value: string, signatureData: string, signatureIndex: number) {
  const original = fromBase64(value);
  const text = original.toString("latin1");
  const objects = new Map<number, { body: string; end: number }>();
  const objectMap = new Map<number, string>();
  const objectRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
  let match: RegExpExecArray | null;
  let maxId = 0;
  let lastPage: { id: number; body: string } | null = null;
  while ((match = objectRegex.exec(text))) {
    const id = Number(match[1]);
    const body = match[3];
    objects.set(id, { body, end: match.index + match[0].length });
    objectMap.set(id, body);
    maxId = Math.max(maxId, id);
    if (/\/Type\s*\/Page\b/.test(body)) lastPage = { id, body };
  }
  if (!lastPage) throw new Error("Halaman PDF tidak dapat dibaca.");
  const image = decodePng(signatureData);
  const imageId = maxId + 1;
  const alphaId = imageId + 1;
  const contentId = imageId + 2;
  const imageName = `SigImg${signatureIndex + 1}`;
  const alphaData = deflateSync(image.alpha);
  const rgbData = deflateSync(image.rgb);
  const hasTransparency = image.alpha.some((item) => item !== 255);
  const alphaObject = `${alphaId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaData.length} >>\nstream\n${alphaData.toString("latin1")}\nendstream\nendobj\n`;
  const imageObject = `${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode${hasTransparency ? ` /SMask ${alphaId} 0 R` : ""} /Length ${rgbData.length} >>\nstream\n${rgbData.toString("latin1")}\nendstream\nendobj\n`;
  const mediaBox = /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(lastPage.body);
  const pageWidth = mediaBox ? Number(mediaBox[3]) - Number(mediaBox[1]) : 595;
  const pageHeight = mediaBox ? Number(mediaBox[4]) - Number(mediaBox[2]) : 842;
  const scale = Math.min(175 / image.width, 70 / image.height, 1);
  const imageWidth = Math.max(1, image.width * scale);
  const imageHeight = Math.max(1, image.height * scale);
  const x = Math.max(24, pageWidth - imageWidth - 42);
  const y = Math.min(Math.max(30, 30 + signatureIndex * 95), Math.max(30, pageHeight - imageHeight - 30));
  const content = `q\n${imageWidth.toFixed(2)} 0 0 ${imageHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/${imageName} Do\nQ`;
  const contentBytes = Buffer.from(content, "latin1");
  const contentObject = `${contentId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${content}\nendstream\nendobj\n`;
  const updates: Array<{ id: number; body: string }> = [];
  const pageWithResources = updatePageResources(lastPage.body, imageName, imageId, objectMap, updates);
  const pageWithContents = updatePageContents(pageWithResources, contentId);
  updates.push({ id: lastPage.id, body: pageWithContents });
  const rootMatch = /\/Root\s+(\d+\s+\d+\s+R)/.exec(text);
  const startxrefMatch = /startxref\s+(\d+)/.exec(text);
  if (!rootMatch || !startxrefMatch) throw new Error("Struktur PDF tidak mendukung penandatanganan otomatis.");
  const parts: Buffer[] = [original, Buffer.from("\n", "latin1")];
  const offsets = new Map<number, number>();
  const append = (id: number, body: string) => {
    offsets.set(id, parts.reduce((total, part) => total + part.length, 0));
    parts.push(pdfObject(id, body));
  };
  append(imageId, imageObject.slice(imageObject.indexOf("obj\n") + 4, imageObject.lastIndexOf("endobj")));
  if (hasTransparency) append(alphaId, alphaObject.slice(alphaObject.indexOf("obj\n") + 4, alphaObject.lastIndexOf("endobj")));
  append(contentId, contentObject.slice(contentObject.indexOf("obj\n") + 4, contentObject.lastIndexOf("endobj")));
  const uniqueUpdates = new Map<number, string>();
  updates.forEach((item) => uniqueUpdates.set(item.id, item.body));
  uniqueUpdates.forEach((body, id) => append(id, body));
  const xrefOffset = parts.reduce((total, part) => total + part.length, 0);
  const xrefIds = [imageId, ...(hasTransparency ? [alphaId] : []), contentId, ...Array.from(uniqueUpdates.keys())];
  const xref = [`xref`, `${Math.min(...xrefIds)} ${Math.max(...xrefIds) - Math.min(...xrefIds) + 1}`];
  const xrefMap = new Map(xrefIds.map((id) => [id, offsets.get(id) ?? 0]));
  for (let id = Math.min(...xrefIds); id <= Math.max(...xrefIds); id += 1) xref.push(xrefMap.has(id) ? `${String(xrefMap.get(id)).padStart(10, "0")} 00000 n ` : `0000000000 65535 f `);
  xref.push(`trailer\n<< /Size ${Math.max(maxId + 1, Math.max(...xrefIds) + 1)} /Root ${rootMatch[1]} /Prev ${startxrefMatch[1]} >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  parts.push(Buffer.from(`${xref.join("\n")}\n`, "latin1"));
  return Buffer.concat(parts).toString("base64");
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readZip(value: string): ZipEntry[] {
  const input = fromBase64(value);
  const eocd = input.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("File Word tidak memiliki struktur DOCX yang valid.");
  const count = input.readUInt16LE(eocd + 10);
  const centralOffset = input.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (input.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Daftar isi DOCX tidak valid.");
    const method = input.readUInt16LE(cursor + 10);
    const compressedSize = input.readUInt32LE(cursor + 20);
    const nameLength = input.readUInt16LE(cursor + 28);
    const extraLength = input.readUInt16LE(cursor + 30);
    const commentLength = input.readUInt16LE(cursor + 32);
    const name = input.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    const localOffset = input.readUInt32LE(cursor + 42);
    const localNameLength = input.readUInt16LE(localOffset + 26);
    const localExtraLength = input.readUInt16LE(localOffset + 28);
    const compressed = input.subarray(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : (() => { throw new Error("Metode kompresi DOCX tidak didukung."); })();
    entries.push({ name, data });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function writeZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    localParts.push(local, entry.data);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length + entry.data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function signDocx(value: string, signatureData: string, signer: DocumentSigner) {
  const entries = readZip(value);
  const documentEntry = entries.find((entry) => entry.name === "word/document.xml");
  const relationshipsEntry = entries.find((entry) => entry.name === "word/_rels/document.xml.rels");
  const contentTypesEntry = entries.find((entry) => entry.name === "[Content_Types].xml");
  if (!documentEntry || !relationshipsEntry || !contentTypesEntry) throw new Error("DOCX tidak memiliki komponen utama yang lengkap.");
  const documentXml = documentEntry.data.toString("utf8");
  const relationshipsXml = relationshipsEntry.data.toString("utf8");
  const contentTypesXml = contentTypesEntry.data.toString("utf8");
  const ids = Array.from(relationshipsXml.matchAll(/Id="rId(\d+)"/g)).map((item) => Number(item[1]));
  const relationshipId = `rId${Math.max(0, ...ids) + 1}`;
  const mediaName = `word/media/signature-${Date.now()}.png`;
  const namespacePatch = [
    ["xmlns:wp=", 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'],
    ["xmlns:a=", 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'],
    ["xmlns:pic=", 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'],
    ["xmlns:r=", 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'],
  ].filter(([needle]) => !documentXml.includes(needle)).map(([, declaration]) => declaration).join(" ");
  const documentWithNamespaces = namespacePatch ? documentXml.replace("<w:document", `<w:document ${namespacePatch}`) : documentXml;
  const label = signer.role === "supervisor" ? "TTD Supervisor Kantor" : "TTD Dosen Pembimbing";
  const drawing = `<w:p><w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${xmlEscape(label)}</w:t></w:r></w:p><w:p><w:r><w:t>${xmlEscape(signer.name)} · ${xmlEscape(signer.signedAt.slice(0, 10))}</w:t></w:r></w:p><w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="3500000" cy="1200000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${Date.now() % 100000}" name="Tanda tangan elektronik"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="signature.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3500000" cy="1200000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  if (!documentWithNamespaces.includes("</w:body>")) throw new Error("Isi DOCX tidak memiliki body yang valid.");
  documentEntry.data = Buffer.from(documentWithNamespaces.replace("</w:body>", `${drawing}</w:body>`), "utf8");
  relationshipsEntry.data = Buffer.from(relationshipsXml.replace("</Relationships>", `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName.split("/").pop()}"/></Relationships>`), "utf8");
  if (!/Extension="png"/i.test(contentTypesXml)) contentTypesEntry.data = Buffer.from(contentTypesXml.replace("</Types>", `<Default Extension="png" ContentType="image/png"/></Types>`), "utf8");
  entries.push({ name: mediaName, data: fromBase64(signatureData) });
  return writeZip(entries).toString("base64");
}

export function signDocument({ fileName, mimeType, data, signatureData, signer, signatureIndex }: { fileName: string; mimeType: string; data: string; signatureData: string; signer: DocumentSigner; signatureIndex: number }) {
  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) return signPdf(data, signatureData, signatureIndex);
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileName.toLowerCase().endsWith(".docx")) return signDocx(data, signatureData, signer);
  throw new Error("Format dokumen belum didukung. Gunakan PDF atau Word .docx.");
}
