"use client";

import CloseRounded from "@mui/icons-material/CloseRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type RemoteRelationOption = Readonly<{
  id: string;
  label: string;
  secondary?: string;
  status?: "draft" | "scheduled" | "published" | "archived";
  availability?: "available" | "unavailable" | "scheduled";
}>;

type PageMetadata = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;

type RemoteRelationLabels = Readonly<{
  add: string;
  close: string;
  empty: string;
  error: string;
  loading: string;
  remove: string;
  retry: string;
  search: string;
  selectedCount: string;
  self: string;
  statuses: Readonly<Record<NonNullable<RemoteRelationOption["status"]>, string>>;
  availability: Readonly<Record<NonNullable<RemoteRelationOption["availability"]>, string>>;
}>;

export type RemoteRelationSelectorProps = Readonly<{
  endpoint: string;
  excludedIds?: readonly string[];
  initialOptions?: readonly RemoteRelationOption[];
  labels: RemoteRelationLabels;
  pageSize?: number;
  title: string;
  unavailableReason?: string;
  value: readonly string[];
  onChange: (ids: readonly string[]) => void;
  mapOption: (value: unknown) => RemoteRelationOption | null;
  sortBy?: string;
}>;

type Envelope = Readonly<{
  data?: readonly unknown[];
  meta?: Readonly<{ pagination?: PageMetadata }>;
}>;

const FALLBACK_PAGE: PageMetadata = { page: 1, pageSize: 12, totalItems: 0, totalPages: 1 };

function endpointUrl(
  endpoint: string,
  page: number,
  pageSize: number,
  search: string,
  sortBy: string,
): string {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortDirection: "asc",
  });
  if (search.trim().length >= 2) query.set("search", search.trim());
  return `${endpoint}?${query.toString()}`;
}

export function RemoteRelationSelector({
  endpoint,
  excludedIds = [],
  initialOptions = [],
  labels,
  pageSize = 12,
  title,
  unavailableReason,
  value,
  onChange,
  mapOption,
  sortBy = "name",
}: RemoteRelationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState<PageMetadata>(FALLBACK_PAGE);
  const [options, setOptions] = useState<readonly RemoteRelationOption[]>([]);
  const [known, setKnown] = useState<ReadonlyMap<string, RemoteRelationOption>>(
    () => new Map(initialOptions.map((option) => [option.id, option])),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const excluded = useMemo(() => new Set(excludedIds), [excludedIds]);

  useEffect(() => {
    if (!open || unavailableReason) return;
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return null;
        setLoading(true);
        setError(false);
        return fetch(endpointUrl(endpoint, page, pageSize, search, sortBy), {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
      })
      .then(async (response) => {
        if (!response) return null;
        if (!response.ok) throw new Error("relation_options_failed");
        return (await response.json()) as Envelope;
      })
      .then((body) => {
        if (controller.signal.aborted || !body) return;
        const nextOptions = (body.data ?? []).flatMap((item) => {
          const option = mapOption(item);
          return option ? [option] : [];
        });
        setOptions(nextOptions);
        setPageMeta(body.meta?.pagination ?? { ...FALLBACK_PAGE, page, pageSize });
        setKnown((current) => {
          const next = new Map(current);
          nextOptions.forEach((option) => next.set(option.id, option));
          return next;
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, mapOption, open, page, pageSize, revision, search, sortBy, unavailableReason]);

  useEffect(() => {
    if (!open || unavailableReason) return;
    const missing = value.filter((id) => !known.has(id));
    if (missing.length === 0) return;
    const controller = new AbortController();
    void Promise.all(
      missing.map(async (id) => {
        const response = await fetch(`${endpoint}/${encodeURIComponent(id)}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) return null;
        const body = (await response.json()) as Readonly<{ data?: unknown }>;
        return body.data === undefined ? null : mapOption(body.data);
      }),
    )
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setKnown((current) => {
          const next = new Map(current);
          loaded.forEach((option) => {
            if (option) next.set(option.id, option);
          });
          return next;
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [endpoint, known, mapOption, open, unavailableReason, value]);

  const submitSearch = useCallback(() => {
    setPage(1);
    setSearch(searchInput.trim().length >= 2 ? searchInput.trim() : "");
  }, [searchInput]);

  const toggle = useCallback(
    (option: RemoteRelationOption) => {
      if (excluded.has(option.id) || option.status === "archived") return;
      onChange(
        value.includes(option.id) ? value.filter((id) => id !== option.id) : [...value, option.id],
      );
    },
    [excluded, onChange, value],
  );

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Typography component="label" variant="subtitle2">
          {title}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<SearchRounded />}
          disabled={Boolean(unavailableReason)}
          onClick={() => setOpen(true)}
        >
          {labels.add}
        </Button>
      </Stack>

      {value.length > 0 ? (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {value.map((id) => {
            const option = known.get(id);
            return (
              <Chip
                key={id}
                label={option?.label ?? `…${id.slice(-6)}`}
                color={option?.status === "archived" ? "warning" : "default"}
                onDelete={() => onChange(value.filter((selectedId) => selectedId !== id))}
                deleteIcon={
                  <CloseRounded aria-label={`${labels.remove}: ${option?.label ?? id}`} />
                }
              />
            );
          })}
        </Stack>
      ) : (
        <Typography color="text.secondary" variant="body2">
          {labels.empty}
        </Typography>
      )}
      {unavailableReason ? (
        <Typography color="text.secondary" variant="caption">
          {unavailableReason}
        </Typography>
      ) : null}

      <Dialog
        fullWidth
        maxWidth="sm"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{ transition: { onEntered: () => searchRef.current?.focus() } }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Stack
              component="form"
              direction={{ xs: "column", sm: "row" }}
              sx={{ gap: 1 }}
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <TextField
                fullWidth
                inputRef={searchRef}
                label={labels.search}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <Button type="submit" variant="contained">
                {labels.search}
              </Button>
            </Stack>
            <Typography color="text.secondary" variant="caption">
              {labels.selectedCount}
            </Typography>

            {loading ? (
              <Box sx={{ display: "grid", minHeight: 220, placeItems: "center" }}>
                <CircularProgress aria-label={labels.loading} />
              </Box>
            ) : error ? (
              <Stack
                sx={{ alignItems: "center", minHeight: 220, justifyContent: "center", gap: 1 }}
              >
                <Typography role="alert">{labels.error}</Typography>
                <Button onClick={() => setRevision((current) => current + 1)}>
                  {labels.retry}
                </Button>
              </Stack>
            ) : options.length === 0 ? (
              <Box sx={{ display: "grid", minHeight: 220, placeItems: "center" }}>
                <Typography color="text.secondary">{labels.empty}</Typography>
              </Box>
            ) : (
              <List disablePadding sx={{ minHeight: 220 }}>
                {options.map((option) => {
                  const isSelf = excluded.has(option.id);
                  const disabled = isSelf || option.status === "archived";
                  return (
                    <ListItemButton
                      key={option.id}
                      disabled={disabled}
                      selected={value.includes(option.id)}
                      onClick={() => toggle(option)}
                    >
                      <ListItemIcon>
                        <Checkbox
                          edge="start"
                          checked={value.includes(option.id)}
                          disabled={disabled}
                          tabIndex={-1}
                        />
                      </ListItemIcon>
                      <ListItemText primary={option.label} secondary={option.secondary} />
                      <Stack
                        direction="row"
                        sx={{ flexWrap: "wrap", gap: 0.5, justifyContent: "flex-end" }}
                      >
                        {isSelf ? <Chip size="small" label={labels.self} /> : null}
                        {option.status ? (
                          <Chip
                            size="small"
                            color={option.status === "archived" ? "warning" : "default"}
                            label={labels.statuses[option.status]}
                          />
                        ) : null}
                        {option.availability && option.availability !== "available" ? (
                          <Chip
                            size="small"
                            color={option.availability === "unavailable" ? "error" : "info"}
                            label={labels.availability[option.availability]}
                          />
                        ) : null}
                      </Stack>
                    </ListItemButton>
                  );
                })}
              </List>
            )}

            {pageMeta.totalPages > 1 ? (
              <Pagination
                count={pageMeta.totalPages}
                page={pageMeta.page}
                onChange={(_event, nextPage) => setPage(nextPage)}
                sx={{ alignSelf: "center" }}
              />
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{labels.close}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
