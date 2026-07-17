import type { Channel } from "@hotline/shared";
import { epicRepository } from "@/repositories/EpicRepository.js";
import type { AuthenticatedUser } from "@/types/index.js";
import { ForbiddenError } from "@/types/index.js";

/**
 * Справочник эпиков администрирует Администратор (SRS §34.8). У этого действия
 * нет отдельного permission в явном списке SRS §21 — в отличие от доступа к
 * содержимому обращений, это чисто административная функция, поэтому проверяем
 * роль напрямую, а не RBAC-permission.
 */
function assertAdministrator(user: AuthenticatedUser): void {
  if (!user.roleNames.includes("ADMINISTRATOR")) {
    throw new ForbiddenError("Управление справочником эпиков доступно только Администратору");
  }
}

export class EpicService {
  list(channel: Channel, includeInactive = false) {
    return epicRepository.list(channel, includeInactive);
  }

  create(user: AuthenticatedUser, channel: Channel, name: string) {
    assertAdministrator(user);
    return epicRepository.create(channel, name);
  }

  setActive(user: AuthenticatedUser, id: string, isActive: boolean) {
    assertAdministrator(user);
    return epicRepository.setActive(id, isActive);
  }
}

export const epicService = new EpicService();
