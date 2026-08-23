import type { Metadata } from "next";

import { AgentDesk } from "@/components/support/AgentDesk";

/** Стіл тех. сапорта. Хто на зміні — у `?agent=agent-1`. */
export const metadata: Metadata = {
  title: "Стіл сапорта",
};

const AGENT_ID_RE = /^[a-z0-9-]{1,40}$/;

export default async function SupportDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const { agent } = await searchParams;

  if (!agent || !AGENT_ID_RE.test(agent)) {
    return (
      <div className="stage">
        <div className="chooser">
          <h1>Не обрано, хто на зміні</h1>
          <p>
            Посилання має містити агента: <code>?agent=agent-1</code>. Його id
            підписує кожну відповідь у транскрипті, тому підставити його «за
            замовчуванням» не можна.
          </p>
          <a className="go" href="/support">
            Обрати агента
          </a>
        </div>
      </div>
    );
  }

  return <AgentDesk agentId={agent} />;
}
