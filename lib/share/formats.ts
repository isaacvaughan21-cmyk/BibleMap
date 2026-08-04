/**
 * Share-card sizes. A study map is a wide, sprawling thing and a social feed is
 * a tall, narrow one — so the card is composed for a chosen frame rather than
 * cropped out of the canvas. Every size is exported at its platform's native
 * pixel dimensions, so nothing is resampled on upload.
 */

export type ShareFormat = {
  id: "portrait" | "square" | "story" | "wide";
  /** Shape name, shown on the chip. */
  name: string;
  /** Where it's meant to go — the reason to pick it. */
  hint: string;
  width: number;
  height: number;
};

export const SHARE_FORMATS: ShareFormat[] = [
  {
    id: "portrait",
    name: "Portrait",
    hint: "Instagram · Facebook",
    width: 1080,
    height: 1350,
  },
  {
    id: "square",
    name: "Square",
    hint: "Feeds · profiles",
    width: 1080,
    height: 1080,
  },
  {
    id: "story",
    name: "Story",
    hint: "Stories · Reels · TikTok",
    width: 1080,
    height: 1920,
  },
  {
    id: "wide",
    name: "Wide",
    hint: "X · link previews",
    width: 1600,
    height: 900,
  },
];

export const DEFAULT_FORMAT = SHARE_FORMATS[0];

export function getFormat(id: string | undefined): ShareFormat {
  return SHARE_FORMATS.find((f) => f.id === id) ?? DEFAULT_FORMAT;
}
