import NextAuth, { NextAuthConfig } from "next-auth";
import CognitoProvider from "next-auth/providers/cognito";

const authConfig: NextAuthConfig = {
    debug: true,
    trustHost: true,
    providers: [
        CognitoProvider({
            clientId: process.env.COGNITO_CLIENT_ID!,
            clientSecret: process.env.COGNITO_CLIENT_SECRET!,
            issuer: process.env.COGNITO_ISSUER,
            client: {
                timeout: 10000,
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }) {
            if (account) {
                token.accessToken = account.access_token;
                token.idToken = account.id_token;
                token.userGroups = ((profile as Record<string, unknown>)?.["cognito:groups"] as string[]) || [];
                token.userClaims = ((profile as Record<string, unknown>)?.["cognito:claims"] as Record<string, unknown>) || {};
            }
            return token;
        },
        async session({ session, token }) {
            session.accessToken = token.accessToken;
            session.idToken = token.idToken;
            if (session.user) {
                session.user.groups = token.userGroups as string[] | undefined;
                session.user.claims = token.userClaims as Record<string, unknown> | undefined;
            }
            return session;
        },
    },
};

const { handlers } = NextAuth(authConfig);

export const { GET, POST } = handlers;
