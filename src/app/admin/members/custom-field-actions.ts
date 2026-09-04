"use server";

import { getCurrentUser } from "@/lib/authz";
import {
  getCustomFieldDefinitions,
  createCustomFieldDefinition,
  updateCustomFieldDefinition,
  getMemberCustomValues,
  saveMemberCustomValues,
  CustomFieldDefinitionDTO,
  MemberCustomFieldValueDTO,
  CustomFieldValueInput,
} from "@/lib/members/custom-field-service";
import { CustomFieldType } from "@/generated/prisma/client";

export async function getCustomFieldDefinitionsAction(
  includeInactive = false,
): Promise<{ success: boolean; data?: CustomFieldDefinitionDTO[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Authentication required." };

    const defs = await getCustomFieldDefinitions(includeInactive, user.id);
    return { success: true, data: defs };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to fetch custom field definitions." };
  }
}

export async function createCustomFieldDefAction(data: {
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  active?: boolean;
  displayOrder?: number;
}): Promise<{ success: boolean; data?: CustomFieldDefinitionDTO[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Authentication required." };

    await createCustomFieldDefinition(data, user.id);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to create custom field definition." };
  }
}

export async function updateCustomFieldDefAction(
  id: string,
  data: {
    label?: string;
    options?: string[];
    required?: boolean;
    active?: boolean;
    displayOrder?: number;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Authentication required." };

    await updateCustomFieldDefinition(id, data, user.id);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to update custom field definition." };
  }
}

export async function getMemberCustomValuesAction(
  memberId: string,
): Promise<{ success: boolean; data?: MemberCustomFieldValueDTO[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Authentication required." };

    const values = await getMemberCustomValues(memberId, user.id);
    return { success: true, data: values };
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to fetch member custom values." };
  }
}

export async function saveMemberCustomValuesAction(
  memberId: string,
  inputs: CustomFieldValueInput[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Authentication required." };

    return await saveMemberCustomValues(memberId, inputs, user.id);
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message || "Failed to save member custom values." };
  }
}
