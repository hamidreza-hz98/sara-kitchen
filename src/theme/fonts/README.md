# Local font assets

These production font files are checked into the repository so builds are deterministic and the
browser never contacts a third-party font host. Both families are licensed under the SIL Open Font
License 1.1; the unmodified license texts are stored beside the binaries.

| Local asset                              | Family and range                                                   | Pinned upstream source                                                                                                                                                                  | SHA-256                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `plus-jakarta-sans-latin-variable.woff2` | Plus Jakarta Sans, normal `200–800`, Latin/Latin Extended          | [`tokotype/PlusJakartaSans` commit `18d1cd2`](https://github.com/tokotype/PlusJakartaSans/blob/18d1cd2f7ea10481919d2f05c1f7064b7307fc26/fonts/webfonts/PlusJakartaSans%5Bwght%5D.woff2) | `49C62CF1FB70F225EA113361F0134A48858C3A7D0175173AA3E38A0C6C8539D2` |
| `vazirmatn-persian-variable.woff2`       | Vazirmatn, normal `100–900`, Persian/Arabic plus supporting glyphs | [`rastikerdar/vazirmatn` release `v33.003`](https://github.com/rastikerdar/vazirmatn/releases/tag/v33.003)                                                                              | `4E3FA217D38FDAFC1FEA4414CEB58CA5E662CF0AB5FA735A8C8C20E8B42CAD92` |

License files:

- `OFL-Plus-Jakarta-Sans.txt`
- `OFL-Vazirmatn.txt`

Do not replace a binary without updating its pinned source, checksum, license review, browser glyph
test, and this inventory in the same change.
