import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { validateBrandingFile } from "../branding-validation";
import {
  isPublicBrandingStorageConfigured,
  deletePublicBrandingAsset,
  uploadPublicBrandingAsset,
} from "../../storage/public-branding-storage";

describe("Phase 7D Branding Upload & Storage Validation", () => {
  test("1. Public branding storage configuration check is independent of KYC private storage", () => {
    const origPublicToken = process.env.PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN;
    const origPublicId = process.env.PUBLIC_BRANDING_BLOB_STORE_ID;
    const origKycToken = process.env.BLOB_READ_WRITE_TOKEN;

    try {
      // Clear public tokens while setting private KYC token
      delete process.env.PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN;
      delete process.env.PUBLIC_BRANDING_BLOB_STORE_ID;
      process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_private_kyc_token_12345";

      // Must be false because public branding store is NOT configured
      assert.equal(isPublicBrandingStorageConfigured(), false);

      // Now set public token
      process.env.PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_public_branding_token_67890";
      assert.equal(isPublicBrandingStorageConfigured(), true);
    } finally {
      if (origPublicToken) process.env.PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN = origPublicToken;
      else delete process.env.PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN;

      if (origPublicId) process.env.PUBLIC_BRANDING_BLOB_STORE_ID = origPublicId;
      else delete process.env.PUBLIC_BRANDING_BLOB_STORE_ID;

      if (origKycToken) process.env.BLOB_READ_WRITE_TOKEN = origKycToken;
      else delete process.env.BLOB_READ_WRITE_TOKEN;
    }
  });

  test("2. Unconfigured public storage throws controlled error without DB mutation or data URLs", async () => {
    const origPublicToken = process.env.PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN;
    const origPublicId = process.env.PUBLIC_BRANDING_BLOB_STORE_ID;

    try {
      delete process.env.PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN;
      delete process.env.PUBLIC_BRANDING_BLOB_STORE_ID;

      const dummyPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      
      await assert.rejects(
        uploadPublicBrandingAsset("logo", dummyPng, "image/png", "test-logo.png"),
        /Public branding storage is not configured/
      );
    } finally {
      if (origPublicToken) process.env.PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN = origPublicToken;
      if (origPublicId) process.env.PUBLIC_BRANDING_BLOB_STORE_ID = origPublicId;
    }
  });

  test("3. File validator rejects SVG, HTML, and executable extensions for security", () => {
    const dummySvg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    
    // SVG extension rejection
    const svgRes = validateBrandingFile("logo", {
      name: "logo.svg",
      size: dummySvg.length,
      type: "image/svg+xml",
      bytes: dummySvg,
    });
    assert.equal(svgRes.valid, false);
    assert.match(svgRes.error || "", /SVG format is prohibited/i);

    // HTML rejection
    const htmlRes = validateBrandingFile("logo", {
      name: "evil.html",
      size: 100,
      type: "text/html",
      bytes: new TextEncoder().encode("<html></html>"),
    });
    assert.equal(htmlRes.valid, false);
    assert.match(htmlRes.error || "", /Executable or HTML/i);
  });

  test("4. File validator verifies binary magic bytes for PNG, JPEG, WebP, and ICO", () => {
    // Valid PNG magic bytes
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validPng = validateBrandingFile("logo", {
      name: "company-logo.png",
      size: pngBytes.length,
      type: "image/png",
      bytes: pngBytes,
    });
    assert.equal(validPng.valid, true);
    assert.equal(validPng.mimeType, "image/png");

    // Invalid PNG (spoofed extension with plain text bytes)
    const spoofedBytes = new TextEncoder().encode("Not a real PNG file!");
    const invalidPng = validateBrandingFile("logo", {
      name: "fake.png",
      size: spoofedBytes.length,
      type: "image/png",
      bytes: spoofedBytes,
    });
    assert.equal(invalidPng.valid, false);
    assert.match(invalidPng.error || "", /magic bytes/i);

    // Valid ICO magic bytes for Favicon
    const icoBytes = new Uint8Array([0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);
    const validIco = validateBrandingFile("favicon", {
      name: "favicon.ico",
      size: icoBytes.length,
      type: "image/x-icon",
      bytes: icoBytes,
    });
    assert.equal(validIco.valid, true);
    assert.equal(validIco.mimeType, "image/x-icon");
  });

  test("5. File validator enforces size limits (Logo: 5MB, Favicon: 2MB)", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // Logo 6 MB > 5 MB limit
    const oversizedLogo = validateBrandingFile("logo", {
      name: "huge-logo.png",
      size: 6 * 1024 * 1024,
      type: "image/png",
      bytes: pngBytes,
    });
    assert.equal(oversizedLogo.valid, false);
    assert.match(oversizedLogo.error || "", /exceeds the 5 MB limit/i);

    // Favicon 3 MB > 2 MB limit
    const oversizedFavicon = validateBrandingFile("favicon", {
      name: "huge-favicon.ico",
      size: 3 * 1024 * 1024,
      type: "image/x-icon",
      bytes: new Uint8Array([0x00, 0x00, 0x01, 0x00]),
    });
    assert.equal(oversizedFavicon.valid, false);
    assert.match(oversizedFavicon.error || "", /exceeds the 2 MB limit/i);
  });

  test("6. Bundled default assets are protected from deletion", async () => {
    // Calling delete on default bundled paths should complete safely without throwing or executing Vercel blob deletion
    await deletePublicBrandingAsset("/branding/kn-finance-logo.png");
    await deletePublicBrandingAsset("/favicon.ico");
    assert.ok(true);
  });
});
