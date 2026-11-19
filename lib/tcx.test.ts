import xmldom from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { tcx } from "./tcx";

function parse(str: string) {
  return new xmldom.DOMParser().parseFromString(
    str,
    "text/xml"
  ) as unknown as Document;
}

function trackpoint(lat: number, lon: number) {
  return `<Trackpoint><Position><LatitudeDegrees>${lat}</LatitudeDegrees><LongitudeDegrees>${lon}</LongitudeDegrees></Position></Trackpoint>`;
}

function course(name: string, seconds: number, lat: number, lon: number) {
  return `<Course>
    <Name>${name}</Name>
    <Lap><TotalTimeSeconds>${seconds}</TotalTimeSeconds></Lap>
    <Track>${trackpoint(lat, lon)}${trackpoint(lat + 1, lon + 1)}</Track>
  </Course>`;
}

describe("tcx courses", () => {
  it("makes one feature per course", () => {
    const doc =
      parse(`<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
      <Courses>
        ${course("First", 100, 1, 2)}
        ${course("Second", 200, 5, 6)}
      </Courses>
    </TrainingCenterDatabase>`);
    const { features } = tcx(doc);
    expect(features).toHaveLength(2);
    expect(features.map((f) => f.properties)).toEqual([
      { name: "First", totalTimeSeconds: 100 },
      { name: "Second", totalTimeSeconds: 200 },
    ]);
    expect(features.map((f) => f.geometry)).toEqual([
      {
        type: "LineString",
        coordinates: [
          [2, 1],
          [3, 2],
        ],
      },
      {
        type: "LineString",
        coordinates: [
          [6, 5],
          [7, 6],
        ],
      },
    ]);
  });
  it("does not use a trackpoint's DistanceMeters as the lap's own", () => {
    const doc =
      parse(`<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
      <Activities><Activity><Lap>
        <TotalTimeSeconds>100</TotalTimeSeconds>
        <Track><Trackpoint>
          <Position><LatitudeDegrees>1</LatitudeDegrees><LongitudeDegrees>2</LongitudeDegrees></Position>
          <DistanceMeters>12.5</DistanceMeters>
        </Trackpoint><Trackpoint>
          <Position><LatitudeDegrees>2</LatitudeDegrees><LongitudeDegrees>3</LongitudeDegrees></Position>
          <DistanceMeters>25</DistanceMeters>
        </Trackpoint></Track>
      </Lap></Activity></Activities>
    </TrainingCenterDatabase>`);
    const { features } = tcx(doc);
    expect(features[0].properties).toEqual({ totalTimeSeconds: 100 });
  });
});
