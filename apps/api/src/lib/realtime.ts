import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, type Namespace } from "socket.io";
import { config } from "@/config/unifiedConfig.js";
import { authService } from "@/services/authService.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { logger } from "@/lib/logger.js";

/**
 * Живые обновления поверх уже существующего HTTP-сервера (не отдельный порт/процесс —
 * PLAN.md держит всё в одном Node-процессе, см. server.ts). Единственный сценарий
 * сейчас — namespace "/leads": «Заявки» видит только тот, у кого есть lead.manage
 * (проверяется тем же JWT access-токеном, что и обычные REST-запросы), поэтому
 * достаточно широковещательной рассылки всем подключённым к namespace — сама
 * подписка уже отфильтрована по праву на этапе подключения.
 */
let leadsNamespace: Namespace | null = null;

export function initRealtime(httpServer: HttpServer): void {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: config.cors.origins, credentials: true },
  });

  leadsNamespace = io.of("/leads");
  leadsNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("no token");
      const { userId } = authService.verifyAccessToken(token);
      const user = await userRepository.getAuthContext(userId);
      if (!user || !user.permissions.includes("lead.manage")) throw new Error("forbidden");
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  leadsNamespace.on("connection", (socket) => {
    socket.on("disconnect", () => undefined);
  });

  logger.info("Realtime (Socket.IO) инициализирован");
}

/** Best-effort — как и push (см. pushService): сбой рассылки не должен ронять создание
 * заявки, live-обновление — дополнение к списку заявок, а не замена его polling'а. */
export function broadcastNewLead(lead: { id: string; publicNumber: string; subject: string; fromEmail: string }): void {
  leadsNamespace?.emit("lead:new", lead);
}
