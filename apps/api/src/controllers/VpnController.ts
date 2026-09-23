import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { vpnService } from "@/services/vpnService.js";
import type { getVpnAccessBotSchema } from "@/validators/vpn.schema.js";

export class VpnController extends BaseController {
  /** Кнопка «Получить VPN» в боковом меню бота-сотрудника. */
  async getAccessFromBot(req: Request, res: Response): Promise<void> {
    try {
      const { telegramId } = req.query as unknown as z.infer<typeof getVpnAccessBotSchema>;
      const access = await vpnService.getAccessFromBot(BigInt(telegramId));
      this.handleSuccess(res, access);
    } catch (error) {
      this.handleError(error, res, "vpn.getAccessFromBot");
    }
  }

  /** Публичный эндпоинт — сюда бьёт напрямую приложение сотрудника (Happ/Incy/
   * v2rayNG), не бот, поэтому без requireBotService. Отдаёт не JSON, а сырой
   * ответ панели (см. vpnService.proxySubscription) — handleSuccess/handleError
   * здесь не подходят, пишем в res напрямую. */
  async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const subId = req.params.subId as string;
      const incomingHwid = req.header("X-HWID");
      const incomingUserAgent = req.header("User-Agent");
      const { status, headers, body } = await vpnService.proxySubscription(subId, incomingHwid, incomingUserAgent);

      // content-encoding: fetch() уже разжал тело перед тем, как оно попало сюда —
      // проброс заголовка "gzip" при фактически несжатом теле сломал бы клиентов,
      // которые честно следуют Content-Encoding (проверено вживую 2026-09-23).
      const SKIP_HEADERS = new Set([
        "content-length",
        "transfer-encoding",
        "connection",
        "date",
        "server",
        "content-encoding",
      ]);
      headers.forEach((value, key) => {
        if (!SKIP_HEADERS.has(key.toLowerCase())) res.setHeader(key, value);
      });
      res.status(status).send(Buffer.from(body));
    } catch (error) {
      this.handleError(error, res, "vpn.getSubscription");
    }
  }
}

export const vpnController = new VpnController();
