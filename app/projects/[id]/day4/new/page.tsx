import Day4Form from "@/components/Day4Form";

export default async function NewDay4Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-2xl rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        New Day 4 · Video record
      </h2>
      <div className="mt-6">
        <Day4Form projectId={id} />
      </div>
    </div>
  );
}
