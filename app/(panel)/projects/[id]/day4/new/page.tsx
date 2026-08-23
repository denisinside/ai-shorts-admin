import type { Metadata } from "next";
import Day4Form from "@/components/Day4Form";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Новий запис · День 4" };

export default async function NewDay4Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        backHref={`/projects/${id}`}
        backLabel="До проєкту"
        eyebrow="День 4 · Відео"
        title="Новий запис"
      />
      <Card className="p-5 sm:p-6">
        <Day4Form projectId={id} />
      </Card>
    </div>
  );
}
