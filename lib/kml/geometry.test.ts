import xmldom from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { kml } from "../kml";
import { coord, coord1, fixRing } from "./geometry";

describe("coord1", () => {
  it("parses a coordinate", () => {
    expect(coord1("42,24")).toEqual([42, 24]);
    expect(coord1("2,2")).toEqual([2, 2]);
    expect(coord1("2,2,4")).toEqual([2, 2, 4]);
  });
  it("rejects a tuple with an invalid component", () => {
    expect(coord1("a,24")).toEqual([]);
  });
});

describe("coord", () => {
  it("parses coordinates", () => {
    expect(coord("42,24 1,2")).toEqual([
      [42, 24],
      [1, 2],
    ]);
    expect(coord("42,24 1,2 alpha,beta")).toEqual([
      [42, 24],
      [1, 2],
    ]);
  });
});

describe("gx:Track", () => {
  function track(coords: string[]) {
    const body = coords.map((c) => `<gx:coord>${c}</gx:coord>`).join("");
    return new xmldom.DOMParser().parseFromString(
      `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Placemark><gx:Track>${body}</gx:Track></Placemark></kml>`,
      "text/xml"
    ) as unknown as Document;
  }

  it("keeps both positions of a two-point track", () => {
    expect(kml(track(["0 0 0", "1 2 3"])).features[0].geometry).toEqual({
      type: "LineString",
      coordinates: [
        [0, 0, 0],
        [1, 2, 3],
      ],
    });
  });

  it("reads coordinates with extra whitespace", () => {
    expect(
      kml(track(["\n  1 2 3\n", "4  5\t6", " 7 8 "])).features[0].geometry
    ).toEqual({
      type: "LineString",
      coordinates: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8],
      ],
    });
  });

  it("keeps a one-point track as a point", () => {
    expect(kml(track(["4 5 6"])).features[0].geometry).toEqual({
      type: "Point",
      coordinates: [4, 5, 6],
    });
  });
});

describe("coordinate times", () => {
  function placemark(body: string) {
    return kml(
      new xmldom.DOMParser().parseFromString(
        `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Placemark>${body}</Placemark></kml>`,
        "text/xml"
      ) as unknown as Document
    ).features[0].properties;
  }

  const untimed =
    "<gx:Track><gx:coord>0 0</gx:coord><gx:coord>1 1</gx:coord></gx:Track>";
  const timed =
    "<gx:Track><when>2020-01-01T00:00:00Z</when><when>2020-01-01T00:01:00Z</when><gx:coord>2 2</gx:coord><gx:coord>3 3</gx:coord></gx:Track>";

  it("keeps times on the right track when an earlier track has none", () => {
    expect(
      placemark(`<gx:MultiTrack>${untimed}${timed}</gx:MultiTrack>`)
        ?.coordinateProperties
    ).toEqual({
      times: [[], ["2020-01-01T00:00:00Z", "2020-01-01T00:01:00Z"]],
    });
  });

  it("keeps times on the right track when a later track has none", () => {
    expect(
      placemark(`<gx:MultiTrack>${timed}${untimed}</gx:MultiTrack>`)
        ?.coordinateProperties
    ).toEqual({
      times: [["2020-01-01T00:00:00Z", "2020-01-01T00:01:00Z"], []],
    });
  });

  it("keeps times on the right geometry next to a LineString", () => {
    expect(
      placemark(
        `<MultiGeometry><LineString><coordinates>5,5 6,6</coordinates></LineString>${timed}</MultiGeometry>`
      )?.coordinateProperties
    ).toEqual({
      times: [[], ["2020-01-01T00:00:00Z", "2020-01-01T00:01:00Z"]],
    });
  });

  it("adds no times when no track has any", () => {
    expect(
      placemark(`<gx:MultiTrack>${untimed}${untimed}</gx:MultiTrack>`)
    ).not.toHaveProperty("coordinateProperties");
  });
});

describe("fixRing", () => {
  it("completes a ring if necessary", () => {
    expect(
      fixRing([
        [1, 2],
        [3, 4],
        [5, 6],
      ])
    ).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [1, 2],
    ]);
  });
  it("does not touch good rings", () => {
    expect(
      fixRing([
        [1, 2],
        [3, 4],
        [5, 6],
        [1, 2],
      ])
    ).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
      [1, 2],
    ]);
  });
});
