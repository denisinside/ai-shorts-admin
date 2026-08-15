import type { Metadata } from "next";
import Day3Form from "@/components/Day3Form";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Новий запис · День 3" };

export default async function NewDay3Page({
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
        eyebrow="День 3 · Матеріали"
        title="Новий запис"
      />
      <Card className="p-5 sm:p-6">
        <Day3Form projectId={id} />
      </Card>
    </div>
  );
}
