// telegramId хранится как BigInt (Prisma) — JSON.stringify не умеет его сериализовать
// нативно. Импортируется первым в app.ts, до любых res.json().
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function toJSON(this: bigint) {
  return this.toString();
};

export {};
