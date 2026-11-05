import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { RichContent } from "@/components/ui";
import type { RichTextDocument, RichTextMediaNode } from "@/lib/rich-text";

import type { AboutContent, AboutImage } from "./about-content";

function ImageFrame({
  image,
  fallbackImage,
  height,
  priority = false,
}: {
  image: AboutImage | null;
  fallbackImage?: AboutImage;
  height: number | { xs: number; md: number };
  priority?: boolean;
}) {
  const source = image ?? fallbackImage ?? { url: "/images/about/kitchen-hands.webp", alt: "" };
  return (
    <Box
      component="img"
      src={source.url}
      alt={source.alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      sx={{ display: "block", width: "100%", height, objectFit: "cover" }}
    />
  );
}

function AboutRichContent({
  document,
  media,
}: {
  document: RichTextDocument;
  media: AboutContent["embeddedMedia"];
}) {
  const renderMedia = (node: RichTextMediaNode) => {
    const asset = media[node.attrs.mediaId];
    if (!asset || asset.kind !== node.attrs.kind) return null;
    return (
      <Box component="figure" sx={{ mx: 0, my: 3 }}>
        {asset.kind === "image" ? (
          <Box
            component="img"
            src={asset.url}
            alt={node.attrs.alt}
            loading="lazy"
            sx={{ width: "100%", height: "auto", borderRadius: 2 }}
          />
        ) : (
          <Box
            component="video"
            src={asset.url}
            controls
            preload="metadata"
            aria-label={node.attrs.alt}
            sx={{ display: "block", width: "100%", borderRadius: 2 }}
          />
        )}
        {node.attrs.caption && (
          <Typography
            component="figcaption"
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1 }}
          >
            {node.attrs.caption}
          </Typography>
        )}
      </Box>
    );
  };
  return <RichContent content={document} renderMedia={renderMedia} />;
}

export function AboutPage({ content }: { content: AboutContent | null }) {
  const t = useTranslations("storefront.about");
  const kitchenPhoto: AboutImage = {
    url: "/images/about/kitchen-hands.webp",
    alt: t("kitchenImageAlt"),
  };
  const tablePhoto: AboutImage = {
    url: "/images/about/persian-table.webp",
    alt: t("tableImageAlt"),
  };
  const title = content?.title ?? t("title");
  const summary = content?.summary ?? t("summary");
  const hasStory = (content?.story?.content?.length ?? 0) > 0;
  const actions = content?.actions.length
    ? content.actions
    : [
        {
          id: "menu",
          label: t("exploreMenu"),
          href: "/menu",
          newTab: false,
          variant: "primary" as const,
        },
      ];
  const heroPhoto = content?.hero ?? content?.kitchen[0] ?? kitchenPhoto;

  return (
    <Box component="main" sx={{ bgcolor: "background.default", pb: { xs: 9, md: 14 } }}>
      <Box
        component="section"
        aria-labelledby="about-title"
        sx={{
          overflow: "hidden",
          background: "linear-gradient(145deg, #fff5f1 0%, #fbf3ef 58%, #f7f7f1 100%)",
          "html.dark &": {
            background: "linear-gradient(145deg, #321f1e 0%, #302525 58%, #242722 100%)",
          },
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, .86fr) minmax(0, 1.14fr)" },
              gap: { xs: 3, md: 7 },
              alignItems: "center",
            }}
          >
            <Stack spacing={{ xs: 1.5, md: 2.5 }} sx={{ maxWidth: 590, order: { xs: 0, md: 0 } }}>
              <Typography
                sx={{
                  color: "primary.main",
                  fontSize: ".78rem",
                  fontWeight: 800,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                }}
              >
                {content?.eyebrow || t("eyebrow")}
              </Typography>
              <Typography
                component="h1"
                id="about-title"
                sx={{
                  color: "primary.dark",
                  fontWeight: 800,
                  fontSize: { xs: "2.35rem", sm: "2.9rem", md: "4rem" },
                  letterSpacing: "-.04em",
                  lineHeight: 1.08,
                  maxWidth: 620,
                }}
              >
                {title}
              </Typography>
              <Typography sx={{ fontSize: { xs: "1rem", md: "1.15rem" }, lineHeight: 1.85 }}>
                {summary}
              </Typography>
              <Stack direction="row" sx={{ pt: 0.5, flexWrap: "wrap", gap: 1.25 }}>
                {actions.map((action) => (
                  <Button
                    key={action.id}
                    component={Link}
                    href={action.href}
                    target={action.newTab ? "_blank" : undefined}
                    rel={action.newTab ? "noopener noreferrer" : undefined}
                    variant={action.variant === "primary" ? "contained" : "outlined"}
                    endIcon={
                      <ArrowForwardRoundedIcon
                        sx={{ transform: "scaleX(var(--sk-direction-scale, 1))" }}
                      />
                    }
                    sx={{ borderRadius: 1.5, px: 2.25, minHeight: 46 }}
                  >
                    {action.label}
                  </Button>
                ))}
                <Button
                  component={Link}
                  href="/contact"
                  variant="text"
                  startIcon={<ChatBubbleOutlineRoundedIcon />}
                  sx={{ borderRadius: 1.5, minHeight: 46 }}
                >
                  {t("contactUs")}
                </Button>
              </Stack>
            </Stack>
            <Box
              sx={{
                position: "relative",
                width: "100%",
                pl: { xs: 0, md: 2 },
                pr: { xs: 0, md: 3 },
                pb: 0,
              }}
            >
              <Paper
                elevation={0}
                sx={{ overflow: "hidden", borderRadius: 2, boxShadow: "0 22px 58px #32221a2b" }}
              >
                <ImageFrame image={heroPhoto} height={{ xs: 258, md: 430 }} priority />
              </Paper>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: { xs: 5, md: 9 } }}>
        <Box
          component="section"
          aria-labelledby="about-story-heading"
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, .95fr) minmax(0, 1.05fr)" },
            alignItems: "center",
            gap: { xs: 2.5, md: 6 },
          }}
        >
          <Paper
            elevation={0}
            sx={{ overflow: "hidden", borderRadius: 2, boxShadow: "0 16px 42px #3020181a" }}
          >
            <ImageFrame image={content?.kitchen[0] ?? tablePhoto} height={{ xs: 250, md: 430 }} />
          </Paper>
          <Stack spacing={2}>
            <Typography
              component="h2"
              id="about-story-heading"
              sx={{ fontSize: { xs: "1.75rem", md: "2.15rem" }, fontWeight: 800, lineHeight: 1.2 }}
            >
              {t("storyHeading")}
            </Typography>
            <Paper
              elevation={0}
              sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 2, bgcolor: "action.hover" }}
            >
              {hasStory && content?.story ? (
                <AboutRichContent document={content.story} media={content.embeddedMedia} />
              ) : (
                <Typography sx={{ lineHeight: 1.9 }}>{t("storyFallback")}</Typography>
              )}
            </Paper>
            <Typography color="text.secondary" sx={{ lineHeight: 1.85 }}>
              {t("journeyCopy")}
            </Typography>
          </Stack>
        </Box>

        <Box
          component="section"
          aria-labelledby="about-table-heading"
          sx={{
            mt: { xs: 6, md: 10 },
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1fr)" },
            alignItems: "stretch",
            gap: 2,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.75, md: 4 },
              borderRadius: 2,
              bgcolor: "#fff1ec",
              "html.dark &": { bgcolor: "#392724" },
            }}
          >
            <RestaurantRoundedIcon sx={{ color: "primary.main", mb: 1.5 }} />
            <Typography
              component="h2"
              id="about-table-heading"
              sx={{ fontSize: { xs: "1.4rem", md: "1.7rem" }, fontWeight: 800, mb: 1.25 }}
            >
              {t("cultureHeading")}
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.85 }}>
              {t("cultureCopy")}
            </Typography>
          </Paper>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.75, md: 4 },
              borderRadius: 2,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <MenuBookRoundedIcon sx={{ color: "primary.main", mb: 1.5 }} />
            <Typography
              component="h2"
              sx={{ fontSize: { xs: "1.4rem", md: "1.7rem" }, fontWeight: 800, mb: 1.25 }}
            >
              {t("portoHeading")}
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.85 }}>
              {t("portoCopy")}
            </Typography>
          </Paper>
        </Box>

        <Box
          component="section"
          aria-labelledby="about-trust-heading"
          sx={{ mt: { xs: 7, md: 11 } }}
        >
          <Typography
            component="h2"
            id="about-trust-heading"
            sx={{ fontSize: { xs: "1.75rem", md: "2.15rem" }, fontWeight: 800, mb: 1 }}
          >
            {t("trustHeading")}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 660, lineHeight: 1.8 }}>
            {t("trustIntro")}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
              gap: 1.5,
            }}
          >
            {[
              {
                title: t("trustMenuTitle"),
                body: t("trustMenuCopy"),
                icon: <MenuBookRoundedIcon />,
              },
              {
                title: t("trustCareTitle"),
                body: t("trustCareCopy"),
                icon: <RestaurantRoundedIcon />,
              },
              {
                title: t("trustContactTitle"),
                body: t("trustContactCopy"),
                icon: <ChatBubbleOutlineRoundedIcon />,
              },
            ].map((item) => (
              <Paper
                key={item.title}
                elevation={0}
                sx={{
                  p: { xs: 2.25, md: 2.75 },
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Box sx={{ color: "primary.main", mb: 1.25, display: "flex" }}>{item.icon}</Box>
                <Typography component="h3" sx={{ fontWeight: 800, mb: 0.75 }}>
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                  {item.body}
                </Typography>
              </Paper>
            ))}
          </Box>
        </Box>

        {content?.sections.map((section, index) => (
          <Box
            key={section.id}
            component="section"
            aria-labelledby={`story-${section.id}`}
            sx={{
              mt: { xs: 6, md: 9 },
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: section.media && section.placement !== "full" ? "1fr 1fr" : "1fr",
              },
              gap: 2,
              alignItems: "center",
            }}
          >
            {section.media && section.placement !== "end" && (
              <Paper elevation={0} sx={{ overflow: "hidden", borderRadius: 2 }}>
                <ImageFrame image={section.media} height={{ xs: 230, md: 340 }} />
              </Paper>
            )}
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.75, md: 4 },
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: index % 2 ? "background.paper" : "action.hover",
                order: { xs: 1, md: section.media && section.placement === "end" ? 0 : 1 },
              }}
            >
              <Typography
                component="h2"
                id={`story-${section.id}`}
                variant="h5"
                sx={{ fontWeight: 800, mb: 2 }}
              >
                {section.title}
              </Typography>
              <AboutRichContent document={section.content} media={content.embeddedMedia} />
            </Paper>
            {section.media && section.placement === "end" && (
              <Paper
                elevation={0}
                sx={{ overflow: "hidden", borderRadius: 2, order: { xs: 0, md: 1 } }}
              >
                <ImageFrame image={section.media} height={{ xs: 230, md: 340 }} />
              </Paper>
            )}
          </Box>
        ))}

        {content?.values.length ? (
          <Box
            component="section"
            aria-labelledby="about-values-heading"
            sx={{ mt: { xs: 7, md: 10 } }}
          >
            <Typography
              component="h2"
              id="about-values-heading"
              variant="h5"
              sx={{ fontWeight: 800, mb: 3 }}
            >
              {t("valuesHeading")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
                gap: 1.5,
              }}
            >
              {content.values.map((value) => (
                <Paper
                  key={value.id}
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    height: "100%",
                  }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      width: 44,
                      height: 44,
                      mb: 1.5,
                      borderRadius: 1.5,
                      bgcolor: "#ffe7e4",
                      color: "primary.dark",
                      overflow: "hidden",
                    }}
                  >
                    {value.icon ? (
                      <Box
                        component="img"
                        src={value.icon.url}
                        alt={value.icon.alt}
                        sx={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <RestaurantRoundedIcon />
                    )}
                  </Box>
                  <Typography component="h3" variant="h6" sx={{ fontWeight: 800, mb: 0.75 }}>
                    {value.title}
                  </Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {value.description}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Box>
        ) : null}

        {content?.team.length ? (
          <Box
            component="section"
            aria-labelledby="about-team-heading"
            sx={{ mt: { xs: 7, md: 10 } }}
          >
            <Typography
              component="h2"
              id="about-team-heading"
              variant="h5"
              sx={{ fontWeight: 800, mb: 3 }}
            >
              {t("teamHeading")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
                gap: 2,
              }}
            >
              {content.team.map((person) => (
                <Paper
                  key={person.id}
                  elevation={0}
                  sx={{
                    overflow: "hidden",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <ImageFrame image={person.portrait} fallbackImage={kitchenPhoto} height={280} />
                  <Stack spacing={0.5} sx={{ p: 2.5 }}>
                    <Typography component="h3" variant="h6" sx={{ fontWeight: 800 }}>
                      {person.name}
                    </Typography>
                    {person.role && <Typography color="primary.main">{person.role}</Typography>}
                    {person.bio && (
                      <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                        {person.bio}
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Box>
        ) : null}

        {content && content.kitchen.length > 2 && (
          <Box
            component="section"
            aria-labelledby="about-kitchen-heading"
            sx={{ mt: { xs: 7, md: 10 } }}
          >
            <Typography
              component="h2"
              id="about-kitchen-heading"
              variant="h5"
              sx={{ fontWeight: 800, mb: 3 }}
            >
              {t("kitchenHeading")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" },
                gap: 1.5,
              }}
            >
              {content.kitchen.slice(2).map((image, index) => (
                <Paper
                  key={`${image.url}-${index}`}
                  elevation={0}
                  sx={{ overflow: "hidden", borderRadius: 2 }}
                >
                  <ImageFrame image={image} height={{ xs: 155, md: 235 }} />
                </Paper>
              ))}
            </Box>
          </Box>
        )}
      </Container>
    </Box>
  );
}
