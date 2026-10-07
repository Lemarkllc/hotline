import { Router } from "express";
import { adminVpnController } from "@/controllers/AdminVpnController.js";
import { requireWebAuth } from "@/middleware/auth.js";
import { requirePlainPermission } from "@/middleware/rbac.js";
import { asyncErrorWrapper } from "@/middleware/asyncErrorWrapper.js";
import { validate } from "@/middleware/validate.js";
import {
  addVpnEmployeeSchema,
  createVpnSchema,
  deleteVpnDeviceSchema,
  sendVpnEmailSchema,
  setVpnDeviceLimitSchema,
} from "@/validators/adminVpn.schema.js";

/** Раздел «VPN» Администратора (openspec admin-vpn-management) — весь под user.manage:
 * HRD сюда доступа не имеет. */
export const adminVpnRoutes = Router();
adminVpnRoutes.use(requireWebAuth, requirePlainPermission("user.manage"));

adminVpnRoutes.get("/", asyncErrorWrapper((req, res) => adminVpnController.list(req, res)));
adminVpnRoutes.post("/employees", validate(addVpnEmployeeSchema), asyncErrorWrapper((req, res) => adminVpnController.addEmployee(req, res)));
adminVpnRoutes.get("/:userId", asyncErrorWrapper((req, res) => adminVpnController.getCard(req, res)));
adminVpnRoutes.post("/:userId/create", validate(createVpnSchema), asyncErrorWrapper((req, res) => adminVpnController.createVpn(req, res)));
adminVpnRoutes.post("/:userId/reissue", asyncErrorWrapper((req, res) => adminVpnController.reissue(req, res)));
adminVpnRoutes.post("/:userId/disable", asyncErrorWrapper((req, res) => adminVpnController.disable(req, res)));
adminVpnRoutes.post("/:userId/limit", validate(setVpnDeviceLimitSchema), asyncErrorWrapper((req, res) => adminVpnController.setDeviceLimit(req, res)));
adminVpnRoutes.post("/:userId/devices/delete", validate(deleteVpnDeviceSchema), asyncErrorWrapper((req, res) => adminVpnController.deleteDevice(req, res)));
adminVpnRoutes.post("/:userId/email", validate(sendVpnEmailSchema), asyncErrorWrapper((req, res) => adminVpnController.sendEmail(req, res)));
