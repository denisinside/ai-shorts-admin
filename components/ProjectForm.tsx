import {
  PLATFORMS,
  PLATFORM_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Project,
} from "@/lib/projects";
import { SelectField, TextField } from "./ui/Field";
import { LinkButton } from "./ui/Button";
import { SubmitButton } from "./ui/SubmitButton";

const PLATFORM_OPTIONS = PLATFORMS.map((value) => ({
  value,
  label: PLATFORM_LABELS[value],
}));

const STATUS_OPTIONS = STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

/** Одна форма на створення й редагування — раніше це були дві копії. */
export default function ProjectForm({
  action,
  project,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  project?: Project;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-5">
      <TextField
        label="Ніша"
        name="niche"
        required
        defaultValue={project?.niche}
        placeholder="напр. Поради з особистих фінансів"
        hint="Тема, навколо якої пайплайн шукатиме тренди"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Платформа"
          name="platform"
          options={PLATFORM_OPTIONS}
          defaultValue={project?.platform ?? PLATFORMS[0]}
        />
        <SelectField
          label="Статус"
          name="status"
          options={STATUS_OPTIONS}
          defaultValue={project?.status ?? STATUSES[0]}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-white/6 pt-5">
        <SubmitButton pendingLabel="Зберігаємо…">{submitLabel}</SubmitButton>
        <LinkButton href={project ? `/projects/${project.id}` : "/"} variant="ghost">
          Скасувати
        </LinkButton>
      </div>
    </form>
  );
}
