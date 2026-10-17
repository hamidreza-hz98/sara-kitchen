import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import RestaurantRoundedIcon from "@mui/icons-material/RestaurantRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";

import { RichContent } from "@/components/ui";
import type { RichTextDocument, RichTextMediaNode } from "@/lib/rich-text";

import type { AboutContent, AboutImage } from "./about-content";

function ImageFrame({
  image,
  height,
  priority = false,
}: {
  image: AboutImage | null;
  height: number | { xs: number; md: number };
  priority?: boolean;
}) {
  return image ? (
    <Box
      component="img"
      src={image.url}
      alt={image.alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      sx={{ display: "block", width: "100%", height, objectFit: "cover" }}
    />
  ) : (
    <Box
      aria-hidden="true"
      sx={{
        width: "100%",
        height,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 28% 30%, #ffd9bd 0 12%, transparent 13%), linear-gradient(135deg, #fff0ec, #ffe3d2 53%, #e8e3eb)",
      }}
    >
      <Box
        component="img"
        src="/brand/sara-kitchen-logo.png"
        alt=""
        sx={{ width: 94, height: 94, objectFit: "contain", opacity: 0.8 }}
      />
    </Box>
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
            sx={{ width: "100%", height: "auto", borderRadius: 3 }}
          />
        ) : (
          <Box
            component="video"
            src={asset.url}
            controls
            preload="metadata"
            aria-label={node.attrs.alt}
            sx={{ display: "block", width: "100%", borderRadius: 3 }}
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
  const title = content?.title ?? t("title");
  const summary = content?.summary ?? t("summary");
  const actions = content
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
  return (
    <Box component="div" sx={{ bgcolor: "background.default", pb: { xs: 9, md: 14 } }}>
      <Box
        sx={{
          background: "linear-gradient(145deg, #fff0ee 0%, #f5eaea 58%, #faf7f5 100%)",
          overflow: "hidden",
          "html.dark &": {
            background: "linear-gradient(145deg, #321b1b 0%, #432424 58%, #321b1b 100%)",
          },
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 7, md: 11 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: { xs: 5, md: 8 },
              alignItems: "center",
            }}
          >
            <Stack spacing={2.5} sx={{ maxWidth: 590 }}>
              <Typography
                sx={{
                  color: "primary.dark",
                  fontWeight: 800,
                  letterSpacing: "0.13em",
                  textTransform: "uppercase",
                }}
              >
                {content?.eyebrow || t("eyebrow")}
              </Typography>
              <Typography
                component="h1"
                variant="h2"
                sx={{
                  color: "primary.dark",
                  fontWeight: 800,
                  fontSize: { xs: "2.6rem", md: "4.5rem" },
                  lineHeight: 1.08,
                }}
              >
                {title}
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "1.05rem", md: "1.25rem" },
                  lineHeight: 1.8,
                  maxWidth: 540,
                }}
              >
                {summary}
              </Typography>
              <Stack direction="row" sx={{ pt: 1, flexWrap: "wrap", gap: 1.5 }}>
                {actions.map((action) => (
                  <Button
                    key={action.id}
                    href={action.href}
                    variant={action.variant === "primary" ? "contained" : "outlined"}
                    endIcon={
                      <ArrowForwardRoundedIcon
                        sx={{
                          transform: "scaleX(var(--sk-direction-scale, 1))",
                        }}
                      />
                    }
                    {...(action.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {action.label}
                  </Button>
                ))}
              </Stack>
            </Stack>
            <Box
              sx={{
                position: "relative",
                maxWidth: 540,
                width: "100%",
                mx: "auto",
                px: { xs: 2, md: 4 },
                pb: { xs: 3, md: 4 },
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  overflow: "hidden",
                  borderRadius: "45% 45% 44% 44%",
                  border: "7px solid white",
                  boxShadow: "0 25px 70px #2c2c4726",
                }}
              >
                <ImageFrame
                  image={content?.hero ?? content?.kitchen[0] ?? null}
                  height={{ xs: 290, md: 390 }}
                  priority
                />
              </Paper>
              {content?.kitchen[1] && (
                <Paper
                  elevation={0}
                  sx={{
                    position: "absolute",
                    insetInlineStart: 0,
                    bottom: 0,
                    width: { xs: 112, md: 155 },
                    overflow: "hidden",
                    borderRadius: "50%",
                    border: "5px solid white",
                    boxShadow: "0 12px 35px #2c2c4726",
                  }}
                >
                  <ImageFrame image={content.kitchen[1]} height={{ xs: 102, md: 145 }} />
                </Paper>
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: { xs: 7, md: 11 } }}>
        <Box
          component="section"
          aria-labelledby="about-story-heading"
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "minmax(0, 0.85fr) minmax(0, 1.15fr)",
            },
            alignItems: "center",
            gap: { xs: 3, md: 7 },
          }}
        >
          <Paper
            sx={{
              overflow: "hidden",
              borderRadius: 5,
              border: "8px solid white",
              boxShadow: "0 18px 55px #2c2c471b",
            }}
          >
            <ImageFrame
              image={content?.kitchen[0] ?? content?.hero ?? null}
              height={{ xs: 310, md: 480 }}
            />
          </Paper>
          <Stack spacing={2.5}>
            <Typography
              component="h2"
              id="about-story-heading"
              variant="h4"
              sx={{ fontWeight: 800 }}
            >
              {t("storyHeading")}
            </Typography>
            <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 4 }}>
              {content?.story ? (
                <AboutRichContent document={content.story} media={content.embeddedMedia} />
              ) : (
                <Typography sx={{ lineHeight: 1.9 }}>{t("storyFallback")}</Typography>
              )}
            </Paper>
          </Stack>
        </Box>

        {content?.sections.map((section, index) => (
          <Box
            key={section.id}
            component="section"
            aria-labelledby={`story-${section.id}`}
            sx={{
              mt: { xs: 6, md: 10 },
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: section.media && section.placement !== "full" ? "1fr 1fr" : "1fr",
              },
              gap: 4,
              alignItems: "center",
            }}
          >
            {section.media && section.placement !== "end" && (
              <Paper
                sx={{
                  overflow: "hidden",
                  borderRadius: 4,
                  order: { xs: 0, md: 0 },
                }}
              >
                <ImageFrame image={section.media} height={{ xs: 250, md: 360 }} />
              </Paper>
            )}
            <Paper
              sx={{
                p: { xs: 3, md: 5 },
                borderRadius: 4,
                order: {
                  xs: 1,
                  md: section.media && section.placement === "end" ? 0 : 1,
                },
                bgcolor: index % 2 ? "background.paper" : "action.hover",
              }}
            >
              <Typography
                component="h2"
                id={`story-${section.id}`}
                variant="h4"
                sx={{ fontWeight: 800, mb: 3 }}
              >
                {section.title}
              </Typography>
              <AboutRichContent document={section.content} media={content.embeddedMedia} />
            </Paper>
            {section.media && section.placement === "end" && (
              <Paper
                sx={{
                  overflow: "hidden",
                  borderRadius: 4,
                  order: { xs: 0, md: 1 },
                }}
              >
                <ImageFrame image={section.media} height={{ xs: 250, md: 360 }} />
              </Paper>
            )}
          </Box>
        ))}

        {content?.values.length ? (
          <Box
            component="section"
            aria-labelledby="about-values-heading"
            sx={{ mt: { xs: 8, md: 12 } }}
          >
            <Typography
              component="h2"
              id="about-values-heading"
              variant="h4"
              sx={{ color: "primary.dark", fontWeight: 800, mb: 4 }}
            >
              {t("valuesHeading")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: "repeat(3, 1fr)",
                },
                gap: 2.5,
              }}
            >
              {content.values.map((value, index) => (
                <Paper key={value.id} sx={{ p: 3, borderRadius: 4, height: "100%" }}>
                  <Box
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      width: 60,
                      height: 60,
                      mb: 2,
                      borderRadius: "50%",
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
                        sx={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : index % 2 ? (
                      <FavoriteRoundedIcon />
                    ) : (
                      <RestaurantRoundedIcon />
                    )}
                  </Box>
                  <Typography component="h3" variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
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
            sx={{ mt: { xs: 8, md: 12 } }}
          >
            <Typography
              component="h2"
              id="about-team-heading"
              variant="h4"
              sx={{ fontWeight: 800, mb: 4 }}
            >
              {t("teamHeading")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: "repeat(3, 1fr)",
                },
                gap: 3,
              }}
            >
              {content.team.map((person) => (
                <Paper key={person.id} sx={{ overflow: "hidden", borderRadius: 4 }}>
                  <ImageFrame image={person.portrait} height={280} />
                  <Stack spacing={0.5} sx={{ p: 3 }}>
                    <Typography component="h3" variant="h6" sx={{ fontWeight: 800 }}>
                      {person.name}
                    </Typography>
                    {person.role && <Typography color="primary.main">{person.role}</Typography>}
                    {person.bio && <Typography color="text.secondary">{person.bio}</Typography>}
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
            sx={{ mt: { xs: 8, md: 12 } }}
          >
            <Typography
              component="h2"
              id="about-kitchen-heading"
              variant="h4"
              sx={{ fontWeight: 800, mb: 4 }}
            >
              {t("kitchenHeading")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, 1fr)" },
                gap: 2,
              }}
            >
              {content.kitchen.slice(2).map((image, index) => (
                <Paper key={`${image.url}-${index}`} sx={{ overflow: "hidden", borderRadius: 3 }}>
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
