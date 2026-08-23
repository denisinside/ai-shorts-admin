import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase";
import { deleteDay1Trends } from "@/app/actions/day1";
import Day1Form from "@/components/Day1Form";
import type { Day1Trends } from "@/lib/day-tables";
import { Card } from "@/components/ui/Card";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { PageHeader } from "@/components/ui/PageHeader";
import { TrashIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Редагування · День 1" };

export default async function EditDay1Page({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;

  const supabase = createClient();
  const { data: record, error } = await supabase
    .from("day1_trends")
    .select("*")
    .eq("id", recordId)
    .eq("project_id", id)
    .returns<Day1Trends[]>()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!record) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        backHref={`/projects/${id}`}
        backLabel="До проєкту"
        eyebrow="День 1 · Тренди"
        title="Редагування запису"
        actions={
          <ConfirmAction
            action={deleteDay1Trends.bind(null, id, recordId)}
            title="Видалити тренди?"
            description="Запис буде видалено назавжди. Дію не можна скасувати."
            trigger={
              <>
                <TrashIcon className="h-4 w-4" />
                Видалити
              </>
            }
            triggerVariant="danger"
            triggerSize="sm"
          />
        }
      />
      <Card className="p-5 sm:p-6">
        <Day1Form projectId={id} record={record} />
      </Card>
    </div>
  );
}
