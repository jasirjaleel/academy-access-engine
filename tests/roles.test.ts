import { describe, expect, it } from "vitest";
import { isAdmin } from "@/lib/roles";

describe("isAdmin", () => {
  it("trusts only app_metadata.role", () => {
    expect(isAdmin({ app_metadata: { role: "admin" } })).toBe(true);
    expect(isAdmin({ app_metadata: { role: "student" } })).toBe(false);
    expect(isAdmin({ app_metadata: {} })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("ignores a role the user wrote into their own user_metadata", () => {
    const user = { app_metadata: {}, user_metadata: { role: "admin" } };
    expect(isAdmin(user)).toBe(false);
  });
});
