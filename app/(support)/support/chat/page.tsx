import type { Metadata } from "next";

import { UserChat } from "@/components/support/UserChat";

/** Чат користувача. Акаунт — у `?user=U001`. */
export const metadata: Metadata = {
  title: "Чат з підтримкою",
};

const USER_ID_RE = /^U\d{3}$/;

export default async function SupportChatPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const { user } = await searchParams;

  // Формат перевіряємо тут, а не в компоненті: битий `user` інакше поїхав би в
  // POST і повернувся 400 уже після того, як людина написала повідомлення.
  if (!user || !USER_ID_RE.test(user)) {
    return (
      <div className="stage">
        <div className="chooser">
          <h1>Акаунт не обрано</h1>
          <p>
            Посилання має містити акаунт датасету: <code>?user=U001</code>. Від нього
            залежить уся відповідь агента — план, канал покупки й статус підписки.
          </p>
          <a className="go" href="/support">
            Обрати акаунт
          </a>
        </div>
      </div>
    );
  }

  return <UserChat userId={user} />;
}
