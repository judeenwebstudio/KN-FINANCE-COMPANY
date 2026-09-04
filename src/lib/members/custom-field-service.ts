import { prisma } from "../prisma";
import { hasPermission, getUserAuthorizedBranchScope } from "../auth/authorize";
import { logAuditEvent } from "../audit/audit-logger";
import { CustomFieldType } from "@/generated/prisma/client";

export type CustomFieldDefinitionDTO = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  optionsJson: string | null;
  options: string[];
  required: boolean;
  active: boolean;
  displayOrder: number;
  createdAt: string;
  hasExistingValues?: boolean;
};

export type CustomFieldValueInput = {
  fieldDefinitionId: string;
  value: string;
};

export type MemberCustomFieldValueDTO = {
  id: string;
  memberId: string;
  fieldDefinitionId: string;
  key: string;
  label: string;
  type: CustomFieldType;
  value: string;
};

export async function getCustomFieldDefinitions(
  includeInactive = false,
  executorUserId?: string,
): Promise<CustomFieldDefinitionDTO[]> {
  if (executorUserId) {
    const perm = await hasPermission(executorUserId, "members.view");
    if (!perm) {
      throw new Error("Unauthorized: Missing members.view permission.");
    }
  }

  const where = includeInactive ? {} : { active: true };
  const defs = await prisma.memberCustomFieldDefinition.findMany({
    where,
    orderBy: { displayOrder: "asc" },
    include: {
      _count: { select: { values: true } },
    },
  });

  return defs.map((d) => {
    let options: string[] = [];
    if (d.optionsJson) {
      try {
        options = JSON.parse(d.optionsJson);
      } catch {
        options = [];
      }
    }
    return {
      id: d.id,
      key: d.key,
      label: d.label,
      type: d.type,
      optionsJson: d.optionsJson,
      options,
      required: d.required,
      active: d.active,
      displayOrder: d.displayOrder,
      createdAt: d.createdAt.toISOString(),
      hasExistingValues: d._count.values > 0,
    };
  });
}

export async function createCustomFieldDefinition(
  data: {
    key: string;
    label: string;
    type: CustomFieldType;
    options?: string[];
    required?: boolean;
    active?: boolean;
    displayOrder?: number;
  },
  executorUserId?: string,
): Promise<CustomFieldDefinitionDTO> {
  if (executorUserId) {
    const perm = await hasPermission(executorUserId, "members.custom_fields.manage");
    if (!perm) {
      throw new Error("Unauthorized: Missing members.custom_fields.manage permission.");
    }
  }

  const keySlug = data.key.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
  if (!keySlug) {
    throw new Error("Invalid custom field key slug.");
  }

  const existing = await prisma.memberCustomFieldDefinition.findUnique({
    where: { key: keySlug },
  });

  if (existing) {
    throw new Error(`Custom field key '${keySlug}' already exists.`);
  }

  if (data.type === "SELECT" && (!data.options || data.options.length === 0)) {
    throw new Error("SELECT type custom field requires at least one option.");
  }

  const optionsJson = data.options ? JSON.stringify(data.options.map((o) => o.trim()).filter(Boolean)) : null;

  const def = await prisma.memberCustomFieldDefinition.create({
    data: {
      key: keySlug,
      label: data.label.trim(),
      type: data.type,
      optionsJson,
      required: Boolean(data.required),
      active: data.active ?? true,
      displayOrder: data.displayOrder ?? 0,
      createdById: executorUserId,
    },
  });

  if (executorUserId) {
    await logAuditEvent({
      actorUserId: executorUserId,
      action: "CUSTOM_FIELD_DEFINITION_CREATED",
      entityType: "MemberCustomFieldDefinition",
      entityId: def.id,
      metadata: { key: def.key, label: def.label, type: def.type },
    });
  }

  return {
    id: def.id,
    key: def.key,
    label: def.label,
    type: def.type,
    optionsJson: def.optionsJson,
    options: data.options || [],
    required: def.required,
    active: def.active,
    displayOrder: def.displayOrder,
    createdAt: def.createdAt.toISOString(),
    hasExistingValues: false,
  };
}

export async function updateCustomFieldDefinition(
  id: string,
  data: {
    label?: string;
    options?: string[];
    required?: boolean;
    active?: boolean;
    displayOrder?: number;
  },
  executorUserId?: string,
): Promise<CustomFieldDefinitionDTO> {
  if (executorUserId) {
    const perm = await hasPermission(executorUserId, "members.custom_fields.manage");
    if (!perm) {
      throw new Error("Unauthorized: Missing members.custom_fields.manage permission.");
    }
  }

  const existing = await prisma.memberCustomFieldDefinition.findUnique({
    where: { id },
    include: { _count: { select: { values: true } } },
  });

  if (!existing) {
    throw new Error("Custom field definition not found.");
  }

  const optionsJson = data.options
    ? JSON.stringify(data.options.map((o) => o.trim()).filter(Boolean))
    : existing.optionsJson;

  const updated = await prisma.memberCustomFieldDefinition.update({
    where: { id },
    data: {
      label: data.label !== undefined ? data.label.trim() : existing.label,
      optionsJson,
      required: data.required !== undefined ? data.required : existing.required,
      active: data.active !== undefined ? data.active : existing.active,
      displayOrder: data.displayOrder !== undefined ? data.displayOrder : existing.displayOrder,
    },
  });

  if (executorUserId) {
    await logAuditEvent({
      actorUserId: executorUserId,
      action: "CUSTOM_FIELD_DEFINITION_UPDATED",
      entityType: "MemberCustomFieldDefinition",
      entityId: id,
      metadata: { key: existing.key, active: data.active, required: data.required },
    });
  }

  let options: string[] = [];
  if (updated.optionsJson) {
    try {
      options = JSON.parse(updated.optionsJson);
    } catch {
      options = [];
    }
  }

  return {
    id: updated.id,
    key: updated.key,
    label: updated.label,
    type: updated.type,
    optionsJson: updated.optionsJson,
    options,
    required: updated.required,
    active: updated.active,
    displayOrder: updated.displayOrder,
    createdAt: updated.createdAt.toISOString(),
    hasExistingValues: existing._count.values > 0,
  };
}

export function validateCustomFieldValues(
  activeDefs: CustomFieldDefinitionDTO[],
  valuesRecord: Record<string, string>,
): Array<{ fieldKey: string; error: string }> {
  const errors: Array<{ fieldKey: string; error: string }> = [];

  for (const def of activeDefs) {
    const val = valuesRecord[def.key] ?? valuesRecord[def.id] ?? "";

    if (def.required && (!val || val.trim() === "")) {
      errors.push({ fieldKey: def.key, error: `'${def.label}' is required.` });
      continue;
    }

    if (val && val.trim() !== "") {
      if (def.type === "NUMBER" && isNaN(Number(val))) {
        errors.push({ fieldKey: def.key, error: `'${def.label}' must be a valid number.` });
      }
      if (def.type === "DATE" && isNaN(Date.parse(val))) {
        errors.push({ fieldKey: def.key, error: `'${def.label}' must be a valid date.` });
      }
      if (def.type === "BOOLEAN" && val !== "true" && val !== "false" && val !== "1" && val !== "0") {
        errors.push({ fieldKey: def.key, error: `'${def.label}' must be true or false.` });
      }
      if (def.type === "SELECT") {
        if (!def.options || !def.options.includes(val.trim())) {
          errors.push({
            fieldKey: def.key,
            error: `'${def.label}' value '${val}' is an invalid option. Allowed: ${def.options.join(", ")}`,
          });
        }
      }
    }
  }

  return errors;
}

export async function setMemberCustomFieldValues(
  memberId: string,
  valuesRecord: Record<string, string>,
  executorUserId?: string,
): Promise<{ success: boolean }> {
  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, branchId: true },
  });

  if (!member) {
    throw new Error("Member profile not found.");
  }

  if (executorUserId && executorUserId !== member.userId) {
    const perm = await hasPermission(executorUserId, "members.update");
    if (!perm) {
      throw new Error("Unauthorized: Missing members.update permission.");
    }
    const scope = await getUserAuthorizedBranchScope(executorUserId);
    if (!scope.global && !scope.branchIds.includes(member.branchId)) {
      throw new Error("Unauthorized: Member branch is outside your authorized scope.");
    }
  }

  const allDefs = await getCustomFieldDefinitions(true);
  const activeDefs = allDefs.filter((d) => d.active);
  const validationErrors = validateCustomFieldValues(activeDefs, valuesRecord);
  if (validationErrors.length > 0) {
    throw new Error(`Custom field validation failed: ${validationErrors.map((e) => e.error).join(" ")}`);
  }

  for (const def of allDefs) {
    const val = valuesRecord[def.key] ?? valuesRecord[def.id];
    if (val !== undefined) {
      await prisma.memberCustomFieldValue.upsert({
        where: {
          memberId_fieldDefinitionId: {
            memberId,
            fieldDefinitionId: def.id,
          },
        },
        update: { value: val.trim() },
        create: {
          memberId,
          fieldDefinitionId: def.id,
          value: val.trim(),
        },
      });
    }
  }

  return { success: true };
}

export async function getMemberCustomFieldValues(
  memberId: string,
  executorUserId?: string,
): Promise<Record<string, string>> {
  const values = await getMemberCustomValues(memberId, executorUserId);
  const result: Record<string, string> = {};
  for (const v of values) {
    result[v.key] = v.value;
  }
  return result;
}

export async function getMemberCustomValues(
  memberId: string,
  executorUserId?: string,
): Promise<MemberCustomFieldValueDTO[]> {
  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, branchId: true },
  });

  if (!member) {
    throw new Error("Member profile not found.");
  }

  if (executorUserId && executorUserId !== member.userId) {
    const perm = await hasPermission(executorUserId, "members.view");
    if (!perm) {
      throw new Error("Unauthorized: Missing members.view permission.");
    }
    const scope = await getUserAuthorizedBranchScope(executorUserId);
    if (!scope.global && !scope.branchIds.includes(member.branchId)) {
      throw new Error("Unauthorized: Member branch is outside your authorized scope.");
    }
  }

  const values = await prisma.memberCustomFieldValue.findMany({
    where: { memberId },
    include: { fieldDefinition: true },
  });

  return values.map((v) => ({
    id: v.id,
    memberId: v.memberId,
    fieldDefinitionId: v.fieldDefinitionId,
    key: v.fieldDefinition.key,
    label: v.fieldDefinition.label,
    type: v.fieldDefinition.type,
    value: v.value,
  }));
}

export async function saveMemberCustomValues(
  memberId: string,
  inputs: CustomFieldValueInput[],
  executorUserId?: string,
): Promise<{ success: boolean }> {
  const valuesRecord: Record<string, string> = {};
  for (const item of inputs) {
    valuesRecord[item.fieldDefinitionId] = item.value;
  }
  return setMemberCustomFieldValues(memberId, valuesRecord, executorUserId);
}
