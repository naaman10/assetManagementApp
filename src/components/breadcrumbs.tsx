import Link from "next/link";

export function Breadcrumbs({
  items,
  current = false,
}: {
  items: Array<{ label: string; href?: string }>;
  current?: boolean;
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <li key={`${item.href ?? item.label}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 ? <Separator /> : null}
              {item.href && !last ? (
                <Link href={item.href} className="text-sm text-gray-500 hover:text-gray-800">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={`text-sm ${last ? "font-medium text-gray-800" : "text-gray-500"}`}
                  aria-current={current && last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Separator() {
  return (
    <svg
      viewBox="0 0 17 16"
      className="size-4 text-gray-400"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.076 12.667 10.243 8.5 6.076 4.334"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
