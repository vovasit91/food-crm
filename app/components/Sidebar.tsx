"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { publishContent } from "@/app/actions/publish";

const links = [
  { href: "/recipes", label: "Recipes" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/tags", label: "Tags" },
  { href: "/kitchen-items", label: "Kitchen Items" },
  { href: "/categories", label: "Categories" },
];

export default function Sidebar({ currentVersion }: { currentVersion: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handlePublish = () => {
    startTransition(async () => {
      await publishContent();
      router.refresh();
    });
  };

  return (
    <nav className="w-52 bg-gray-900 text-white flex flex-col shrink-0">
      <div className="px-4 py-5 font-semibold border-b border-gray-700 text-sm tracking-wide">
        Food CRM
      </div>
      <ul className="px-2 py-3 space-y-0.5 flex-1">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className={`flex items-center px-3 py-2 rounded text-sm transition-colors ${
                pathname.startsWith(href)
                  ? "bg-indigo-600 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="px-4 py-3 border-t border-gray-700 flex items-center gap-3">
        <UserButton
          appearance={{ elements: { avatarBox: "w-7 h-7" } }}
        />
      </div>
      <div className="px-3 pb-4">
        <button
          onClick={handlePublish}
          disabled={isPending}
          className="w-full px-3 py-2 rounded text-sm font-medium transition-colors bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white"
        >
          {isPending ? "Publishing..." : `Publish v${currentVersion + 1}`}
        </button>
      </div>
    </nav>
  );
}
