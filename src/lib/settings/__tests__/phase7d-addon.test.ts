import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { updateCompanyProfileSchema, DEFAULT_COMPANY_PROFILE } from "../company-profile";
import { isRecaptchaConfigured, getRecaptchaSiteKey, verifyRecaptchaToken } from "../../security/recaptcha";
import { getScheduledJobsStatus } from "../scheduled-jobs";
import { getSafeSecurityStatus } from "../system-status";

describe("Phase 7D Add-On — Favicon, Login-Only reCAPTCHA, and Scheduled Jobs", () => {
  test("1. Favicon schema validation accepts relative paths and https URLs, but rejects SVG & unsafe schemes", () => {
    // Valid PNG/ICO asset URLs
    assert.equal(updateCompanyProfileSchema.safeParse({ displayName: "KN Finance", faviconUrl: "/favicon.ico" }).success, true);
    assert.equal(updateCompanyProfileSchema.safeParse({ displayName: "KN Finance", faviconUrl: "/branding/kn-favicon.png" }).success, true);
    assert.equal(updateCompanyProfileSchema.safeParse({ displayName: "KN Finance", faviconUrl: "https://example.com/assets/favicon.ico" }).success, true);

    // Unsafe schemes (javascript:, data:, http:) must be rejected
    assert.equal(updateCompanyProfileSchema.safeParse({ displayName: "KN Finance", faviconUrl: "javascript:alert(1)" }).success, false);
    assert.equal(updateCompanyProfileSchema.safeParse({ displayName: "KN Finance", faviconUrl: "data:image/png;base64,abc" }).success, false);
    assert.equal(updateCompanyProfileSchema.safeParse({ displayName: "KN Finance", faviconUrl: "http://insecure.com/favicon.ico" }).success, false);

    // SVG must be rejected for sanitization safety
    assert.equal(updateCompanyProfileSchema.safeParse({ displayName: "KN Finance", faviconUrl: "/branding/logo.svg" }).success, false);
    assert.equal(updateCompanyProfileSchema.safeParse({ displayName: "KN Finance", faviconUrl: "https://example.com/icon.svg" }).success, false);
  });

  test("2. Default Company Profile specifies en-IN locale", () => {
    assert.equal(DEFAULT_COMPANY_PROFILE.locale, "en-IN");
  });

  test("3. reCAPTCHA helper truthfully reports status and concealed secrets", async () => {
    const configured = isRecaptchaConfigured();
    const siteKey = getRecaptchaSiteKey();
    const status = getSafeSecurityStatus();

    assert.equal(status.recaptcha.provider, "Google reCAPTCHA");
    assert.equal(status.recaptcha.protectionScope, "Login Form Only");
    assert.equal(status.recaptcha.configured, configured);

    // Verify RECAPTCHA_SECRET_KEY is never serialized or exposed
    const serialized = JSON.stringify(status);
    assert.equal(/RECAPTCHA_SECRET_KEY/i.test(serialized), false);

    // When unconfigured, token verification fails open gracefully for login
    if (!configured) {
      const res = await verifyRecaptchaToken(null);
      assert.equal(res.success, true);
      assert.equal(res.configured, false);
    }
  });

  test("4. Scheduled Jobs truthfully reports Not Configured with zero active crons or financial mutators", () => {
    const jobs = getScheduledJobsStatus();
    assert.equal(jobs.configured, false);
    assert.match(jobs.message, /No production scheduler configured/i);
    assert.equal(jobs.jobs.length, 3);

    for (const j of jobs.jobs) {
      assert.equal(j.status, "NOT_CONFIGURED");
      assert.notEqual(j.triggerType, "CRON");
    }
  });

  test("5. System and security status read routines perform no database mutations", async () => {
    const jobsSource = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../scheduled-jobs.ts", import.meta.url), "utf8")
    );
    const recaptchaSource = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../../security/recaptcha.ts", import.meta.url), "utf8")
    );

    assert.doesNotMatch(jobsSource, /prisma\.|CREATE TABLE|ALTER TABLE|upsert\(|insert\(|delete\(/i);
    assert.doesNotMatch(recaptchaSource, /prisma\.|CREATE TABLE|ALTER TABLE|upsert\(|insert\(|delete\(/i);
  });
});
