/** Единая точка форматирования payload уведомления — переиспользуется десктопным
 * колокольчиком (Topbar) и мобильным экраном "Уведомления", чтобы текст не разъезжался
 * между ними при добавлении нового типа уведомления. */
export function describeNotification(payload: Record<string, unknown>): string {
  switch (payload.type) {
    case "new_appeal":
      return `Новое обращение ${payload.publicNumber}`;
    case "author_replied":
      return `Автор ответил по обращению ${payload.publicNumber}`;
    case "low_rating":
      // EMPLOYEE — score, CUSTOMER — wouldRecommendScore/wouldReturnScore (Фаза 7, NPS-style).
      return payload.wouldRecommendScore !== undefined
        ? `Низкая оценка по обращению ${payload.publicNumber} (рекомендация ${payload.wouldRecommendScore}/5, вернётся ${payload.wouldReturnScore}/5)`
        : `Низкая оценка (${payload.score}) по обращению ${payload.publicNumber}`;
    case "assigned":
      return `Вам назначено обращение ${payload.publicNumber}`;
    case "internal_mention":
      return `${payload.fromFullName ?? "Коллега"} упомянул(а) вас в обращении ${payload.publicNumber}`;
    case "new_lead":
      return `Новая заявка ${payload.publicNumber}`;
    case "lead_ai_relevant":
      return `ИИ считает заявку ${payload.publicNumber} релевантной — передайте в CRM: ${payload.reasoning}`;
    case "lead_auto_converted":
      return `Заявка ${payload.publicNumber} передана в CRM — назначена ${payload.assigneeFullName}`;
    case "lead_sla_warning":
      return `Заявка ${payload.publicNumber} — меньше часа до дедлайна ответа`;
    case "lead_sla_breach":
      return `Заявка ${payload.publicNumber} — дедлайн ответа просрочен`;
    case "lead_phishing_attempt":
      return `Заявка ${payload.publicNumber} похожа на попытку манипуляции ИИ (промпт-инъекция)`;
    case "lead_ai_autostoplist_digest":
      return `ИИ отправил в стоп-лист ${payload.count} писем за сегодня — фильтр «От ИИ» в стоп-листе`;
    case "bitrix_lead_stalled":
      return `Лид Bitrix «${payload.title}» завис без движения`;
    default:
      return "Новое уведомление";
  }
}
