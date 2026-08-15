import type { Metadata } from "next";
import Day1Form from "@/components/Day1Form";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Новий запис · День 1" };

export default async function NewDay1Page({
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
        eyebrow="День 1 · Тренди"
        title="Новий запис"
      />
      <Card className="p-5 sm:p-6">
        <Day1Form projectId={id} />
      </Card>
    </div>
  );
}
