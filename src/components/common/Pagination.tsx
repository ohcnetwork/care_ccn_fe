import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useTranslation } from "@/hooks/useTranslation";

interface PaginationProps {
  data: { totalCount: number };
  cPage: number;
  defaultPerPage: number;
  onChange: (page: number) => void;
}

/** Previous / next paging for a limit-offset list. */
export default function Pagination({
  data,
  cPage,
  defaultPerPage,
  onChange,
}: PaginationProps) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(data.totalCount / defaultPerPage));
  if (pages <= 1) return null;
  return (
    <nav
      aria-label={t("ccn_pagination")}
      className="flex items-center justify-center gap-3 py-2 text-sm"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={cPage <= 1}
        onClick={() => onChange(cPage - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden />
        {t("previous")}
      </Button>
      <span className="tabular-nums text-muted-foreground">
        {t("ccn_page_of", { page: cPage, pages })}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={cPage >= pages}
        onClick={() => onChange(cPage + 1)}
      >
        {t("next")}
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}
