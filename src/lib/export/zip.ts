import { inflateRawSync } from "node:zlib";

export type ZipEntry = {
  path: string;
  bytes: Uint8Array;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function safeZipPath(value: string) {
  return (
    value.length > 0 &&
    value.length <= 500 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value.split("/").every((part) => part !== "" && part !== "." && part !== "..")
  );
}

export function createStoredZip(entries: ZipEntry[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    if (!safeZipPath(entry.path)) throw new Error(`Unsafe ZIP entry path: ${entry.path}`);
    const name = textEncoder.encode(entry.path);
    const checksum = crc32(entry.bytes);
    const localHeader = new Uint8Array(30 + name.length);
    const localView = new DataView(localHeader.buffer);
    u32(localView, 0, 0x04034b50);
    u16(localView, 4, 20);
    u16(localView, 6, 0x0800);
    u16(localView, 8, 0);
    u32(localView, 14, checksum);
    u32(localView, 18, entry.bytes.byteLength);
    u32(localView, 22, entry.bytes.byteLength);
    u16(localView, 26, name.length);
    localHeader.set(name, 30);
    localParts.push(localHeader, entry.bytes);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    u32(centralView, 0, 0x02014b50);
    u16(centralView, 4, 20);
    u16(centralView, 6, 20);
    u16(centralView, 8, 0x0800);
    u16(centralView, 10, 0);
    u32(centralView, 16, checksum);
    u32(centralView, 20, entry.bytes.byteLength);
    u32(centralView, 24, entry.bytes.byteLength);
    u16(centralView, 28, name.length);
    u32(centralView, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);

    localOffset += localHeader.byteLength + entry.bytes.byteLength;
  }

  const centralDirectory = concat(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 8, entries.length);
  u16(endView, 10, entries.length);
  u32(endView, 12, centralDirectory.byteLength);
  u32(endView, 16, localOffset);
  return concat([...localParts, centralDirectory, end]);
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const minimum = Math.max(0, bytes.length - 65557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  throw new Error("Invalid ZIP: end-of-central-directory record not found.");
}

export function readZip(bytes: Uint8Array, limits = { maxEntries: 500, maxTotalBytes: 100 * 1024 * 1024 }) {
  if (bytes.byteLength < 22) throw new Error("Invalid ZIP: file is too small.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findEndOfCentralDirectory(bytes);
  const entryCount = view.getUint16(endOffset + 10, true);
  const centralOffset = view.getUint32(endOffset + 16, true);
  if (entryCount > limits.maxEntries) throw new Error("ZIP contains too many entries.");

  const entries = new Map<string, Uint8Array>();
  let offset = centralOffset;
  let totalBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory.");
    }
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const checksum = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
    if (!safeZipPath(name) || name.endsWith("/")) throw new Error(`Unsafe ZIP entry path: ${name}`);
    if (entries.has(name)) throw new Error(`Duplicate ZIP entry: ${name}`);
    if (flags & 0x1) throw new Error("Encrypted ZIP entries are not supported.");
    if (method !== 0 && method !== 8) throw new Error(`Unsupported ZIP compression method: ${method}`);
    if (localHeaderOffset + 30 > bytes.length || view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error("Invalid ZIP local header.");
    }
    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error("Invalid ZIP entry bounds.");
    const compressed = bytes.slice(dataStart, dataEnd);
    const content = method === 0 ? compressed : new Uint8Array(inflateRawSync(compressed));
    if (content.byteLength !== uncompressedSize) throw new Error(`ZIP size mismatch for ${name}`);
    if (crc32(content) !== checksum) throw new Error(`ZIP checksum mismatch for ${name}`);
    totalBytes += content.byteLength;
    if (totalBytes > limits.maxTotalBytes) throw new Error("ZIP expands beyond the allowed size.");
    entries.set(name, content);
  }
  return entries;
}
