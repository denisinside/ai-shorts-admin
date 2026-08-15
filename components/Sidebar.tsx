import Link from "next/link";

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"
      />
    </svg>
  );
}

const navItems = [{ label: "Projects", href: "/", icon: FolderIcon }];

export default function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white">
          A
        </div>
        <span className="text-lg font-semibold text-gray-900">
          AI Shorts
        </span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-xl bg-violet-50 px-3 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-100"
          >
            <item.icon className="h-5 w-5 text-violet-600" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-3 rounded-2xl bg-violet-600 px-3 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white">
          A
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">Admin</p>
          <p className="truncate text-xs text-violet-100">
            admin@aishorts.com
          </p>
        </div>
      </div>
    </aside>
  );
}
