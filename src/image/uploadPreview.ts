/** A data URL needs no object-URL lifecycle and is never sent to the API. */
export function withUploadPreview<T>(image: T, file: File): Promise<T> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string"
      ? { ...image, previewUrl: reader.result }
      : image);
    // Preview failure must not turn a completed storage upload into a failed mutation.
    reader.onerror = () => resolve(image);
    reader.onabort = () => resolve(image);
    reader.readAsDataURL(file);
  });
}
