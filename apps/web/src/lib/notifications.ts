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
    default:
      return "Новое уведомление";
  }
}
