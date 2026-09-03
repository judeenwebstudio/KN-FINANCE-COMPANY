"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCurrentUser } from "@/lib/authz";
import {
  createMember as createMemberService,
  updateMember as updateMemberService,
  CreateMemberInput,
  UpdateMemberInput,
} from "@/lib/members/member-service";

export async function createMemberAction(input: CreateMemberInput) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized. Please log in." };

    const result = await createMemberService(user.id, input);
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create member." };
  }
}

export async function updateMemberAction(input: UpdateMemberInput) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Unauthorized. Please log in." };

    const result = await updateMemberService(user.id, input);
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update member." };
  }
}
