import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase";
import { deleteDay4Video } from "@/app/actions/day4";
import Day4Form from "@/components/Day4Form";
import type { Day4Video } from "@/lib/day-tables";
import { Card } from "@/components/ui/Card";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { PageHeader } from "@/components/ui/PageHeader";
import { TrashIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Редагування · День 4" };

export default async function EditDay4Page({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;

  const supabase = createClient();
  const { data: record, error } = await supabase
    .from("day4_video")
    .select("*")
    .eq("id", recordId)
    .eq("project_id", id)
    .returns<Day4Video[]>()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!record) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        backHref={`/projects/${id}`}
        backLabel="До проєкту"
        eyebrow="День 4 · Відео"
        title="Редагування запису"
        actions={
          <ConfirmAction
            action={deleteDay4Video.bind(null, id, recordId)}
            title="Видалити відео?"
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
        <Day4Form projectId={id} record={record} />
      </Card>
    </div>
  );
}
