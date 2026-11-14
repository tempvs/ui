import { getImageThumbnails } from "./imageApi";

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => jest.restoreAllMocks());

test("keeps default thumbnails and selected covers separate in the batch and cache", async () => {
  const resource = { resourceType: "source", resourceId: "cover-cache-source" };
  const preferredImageId = "018f0000-0000-7000-8000-000000000002";
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
    response({
      content: [
        { ...resource, image: { id: "first", thumbnailUrl: "first-url" } },
        {
          ...resource,
          preferredImageId,
          image: { id: preferredImageId, thumbnailUrl: "cover-url" },
        },
      ],
    }),
  );
  const [defaults, covers] = await Promise.all([
    getImageThumbnails([resource]),
    getImageThumbnails([{ ...resource, preferredImageId }]),
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(defaults[0].image?.thumbnailUrl).toBe("first-url");
  expect(covers[0].image?.thumbnailUrl).toBe("cover-url");
  expect((await getImageThumbnails([resource]))[0].image?.thumbnailUrl).toBe(
    "first-url",
  );
  expect(
    (await getImageThumbnails([{ ...resource, preferredImageId }]))[0].image
      ?.thumbnailUrl,
  ).toBe("cover-url");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).resources,
  ).toHaveLength(2);
});

test("splits a large lookup into bounded batches without dropping resources", async () => {
  const fetchMock = jest
    .spyOn(global, "fetch")
    .mockImplementation(async (_url, options) =>
      response({
        content: JSON.parse(String(options?.body)).resources.map(
          (resource: object) => ({ ...resource, image: null }),
        ),
      }),
    );
  const resources = Array.from({ length: 121 }, (_, id) => ({
    resourceType: "profile",
    resourceId: `large-batch-${id}`,
  }));
  expect(await getImageThumbnails(resources)).toHaveLength(121);
  const sizes = fetchMock.mock.calls.map(
    ([, options]) => JSON.parse(String(options?.body)).resources.length,
  );
  expect(sizes).toEqual([50, 50, 21]);
});

test("coalesces concurrent thumbnail callers into one lookup batch", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
    response({
      content: [
        { resourceType: "source", resourceId: "batch-image-a", image: null },
        { resourceType: "source", resourceId: "batch-image-b", image: null },
        { resourceType: "club", resourceId: "batch-image-c", image: null },
      ],
    }),
  );

  await expect(
    Promise.all([
      getImageThumbnails([
        { resourceType: "source", resourceId: "batch-image-a" },
        { resourceType: "source", resourceId: "batch-image-b" },
      ]),
      getImageThumbnails([
        { resourceType: "source", resourceId: "batch-image-b" },
        { resourceType: "club", resourceId: "batch-image-c" },
      ]),
    ]),
  ).resolves.toHaveLength(2);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
    resources: [
      { resourceType: "source", resourceId: "batch-image-a" },
      { resourceType: "source", resourceId: "batch-image-b" },
      { resourceType: "club", resourceId: "batch-image-c" },
    ],
  });
});

test("looks up unique image thumbnails in one request", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
    response({
      content: [
        {
          resourceType: "profile",
          resourceId: "profile-1",
          image: { thumbnailUrl: "https://images.example.com/1" },
        },
      ],
    }),
  );

  await expect(
    getImageThumbnails([
      { resourceType: "profile", resourceId: "profile-1" },
      { resourceType: "profile", resourceId: "profile-1" },
      { resourceType: "profile", resourceId: "profile-2" },
    ]),
  ).resolves.toHaveLength(1);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/images/lookup",
    expect.objectContaining({ method: "POST" }),
  );
  expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
    resources: [
      { resourceType: "profile", resourceId: "profile-1" },
      { resourceType: "profile", resourceId: "profile-2" },
    ],
  });
});
