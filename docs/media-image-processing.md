# Image processing (SK-0073)

`processImage(input, mimeType)` is the server-only image transformation boundary. It accepts only admitted JPEG, PNG, WebP, or AVIF bytes and verifies Sharp's detected format against the claimed MIME. Animated/multipage inputs are rejected. It returns a source summary and four ordered, in-memory variants; a later media service assigns generated object keys, uploads the variants, and persists their metadata. This task does not publish raw originals.

| Role                 | Maximum bounding box | Format                                  |
| -------------------- | -------------------: | --------------------------------------- |
| `display_webp`       |          1600 × 1600 | WebP, quality 78                        |
| `display_fallback`   |          1600 × 1600 | JPEG quality 82 if opaque; PNG if alpha |
| `thumbnail_webp`     |            320 × 320 | WebP, quality 78                        |
| `thumbnail_fallback` |            320 × 320 | JPEG if opaque; PNG if alpha            |

Resizing fits inside each box without upscaling or cropping. EXIF orientation is applied before output. The processor does not call `keepMetadata` or `withMetadata`, so the generated files omit EXIF/XMP and other source metadata and use Sharp's default sRGB output. Alpha channels are retained by WebP and PNG variants; JPEG is never chosen for transparent inputs. Each variant carries role, extension, MIME, exact encoded bytes, output dimensions, and a lowercase SHA-256 checksum. The list order and encoder settings are fixed.

The input cap is 10 MiB, 32 million pixels, and 8000 pixels per side. Header metadata is inspected before decoding; actual decoding uses Sharp's pixel limit and `failOn: "warning"`. Processing errors return stable codes without raw decoder details. The original upload remains in the private bucket under the upload policy; only checked, processed variants should later be eligible for public delivery. This is not malware scanning, a sandbox, or a replacement for storage quotas. The worker/runtime should also have memory and CPU limits.

Generated fixtures test EXIF orientation, metadata removal, WebP/AVIF ingestion, transparency, no upscaling, expected dimensions, repeatable checksums, decodable visual output, and substantial compression of a photographic-style PNG. Malformed, mismatched, oversized, and excessive-dimension inputs are rejected.

Sharp references: [auto-orientation](https://sharp.pixelplumbing.com/api-operation/#autoorient), [output metadata defaults](https://sharp.pixelplumbing.com/api-output/), [security and resource limits](https://sharp.pixelplumbing.com/security/).
