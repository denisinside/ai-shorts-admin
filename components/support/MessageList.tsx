"use client";

import type { PairlyMessage } from "@/lib/pairly";
import { ROLE_INITIAL, bubbleLook, bubbleTime } from "@/lib/pairly-ui";

/**
 * Стрічка ходів розмови. Розмітка й класи — з макета
 * `docs/Pairly_support_bot.html`; спільна для чату користувача й для столу
 * тех. сапорта, бо обоє мусять бачити ОДНЕ І ТЕ САМЕ. Друга верстка для
 * сапорта означала б, що він читає інший діалог, ніж людина.
 *
 * `sources` — єдиний елемент, якого в макеті не було. Без нього не видно, на що
 * спиралася відповідь, а grounding — окремий критерій кейсу.
 */
export function MessageList({
  messages,
  showSources = true,
  showDeviation = false,
  pending = false,
}: {
  messages: PairlyMessage[];
  /** У черзі сапорта джерела теж потрібні: він перевіряє, чим відповів бот. */
  showSources?: boolean;
  /**
   * Рядок про те, що бот вирішив інакше, ніж радили правила. Тільки для стола
   * сапорта: користувачу знати, що в нас усередині є «план», не треба й шкідливо
   * — це внутрішня кухня, а не частина відповіді.
   */
  showDeviation?: boolean;
  pending?: boolean;
}) {
  return (
    <>
      {messages.map((message) => (
        <Row
          key={message.id}
          message={message}
          showSources={showSources}
          showDeviation={showDeviation}
        />
      ))}
      {pending ? (
        <div className="row">
          <div className="mini">P</div>
          <div className="typing" aria-label="Агент друкує">
            <i />
            <i />
            <i />
          </div>
        </div>
      ) : null}
    </>
  );
}

function Row({
  message,
  showSources,
  showDeviation,
}: {
  message: PairlyMessage;
  showSources: boolean;
  showDeviation: boolean;
}) {
  const mine = message.role === "user";
  const look = bubbleLook(message);

  // Службовий хід — рядок про стан розмови, а не репліка. Без аватара й без
  // вирівнювання по боку: він не належить ні користувачу, ні агенту.
  if (message.role === "system") {
    return (
      <div className="row" style={{ justifyContent: "center" }}>
        <div className="bubble system">
          {message.text}
          <time>{bubbleTime(message.createdAt)}</time>
        </div>
      </div>
    );
  }

  return (
    <div className={mine ? "row user" : "row"}>
      {mine ? null : (
        <div className={message.role === "agent" ? "mini human" : "mini"}>
          {ROLE_INITIAL[message.role]}
        </div>
      )}
      <div className={look?.tone ? `bubble ${look.tone}` : "bubble"}>
        {look?.label ? (
          <div className="status">
            <b>{look.icon}</b>
            {look.label}
          </div>
        ) : null}
        {message.text}
        {showSources && message.role === "bot" ? (
          <Sources message={message} />
        ) : null}
        {showDeviation && message.role === "bot" ? (
          <Deviation message={message} />
        ) : null}
        <time>
          {bubbleTime(message.createdAt)}
          {mine ? <span className="checks">✓✓</span> : null}
        </time>
      </div>
    </div>
  );
}

/**
 * Джерела під відповіддю бота.
 *
 * Порожній набір показуємо словом, а не приховуємо: «відповідь без джерела» і
 * «джерела не показали» — різні речі, і перша з них у цьому кейсі означає, що
 * відповідь не мала права бути. `grounded=false` підсвічується окремо, бо саме
 * він веде до ескалації `kb_no_answer`.
 */
function Sources({ message }: { message: PairlyMessage }) {
  const hasArticles = message.articleIds.length > 0;
  if (!hasArticles && message.grounded !== false) return null;

  return (
    <div className="sources">
      <span>Джерела:</span>
      {hasArticles ? (
        message.articleIds.map((id) => <code key={id}>{id}</code>)
      ) : (
        <span className="nogr">база знань не дала підтвердження</span>
      )}
      {message.grounded === false && hasArticles ? (
        <span className="nogr">· без підтвердження</span>
      ) : null}
    </div>
  );
}

/**
 * Коли бот вирішив інакше, ніж радив детермінований порадник.
 *
 * Показуємо саме живому агенту, і не з любові до внутрішньої кухні: якщо бот
 * СВІДОМО не передав розмову, людина, яка її підхоплює, мусить знати, що це був
 * вибір з причиною, а не пропущений тригер. `floor_held` навпаки не показуємо —
 * там модель нічого не вирішила, підлога просто не пустила, і рядок про це лише
 * шумів би.
 */
const OVERRIDE_LABEL: Record<string, string> = {
  escalated_up: "бот передав розмову, хоч правила цього не вимагали",
  escalated_down: "бот НЕ передав розмову, хоч правила радили",
  rejected_silent_override: "бот хотів не передавати, але не пояснив — передано",
  compose_failed: "модель не сформулювала відповідь — передано",
};

function Deviation({ message }: { message: PairlyMessage }) {
  const label = message.override ? OVERRIDE_LABEL[message.override] : undefined;
  if (!label) return null;

  return (
    <div className="deviation">
      <span>{label}</span>
      {message.deviationReason ? <em>{message.deviationReason}</em> : null}
    </div>
  );
}
