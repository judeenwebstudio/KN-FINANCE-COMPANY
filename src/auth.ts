import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [Credentials({
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(raw) {
      const parsed = loginSchema.safeParse(raw);
      if (!parsed.success) return null;
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
      if (!user || user.status !== "ACTIVE" || !(await compare(parsed.data.password, user.passwordHash))) return null;
      return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, branchId: user.branchId };
    },
  })],
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = user.role; token.status = user.status; token.branchId = user.branchId; }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as typeof session.user.role;
      session.user.status = token.status as typeof session.user.status;
      session.user.branchId = token.branchId as string | null;
      return session;
    },
  },
});
