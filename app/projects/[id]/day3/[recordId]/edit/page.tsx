import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { deleteDay3Assets } from "@/app/actions/day3";
import Day3Form from "@/components/Day3Form";
import type { Day3Assets } from "@/lib/day-tables";

export default async function EditDay3Page({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;

  const supabase = createClient();
  const { data: record, error } = await supabase
    .from("day3_assets")
    .select("*")
    .eq("id", recordId)
    .eq("project_id", id)
    .returns<Day3Assets[]>()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!record) notFound();

  return (
    <div className="max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Edit Day 3 · Assets record
        </h2>
        <form action={deleteDay3Assets.bind(null, id, recordId)}>
          <button
            type="submit"
            className="text-sm font-medium text-red-500 hover:text-red-600"
          >
            Delete
          </button>
        </form>
      </div>
      <div className="mt-6">
        <Day3Form projectId={id} record={record} />
      </div>
    </div>
  );
}
