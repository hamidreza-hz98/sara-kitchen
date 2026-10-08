"use client";

import ArchiveOutlined from "@mui/icons-material/ArchiveOutlined";
import AssignmentIndOutlined from "@mui/icons-material/AssignmentIndOutlined";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import MarkEmailReadOutlined from "@mui/icons-material/MarkEmailReadOutlined";
import MoreHorizRounded from "@mui/icons-material/MoreHorizRounded";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmationDialog } from "@/components/feedback";
import { AppDrawer, AppPagination, EmptyState, ErrorState } from "@/components/ui";
import type { SupportedLocale } from "@/constants";
import { useFeedback } from "@/hooks";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { formatDateTime } from "@/locales/formatters";
import { usePathname, useRouter } from "@/locales/navigation";

type ContactStatus = "new" | "in_progress" | "resolved" | "spam" | "archived";
type InternalNote = Readonly<{
  id: string;
  authorAdminId: string;
  body: string;
  createdAt: string;
}>;
type ContactSubmission = Readonly<{
  id: string;
  fullName: string;
  mobile: string | null;
  email: string | null;
  message: string | null;
  locale: SupportedLocale;
  status: ContactStatus;
  assigneeAdminId: string | null;
  internalNotes: readonly InternalNote[];
  source: Readonly<{
    channel: string;
    pagePath: string | null;
    referrerHost: string | null;
    campaign: string | null;
    requestId: string;
  }> | null;
  spam: Readonly<{ disposition: string; score: number; signals: readonly string[] }>;
  retentionExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}>;
type Assignee = Readonly<{ id: string; displayName: string; role: string }>;
type Pagination = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;
type ListEnvelope = Readonly<{
  data?: readonly ContactSubmission[];
  meta?: Readonly<{ pagination?: Pagination }>;
}>;
type DetailEnvelope = Readonly<{ data?: ContactSubmission }>;
type AssigneeEnvelope = Readonly<{ data?: readonly Assignee[] }>;
type Capabilities = Readonly<{ update: boolean; delete: boolean }>;
type ConfirmAction = Readonly<{ kind: "archive" | "delete"; contact: ContactSubmission }>;

const PAGE_SIZES = [10, 20, 50] as const;
const FILTER_STATUSES = ["new", "in_progress", "resolved", "spam", "archived"] as const;
const EDITABLE_STATUSES = ["new", "in_progress", "resolved", "spam"] as const;

function responseData<T>(body: unknown): T | undefined {
  return typeof body === "object" && body !== null && "data" in body
    ? ((body as { data?: T }).data ?? undefined)
    : undefined;
}

export function ContactManager({ capabilities }: { capabilities: Capabilities }) {
  const t = useTranslations("dashboard.contacts");
  const locale = useLocale() as SupportedLocale;
  const feedback = useFeedback();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawQuery = searchParams.toString();
  const query = useMemo(() => new URLSearchParams(rawQuery), [rawQuery]);
  const page = Math.max(1, Number(query.get("page")) || 1);
  const pageSize = PAGE_SIZES.includes(Number(query.get("pageSize")) as 10 | 20 | 50)
    ? Number(query.get("pageSize"))
    : 20;
  const status = FILTER_STATUSES.includes(query.get("status") as ContactStatus)
    ? (query.get("status") ?? "")
    : "";
  const search = query.get("search") ?? "";
  const selectedId = query.get("submission");
  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const [items, setItems] = useState<readonly ContactSubmission[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<ContactSubmission | null>(null);
  const [assignees, setAssignees] = useState<readonly Assignee[]>([]);
  const [statusDraft, setStatusDraft] = useState<ContactStatus>("new");
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [mutating, setMutating] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuContact, setMenuContact] = useState<ContactSubmission | null>(null);
  const draftSearch = searchDraft ?? search;

  const replaceQuery = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(rawQuery);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (Object.keys(patch).some((key) => key !== "submission")) setLoading(true);
      router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
    },
    [pathname, rawQuery, router],
  );

  useEffect(() => {
    const value = searchDraft?.trim();
    if (value === undefined || value === search || (value.length > 0 && value.length < 2)) return;
    const timer = window.setTimeout(() => {
      setSearchDraft(null);
      replaceQuery({ search: value || null, page: 1 });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [replaceQuery, search, searchDraft]);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortDirection: "desc",
    });
    if (search.length >= 2) parameters.set("search", search);
    if (status) parameters.set("status", status);
    fetch(`/api/contacts?${parameters.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("contact_list_failed");
        return (await response.json()) as ListEnvelope;
      })
      .then((body) => {
        if (!Array.isArray(body.data) || !body.meta?.pagination)
          throw new Error("invalid_contact_list");
        setItems(body.data);
        setPagination(body.meta.pagination);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, pageSize, reload, search, status]);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    fetch(`/api/contacts/${selectedId}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("contact_detail_failed");
        return (await response.json()) as DetailEnvelope;
      })
      .then((body) => {
        if (!body.data) throw new Error("invalid_contact_detail");
        setSelected(body.data);
        setStatusDraft(body.data.status);
        setAssigneeDraft(body.data.assigneeAdminId ?? "");
        setNoteDraft("");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          feedback.notify({ message: t("detailError"), severity: "error" });
          replaceQuery({ submission: null });
        }
      })
      .finally(() => undefined);
    return () => controller.abort();
  }, [feedback, replaceQuery, selectedId, t]);

  useEffect(() => {
    if (!capabilities.update) return;
    const controller = new AbortController();
    fetch("/api/contacts/assignees?page=1&pageSize=100&sortBy=firstName&sortDirection=asc", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("assignees_failed");
        return (await response.json()) as AssigneeEnvelope;
      })
      .then((body) => setAssignees(Array.isArray(body.data) ? body.data : []))
      .catch(() => {
        if (!controller.signal.aborted)
          feedback.notify({ message: t("assigneeError"), severity: "warning" });
      });
    return () => controller.abort();
  }, [capabilities.update, feedback, t]);

  const date = (value: string) => formatDateTime(new Date(value), locale);
  const assigneeName = (id: string | null) =>
    id ? (assignees.find((item) => item.id === id)?.displayName ?? t("assigned")) : t("unassigned");
  const openDetails = (contact: ContactSubmission) => {
    setSelected(contact);
    setStatusDraft(contact.status);
    setAssigneeDraft(contact.assigneeAdminId ?? "");
    setNoteDraft("");
    replaceQuery({ submission: contact.id });
  };
  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuContact(null);
  };
  const mergeContact = (contact: ContactSubmission) => {
    setSelected(contact);
    setStatusDraft(contact.status);
    setAssigneeDraft(contact.assigneeAdminId ?? "");
    setNoteDraft("");
    setItems((current) => current.map((item) => (item.id === contact.id ? contact : item)));
  };
  const mutate = async (path: string, method: "PATCH" | "POST" | "DELETE", body: unknown) => {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: await csrfJsonHeaders("admin"),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as unknown;
  };
  const saveWorkflow = async () => {
    if (!selected || selected.status === "archived") return;
    const update: Record<string, string | null> = {};
    if (statusDraft !== selected.status) update.status = statusDraft;
    if (assigneeDraft !== (selected.assigneeAdminId ?? ""))
      update.assigneeAdminId = assigneeDraft || null;
    if (noteDraft.trim()) update.note = noteDraft.trim();
    if (Object.keys(update).length === 0) {
      feedback.notify({ message: t("nothingToSave"), severity: "info" });
      return;
    }
    setMutating(true);
    try {
      const body = await mutate(`/api/contacts/${selected.id}`, "PATCH", update);
      const contact = responseData<ContactSubmission>(body);
      if (!contact) throw new Error("invalid_contact_update");
      mergeContact(contact);
      setNoteDraft("");
      feedback.notify({ message: t("saveSuccess"), severity: "success" });
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };
  const runConfirm = async () => {
    if (!confirm) return;
    const action = confirm;
    setMutating(true);
    try {
      if (action.kind === "archive") {
        const body = await mutate(`/api/contacts/${action.contact.id}/archive`, "POST", {});
        const contact = responseData<ContactSubmission>(body);
        if (!contact) throw new Error("invalid_archive_response");
        mergeContact(contact);
      } else {
        await mutate(`/api/contacts/${action.contact.id}`, "DELETE", {});
        setItems((current) => current.filter((item) => item.id !== action.contact.id));
        setSelected(null);
        replaceQuery({ submission: null });
      }
      feedback.notify({ message: t(`${action.kind}Success`), severity: "success" });
      setConfirm(null);
      setReload((value) => value + 1);
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };

  const statusChip = (contact: ContactSubmission) => (
    <Chip
      size="small"
      color={
        contact.status === "new"
          ? "error"
          : contact.status === "in_progress"
            ? "info"
            : contact.status === "resolved"
              ? "success"
              : contact.status === "spam"
                ? "warning"
                : "default"
      }
      label={t(`statuses.${contact.status}`)}
    />
  );
  const actionMenu = (contact: ContactSubmission) => (
    <Tooltip title={t("actions")}>
      <IconButton
        aria-label={t("actionsFor", { name: contact.fullName })}
        onClick={(event) => {
          setMenuAnchor(event.currentTarget);
          setMenuContact(contact);
        }}
      >
        <MoreHorizRounded />
      </IconButton>
    </Tooltip>
  );

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        sx={{ justifyContent: "space-between", gap: 2 }}
      >
        <Box>
          <Typography variant="h4" component="h1">
            {t("title")}
          </Typography>
          <Typography color="text.secondary">{t("description")}</Typography>
        </Box>
        <Button startIcon={<RefreshRounded />} onClick={() => setReload((value) => value + 1)}>
          {t("refresh")}
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <TextField
            fullWidth
            value={draftSearch}
            label={t("search")}
            onChange={(event) => setSearchDraft(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }} aria-label={t("statusFilter")}>
            <Button
              size="small"
              variant={status === "" ? "contained" : "outlined"}
              onClick={() => replaceQuery({ status: null, page: 1 })}
            >
              {t("allStatuses")}
            </Button>
            {FILTER_STATUSES.map((value) => (
              <Button
                key={value}
                size="small"
                variant={status === value ? "contained" : "outlined"}
                onClick={() => replaceQuery({ status: value, page: 1 })}
              >
                {t(`statuses.${value}`)}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <ErrorState
          title={t("errorTitle")}
          description={t("errorDescription")}
          action={<Button onClick={() => setReload((value) => value + 1)}>{t("retry")}</Button>}
        />
      ) : loading ? (
        <Stack spacing={1}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={82} />
          ))}
        </Stack>
      ) : items.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          icon={<MarkEmailReadOutlined />}
        />
      ) : (
        <>
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ display: { xs: "none", md: "block" } }}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("sender")}</TableCell>
                  <TableCell>{t("message")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell>{t("assignee")}</TableCell>
                  <TableCell>{t("received")}</TableCell>
                  <TableCell align="right">{t("actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((contact) => (
                  <TableRow key={contact.id} hover>
                    <TableCell>
                      <Button
                        color="inherit"
                        onClick={() => openDetails(contact)}
                        sx={{ p: 0, textAlign: "start", textTransform: "none" }}
                      >
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>{contact.fullName}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {contact.email ?? contact.mobile ?? t("restricted")}
                          </Typography>
                        </Box>
                      </Button>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 330 }}>
                      <Typography variant="body2" noWrap>
                        {contact.message ?? t("restricted")}
                      </Typography>
                    </TableCell>
                    <TableCell>{statusChip(contact)}</TableCell>
                    <TableCell>{assigneeName(contact.assigneeAdminId)}</TableCell>
                    <TableCell>{date(contact.createdAt)}</TableCell>
                    <TableCell align="right">{actionMenu(contact)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
            {items.map((contact) => (
              <Paper key={contact.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" sx={{ alignItems: "flex-start", gap: 1 }}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => openDetails(contact)}
                    sx={{
                      appearance: "none",
                      border: 0,
                      bgcolor: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      flex: 1,
                      minWidth: 0,
                      p: 0,
                      textAlign: "start",
                    }}
                  >
                    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>{contact.fullName}</Typography>
                      {statusChip(contact)}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                      {contact.message ?? t("restricted")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {date(contact.createdAt)} · {assigneeName(contact.assigneeAdminId)}
                    </Typography>
                  </Box>
                  {actionMenu(contact)}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </>
      )}

      {!error && !loading && pagination.totalItems > 0 && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}
        >
          <Typography color="text.secondary">
            {t("results", { count: pagination.totalItems })}
          </Typography>
          <AppPagination
            label={t("pagination")}
            count={pagination.totalPages}
            page={pagination.page}
            onChange={(_event, value) => replaceQuery({ page: value })}
          />
          <FormControl size="small">
            <InputLabel>{t("perPage")}</InputLabel>
            <Select
              label={t("perPage")}
              value={pageSize}
              onChange={(event) => replaceQuery({ pageSize: Number(event.target.value), page: 1 })}
            >
              {PAGE_SIZES.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuContact) openDetails(menuContact);
            closeMenu();
          }}
        >
          {t("viewDetails")}
        </MenuItem>
        {capabilities.update && menuContact?.status !== "archived" && (
          <MenuItem
            onClick={() => {
              if (menuContact) setConfirm({ kind: "archive", contact: menuContact });
              closeMenu();
            }}
          >
            <ArchiveOutlined fontSize="small" sx={{ mr: 1 }} />
            {t("archive")}
          </MenuItem>
        )}
        {capabilities.delete &&
          menuContact &&
          (menuContact.status === "spam" || menuContact.status === "archived") && (
            <MenuItem
              sx={{ color: "error.main" }}
              onClick={() => {
                setConfirm({ kind: "delete", contact: menuContact });
                closeMenu();
              }}
            >
              <DeleteOutlineRounded fontSize="small" sx={{ mr: 1 }} />
              {t("delete")}
            </MenuItem>
          )}
      </Menu>

      <AppDrawer
        open={Boolean(selectedId)}
        title={t("detailTitle")}
        closeLabel={t("close")}
        onClose={() => replaceQuery({ submission: null })}
      >
        {!selected || selected.id !== selectedId ? (
          <Stack spacing={1.5}>
            <Skeleton variant="rounded" height={80} />
            <Skeleton variant="rounded" height={220} />
            <Skeleton variant="rounded" height={140} />
          </Stack>
        ) : (
          <Stack spacing={3}>
            <Box>
              <Typography variant="overline" color="primary.main">
                {t("name")}
              </Typography>
              <Typography variant="h5">{selected.fullName}</Typography>
              <Stack direction="row" sx={{ gap: 1, mt: 1, flexWrap: "wrap" }}>
                {statusChip(selected)}
                <Chip size="small" variant="outlined" label={selected.locale} />
              </Stack>
            </Box>

            <Stack spacing={1.5}>
              {selected.mobile && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}
                  >
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {t("mobile")}
                      </Typography>
                      <Typography>{selected.mobile}</Typography>
                    </Box>
                    <Button
                      component="a"
                      href={`tel:${selected.mobile}`}
                      startIcon={<PhoneOutlined />}
                    >
                      {t("call")}
                    </Button>
                  </Stack>
                </Paper>
              )}
              {selected.email && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t("email")}
                      </Typography>
                      <Typography sx={{ overflowWrap: "anywhere" }}>{selected.email}</Typography>
                    </Box>
                    <Button
                      component="a"
                      href={`mailto:${selected.email}`}
                      startIcon={<EmailOutlined />}
                    >
                      {t("respond")}
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Stack>

            <Box>
              <Typography variant="overline" color="primary.main">
                {t("message")}
              </Typography>
              <Paper variant="outlined" sx={{ bgcolor: "action.hover", mt: 0.5, p: 2.5 }}>
                <Typography component="p" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                  {selected.message ?? t("restricted")}
                </Typography>
              </Paper>
            </Box>

            <Stack spacing={0.75}>
              <Detail label={t("received")} value={date(selected.createdAt)} />
              <Detail label={t("updated")} value={date(selected.updatedAt)} />
              <Detail label={t("retentionUntil")} value={date(selected.retentionExpiresAt)} />
              {selected.source?.pagePath && (
                <Detail label={t("sourcePage")} value={selected.source.pagePath} />
              )}
            </Stack>

            {capabilities.update && selected.status !== "archived" && (
              <>
                <Divider />
                <Stack spacing={2}>
                  <Typography variant="h6">{t("workflow")}</Typography>
                  <FormControl fullWidth>
                    <InputLabel>{t("status")}</InputLabel>
                    <Select
                      label={t("status")}
                      value={statusDraft}
                      onChange={(event) => setStatusDraft(event.target.value as ContactStatus)}
                    >
                      {EDITABLE_STATUSES.map((value) => (
                        <MenuItem key={value} value={value}>
                          {t(`statuses.${value}`)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>{t("assignee")}</InputLabel>
                    <Select
                      label={t("assignee")}
                      value={assigneeDraft}
                      onChange={(event) => setAssigneeDraft(event.target.value)}
                      startAdornment={<AssignmentIndOutlined sx={{ mr: 1 }} />}
                    >
                      <MenuItem value="">{t("unassigned")}</MenuItem>
                      {assignees.map((assignee) => (
                        <MenuItem key={assignee.id} value={assignee.id}>
                          {assignee.displayName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    multiline
                    minRows={3}
                    value={noteDraft}
                    label={t("newNote")}
                    slotProps={{ htmlInput: { maxLength: 2_000 } }}
                    helperText={t("noteHelp", { count: noteDraft.length })}
                    onChange={(event) => setNoteDraft(event.target.value)}
                  />
                  <Button
                    variant="contained"
                    disabled={mutating}
                    onClick={() => void saveWorkflow().catch(() => undefined)}
                  >
                    {mutating ? t("saving") : t("saveWorkflow")}
                  </Button>
                </Stack>
              </>
            )}

            {selected.internalNotes.length > 0 && (
              <Stack spacing={1.5}>
                <Divider />
                <Typography variant="h6">{t("notes")}</Typography>
                {selected.internalNotes.map((note) => (
                  <Paper key={note.id} variant="outlined" sx={{ p: 2 }}>
                    <Typography
                      component="p"
                      sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                    >
                      {note.body}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {date(note.createdAt)}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            )}

            {(capabilities.update || capabilities.delete) && (
              <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
                {capabilities.update && selected.status !== "archived" && (
                  <Button
                    color="warning"
                    startIcon={<ArchiveOutlined />}
                    onClick={() => setConfirm({ kind: "archive", contact: selected })}
                  >
                    {t("archive")}
                  </Button>
                )}
                {capabilities.delete &&
                  (selected.status === "spam" || selected.status === "archived") && (
                    <Button
                      color="error"
                      startIcon={<DeleteOutlineRounded />}
                      onClick={() => setConfirm({ kind: "delete", contact: selected })}
                    >
                      {t("delete")}
                    </Button>
                  )}
              </Stack>
            )}
          </Stack>
        )}
      </AppDrawer>

      <ConfirmationDialog
        open={confirm !== null}
        danger={confirm?.kind === "delete"}
        loading={mutating}
        title={confirm ? t(`${confirm.kind}Title`) : ""}
        description={
          confirm ? t(`${confirm.kind}Description`, { name: confirm.contact.fullName }) : ""
        }
        confirmLabel={confirm ? t(`${confirm.kind}Confirm`) : t("confirm")}
        cancelLabel={t("cancel")}
        closeLabel={t("close")}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirm().catch(() => undefined)}
      />
    </Stack>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", gap: 2 }}>
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ textAlign: "end", overflowWrap: "anywhere" }}>{value}</Typography>
    </Stack>
  );
}
