import { z } from "zod";

const telegramIdField = z.union([z.string(), z.number()]).transform((v) => String(v));

export const getVpnAccessBotSchema = z.object({ telegramId: telegramIdField });

export const listVpnDevicesBotSchema = z.object({ telegramId: telegramIdField });

export const deleteVpnDeviceBotSchema = z.object({
  telegramId: telegramIdField,
  deviceId: z.coerce.number().int().positive(),
});
