import { Card } from "@/components/ui/Card";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Завантаження">
      <div className="space-y-3">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-10 w-full max-w-sm rounded-xl" />
      </div>

      <Card className="overflow-hidden">
        <div className="space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-6 w-24 rounded-full" />
              <div className="skeleton h-4 w-24" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
