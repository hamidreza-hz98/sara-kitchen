import Pagination from "@mui/material/Pagination";
import type { PaginationProps } from "@mui/material/Pagination";

export type AppPaginationProps = Omit<PaginationProps, "aria-label"> & {
  label: string;
};

export function AppPagination({ label, ...props }: AppPaginationProps) {
  return <Pagination aria-label={label} shape="rounded" {...props} />;
}
