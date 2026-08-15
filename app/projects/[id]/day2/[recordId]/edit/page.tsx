import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase";
import { deleteDay2Plan } from "@/app/actions/day2";
import Day2Form from "@/components/Day2Form";
import type { Day2Plan } from "@/lib/day-tables";
import { Card } from "@/components/ui/Card";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { PageHeader } from "@/components/ui/PageHeader";
import { TrashIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Редагування · День 2" };

export default async function EditDay2Page({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;

  const supabase = createClient();
  const { data: record, error } = await supabase
    .from("day2_plan")
    .select("*")
    .eq("id", recordId)
    .eq("project_id", id)
    .returns<Day2Plan[]>()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!record) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        backHref={`/projects/${id}`}
        backLabel="До проєкту"
        eyebrow="День 2 · План"
        title="Редагування запису"
        actions={
          <ConfirmAction
            action={deleteDay2Plan.bind(null, id, recordId)}
            title="Видалити план?"
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
        <Day2Form projectId={id} record={record} />
      </Card>
    </div>
  );
}
