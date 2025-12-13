// lib/adminJwt.ts
import { SignJWT, jwtVerify } from "jose";

const secretKey = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET ?? "dev-admin-secret-change-me"
);

const alg = "HS256";

export async function signAdminJwt(sub: string): Promise<string> {
  return await new SignJWT({ sub })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("1h") // 1 hour
    .sign(secretKey);
}

export async function verifyAdminJwt(token: string) {
  const { payload } = await jwtVerify(token, secretKey);
  return payload as { sub: string; iat: number; exp: number };
}
