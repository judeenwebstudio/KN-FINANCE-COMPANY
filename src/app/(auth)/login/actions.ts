"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { loginSchema } from "@/lib/validations";

export type LoginState = { error?: string };
export async function loginAction(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  try { await signIn("credentials", { ...parsed.data, redirectTo: "/" }); }
  catch (error) { if (error instanceof AuthError) return { error: "Invalid email or password" }; throw error; }
  return {};
}
