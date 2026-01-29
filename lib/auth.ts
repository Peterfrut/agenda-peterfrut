import { NextRequest } from "next/server";
import { SignJWT, jwtVerify, JWTPayload } from "jose";

const SECRET = process.env.JWT_SECRET;

const secretKey = new TextEncoder().encode(SECRET);

export async function signJwt(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secretKey);
}

export async function verifyJwt(
  token: string
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const cookie = req.cookies.get("token");
  return cookie?.value ?? null;
}
