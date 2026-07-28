import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Отсутствует обязательная переменная окружения ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/**
 * Единственная точка доступа к переменным окружения (backend-dev-guidelines §6).
 * Ничто в src/ не должно обращаться к process.env напрямую, кроме этого файла.
 */
export const config = {
  env: optional("NODE_ENV", "development"),
  isProduction: process.env.NODE_ENV === "production",

  server: {
    port: Number(optional("API_PORT", "4000")),
  },

  database: {
    url: required("DATABASE_URL"),
  },

  redis: {
    url: optional("REDIS_URL", "redis://localhost:6379"),
  },

  auth: {
    jwtAccessSecret: optional("JWT_ACCESS_SECRET", "dev-access-secret-change-me-32chars"),
    jwtRefreshSecret: optional("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me-32chars"),
    jwtAccessTtl: optional("JWT_ACCESS_TTL", "15m"),
    jwtRefreshTtl: optional("JWT_REFRESH_TTL", "30d"),
    botServiceToken: optional("BOT_SERVICE_TOKEN", "dev-bot-service-token"),
  },

  storage: {
    endpoint: optional("S3_ENDPOINT", "http://localhost:9000"),
    region: optional("S3_REGION", "us-east-1"),
    bucket: optional("S3_BUCKET", "hotline-attachments"),
    accessKeyId: optional("S3_ACCESS_KEY", "hotline"),
    secretAccessKey: optional("S3_SECRET_KEY", "hotline12345"),
    forcePathStyle: optional("S3_FORCE_PATH_STYLE", "true") === "true",
  },

  sentry: {
    dsn: process.env.SENTRY_DSN ?? "",
  },

  cors: {
    origins: optional("CORS_ORIGINS", "http://localhost:5173").split(","),
  },

  webPush: {
    vapidPublicKey: optional("VAPID_PUBLIC_KEY", ""),
    vapidPrivateKey: optional("VAPID_PRIVATE_KEY", ""),
    vapidSubject: optional("VAPID_SUBJECT", "mailto:admin@example.com"),
  },
} as const;
