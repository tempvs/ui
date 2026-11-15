import thumbnail0 from "./images/thumbnails/ancient.jpg";
import thumbnail1 from "./images/thumbnails/antiquity.jpg";
import thumbnail2 from "./images/thumbnails/contemporary.jpg";
import thumbnail3 from "./images/thumbnails/early_middle_ages.jpg";
import thumbnail4 from "./images/thumbnails/high_middle_ages.jpg";
import thumbnail5 from "./images/thumbnails/late_middle_ages.jpg";
import thumbnail6 from "./images/thumbnails/modern.jpg";
import thumbnail7 from "./images/thumbnails/other.jpg";
import thumbnail8 from "./images/thumbnails/renaissance.jpg";
import thumbnail9 from "./images/thumbnails/wwi.jpg";
import thumbnail10 from "./images/thumbnails/wwii.jpg";
import interwar from "./images/thumbnails/interwar.svg";

/** Explicit asset imports work in both the browser bundle and test runner. */
export const periodThumbnails: Record<string, string> = {
  ancient: thumbnail0,
  antiquity: thumbnail1,
  contemporary: thumbnail2,
  early_middle_ages: thumbnail3,
  high_middle_ages: thumbnail4,
  late_middle_ages: thumbnail5,
  modern: thumbnail6,
  other: thumbnail7,
  renaissance: thumbnail8,
  wwi: thumbnail9,
  wwii: thumbnail10,
  interwar,
};
