import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase";
import { deleteProject, updateProject } from "@/app/actions/projects";
import type { Project } from "@/lib/projects";
import ProjectForm from "@/components/ProjectForm";
import { Card } from "@/components/ui/Card";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { PageHeader } from "@/components/ui/PageHeader";
import { TrashIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Редагування проєкту" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .returns<Project[]>()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        backHref={`/projects/${id}`}
        backLabel="До проєкту"
        eyebrow="Проєкт"
        title={project.niche}
        actions={
          <ConfirmAction
            action={deleteProject.bind(null, id)}
            title="Видалити проєкт?"
            description={
              <>
                Проєкт «{project.niche}» і всі пов&apos;язані записи днів буде
                видалено назавжди.
              </>
            }
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
        <ProjectForm
          action={updateProject.bind(null, id)}
          project={project}
          submitLabel="Зберегти зміни"
        />
      </Card>
    </div>
  );
}
