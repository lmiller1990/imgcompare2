import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { LocalSecretService } from "../src/services/encryption.ts";

function makeService() {
  return new LocalSecretService(randomBytes(32));
}

describe("LocalSecretService", () => {
  it("roundtrips a token", async () => {
    const svc = makeService();
    const ciphertext = await svc.encrypt("glpat-secret", "project-1");
    const plaintext = await svc.decrypt(ciphertext, "project-1");
    expect(plaintext).toBe("glpat-secret");
  });

  it("produces different ciphertexts for the same plaintext", async () => {
    const svc = makeService();
    const a = await svc.encrypt("glpat-secret", "project-1");
    const b = await svc.encrypt("glpat-secret", "project-1");
    expect(a.equals(b)).toBe(false);
  });

  it("fails decryption when context does not match", async () => {
    const svc = makeService();
    const ciphertext = await svc.encrypt("glpat-secret", "project-1");
    await expect(svc.decrypt(ciphertext, "project-2")).rejects.toThrow();
  });

  it("fails decryption with a different master key", async () => {
    const a = makeService();
    const b = makeService();
    const ciphertext = await a.encrypt("glpat-secret", "project-1");
    await expect(b.decrypt(ciphertext, "project-1")).rejects.toThrow();
  });

  it("rejects a master key that is not 32 bytes", () => {
    expect(() => new LocalSecretService(randomBytes(16))).toThrow(
      "MASTER_KEY must decode to exactly 32 bytes",
    );
  });

  it("fromEnv reads MASTER_KEY from the environment", () => {
    const key = randomBytes(32).toString("base64");
    process.env["MASTER_KEY"] = key;
    expect(() => LocalSecretService.fromEnv()).not.toThrow();
    delete process.env["MASTER_KEY"];
  });

  it("fromEnv throws when MASTER_KEY is missing", () => {
    delete process.env["MASTER_KEY"];
    expect(() => LocalSecretService.fromEnv()).toThrow(
      "MASTER_KEY env var is required",
    );
  });
});
