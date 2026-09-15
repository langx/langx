# Fonts

The faces `modules/cards/render.ts` hands to satori. Both are under the SIL
Open Font License 1.1, whose text is in [`OFL.txt`](./OFL.txt) — the licence
requires it to travel with the files.

| File                             | Family           | Source                                                    |
| -------------------------------- | ---------------- | --------------------------------------------------------- |
| `Nunito_800ExtraBold.ttf`        | Nunito           | <https://fonts.google.com/specimen/Nunito>                |
| `Nunito_600SemiBold.ttf`         | Nunito           | <https://fonts.google.com/specimen/Nunito>                |
| `NotoSansArabic_600SemiBold.ttf` | Noto Sans Arabic | <https://fonts.google.com/noto/specimen/Noto+Sans+Arabic> |

Noto is the fallback rather than a choice any caller makes: Nunito has no
Arabic in it, and satori draws an empty box per missing glyph. It joins and
shapes the letters correctly, which is worth re-checking by eye if the file is
ever replaced — nothing throws when shaping goes wrong.
