import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    idToken?: string;
    user: {
      groups?: string[];
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    groups?: string[];
    claims?: Record<string, unknown>;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    accessToken?: string;
    idToken?: string;
    userGroups?: string[];
    userClaims?: Record<string, unknown>
  }
}
