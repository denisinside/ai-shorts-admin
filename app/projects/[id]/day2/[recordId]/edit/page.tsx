import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { deleteDay2Plan } from "@/app/actions/day2";
import Day2Form from "@/components/Day2Form";
import type { Day2Plan } from "@/lib/day-tables";

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
    <div className="max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Edit Day 2 · Plan record
        </h2>
        <form action={deleteDay2Plan.bind(null, id, recordId)}>
          <button
            type="submit"
            className="text-sm font-medium text-red-500 hover:text-red-600"
          >
            Delete
          </button>
        </form>
      </div>
      <div className="mt-6">
        <Day2Form projectId={id} record={record} />
      </div>
    </div>
  );
}
