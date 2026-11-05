"use client";

import AddRounded from "@mui/icons-material/AddRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { MediaPicker } from "@/components/media";

type RecordValue = Record<string, unknown>;
type Translator = (key: string, values?: Record<string, string | number>) => string;
type AboutCollection = "teamMembers" | "values" | "storySections" | "callsToAction";
type AboutTab = "media" | AboutCollection;
const ABOUT_ID_PREFIX: Record<AboutCollection, string> = {
  teamMembers: "team-member",
  values: "value",
  storySections: "story",
  callsToAction: "about-link",
};

function record(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function list(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function moveItem(items: readonly RecordValue[], index: number, offset: number): RecordValue[] {
  const target = index + offset;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next.map((item, order) => ({ ...item, order }));
}

function AboutPanel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ gap: 1, alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
          {action}
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}

function AboutItem({
  title,
  enabled,
  index,
  count,
  expanded,
  canEdit,
  labels,
  onExpandedChange,
  onMove,
  onRemove,
  children,
}: {
  title: string;
  enabled: boolean;
  index: number;
  count: number;
  expanded: boolean;
  canEdit: boolean;
  labels: { moveUp: string; moveDown: string; remove: string; active: string; hidden: string };
  onExpandedChange: (expanded: boolean) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={(_, nextExpanded) => onExpandedChange(nextExpanded)}
      sx={{
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRounded />}>
        <Stack direction="row" sx={{ minWidth: 0, alignItems: "center", gap: 1, flex: 1, pe: 1 }}>
          <Typography noWrap sx={{ minWidth: 0, fontWeight: 700 }}>
            {title}
          </Typography>
          <Chip
            size="small"
            color={enabled ? "success" : "default"}
            label={enabled ? labels.active : labels.hidden}
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            sx={{ justifyContent: "flex-end", alignItems: "center", gap: 0.5 }}
          >
            <IconButton
              size="small"
              aria-label={labels.moveUp}
              disabled={!canEdit || index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUpwardRounded fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={labels.moveDown}
              disabled={!canEdit || index === count - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDownwardRounded fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              aria-label={labels.remove}
              disabled={!canEdit}
              onClick={onRemove}
            >
              <DeleteOutlineRounded fontSize="small" />
            </IconButton>
          </Stack>
          {children}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

export function AboutSettingsForm({
  data,
  labelsTranslation,
  canEdit,
  canUploadMedia,
  onChange,
}: {
  data: RecordValue;
  labelsTranslation: RecordValue;
  canEdit: boolean;
  canUploadMedia: boolean;
  onChange: (value: RecordValue) => void;
}) {
  const translator = useTranslations("dashboard.settingsEditor.forms");
  const t = translator as unknown as Translator;
  const direction = useLocale() === "fa" ? "rtl" : "ltr";
  const [tab, setTab] = useState<AboutTab>("media");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const kitchenMediaIds = Array.isArray(data.kitchenMediaIds)
    ? data.kitchenMediaIds.map(String)
    : [];
  const items: Record<AboutCollection, RecordValue[]> = {
    teamMembers: list(data.teamMembers).sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)),
    values: list(data.values).sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)),
    storySections: list(data.storySections).sort(
      (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0),
    ),
    callsToAction: list(data.callsToAction).sort(
      (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0),
    ),
  };
  const update = (patch: RecordValue) => onChange({ ...data, ...patch });
  const updateCollection = (key: AboutCollection, next: RecordValue[]) =>
    update({ [key]: next.map((item, order) => ({ ...item, order })) });
  const tabs: readonly { value: AboutTab; title: string; count?: number }[] = [
    {
      value: "media",
      title: t("aboutHero"),
      count: kitchenMediaIds.length + (data.heroMediaId ? 1 : 0),
    },
    { value: "teamMembers", title: t("aboutTeam"), count: items.teamMembers.length },
    { value: "values", title: t("aboutValues"), count: items.values.length },
    { value: "storySections", title: t("aboutStories"), count: items.storySections.length },
    { value: "callsToAction", title: t("aboutActions"), count: items.callsToAction.length },
  ];
  const itemTitle = (collection: AboutCollection, item: RecordValue, index: number) => {
    const id = String(item.id ?? "");
    const translationRows = list(labelsTranslation[collection]);
    const translationRow = translationRows.find((row) => String(row.id ?? "") === id);
    const textKey =
      collection === "teamMembers"
        ? "name"
        : collection === "values"
          ? "title"
          : collection === "storySections"
            ? "title"
            : "label";
    const name = String(translationRow?.[textKey] ?? "").trim();
    return name || t("itemNumber", { number: index + 1 });
  };
  const itemLabels = {
    moveUp: t("moveUp"),
    moveDown: t("moveDown"),
    remove: t("remove"),
    active: t("active"),
    hidden: t("visibilityHidden"),
  };
  const addItem = (collection: AboutCollection) => {
    const current = items[collection];
    const order = current.length;
    const id = createId(ABOUT_ID_PREFIX[collection]);
    const base = { id, enabled: true, order };
    const nextItem =
      collection === "teamMembers"
        ? { ...base, portraitMediaId: "" }
        : collection === "values"
          ? { ...base, iconMediaId: null }
          : collection === "storySections"
            ? { ...base, mediaId: null, mediaPlacement: "end" }
            : { ...base, href: "/menu", openInNewTab: false, variant: "primary" };
    updateCollection(collection, [...current, nextItem]);
    setExpandedItemId(id);
  };

  return (
    <Stack spacing={2.5} dir={direction}>
      <Paper variant="outlined" sx={{ px: { xs: 1, md: 1.5 }, minWidth: 0 }}>
        <Tabs
          value={tab}
          onChange={(_, value: AboutTab) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={t("aboutEditorTabs")}
        >
          {tabs.map((entry) => (
            <Tab
              key={entry.value}
              value={entry.value}
              label={
                <Stack direction="row" sx={{ alignItems: "center", gap: 0.75 }}>
                  <span>{entry.title}</span>
                  <Chip size="small" label={entry.count ?? 0} />
                </Stack>
              }
            />
          ))}
        </Tabs>
      </Paper>

      {tab === "media" ? (
        <AboutPanel title={t("aboutHero")} description={t("aboutHeroHelp")}>
          <MediaPicker
            allowedKinds={["image"]}
            canUpload={canUploadMedia}
            disabled={!canEdit}
            label={t("heroImage")}
            value={typeof data.heroMediaId === "string" ? data.heroMediaId : null}
            onChange={(heroMediaId) => update({ heroMediaId })}
          />
          <MediaPicker
            multiple
            maxItems={12}
            allowedKinds={["image"]}
            canUpload={canUploadMedia}
            disabled={!canEdit}
            label={t("kitchenGallery")}
            value={kitchenMediaIds}
            onChange={(next) => update({ kitchenMediaIds: next })}
          />
        </AboutPanel>
      ) : null}

      {tab === "teamMembers" ? (
        <AboutPanel
          title={t("aboutTeam")}
          description={t("aboutTeamHelp")}
          action={
            <Button
              startIcon={<AddRounded />}
              variant="outlined"
              disabled={!canEdit || items.teamMembers.length >= 20}
              onClick={() => addItem("teamMembers")}
            >
              {t("addTeamMember")}
            </Button>
          }
        >
          {items.teamMembers.length ? (
            <Stack spacing={1}>
              {items.teamMembers.map((item, index) => (
                <AboutItem
                  key={String(item.id)}
                  title={itemTitle("teamMembers", item, index)}
                  enabled={Boolean(item.enabled)}
                  index={index}
                  count={items.teamMembers.length}
                  expanded={expandedItemId === String(item.id)}
                  canEdit={canEdit}
                  labels={itemLabels}
                  onExpandedChange={(expanded) =>
                    setExpandedItemId(expanded ? String(item.id) : null)
                  }
                  onMove={(offset) =>
                    updateCollection("teamMembers", moveItem(items.teamMembers, index, offset))
                  }
                  onRemove={() =>
                    updateCollection(
                      "teamMembers",
                      items.teamMembers.filter((_, position) => position !== index),
                    )
                  }
                >
                  <MediaPicker
                    allowedKinds={["image"]}
                    canUpload={canUploadMedia}
                    disabled={!canEdit}
                    label={t("teamPortrait")}
                    value={String(item.portraitMediaId ?? "") || null}
                    onChange={(portraitMediaId) =>
                      updateCollection(
                        "teamMembers",
                        items.teamMembers.map((row, position) =>
                          position === index
                            ? { ...row, portraitMediaId: portraitMediaId ?? "" }
                            : row,
                        ),
                      )
                    }
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(item.enabled)}
                        disabled={!canEdit}
                        onChange={(event) =>
                          updateCollection(
                            "teamMembers",
                            items.teamMembers.map((row, position) =>
                              position === index ? { ...row, enabled: event.target.checked } : row,
                            ),
                          )
                        }
                      />
                    }
                    label={t("active")}
                  />
                </AboutItem>
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary" variant="body2">
              {t("aboutEmptyTeam")}
            </Typography>
          )}
        </AboutPanel>
      ) : null}

      {tab === "values" ? (
        <AboutPanel
          title={t("aboutValues")}
          description={t("aboutValuesHelp")}
          action={
            <Button
              startIcon={<AddRounded />}
              variant="outlined"
              disabled={!canEdit || items.values.length >= 12}
              onClick={() => addItem("values")}
            >
              {t("addValue")}
            </Button>
          }
        >
          {items.values.length ? (
            <Stack spacing={1}>
              {items.values.map((item, index) => (
                <AboutItem
                  key={String(item.id)}
                  title={itemTitle("values", item, index)}
                  enabled={Boolean(item.enabled)}
                  index={index}
                  count={items.values.length}
                  expanded={expandedItemId === String(item.id)}
                  canEdit={canEdit}
                  labels={itemLabels}
                  onExpandedChange={(expanded) =>
                    setExpandedItemId(expanded ? String(item.id) : null)
                  }
                  onMove={(offset) =>
                    updateCollection("values", moveItem(items.values, index, offset))
                  }
                  onRemove={() =>
                    updateCollection(
                      "values",
                      items.values.filter((_, position) => position !== index),
                    )
                  }
                >
                  <MediaPicker
                    allowedKinds={["image"]}
                    canUpload={canUploadMedia}
                    disabled={!canEdit}
                    label={t("valueIcon")}
                    value={typeof item.iconMediaId === "string" ? item.iconMediaId : null}
                    onChange={(iconMediaId) =>
                      updateCollection(
                        "values",
                        items.values.map((row, position) =>
                          position === index ? { ...row, iconMediaId } : row,
                        ),
                      )
                    }
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(item.enabled)}
                        disabled={!canEdit}
                        onChange={(event) =>
                          updateCollection(
                            "values",
                            items.values.map((row, position) =>
                              position === index ? { ...row, enabled: event.target.checked } : row,
                            ),
                          )
                        }
                      />
                    }
                    label={t("active")}
                  />
                </AboutItem>
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary" variant="body2">
              {t("aboutEmptyValues")}
            </Typography>
          )}
        </AboutPanel>
      ) : null}

      {tab === "storySections" ? (
        <AboutPanel
          title={t("aboutStories")}
          description={t("aboutStoriesHelp")}
          action={
            <Button
              startIcon={<AddRounded />}
              variant="outlined"
              disabled={!canEdit || items.storySections.length >= 12}
              onClick={() => addItem("storySections")}
            >
              {t("addStory")}
            </Button>
          }
        >
          {items.storySections.length ? (
            <Stack spacing={1}>
              {items.storySections.map((item, index) => (
                <AboutItem
                  key={String(item.id)}
                  title={itemTitle("storySections", item, index)}
                  enabled={Boolean(item.enabled)}
                  index={index}
                  count={items.storySections.length}
                  expanded={expandedItemId === String(item.id)}
                  canEdit={canEdit}
                  labels={itemLabels}
                  onExpandedChange={(expanded) =>
                    setExpandedItemId(expanded ? String(item.id) : null)
                  }
                  onMove={(offset) =>
                    updateCollection("storySections", moveItem(items.storySections, index, offset))
                  }
                  onRemove={() =>
                    updateCollection(
                      "storySections",
                      items.storySections.filter((_, position) => position !== index),
                    )
                  }
                >
                  <MediaPicker
                    allowedKinds={["image"]}
                    canUpload={canUploadMedia}
                    disabled={!canEdit}
                    label={t("storyImage")}
                    value={typeof item.mediaId === "string" ? item.mediaId : null}
                    onChange={(mediaId) =>
                      updateCollection(
                        "storySections",
                        items.storySections.map((row, position) =>
                          position === index ? { ...row, mediaId } : row,
                        ),
                      )
                    }
                  />
                  <FormControl fullWidth disabled={!canEdit}>
                    <InputLabel id={`story-placement-${String(item.id)}`}>
                      {t("mediaPlacement")}
                    </InputLabel>
                    <Select
                      labelId={`story-placement-${String(item.id)}`}
                      label={t("mediaPlacement")}
                      value={String(item.mediaPlacement)}
                      onChange={(event) =>
                        updateCollection(
                          "storySections",
                          items.storySections.map((row, position) =>
                            position === index
                              ? { ...row, mediaPlacement: event.target.value }
                              : row,
                          ),
                        )
                      }
                    >
                      <MenuItem value="start">{t("placement.start")}</MenuItem>
                      <MenuItem value="end">{t("placement.end")}</MenuItem>
                      <MenuItem value="full">{t("placement.full")}</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(item.enabled)}
                        disabled={!canEdit}
                        onChange={(event) =>
                          updateCollection(
                            "storySections",
                            items.storySections.map((row, position) =>
                              position === index ? { ...row, enabled: event.target.checked } : row,
                            ),
                          )
                        }
                      />
                    }
                    label={t("active")}
                  />
                </AboutItem>
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary" variant="body2">
              {t("aboutEmptyStories")}
            </Typography>
          )}
        </AboutPanel>
      ) : null}

      {tab === "callsToAction" ? (
        <AboutPanel
          title={t("aboutActions")}
          description={t("aboutActionsHelp")}
          action={
            <Button
              startIcon={<AddRounded />}
              variant="outlined"
              disabled={!canEdit || items.callsToAction.length >= 3}
              onClick={() => addItem("callsToAction")}
            >
              {t("addCallToAction")}
            </Button>
          }
        >
          {items.callsToAction.length ? (
            <Stack spacing={1}>
              {items.callsToAction.map((item, index) => (
                <AboutItem
                  key={String(item.id)}
                  title={itemTitle("callsToAction", item, index)}
                  enabled={Boolean(item.enabled)}
                  index={index}
                  count={items.callsToAction.length}
                  expanded={expandedItemId === String(item.id)}
                  canEdit={canEdit}
                  labels={itemLabels}
                  onExpandedChange={(expanded) =>
                    setExpandedItemId(expanded ? String(item.id) : null)
                  }
                  onMove={(offset) =>
                    updateCollection("callsToAction", moveItem(items.callsToAction, index, offset))
                  }
                  onRemove={() =>
                    updateCollection(
                      "callsToAction",
                      items.callsToAction.filter((_, position) => position !== index),
                    )
                  }
                >
                  <TextField
                    fullWidth
                    label={t("destinationLink")}
                    value={String(item.href ?? "")}
                    disabled={!canEdit}
                    slotProps={{ htmlInput: { dir: "ltr" } }}
                    onChange={(event) =>
                      updateCollection(
                        "callsToAction",
                        items.callsToAction.map((row, position) =>
                          position === index ? { ...row, href: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      gap: 1.5,
                    }}
                  >
                    <FormControl fullWidth disabled={!canEdit}>
                      <InputLabel id={`cta-variant-${String(item.id)}`}>
                        {t("buttonStyle")}
                      </InputLabel>
                      <Select
                        labelId={`cta-variant-${String(item.id)}`}
                        label={t("buttonStyle")}
                        value={String(item.variant)}
                        onChange={(event) =>
                          updateCollection(
                            "callsToAction",
                            items.callsToAction.map((row, position) =>
                              position === index ? { ...row, variant: event.target.value } : row,
                            ),
                          )
                        }
                      >
                        <MenuItem value="primary">{t("primaryStyle")}</MenuItem>
                        <MenuItem value="secondary">{t("secondaryStyle")}</MenuItem>
                      </Select>
                    </FormControl>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: "space-between", flexWrap: "wrap" }}
                    >
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(item.openInNewTab)}
                            disabled={!canEdit}
                            onChange={(event) =>
                              updateCollection(
                                "callsToAction",
                                items.callsToAction.map((row, position) =>
                                  position === index
                                    ? { ...row, openInNewTab: event.target.checked }
                                    : row,
                                ),
                              )
                            }
                          />
                        }
                        label={t("openInNewTab")}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={Boolean(item.enabled)}
                            disabled={!canEdit}
                            onChange={(event) =>
                              updateCollection(
                                "callsToAction",
                                items.callsToAction.map((row, position) =>
                                  position === index
                                    ? { ...row, enabled: event.target.checked }
                                    : row,
                                ),
                              )
                            }
                          />
                        }
                        label={t("active")}
                      />
                    </Stack>
                  </Box>
                </AboutItem>
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary" variant="body2">
              {t("aboutEmptyActions")}
            </Typography>
          )}
        </AboutPanel>
      ) : null}

      <Typography variant="caption" color="text.secondary">
        {t("aboutOrderNote")}
      </Typography>
    </Stack>
  );
}
