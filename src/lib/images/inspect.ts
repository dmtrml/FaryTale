export type ImageInspection = {
  mimeType: string;
  width: number;
  height: number;
};

const MAX_DIMENSION = 8192;

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function u16be(bytes: Uint8Array, offset: number) {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function u16le(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function u24le(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function u32be(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]! * 0x1000000 +
    (bytes[offset + 1]! << 16) +
    (bytes[offset + 2]! << 8) +
    bytes[offset + 3]!
  );
}

function inspectPng(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  if (ascii(bytes, 12, 4) !== "IHDR") return null;
  return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
}

function inspectGif(bytes: Uint8Array) {
  if (bytes.length < 10 || !["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) return null;
  return { width: u16le(bytes, 6), height: u16le(bytes, 8) };
}

function inspectJpeg(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++]!;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 1 >= bytes.length) break;
    const length = u16be(bytes, offset);
    if (length < 2 || offset + length > bytes.length) break;
    if (sof.has(marker) && length >= 7) {
      return { height: u16be(bytes, offset + 3), width: u16be(bytes, offset + 5) };
    }
    offset += length;
  }
  return null;
}

function inspectWebp(bytes: Uint8Array) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    return { width: 1 + u24le(bytes, 24), height: 1 + u24le(bytes, 27) };
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const b21 = bytes[21]!;
    const b22 = bytes[22]!;
    const b23 = bytes[23]!;
    const b24 = bytes[24]!;
    return {
      width: 1 + (b21 | ((b22 & 0x3f) << 8)),
      height: 1 + ((b22 >> 6) | (b23 << 2) | ((b24 & 0x0f) << 10)),
    };
  }
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
  }
  return null;
}

function inspectAvif(bytes: Uint8Array) {
  if (bytes.length < 32 || ascii(bytes, 4, 4) !== "ftyp") return null;
  const brand = ascii(bytes, 8, 4);
  if (brand !== "avif" && brand !== "avis") return null;
  for (let index = 4; index + 16 <= bytes.length; index += 1) {
    if (ascii(bytes, index, 4) === "ispe") {
      return { width: u32be(bytes, index + 8), height: u32be(bytes, index + 12) };
    }
  }
  return null;
}

export function inspectImage(bytes: Uint8Array, mimeType: string): ImageInspection {
  const dimensions =
    mimeType === "image/png"
      ? inspectPng(bytes)
      : mimeType === "image/jpeg"
        ? inspectJpeg(bytes)
        : mimeType === "image/gif"
          ? inspectGif(bytes)
          : mimeType === "image/webp"
            ? inspectWebp(bytes)
            : mimeType === "image/avif"
              ? inspectAvif(bytes)
              : null;
  if (!dimensions) throw new Error("Image content does not match its declared type or has no readable dimensions.");
  if (
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > MAX_DIMENSION ||
    dimensions.height > MAX_DIMENSION
  ) {
    throw new Error(`Image dimensions must be between 1 and ${MAX_DIMENSION}px.`);
  }
  return { mimeType, ...dimensions };
}
