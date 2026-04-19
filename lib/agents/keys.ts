import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";

export function generateAgentKey(): { plain: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const plain = `ae_${raw}`;
  const prefix = plain.slice(0, 10);
  return { plain, prefix };
}

export async function hashAgentKey(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyAgentKey(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function fingerprint(plain: string): string {
  return createHash("sha256").update(plain).digest("hex").slice(0, 16);
}
