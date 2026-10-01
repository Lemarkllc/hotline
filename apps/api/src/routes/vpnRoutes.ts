import { Router } from "express";
import { vpnController } from "@/controllers/VpnController.js";
import { requireBotService } from "@/middleware/auth.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import { deleteVpnDeviceBotSchema, getVpnAccessBotSchema, listVpnDevicesBotSchema } from "@/validators/vpn.schema.js";

export const vpnRoutes = Router();

vpnRoutes.get(
  "/access",
  requireBotService("EMPLOYEE"),
  validate(getVpnAccessBotSchema, "query"),
  asyncErrorWrapper((req, res) => vpnController.getAccessFromBot(req, res)),
);

/** «Мои устройства VPN» в боте — устройства своей подписки и удаление одного из них
 * (владение проверяет vpnService по telegramId, см. listOwnDevices/deleteOwnDevice). */
vpnRoutes.get(
  "/devices",
  requireBotService("EMPLOYEE"),
  validate(listVpnDevicesBotSchema, "query"),
  asyncErrorWrapper((req, res) => vpnController.listDevicesFromBot(req, res)),
);

vpnRoutes.post(
  "/devices/delete",
  requireBotService("EMPLOYEE"),
  validate(deleteVpnDeviceBotSchema),
  asyncErrorWrapper((req, res) => vpnController.deleteDeviceFromBot(req, res)),
);

/** Публичный — без requireBotService, бьёт сюда напрямую VPN-приложение
 * сотрудника, а не бот (см. VpnController.getSubscription). */
vpnRoutes.get("/sub/:subId", asyncErrorWrapper((req, res) => vpnController.getSubscription(req, res)));

/** Зеркало geoip.dat/geosite.dat (см. vpnGeoDataService, vpnService.rewriteRoutingGeoUrls) —
 * публичные, VPN-приложение качает их напрямую, ещё до установки туннеля. */
vpnRoutes.get("/geoip.dat", asyncErrorWrapper((req, res) => vpnController.getGeoIp(req, res)));
vpnRoutes.get("/geosite.dat", asyncErrorWrapper((req, res) => vpnController.getGeoSite(req, res)));
