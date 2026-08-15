import Day1Form from "@/components/Day1Form";

export default async function NewDay1Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        New Day 1 · Trends record
      </h2>
      <div className="mt-6">
        <Day1Form projectId={id} />
      </div>
    </div>
  );
}
