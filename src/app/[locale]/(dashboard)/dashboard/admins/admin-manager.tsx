"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import BlockRounded from "@mui/icons-material/BlockRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import KeyRounded from "@mui/icons-material/KeyRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import VerifiedUserRounded from "@mui/icons-material/VerifiedUserRounded";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
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
import { AppPagination, EmptyState, ErrorState } from "@/components/ui";
import { ADMIN_ROLES, type AdminRole } from "@/constants/admin-access";
import { useFeedback } from "@/hooks";
import { csrfJsonHeaders } from "@/lib/csrf-client";
import { Link, usePathname, useRouter } from "@/locales/navigation";

type Admin = Readonly<{
  id: string;
  firstName: string;
  lastName: string;
  identifier: string | null;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;
type Pagination = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;
type Envelope = Readonly<{
  data?: readonly Admin[];
  meta?: Readonly<{ pagination?: Pagination }>;
}>;
type Capabilities = Readonly<{
  create: boolean;
  update: boolean;
  assignRole: boolean;
  disable: boolean;
  delete: boolean;
}>;
type FormValues = Readonly<{
  firstName: string;
  lastName: string;
  identifier: string;
  role: AdminRole;
  password: string;
}>;
type ConfirmAction = Readonly<{
  kind: "disable" | "delete" | "sessions";
  admin: Admin;
}>;

const PAGE_SIZES = [10, 20, 50] as const;
const SORTS = [
  "createdAt:desc",
  "createdAt:asc",
  "firstName:asc",
  "firstName:desc",
  "identifier:asc",
  "lastLoginAt:desc",
] as const;
const STATUSES = ["active", "disabled", "deleted"] as const;
const SORT_LABELS = {
  "createdAt:desc": "sorts.createdAt_desc",
  "createdAt:asc": "sorts.createdAt_asc",
  "firstName:asc": "sorts.firstName_asc",
  "firstName:desc": "sorts.firstName_desc",
  "identifier:asc": "sorts.identifier_asc",
  "lastLoginAt:desc": "sorts.lastLoginAt_desc",
} as const;
const EMPTY_FORM: FormValues = {
  firstName: "",
  lastName: "",
  identifier: "",
  role: "viewer",
  password: "",
};

function formFor(admin: Admin | null): FormValues {
  return admin
    ? {
        firstName: admin.firstName,
        lastName: admin.lastName,
        identifier: admin.identifier ?? "",
        role: admin.role,
        password: "",
      }
    : EMPTY_FORM;
}

export function AdminManager({
  currentAdminId,
  capabilities,
}: {
  currentAdminId: string;
  capabilities: Capabilities;
}) {
  const t = useTranslations("dashboard.admins");
  const locale = useLocale();
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
  const role = ADMIN_ROLES.includes(query.get("role") as AdminRole)
    ? (query.get("role") ?? "")
    : "";
  const status = STATUSES.includes(query.get("status") as (typeof STATUSES)[number])
    ? (query.get("status") ?? "")
    : "";
  const sort = SORTS.includes(query.get("sort") as (typeof SORTS)[number])
    ? (query.get("sort") ?? SORTS[0])
    : SORTS[0];
  const search = query.get("search") ?? "";
  const [searchDraft, setSearchDraft] = useState<string | null>(null);
  const [items, setItems] = useState<readonly Admin[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<Admin | "new" | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<FormValues>(EMPTY_FORM);
  const [attempted, setAttempted] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [resetting, setResetting] = useState<Admin | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [mutating, setMutating] = useState(false);
  const draftSearch = searchDraft ?? search;
  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  const replaceQuery = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(rawQuery);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      setLoading(true);
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
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search.length >= 2) params.set("search", search);
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    const [sortBy, sortDirection] = sort.split(":");
    params.set("sortBy", sortBy ?? "createdAt");
    params.set("sortDirection", sortDirection ?? "desc");
    fetch(`/api/admins?${params.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("admin_list_failed");
        return (await response.json()) as Envelope;
      })
      .then((body) => {
        if (!Array.isArray(body.data) || !body.meta?.pagination)
          throw new Error("invalid_admin_list");
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
  }, [page, pageSize, reload, role, search, sort, status]);

  const openEditor = (value: Admin | "new") => {
    const next = formFor(value === "new" ? null : value);
    setEditing(value);
    setForm(next);
    setInitialForm(next);
    setAttempted(false);
  };
  const closeEditor = () => {
    if (dirty && !window.confirm(t("discardChanges"))) return;
    setEditing(null);
  };
  const mutate = async (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: await csrfJsonHeaders("admin"),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(String(response.status));
    return response;
  };
  const save = async () => {
    setAttempted(true);
    if (
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.identifier.trim() ||
      (editing === "new" && form.password.length < 12)
    )
      return;
    setMutating(true);
    try {
      const body =
        editing === "new"
          ? form
          : {
              firstName: form.firstName,
              lastName: form.lastName,
              identifier: form.identifier,
              role: form.role,
            };
      await mutate(
        editing === "new" ? "/api/admins" : `/api/admins/${editing?.id}`,
        editing === "new" ? "POST" : "PATCH",
        body,
      );
      feedback.notify({
        message: t(editing === "new" ? "createSuccess" : "updateSuccess"),
        severity: "success",
      });
      setEditing(null);
      setReload((value) => value + 1);
    } catch {
      feedback.notify({ message: t("saveError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };
  const runConfirm = async () => {
    if (!confirm) return;
    setMutating(true);
    try {
      const { admin, kind } = confirm;
      if (kind === "disable") await mutate(`/api/admins/${admin.id}/disable`, "POST", {});
      else if (kind === "sessions") await mutate(`/api/admins/${admin.id}/sessions`, "POST", {});
      else await mutate(`/api/admins/${admin.id}`, "DELETE");
      feedback.notify({ message: t(`${kind}Success`), severity: "success" });
      setConfirm(null);
      setReload((value) => value + 1);
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };
  const reactivate = async (admin: Admin) => {
    setMutating(true);
    try {
      await mutate(`/api/admins/${admin.id}/reactivate`, "POST", {});
      feedback.notify({ message: t("reactivateSuccess"), severity: "success" });
      setReload((value) => value + 1);
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };
  const resetCredential = async () => {
    if (!resetting || newPassword.length < 12) return;
    setMutating(true);
    try {
      await mutate(`/api/admins/${resetting.id}/reset-credential`, "POST", {
        password: newPassword,
      });
      feedback.notify({ message: t("resetSuccess"), severity: "success" });
      setResetting(null);
      setNewPassword("");
    } catch {
      feedback.notify({ message: t("actionError"), severity: "error" });
    } finally {
      setMutating(false);
    }
  };

  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(value),
        )
      : t("never");
  const statusChip = (admin: Admin) => (
    <Chip
      size="small"
      color={admin.deletedAt ? "default" : admin.active ? "success" : "warning"}
      label={t(`statuses.${admin.deletedAt ? "deleted" : admin.active ? "active" : "disabled"}`)}
    />
  );
  const actions = (admin: Admin) => {
    const self = admin.id === currentAdminId;
    return (
      <Stack direction="row" spacing={0.25} sx={{ justifyContent: "flex-end" }}>
        {capabilities.update && !admin.deletedAt && (
          <Tooltip title={t("edit")}>
            <IconButton
              aria-label={t("editAdmin", { name: `${admin.firstName} ${admin.lastName}` })}
              onClick={() => openEditor(admin)}
            >
              <EditRounded />
            </IconButton>
          </Tooltip>
        )}
        {capabilities.update && !admin.deletedAt && (
          <Tooltip title={t("resetCredential")}>
            <IconButton
              aria-label={t("resetFor", { name: admin.firstName })}
              onClick={() => {
                setResetting(admin);
                setNewPassword("");
              }}
            >
              <KeyRounded />
            </IconButton>
          </Tooltip>
        )}
        {capabilities.update && !admin.deletedAt && (
          <Tooltip title={self ? t("mySessions") : t("revokeSessions")}>
            <IconButton
              component={self ? Link : "button"}
              href={self ? "/dashboard/sessions" : undefined}
              aria-label={self ? t("mySessions") : t("revokeFor", { name: admin.firstName })}
              onClick={self ? undefined : () => setConfirm({ kind: "sessions", admin })}
            >
              <LogoutRounded />
            </IconButton>
          </Tooltip>
        )}
        {capabilities.disable &&
          !self &&
          !admin.deletedAt &&
          (admin.active ? (
            <Tooltip title={t("disable")}>
              <IconButton
                color="warning"
                aria-label={t("disableAdmin", { name: admin.firstName })}
                onClick={() => setConfirm({ kind: "disable", admin })}
              >
                <BlockRounded />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title={t("reactivate")}>
              <IconButton
                color="success"
                aria-label={t("reactivateAdmin", { name: admin.firstName })}
                onClick={() => {
                  void reactivate(admin).catch(() => undefined);
                }}
              >
                <VerifiedUserRounded />
              </IconButton>
            </Tooltip>
          ))}
        {capabilities.delete && !self && !admin.active && !admin.deletedAt && (
          <Tooltip title={t("delete")}>
            <IconButton
              color="error"
              aria-label={t("deleteAdmin", { name: admin.firstName })}
              onClick={() => setConfirm({ kind: "delete", admin })}
            >
              <DeleteOutlineRounded />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    );
  };

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
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<RefreshRounded />}
            onClick={() => {
              setLoading(true);
              setReload((value) => value + 1);
            }}
          >
            {t("refresh")}
          </Button>
          {capabilities.create && (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => openEditor("new")}
            >
              {t("add")}
            </Button>
          )}
        </Stack>
      </Stack>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2 }}>
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
          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel>{t("role")}</InputLabel>
            <Select
              label={t("role")}
              value={role}
              onChange={(event) => replaceQuery({ role: event.target.value || null, page: 1 })}
            >
              <MenuItem value="">{t("allRoles")}</MenuItem>
              {ADMIN_ROLES.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`roles.${value}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 160 }}>
            <InputLabel>{t("status")}</InputLabel>
            <Select
              label={t("status")}
              value={status}
              onChange={(event) => replaceQuery({ status: event.target.value || null, page: 1 })}
            >
              <MenuItem value="">{t("allStatuses")}</MenuItem>
              {STATUSES.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(`statuses.${value}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 190 }}>
            <InputLabel>{t("sort")}</InputLabel>
            <Select
              label={t("sort")}
              value={sort}
              onChange={(event) => replaceQuery({ sort: event.target.value, page: 1 })}
            >
              {SORTS.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(SORT_LABELS[value])}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>
      {error ? (
        <ErrorState
          title={t("errorTitle")}
          description={t("errorDescription")}
          action={
            <Button
              onClick={() => {
                setLoading(true);
                setReload((value) => value + 1);
              }}
            >
              {t("retry")}
            </Button>
          }
        />
      ) : loading ? (
        <Stack spacing={1}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} variant="rounded" height={74} />
          ))}
        </Stack>
      ) : items.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          icon={<PersonRounded />}
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
                  <TableCell>{t("administrator")}</TableCell>
                  <TableCell>{t("role")}</TableCell>
                  <TableCell>{t("status")}</TableCell>
                  <TableCell>{t("lastLogin")}</TableCell>
                  <TableCell align="right">{t("actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((admin) => (
                  <TableRow key={admin.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                        <Avatar>
                          {admin.firstName[0]}
                          {admin.lastName[0]}
                        </Avatar>
                        <Box>
                          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                            <Typography sx={{ fontWeight: 700 }}>
                              {admin.firstName} {admin.lastName}
                            </Typography>
                            {admin.id === currentAdminId && <Chip size="small" label={t("you")} />}
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {admin.identifier ?? t("restricted")}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{t(`roles.${admin.role}`)}</TableCell>
                    <TableCell>{statusChip(admin)}</TableCell>
                    <TableCell>{date(admin.lastLoginAt)}</TableCell>
                    <TableCell align="right">{actions(admin)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack spacing={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
            {items.map((admin) => (
              <Paper key={admin.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" spacing={1.5}>
                  <Avatar>
                    {admin.firstName[0]}
                    {admin.lastName[0]}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {admin.firstName} {admin.lastName}
                      {admin.id === currentAdminId ? ` · ${t("you")}` : ""}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {admin.identifier ?? t("restricted")}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      {statusChip(admin)}
                      <Chip size="small" variant="outlined" label={t(`roles.${admin.role}`)} />
                    </Stack>
                  </Box>
                </Stack>
                {actions(admin)}
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

      <Dialog open={editing !== null} onClose={closeEditor} fullWidth maxWidth="sm">
        <DialogTitle>{t(editing === "new" ? "createTitle" : "editTitle")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              label={t("firstName")}
              value={form.firstName}
              error={attempted && !form.firstName.trim()}
              required
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
            <TextField
              label={t("lastName")}
              value={form.lastName}
              error={attempted && !form.lastName.trim()}
              required
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
            <TextField
              label={t("identifier")}
              value={form.identifier}
              error={attempted && !form.identifier.trim()}
              required
              onChange={(event) => setForm({ ...form, identifier: event.target.value })}
            />
            <FormControl>
              <InputLabel>{t("role")}</InputLabel>
              <Select
                label={t("role")}
                value={form.role}
                disabled={!capabilities.assignRole}
                onChange={(event) => setForm({ ...form, role: event.target.value as AdminRole })}
              >
                {ADMIN_ROLES.map((value) => (
                  <MenuItem key={value} value={value}>
                    {t(`roles.${value}`)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {editing === "new" && (
              <TextField
                type="password"
                label={t("password")}
                value={form.password}
                error={attempted && form.password.length < 12}
                helperText={t("passwordHelp")}
                required
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={mutating} onClick={closeEditor}>
            {t("cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={mutating}
            onClick={() => {
              void save().catch(() => undefined);
            }}
          >
            {mutating ? t("saving") : t("save")}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog
        open={confirm !== null}
        danger={confirm?.kind !== "sessions"}
        loading={mutating}
        title={confirm ? t(`${confirm.kind}Title`) : ""}
        description={
          confirm
            ? t(`${confirm.kind}Description`, {
                name: `${confirm.admin.firstName} ${confirm.admin.lastName}`,
              })
            : ""
        }
        confirmLabel={confirm ? t(`${confirm.kind}Confirm`) : t("confirm")}
        cancelLabel={t("cancel")}
        closeLabel={t("close")}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void runConfirm().catch(() => undefined);
        }}
      />
      <ConfirmationDialog
        open={resetting !== null}
        danger
        loading={mutating}
        title={t("resetTitle")}
        description={
          resetting
            ? t("resetDescription", { name: `${resetting.firstName} ${resetting.lastName}` })
            : ""
        }
        confirmLabel={t("resetConfirm")}
        cancelLabel={t("cancel")}
        closeLabel={t("close")}
        onCancel={() => {
          setResetting(null);
          setNewPassword("");
        }}
        onConfirm={() => {
          void resetCredential().catch(() => undefined);
        }}
      >
        <TextField
          fullWidth
          autoFocus
          type="password"
          label={t("newPassword")}
          value={newPassword}
          error={newPassword.length > 0 && newPassword.length < 12}
          helperText={t("passwordHelp")}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </ConfirmationDialog>
    </Stack>
  );
}
