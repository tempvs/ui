import React from "react";

import defaultImage from "../assets/default-image.png";

export const DEFAULT_HOURGLASS_IMAGE_SRC = defaultImage;

type DefaultHourglassImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
>;

/** The common visual fallback for an entity that has no uploaded image. */
export default function DefaultHourglassImage({
  alt = "No image",
  ...props
}: DefaultHourglassImageProps) {
  return <img src={DEFAULT_HOURGLASS_IMAGE_SRC} alt={alt} {...props} />;
}
