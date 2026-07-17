import { auditRepository, type AuditEntryInput } from "@/repositories/AuditRepository.js";

export class AuditService {
  record(entry: AuditEntryInput) {
    return auditRepository.create(entry);
  }

  list(filters: { action?: string; actorId?: string; appealId?: string }, page = 1, pageSize = 50) {
    return auditRepository.list(filters, page, pageSize);
  }
}

export const auditService = new AuditService();
