export type BrandingAssetKind = "logo" | "favicon";

export type BrandingValidationResult = {
  valid: boolean;
  mimeType: string;
  error?: string;
};

export function validateBrandingFile(
  kind: BrandingAssetKind,
  file: { name: string; size: number; type: string; bytes: Uint8Array }
): BrandingValidationResult {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const sizeMb = file.size / (1024 * 1024);

  // Reject SVG explicitly for security & sanitization safety
  if (ext === "svg" || file.type.toLowerCase().includes("svg")) {
    return {
      valid: false,
      mimeType: file.type,
      error: "SVG format is prohibited for security reasons. Please upload PNG, JPEG, WebP, or ICO.",
    };
  }

  // Reject HTML & Script extensions
  const forbiddenExts = ["html", "htm", "php", "js", "exe", "sh", "bat", "cmd", "vbs", "jar"];
  if (forbiddenExts.includes(ext) || file.type.toLowerCase().includes("html")) {
    return {
      valid: false,
      mimeType: file.type,
      error: "Executable or HTML file types are prohibited.",
    };
  }

  const b = file.bytes;

  if (kind === "logo") {
    if (sizeMb > 5) {
      return { valid: false, mimeType: file.type, error: "Logo file size exceeds the 5 MB limit." };
    }
    const allowedExts = ["png", "jpg", "jpeg", "webp"];
    if (!allowedExts.includes(ext)) {
      return { valid: false, mimeType: file.type, error: "Logo must be PNG, JPEG, or WebP format." };
    }

    const isPng = b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    const isJpeg = b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const isWebp =
      b.length >= 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50;

    if (!isPng && !isJpeg && !isWebp) {
      return {
        valid: false,
        mimeType: file.type,
        error: "File contents do not match valid PNG, JPEG, or WebP magic bytes.",
      };
    }

    const mime = isPng ? "image/png" : isJpeg ? "image/jpeg" : "image/webp";
    return { valid: true, mimeType: mime };
  }

  if (kind === "favicon") {
    if (sizeMb > 2) {
      return { valid: false, mimeType: file.type, error: "Favicon file size exceeds the 2 MB limit." };
    }
    const allowedExts = ["png", "ico"];
    if (!allowedExts.includes(ext)) {
      return { valid: false, mimeType: file.type, error: "Favicon must be PNG or ICO format." };
    }

    const isPng = b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    const isIco = b.length >= 4 && b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00;

    if (!isPng && !isIco) {
      return {
        valid: false,
        mimeType: file.type,
        error: "File contents do not match valid PNG or ICO magic bytes.",
      };
    }

    const mime = isPng ? "image/png" : "image/x-icon";
    return { valid: true, mimeType: mime };
  }

  return { valid: false, mimeType: file.type, error: "Invalid asset category." };
}
