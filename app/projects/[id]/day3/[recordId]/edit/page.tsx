import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase";
import { deleteDay3Article } from "@/app/actions/day3";
import Day3Form from "@/components/Day3Form";
import type { Day3Article } from "@/lib/day-tables";
import { Card } from "@/components/ui/Card";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { PageHeader } from "@/components/ui/PageHeader";
import { TrashIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Редагування · День 3" };

export default async function EditDay3Page({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;

  const supabase = createClient();
  const { data: record, error } = await supabase
    .from("day3_article")
    .select("*")
    .eq("id", recordId)
    .eq("project_id", id)
    .returns<Day3Article[]>()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!record) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        backHref={`/projects/${id}`}
        backLabel="До проєкту"
        eyebrow="День 3 · Стаття"
        title="Редагування статті"
        actions={
          <ConfirmAction
            action={deleteDay3Article.bind(null, id, recordId)}
            title="Видалити статтю?"
            description="Статтю буде видалено назавжди. Файли ілюстрацій лишаться у Storage. Дію не можна скасувати."
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
        <Day3Form projectId={id} record={record} />
      </Card>
    </div>
  );
}
