import { ApiClient } from "@hotline/bot-core";
import { config } from "./config.js";

export const apiClient = new ApiClient({
  baseUrl: config.apiBaseUrl,
  serviceToken: config.botServiceToken,
  channel: "CUSTOMER",
});
