import {
  findSources,
  getAdminRoleRequests,
  getSourceProfiles,
  patchSourceField,
  removeSource,
  createSource,
  projectApprovedSourceImages,
  uploadSourceChangesetImage,
} from "./libraryApi";

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  } as Response;
}

afterEach(() => jest.restoreAllMocks());

test("Library search and admin lists use opaque cursor envelopes", async () => {
  const fetchMock = jest
    .spyOn(window, "fetch")
    .mockResolvedValueOnce(
      response({
        content: [{ id: "source-uuid", version: 1 }],
        nextToken: "next-source",
      }),
    )
    .mockResolvedValueOnce(
      response({
        roleRequests: [{ userId: "12", role: "ROLE_CONTRIBUTOR" }],
        nextToken: "next-request",
      }),
    );

  const sources = await findSources({ query: "cloth", size: 20 });
  const requests = await getAdminRoleRequests({
    size: 20,
    nextToken: "cursor-1",
  });

  expect(sources.data?.[0].id).toBe("source-uuid");
  expect(sources.nextToken).toBe("next-source");
  expect(String(fetchMock.mock.calls[0][0])).toContain("limit=20");
  expect(String(fetchMock.mock.calls[0][0])).not.toContain("page=");
  expect(requests.data?.nextToken).toBe("next-request");
  expect(String(fetchMock.mock.calls[1][0])).toContain("nextToken=cursor-1");
});

test("source writes send idempotency and optimistic version headers", async () => {
  const fetchMock = jest
    .spyOn(window, "fetch")
    .mockResolvedValueOnce(response({ id: "source-uuid", version: 1 }, 201))
    .mockResolvedValueOnce(response({ id: "source-uuid", version: 2 }))
    .mockResolvedValueOnce(response({ id: "job-uuid", state: "PENDING" }, 202));

  await createSource({
    name: "Example",
    classification: "OTHER",
    type: "WRITTEN",
    period: "MODERN",
  });
  await patchSourceField("source-uuid", "name", "Renamed", 1);
  await removeSource("source-uuid", 2);

  expect(
    new Headers(fetchMock.mock.calls[0][1]?.headers).get("Idempotency-Key"),
  ).toBeTruthy();
  expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("If-Match")).toBe(
    '"1"',
  );
  expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get("If-Match")).toBe(
    '"2"',
  );
});

test("source profiles are read from the stash usage endpoint", async () => {
  const fetchMock = jest
    .spyOn(window, "fetch")
    .mockResolvedValueOnce(
      response([
        {
          id: "profile-uuid",
          name: "Example Company",
          alias: "example-company",
        },
      ]),
    );

  const profiles = await getSourceProfiles("source-uuid");

  expect(profiles.data).toEqual([
    expect.objectContaining({ id: "profile-uuid", alias: "example-company" }),
  ]);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/stash/source/source-uuid/profiles",
    {},
  );
});

test("staged changeset images use the collection POST contract with their stable image ID", async () => {
  const file = new File(["image"], "detail.png", { type: "image/png" });
  const fetchMock = jest
    .spyOn(window, "fetch")
    .mockResolvedValueOnce(
      response({
        image: { id: "018f0000-0000-7000-8000-000000000001" },
        upload: {
          method: "PUT",
          url: "https://uploads.example.test/staged-image",
          headers: { "content-type": "image/png" },
        },
      }, 201),
    )
    .mockResolvedValueOnce(response({}, 200));

  await expect(
    uploadSourceChangesetImage(
      "source-uuid",
      "changeset-uuid",
      "018f0000-0000-7000-8000-000000000001",
      file,
      "Detail image",
    ),
  ).resolves.toMatchObject({ ok: true, status: 201 });

  expect(fetchMock.mock.calls[0]?.[0]).toBe(
    "/api/images/source-changeset/source-uuid/changeset-uuid",
  );
  expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
    imageId: "018f0000-0000-7000-8000-000000000001",
    fileName: "detail.png",
    contentType: "image/png",
    description: "Detail image",
  });
});

test("projects approved staged images into the source carousel before asynchronous promotion", () => {
  const images = projectApprovedSourceImages(
    [{ id: "published", url: "https://example.test/published.jpg" }],
    {
      sourceId: "source-uuid",
      imageOperations: [
        { kind: "ADD", stagedImageId: "new-image", description: "New detail" },
      ],
    },
    [{ id: "new-image", url: "https://example.test/new.jpg" }],
  );

  expect(images).toEqual([
    expect.objectContaining({ id: "published" }),
    expect.objectContaining({
      id: "new-image",
      url: "https://example.test/new.jpg",
      description: "New detail",
      resourceType: "source",
      resourceId: "source-uuid",
    }),
  ]);
});
