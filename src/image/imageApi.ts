export type ImageThumbnail = {
  id?: string | number | null;
  url?: string | null;
  thumbnailUrl?: string | null;
};

export type ResourceThumbnail = {
  resourceType: string;
  resourceId: string;
  image: ImageThumbnail | null;
};

/** Fetch first images for a page of resources in one request. */
export async function getImageThumbnails(
  resources: Array<{ resourceType: string; resourceId: string | number }>,
): Promise<ResourceThumbnail[]> {
  const unique = Array.from(
    new Map(
      resources.map((resource) => [
        `${resource.resourceType}:${resource.resourceId}`,
        {
          resourceType: resource.resourceType,
          resourceId: String(resource.resourceId),
        },
      ]),
    ).values(),
  );
  const content: ResourceThumbnail[] = [];
  for (let offset = 0; offset < unique.length; offset += 50) {
    const response = await fetch("/api/images/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resources: unique.slice(offset, offset + 50) }),
    });
    if (!response.ok) {
      throw new Error(`Image thumbnail lookup failed (${response.status})`);
    }
    const payload = (await response.json()) as {
      content?: ResourceThumbnail[];
    };
    if (Array.isArray(payload.content)) content.push(...payload.content);
  }
  return content;
}
