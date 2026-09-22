import { z } from "zod";

const telegramIdField = z.union([z.string(), z.number()]).transform((v) => String(v));

export const getVpnAccessBotSchema = z.object({ telegramId: telegramIdField });
