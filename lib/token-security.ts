import { createHash, randomBytes } from "crypto";
import { normalizeToken } from "@/lib/formatters";

const URL_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function createUrlToken() {
  return randomBytes(32).toString("hex");
}

export function normalizeUrlToken(value: unknown) {
  return normalizeToken(value).toLowerCase();
}

export function isValidUrlToken(token: string) {
  return URL_TOKEN_PATTERN.test(token);
}

export function hashUrlToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function getUrlTokenLookupValues(value: unknown) {
  const token = normalizeUrlToken(value);
  if (!isValidUrlToken(token)) return null;

  return {
    raw: token,
    hashed: hashUrlToken(token),
  };
}
