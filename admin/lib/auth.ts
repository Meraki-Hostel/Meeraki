import type { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isAllowed } from "./allowlist";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      return isAllowed(user.email);
    },
  },
  pages: {
    error: "/auth-error",
  },
};
