import {
  appendMapSearchParams,
  overlapsHistoricalRange,
  publicSearchParams,
  rangeFromInputs,
} from "./publicSearchFilterContract";

describe("public search filter contract", () => {
  it("uses the same inclusive BC/AD range semantics across public discovery", () => {
    const range = rangeFromInputs(
      { year: "50", era: "BC" },
      { year: "20", era: "AD" },
    );
    expect(
      overlapsHistoricalRange({ from: { year: 10, era: "BC" } }, range),
    ).toBe(true);
    expect(
      overlapsHistoricalRange({ to: { year: 51, era: "BC" } }, range),
    ).toBe(false);
    expect(overlapsHistoricalRange({}, range)).toBe(true);
  });

  it("serializes a shareable public filter and its map namespace", () => {
    const range = rangeFromInputs(
      { year: "50", era: "BC" },
      { year: "20", era: "AD" },
    );
    const params = appendMapSearchParams(
      publicSearchParams({ query: "  Rome ", period: "ANTIQUITY", range }),
      range,
      "source",
    );
    expect(params.toString()).toBe(
      "q=Rome&period=ANTIQUITY&fromYear=50&fromEra=BC&toYear=20&toEra=AD&sourceFrom=-49&sourceTo=20",
    );
  });
});
