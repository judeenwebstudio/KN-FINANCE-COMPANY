import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import {
  getMemberDocuments,
  uploadMemberDocument,
  deleteMemberDocument,
  isStorageConfigured,
} from "../document-service";

describe("Member Document & KYC Service Tests", () => {
  let adminUserId: string;
  let memberUserId: string;
  let memberId: string;
  let branchId: string;

  before(async () => {
    let branch = await prisma.branch.findFirst({ where: { code: "HQ-01" } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          name: "HQ Head Office",
          code: "HQ-01",
          email: "hq@test.com",
          phone: "123",
          address: "HQ",
          city: "Metro",
          state: "NY",
          country: "USA",
          currency: "USD",
        },
      });
    }
    branchId = branch.id;

    let superAdminRole = await prisma.roleProfile.findFirst({ where: { isSuperAdminRole: true } });
    if (!superAdminRole) {
      superAdminRole = await prisma.roleProfile.create({
        data: {
          name: "Super Admin Doc Role",
          slug: `sa_doc_${Date.now()}`,
          isSuperAdminRole: true,
          status: "ACTIVE",
        },
      });
    }

    let admin = await prisma.user.findFirst({ where: { email: "docadmin@test.com" } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: "Doc Admin",
          email: "docadmin@test.com",
          passwordHash: "hash",
          status: "ACTIVE",
          hasGlobalBranchAccess: true,
        },
      });
    }
    adminUserId = admin.id;

    const existingAssignment = await prisma.userRoleAssignment.findFirst({
      where: { userId: adminUserId, roleId: superAdminRole.id },
    });
    if (!existingAssignment) {
      await prisma.userRoleAssignment.create({
        data: { userId: adminUserId, roleId: superAdminRole.id },
      });
    }

    let memberUser = await prisma.user.findFirst({ where: { email: "docmember@test.com" } });
    if (!memberUser) {
      memberUser = await prisma.user.create({
        data: {
          name: "Doc Member",
          email: "docmember@test.com",
          passwordHash: "hash",
          status: "ACTIVE",
        },
      });
    }
    memberUserId = memberUser.id;

    let profile = await prisma.memberProfile.findUnique({ where: { userId: memberUserId } });
    if (!profile) {
      profile = await prisma.memberProfile.create({
        data: {
          userId: memberUserId,
          branchId,
          memberNumber: "MEM-DOC-001",
          phone: "+15551234",
          address: "Document St",
        },
      });
    }
    memberId = profile.id;
  });

  test("isStorageConfigured should return boolean based on env", () => {
    const configured = isStorageConfigured();
    assert.equal(typeof configured, "boolean");
  });

  test("uploadMemberDocument rejects invalid MIME type", async () => {
    await assert.rejects(
      async () => {
        await uploadMemberDocument({
          memberId,
          category: "IDENTITY",
          fileName: "malicious.exe",
          mimeType: "application/x-msdownload",
          sizeBytes: 1024,
          uploadedById: adminUserId,
          bypassStorageCheckForTest: true,
        });
      },
      (err: Error) => {
        assert.match(err.message, /Unsupported document file type/);
        return true;
      }
    );
  });

  test("uploadMemberDocument rejects file exceeding size limit", async () => {
    await assert.rejects(
      async () => {
        await uploadMemberDocument({
          memberId,
          category: "IDENTITY",
          fileName: "large.pdf",
          mimeType: "application/pdf",
          sizeBytes: 10 * 1024 * 1024, // 10MB
          uploadedById: adminUserId,
          bypassStorageCheckForTest: true,
        });
      },
      (err: Error) => {
        assert.match(err.message, /File size exceeds maximum allowed limit/);
        return true;
      }
    );
  });

  test("uploadMemberDocument creates document record safely", async () => {
    const doc = await uploadMemberDocument({
      memberId,
      category: "IDENTITY",
      fileName: "passport_scan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 500 * 1024,
      uploadedById: adminUserId,
      bypassStorageCheckForTest: true,
    });

    assert.ok(doc.id);
    assert.equal(doc.category, "IDENTITY");
    assert.equal(doc.fileName, "passport_scan.pdf");
    assert.equal(doc.mimeType, "application/pdf");

    const docs = await getMemberDocuments(memberId, adminUserId);
    assert.ok(docs.length >= 1);
    assert.equal(docs.find((d) => d.id === doc.id)?.fileName, "passport_scan.pdf");
  });

  test("deleteMemberDocument removes record", async () => {
    const doc = await uploadMemberDocument({
      memberId,
      category: "ADDRESS_PROOF",
      fileName: "utility_bill.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 200 * 1024,
      uploadedById: adminUserId,
      bypassStorageCheckForTest: true,
    });

    const result = await deleteMemberDocument(doc.id, adminUserId);
    assert.equal(result.success, true);

    const docs = await getMemberDocuments(memberId, adminUserId);
    assert.equal(docs.find((d) => d.id === doc.id), undefined);
  });
});
