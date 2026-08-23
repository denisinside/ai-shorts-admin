import type { Metadata } from "next";
import Day2Form from "@/components/Day2Form";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Новий запис · День 2" };

export default async function NewDay2Page({
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
        eyebrow="День 2 · План"
        title="Новий запис"
      />
      <Card className="p-5 sm:p-6">
        <Day2Form projectId={id} />
      </Card>
    </div>
  );
}
