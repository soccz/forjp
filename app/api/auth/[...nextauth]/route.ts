import NextAuth from "next-auth";
import Kakao from "next-auth/providers/kakao";

const { handlers } = NextAuth({
  providers: [
    Kakao({
      clientId: process.env.KAKAO_CLIENT_ID ?? "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

export const GET = handlers.GET;
export const POST = handlers.POST;
