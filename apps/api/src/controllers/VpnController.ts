import type { Request, Response } from "express";
import type { z } from "zod";
import { BaseController } from "@/controllers/BaseController.js";
import { vpnService } from "@/services/vpnService.js";
import { vpnGeoDataService, type GeoDataKind } from "@/services/vpnGeoDataService.js";
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

  /** Зеркало geoip.dat/geosite.dat через наш домен (см. vpnGeoDataService,
   * vpnService.rewriteRoutingGeoUrls) — публично, без requireBotService, бьёт
   * сюда напрямую VPN-приложение сотрудника. */
  private async getGeoData(kind: GeoDataKind, res: Response): Promise<void> {
    try {
      const body = await vpnGeoDataService.get(kind);
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(Buffer.from(body));
    } catch (error) {
      this.handleError(error, res, `vpn.get${kind}`);
    }
  }

  async getGeoIp(_req: Request, res: Response): Promise<void> {
    await this.getGeoData("geoip", res);
  }

  async getGeoSite(_req: Request, res: Response): Promise<void> {
    await this.getGeoData("geosite", res);
  }
}

export const vpnController = new VpnController();
