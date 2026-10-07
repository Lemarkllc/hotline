import { z } from "zod";
import { FULL_NAME_FORMAT_HINT, isValidFullName } from "@hotline/shared";
import { VPN_MAX_DEVICE_LIMIT } from "@/config/vpnConfig.js";

const deviceLimit = z.coerce.number().int().min(1).max(VPN_MAX_DEVICE_LIMIT);
const email = z.string().trim().toLowerCase().email("Некорректный email");

export const addVpnEmployeeSchema = z.object({
  telegramId: z.string().trim().regex(/^\d{5,15}$/, "Telegram ID — только цифры"),
  fullName: z.string().trim().refine(isValidFullName, FULL_NAME_FORMAT_HINT),
  email: email.optional().or(z.literal("").transform(() => undefined)),
  deviceLimit: deviceLimit.optional(),
});

export const createVpnSchema = z.object({ deviceLimit: deviceLimit.optional() });

export const setVpnDeviceLimitSchema = z.object({ deviceLimit });

export const deleteVpnDeviceSchema = z.object({ deviceId: z.coerce.number().int().positive() });

export const sendVpnEmailSchema = z.object({ email: email.optional() });
