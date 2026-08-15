import Day2Form from "@/components/Day2Form";

export default async function NewDay2Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        New Day 2 · Plan record
      </h2>
      <div className="mt-6">
        <Day2Form projectId={id} />
      </div>
    </div>
  );
}
