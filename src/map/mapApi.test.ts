import { listMapPlaceEntities } from "./mapApi";

test("sends exact-place role refinements as a bounded query parameter", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({ items: [] }),
  } as Response);

  await listMapPlaceEntities(
    "seed:rome",
    ["SOURCE"],
    ["DISCOVERED_AT"],
  );

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("types=SOURCE&roles=DISCOVERED_AT"),
    expect.objectContaining({ signal: undefined }),
  );
  fetchMock.mockRestore();
});
