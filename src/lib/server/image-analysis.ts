import "server-only";

import sharp from "sharp";

const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);

export function fileExtension(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

export async function imageDataUrlForVision(file: File) {
  const input = Buffer.from(await file.arrayBuffer());
  const extension = fileExtension(file.name);
  const declaredMime = file.type.toLowerCase();
  const convertedFromHeic = HEIC_EXTENSIONS.has(extension) || ["image/heic", "image/heif"].includes(declaredMime);

  try {
    // Normalizing every mobile image applies EXIF orientation and bounds the
    // multipart-to-OpenAI payload when several high-resolution photos are sent.
    const output = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer();
    return { dataUrl: `data:image/jpeg;base64,${output.toString("base64")}`, mimeType: "image/jpeg", convertedFromHeic };
  } catch (error) {
    const type = convertedFromHeic ? "La photo HEIC" : "L’image";
    throw new Error(`${type} « ${file.name} » n’a pas pu être préparée sur le serveur : ${error instanceof Error ? error.message : "format illisible"}`);
  }
}
