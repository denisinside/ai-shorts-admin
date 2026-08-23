import type { Metadata } from "next";
import { createProject } from "@/app/actions/projects";
import ProjectForm from "@/components/ProjectForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Новий проєкт" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        backHref="/"
        backLabel="Усі проєкти"
        eyebrow="Проєкт"
        title="Новий проєкт"
      />
      <Card className="p-5 sm:p-6">
        <ProjectForm action={createProject} submitLabel="Створити проєкт" />
      </Card>
    </div>
  );
}
