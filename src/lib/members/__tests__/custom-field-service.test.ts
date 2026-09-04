import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../prisma";
import {
  getCustomFieldDefinitions,
  createCustomFieldDefinition,
  updateCustomFieldDefinition,
  validateCustomFieldValues,
  setMemberCustomFieldValues,
  getMemberCustomFieldValues,
} from "../custom-field-service";

describe("Member Custom Fields Service Tests", () => {
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
          name: "Super Admin CF Role",
          slug: `sa_cf_${Date.now()}`,
          isSuperAdminRole: true,
          status: "ACTIVE",
        },
      });
    }

    let admin = await prisma.user.findFirst({ where: { email: "cfadmin@test.com" } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: "CF Admin",
          email: "cfadmin@test.com",
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

    let memberUser = await prisma.user.findFirst({ where: { email: "cfmember@test.com" } });
    if (!memberUser) {
      memberUser = await prisma.user.create({
        data: {
          name: "CF Member",
          email: "cfmember@test.com",
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
          memberNumber: "MEM-CF-001",
          phone: "+15559876",
          address: "Custom St",
        },
      });
    }
    memberId = profile.id;
  });

  test("createCustomFieldDefinition creates text field and SELECT field", async () => {
    let textDef = (await getCustomFieldDefinitions(true, adminUserId)).find((d) => d.key === "tax_id");
    if (!textDef) {
      textDef = await createCustomFieldDefinition(
        {
          key: "tax_id",
          label: "Tax Identification Number",
          type: "TEXT",
          required: true,
          displayOrder: 1,
        },
        adminUserId
      );
    } else {
      textDef = await updateCustomFieldDefinition(textDef.id, { required: true, active: true }, adminUserId);
    }
    assert.ok(textDef.id);
    assert.equal(textDef.key, "tax_id");

    let selectDef = (await getCustomFieldDefinitions(true, adminUserId)).find((d) => d.key === "employment_status");
    if (!selectDef) {
      selectDef = await createCustomFieldDefinition(
        {
          key: "employment_status",
          label: "Employment Status",
          type: "SELECT",
          options: ["Salaried", "Self-Employed", "Retired"],
          required: false,
          displayOrder: 2,
        },
        adminUserId
      );
    } else {
      selectDef = await updateCustomFieldDefinition(
        selectDef.id,
        { options: ["Salaried", "Self-Employed", "Retired"], active: true },
        adminUserId
      );
    }
    assert.ok(selectDef.id);
    assert.equal(selectDef.options.length, 3);
  });

  test("validateCustomFieldValues rejects missing required field", async () => {
    const activeDefs = await getCustomFieldDefinitions(false, adminUserId);
    const errors = validateCustomFieldValues(activeDefs, {});
    assert.ok(errors.some((e) => e.fieldKey === "tax_id" && e.error.toLowerCase().includes("required")));
  });

  test("validateCustomFieldValues rejects invalid SELECT option", async () => {
    const activeDefs = await getCustomFieldDefinitions(false, adminUserId);
    const errors = validateCustomFieldValues(activeDefs, {
      tax_id: "TX-12345",
      employment_status: "Unemployed_Invalid_Option",
    });
    assert.ok(errors.some((e) => e.fieldKey === "employment_status" && e.error.toLowerCase().includes("invalid option")));
  });

  test("setMemberCustomFieldValues persists values and getMemberCustomFieldValues retrieves them", async () => {
    await setMemberCustomFieldValues(
      memberId,
      {
        tax_id: "TX-99999",
        employment_status: "Salaried",
      },
      adminUserId
    );

    const values = await getMemberCustomFieldValues(memberId, adminUserId);
    assert.equal(values.tax_id, "TX-99999");
    assert.equal(values.employment_status, "Salaried");
  });

  test("updateCustomFieldDefinition deactivates field safely", async () => {
    const activeDefs = await getCustomFieldDefinitions(true, adminUserId);
    const taxDef = activeDefs.find((d) => d.key === "tax_id");
    assert.ok(taxDef);

    const updated = await updateCustomFieldDefinition(
      taxDef.id,
      { active: false },
      adminUserId
    );
    assert.equal(updated.active, false);

    // Reactivate for subsequent clean state
    await updateCustomFieldDefinition(taxDef.id, { active: true }, adminUserId);
  });
});
