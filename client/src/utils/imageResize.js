// Shrinks a photo in the browser before it is uploaded, so a 9 MB phone picture doesn't become a
// 9 MB download every time the page it sits on is opened. Used by uploadApi.uploadImage, so every
// image field in the app gets it.
//
// A picture is scaled to at most MAX_EDGE pixels on its longer side and re-saved — as JPEG, or as
// PNG when it has transparent pixels (logos, a signature), so the see-through background
// survives. What is left alone:
//   - animated formats (GIF): redrawing one would freeze it on its first frame
//   - anything that is already small in both pixels and bytes
//   - anything the browser can't decode — the server then decides whether to accept it
// And if the result somehow isn't smaller than the original, the original is sent.

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;
// Already light enough to send as it is, provided it's within MAX_EDGE.
const SMALL_ENOUGH_BYTES = 600 * 1024;
const RESIZABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Decodes the file the way it should be seen — a phone photo's rotation (EXIF) applied.
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to the <img> route below
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("This image could not be read"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hasTransparency(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * The file to actually upload: a resized copy when that helps, otherwise the file it was given.
 * Never throws — a picture it can't process is returned untouched.
 */
export async function prepareImageForUpload(file) {
  if (!file || !RESIZABLE_TYPES.includes(file.type)) return file;
  try {
    const source = await decode(file);
    const width = source.width || source.naturalWidth;
    const height = source.height || source.naturalHeight;
    if (!width || !height) return file;

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    if (scale === 1 && file.size <= SMALL_ENOUGH_BYTES) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if (typeof source.close === "function") source.close();

    // A JPEG can't be transparent; a PNG or WEBP might be — keep it see-through if it is.
    const keepAlpha = file.type !== "image/jpeg" && hasTransparency(ctx, canvas.width, canvas.height);
    const type = keepAlpha ? "image/png" : "image/jpeg";
    const blob = await toBlob(canvas, type, keepAlpha ? undefined : JPEG_QUALITY);
    if (!blob || blob.size >= file.size) return file;

    const name = `${file.name.replace(/\.[^.]+$/, "") || "image"}.${keepAlpha ? "png" : "jpg"}`;
    return new File([blob], name, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
