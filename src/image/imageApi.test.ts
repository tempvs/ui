import { getImageThumbnails } from "./imageApi";

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => jest.restoreAllMocks());

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
