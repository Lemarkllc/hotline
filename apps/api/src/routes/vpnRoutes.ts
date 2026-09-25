import { Router } from "express";
import { vpnController } from "@/controllers/VpnController.js";
import { requireBotService } from "@/middleware/auth.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import { getVpnAccessBotSchema } from "@/validators/vpn.schema.js";

export const vpnRoutes = Router();

vpnRoutes.get(
  "/access",
  requireBotService("EMPLOYEE"),
  validate(getVpnAccessBotSchema, "query"),
  asyncErrorWrapper((req, res) => vpnController.getAccessFromBot(req, res)),
);

/** Публичный — без requireBotService, бьёт сюда напрямую VPN-приложение
 * сотрудника, а не бот (см. VpnController.getSubscription). */
vpnRoutes.get("/sub/:subId", asyncErrorWrapper((req, res) => vpnController.getSubscription(req, res)));

/** Зеркало geoip.dat/geosite.dat (см. vpnGeoDataService, vpnService.rewriteRoutingGeoUrls) —
 * публичные, VPN-приложение качает их напрямую, ещё до установки туннеля. */
vpnRoutes.get("/geoip.dat", asyncErrorWrapper((req, res) => vpnController.getGeoIp(req, res)));
vpnRoutes.get("/geosite.dat", asyncErrorWrapper((req, res) => vpnController.getGeoSite(req, res)));
