import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import { config } from "@/config/unifiedConfig.js";
import { redis } from "@/lib/redis.js";
import { accessRequestRepository } from "@/repositories/AccessRequestRepository.js";
import { userRepository } from "@/repositories/UserRepository.js";
import { auditService } from "@/services/auditService.js";
import { notificationService } from "@/services/notificationService.js";
import { ConflictError, ForbiddenError, UnauthorizedError } from "@/types/index.js";

const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";

interface TokenPayload {
  sub: string;
  type: typeof ACCESS_TOKEN_TYPE | typeof REFRESH_TOKEN_TYPE;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

export class AuthService {
  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  private signAccessToken(userId: string): string {
    return jwt.sign(
      { sub: userId, type: ACCESS_TOKEN_TYPE } satisfies TokenPayload,
      config.auth.jwtAccessSecret,
      { expiresIn: config.auth.jwtAccessTtl } as jwt.SignOptions,
    );
  }

  private signRefreshToken(userId: string): string {
    return jwt.sign(
      { sub: userId, type: REFRESH_TOKEN_TYPE } satisfies TokenPayload,
      config.auth.jwtRefreshSecret,
      { expiresIn: config.auth.jwtRefreshTtl } as jwt.SignOptions,
    );
  }

  verifyAccessToken(token: string): { userId: string } {
    try {
      const payload = jwt.verify(token, config.auth.jwtAccessSecret) as TokenPayload;
      if (payload.type !== ACCESS_TOKEN_TYPE) throw new Error("wrong token type");
      return { userId: payload.sub };
    } catch {
      throw new UnauthorizedError("Недействительный или истёкший токен доступа");
    }
  }

  verifyRefreshToken(token: string): { userId: string } {
    try {
      const payload = jwt.verify(token, config.auth.jwtRefreshSecret) as TokenPayload;
      if (payload.type !== REFRESH_TOKEN_TYPE) throw new Error("wrong token type");
      return { userId: payload.sub };
    } catch {
      throw new UnauthorizedError("Недействительный или истёкший refresh-токен");
    }
  }

  private lockoutKey(email: string) {
    return `login:lockout:${email}`;
  }

  private attemptsKey(email: string) {
    return `login:attempts:${email}`;
  }

  private async assertNotLockedOut(email: string): Promise<void> {
    const locked = await redis.get(this.lockoutKey(email));
    if (locked) {
      throw new ForbiddenError("Слишком много неуспешных попыток входа, попробуйте позже");
    }
  }

  private async registerFailedAttempt(email: string): Promise<void> {
    const attempts = await redis.incr(this.attemptsKey(email));
    await redis.expire(this.attemptsKey(email), 15 * 60);
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      await redis.set(this.lockoutKey(email), "1", "EX", LOCKOUT_SECONDS);
    }
  }

  private async clearFailedAttempts(email: string): Promise<void> {
    await redis.del(this.attemptsKey(email), this.lockoutKey(email));
  }

  /** SRS §34.1: не сообщаем, существует ли логин; пять неудачных попыток — временная задержка. */
  async webLogin(params: {
    email: string;
    password: string;
    totpCode?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; fullName: string; mustChangePassword: boolean };
  }> {
    await this.assertNotLockedOut(params.email);
    const genericError = () => new UnauthorizedError("Неверный логин или пароль");

    const user = await userRepository.findByEmail(params.email);
    if (!user || !user.passwordHash || user.status !== "ACTIVE") {
      await this.registerFailedAttempt(params.email);
      throw genericError();
    }

    const valid = await argon2.verify(user.passwordHash, params.password);
    if (!valid) {
      await this.registerFailedAttempt(params.email);
      await auditService.record({
        actorId: user.id,
        action: "auth.login_failed",
        objectType: "User",
        objectId: user.id,
        result: "failure",
        requestId: params.requestId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      throw genericError();
    }

    const authContext = await userRepository.getAuthContext(user.id);
    const requires2fa =
      authContext?.roleNames.some((r) => r === "HRD" || r === "ADMINISTRATOR") ?? false;

    if (requires2fa) {
      if (!user.totpEnabled) {
        throw new ForbiddenError(
          "Для этой роли обязательна настройка двухфакторной аутентификации",
          "TWO_FACTOR_SETUP_REQUIRED",
        );
      }
      if (!params.totpCode) {
        throw new UnauthorizedError("Требуется код двухфакторной аутентификации");
      }
      if (!authenticator.verify({ token: params.totpCode, secret: user.totpSecret! })) {
        await this.registerFailedAttempt(params.email);
        throw new UnauthorizedError("Неверный код двухфакторной аутентификации");
      }
    }

    await this.clearFailedAttempts(params.email);
    await auditService.record({
      actorId: user.id,
      action: "auth.login_success",
      objectType: "User",
      objectId: user.id,
      result: "success",
      requestId: params.requestId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return {
      accessToken: this.signAccessToken(user.id),
      refreshToken: this.signRefreshToken(user.id),
      user: { id: user.id, fullName: user.fullName, mustChangePassword: user.mustChangePassword },
    };
  }

  /**
   * Бутстрап 2FA (SRS §21: обязательна для HRD/Администратора). Без этого пути
   * свежесозданный HRD/Admin аккаунт (totpEnabled=false) не смог бы залогиниться
   * никогда — webLogin блокирует вход, требуя уже настроенную 2FA. Подтверждение
   * личности здесь — повторный ввод пароля (bearer-токена ещё не существует).
   */
  async beginTwoFactorSetup(email: string, password: string): Promise<{ secret: string; otpauthUrl: string }> {
    await this.assertNotLockedOut(email);
    const user = await userRepository.findByEmail(email);
    if (!user || !user.passwordHash) {
      await this.registerFailedAttempt(email);
      throw new UnauthorizedError("Неверный логин или пароль");
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      await this.registerFailedAttempt(email);
      throw new UnauthorizedError("Неверный логин или пароль");
    }
    if (user.totpEnabled) {
      throw new ForbiddenError("Двухфакторная аутентификация уже настроена для этого аккаунта");
    }
    const secret = authenticator.generateSecret();
    await userRepository.setTotpSecret(user.id, secret);
    const otpauthUrl = authenticator.keyuri(email, "HotLineBot", secret);
    return { secret, otpauthUrl };
  }

  async confirmTwoFactorSetup(email: string, password: string, code: string): Promise<void> {
    await this.assertNotLockedOut(email);
    const user = await userRepository.findByEmail(email);
    if (!user || !user.passwordHash || !user.totpSecret) {
      await this.registerFailedAttempt(email);
      throw new UnauthorizedError("Сначала выполните /auth/2fa/setup");
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid || !authenticator.verify({ token: code, secret: user.totpSecret })) {
      await this.registerFailedAttempt(email);
      throw new UnauthorizedError("Неверный пароль или код подтверждения");
    }
    await this.clearFailedAttempts(email);
    await userRepository.enableTotp(user.id);
    await auditService.record({
      actorId: user.id,
      action: "auth.2fa_enabled",
      objectType: "User",
      objectId: user.id,
      result: "success",
    });
  }

  /** SRS §21: временный пароль требует смены. Самообслуживание — текущий пароль подтверждает личность. */
  /** Step-up подтверждение паролем без смены (используется перед раскрытием автора
   * конфиденциального обращения, appealService.revealAuthor) — TOTP повторно не
   * спрашиваем, пользователь уже прошёл его при логине в текущей сессии. */
  async verifyPassword(userId: string, password: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user?.passwordHash) throw new UnauthorizedError();
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedError("Неверный пароль");
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user?.passwordHash) throw new UnauthorizedError();
    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedError("Текущий пароль указан неверно");
    const passwordHash = await this.hashPassword(newPassword);
    await userRepository.setPassword(user.id, passwordHash);
    await auditService.record({
      actorId: user.id,
      action: "auth.password_changed",
      objectType: "User",
      objectId: user.id,
      result: "success",
    });
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const { userId } = this.verifyRefreshToken(refreshToken);
    const user = await userRepository.findById(userId);
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedError("Учётная запись недоступна");
    }
    return {
      accessToken: this.signAccessToken(userId),
      refreshToken: this.signRefreshToken(userId),
    };
  }

  /**
   * Вызывается ботом сотрудников (service-token) при первом запуске (FR-AUTH-001..004).
   * Создаёт кандидата User + AccessRequest либо возвращает текущий статус существующего.
   */
  async telegramIdentify(params: {
    telegramId: bigint;
    fullName?: string;
  }): Promise<{ status: string; userId: string; isNew: boolean }> {
    const existing = await userRepository.findByTelegramId(params.telegramId);
    if (existing) {
      return { status: existing.status, userId: existing.id, isNew: false };
    }
    if (!params.fullName) {
      throw new ConflictError("Для нового пользователя обязательно ФИО");
    }
    const user = await userRepository.createEmployeeCandidate({
      telegramId: params.telegramId,
      fullName: params.fullName,
    });
    const accessRequest = await accessRequestRepository.create({
      userId: user.id,
      telegramId: params.telegramId,
      fullName: params.fullName,
    });
    await notificationService.notifyHrdNewAccessRequest(accessRequest.id, params.fullName);
    return { status: user.status, userId: user.id, isNew: true };
  }
}

export const authService = new AuthService();
