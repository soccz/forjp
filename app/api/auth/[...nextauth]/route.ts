import NextAuth from "next-auth";
import Kakao from "next-auth/providers/kakao";

const { handlers, auth } = NextAuth({
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

export { handlers as GET, handlers as POST };
export { auth };
