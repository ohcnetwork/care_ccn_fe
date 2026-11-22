import { ReactNode, useEffect } from "react";

import { CCN_SCOPE } from "@/lib/scope";

interface PageProps {
  /** Shown as the browser tab title; the page renders its own heading. */
  title: string;
  hideTitleOnPage?: boolean;
  className?: string;
  children: ReactNode;
}

/** The host's `Page` frame for a page without a breadcrumb title row. */
export default function Page({ title, className, children }: PageProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className={CCN_SCOPE}>
      <div className={className ?? "py-4"}>{children}</div>
    </div>
  );
}
