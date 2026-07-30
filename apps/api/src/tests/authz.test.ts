import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "@/types/index.js";
import { canRevealAuthor, canSeeAuthor, hasChannelPermission } from "@/utils/authz.js";

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user-1",
    fullName: "Test User",
    email: "test@hotline.local",
    roleNames: [],
    permissions: [],
    channels: ["EMPLOYEE"],
    ...overrides,
  };
}

describe("hasChannelPermission", () => {
  it("требует И permission, И явный доступ к каналу", () => {
    const hrdNoChannel = user({ permissions: ["appeal.read_all"], channels: [] });
    expect(hasChannelPermission(hrdNoChannel, "appeal.read_all", "EMPLOYEE")).toBe(false);

    const hrdWithChannel = user({ permissions: ["appeal.read_all"], channels: ["EMPLOYEE"] });
    expect(hasChannelPermission(hrdWithChannel, "appeal.read_all", "EMPLOYEE")).toBe(true);
  });

  it("permission для канала EMPLOYEE не даёт доступа к CUSTOMER", () => {
    const hrd = user({ permissions: ["appeal.read_all"], channels: ["EMPLOYEE"] });
    expect(hasChannelPermission(hrd, "appeal.read_all", "CUSTOMER")).toBe(false);
  });
});

describe("canSeeAuthor — критический инвариант конфиденциальности (SRS §7, §4.5)", () => {
  const openAppeal = { channel: "EMPLOYEE" as const, mode: "OPEN" as const };
  const confidentialAppeal = { channel: "EMPLOYEE" as const, mode: "CONFIDENTIAL" as const };

  it("HRD (read_author + read_all) видит автора в открытом режиме, но НЕ в конфиденциальном — там нужен отдельный reveal", () => {
    const hrd = user({ permissions: ["appeal.read_author", "appeal.read_all"], channels: ["EMPLOYEE"] });
    expect(canSeeAuthor(openAppeal, hrd, false)).toBe(true);
    expect(canSeeAuthor(confidentialAppeal, hrd, false)).toBe(false);
  });

  it("Ни у кого нет мгновенного доступа к автору CONFIDENTIAL через обычный ответ — только через canRevealAuthor()", () => {
    const everyone = user({
      permissions: ["appeal.read_all", "appeal.read_assigned", "appeal.read_author"],
      channels: ["EMPLOYEE"],
    });
    expect(canSeeAuthor(confidentialAppeal, everyone, true)).toBe(false);
  });

  it("Менеджер (read_assigned, назначен) видит автора ТОЛЬКО в открытом режиме", () => {
    const manager = user({ permissions: ["appeal.read_assigned"], channels: ["EMPLOYEE"] });
    expect(canSeeAuthor(openAppeal, manager, true)).toBe(true);
    expect(canSeeAuthor(confidentialAppeal, manager, true)).toBe(false);
  });

  it("Менеджер без назначения не видит автора даже в открытом режиме", () => {
    const manager = user({ permissions: ["appeal.read_assigned"], channels: ["EMPLOYEE"] });
    expect(canSeeAuthor(openAppeal, manager, false)).toBe(false);
  });

  it("Администратор (без appeal.* permissions) не видит автора ни в каком режиме", () => {
    const admin = user({ permissions: ["user.manage", "audit.read"], channels: ["EMPLOYEE"] });
    expect(canSeeAuthor(openAppeal, admin, false)).toBe(false);
    expect(canSeeAuthor(confidentialAppeal, admin, false)).toBe(false);
  });

  it("read_all видит автора открытого обращения независимо от назначения", () => {
    const hrdReadAll = user({ permissions: ["appeal.read_all"], channels: ["EMPLOYEE"] });
    expect(canSeeAuthor(openAppeal, hrdReadAll, false)).toBe(true);
    expect(canSeeAuthor(confidentialAppeal, hrdReadAll, false)).toBe(false);
  });

  it("permission без доступа к каналу не открывает автора ни при каких условиях", () => {
    const noChannelAccess = user({ permissions: ["appeal.read_all", "appeal.read_author"], channels: [] });
    expect(canSeeAuthor(openAppeal, noChannelAccess, false)).toBe(false);
    expect(canSeeAuthor(confidentialAppeal, noChannelAccess, false)).toBe(false);
  });
});

describe("canRevealAuthor — кто вообще может раскрыть автора CONFIDENTIAL через отдельный шаг (пароль + аудит)", () => {
  const openAppeal = { channel: "EMPLOYEE" as const, mode: "OPEN" as const };
  const confidentialAppeal = { channel: "EMPLOYEE" as const, mode: "CONFIDENTIAL" as const };

  it("read_author может раскрыть автора CONFIDENTIAL, но не OPEN (там он и так виден)", () => {
    const hrd = user({ permissions: ["appeal.read_author"], channels: ["EMPLOYEE"] });
    expect(canRevealAuthor(confidentialAppeal, hrd)).toBe(true);
    expect(canRevealAuthor(openAppeal, hrd)).toBe(false);
  });

  it("read_all без read_author не может раскрыть автора CONFIDENTIAL", () => {
    const readAllOnly = user({ permissions: ["appeal.read_all"], channels: ["EMPLOYEE"] });
    expect(canRevealAuthor(confidentialAppeal, readAllOnly)).toBe(false);
  });

  it("read_author без доступа к каналу не может раскрыть автора", () => {
    const noChannel = user({ permissions: ["appeal.read_author"], channels: [] });
    expect(canRevealAuthor(confidentialAppeal, noChannel)).toBe(false);
  });
});
