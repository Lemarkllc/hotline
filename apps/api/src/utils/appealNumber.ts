import type { Channel } from "@hotline/shared";

/** Префикс не должен идентифицировать автора/подразделение (FR-APP-011) — только канал. */
const CHANNEL_PREFIX: Record<Channel, string> = {
  EMPLOYEE: "HL",
  CUSTOMER: "CF",
};

export function formatPublicNumber(channel: Channel, year: number, sequence: number): string {
  return `${CHANNEL_PREFIX[channel]}-${year}-${String(sequence).padStart(5, "0")}`;
}

export function sequenceKey(channel: Channel, year: number): string {
  return `${channel}:${year}`;
}
