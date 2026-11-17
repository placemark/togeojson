import fs from "node:fs";
import path from "node:path";
import { check } from "@placemarkio/check-geojson";
import xmldom from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import * as tj from "./index";

const d = "./test/data/";

function parse(file: string) {
  return new xmldom.DOMParser().parseFromString(
    fs.readFileSync(file, "utf8"),
    "text/xml"
  ) as unknown as Document;
}

describe("toGeoJSON", () => {
  // Loop through all files except hidden ones
  for (const file of fs
    .readdirSync(d)
    .filter((item) => !item.startsWith("."))) {
    it(`${file}`, () => {
      const ext = path.extname(file).substring(1) as "kml" | "tcx" | "gpx";
      const dom = parse(path.join(d, file));
      const res = tj[ext](dom);
      expect(res).toMatchSnapshot();
      expect(() => {
        check(JSON.stringify(res));
      }).not.toThrow();

      if (ext === "kml") {
        expect(tj.kmlWithFolders(dom)).toMatchSnapshot();
        expect(
          tj.kmlWithFolders(dom, {
            skipNullGeometry: true,
          })
        ).toMatchSnapshot();
      }
    });
  }
});

describe("mini cases", () => {
  it("gpx properties only come from the feature's own tags", () => {
    const dom = new xmldom.DOMParser().parseFromString(
      `<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:ex="http://example.com/ex">
        <wpt lat="1" lon="2">
          <link href="http://example.com/a.jpg"><text>photo</text><type>image/jpeg</type></link>
        </wpt>
        <trk>
          <extensions><ex:id>track</ex:id></extensions>
          <trkseg>
            <trkpt lat="1" lon="2">
              <name>first point</name>
              <time>2024-01-01T00:00:00Z</time>
              <link href="http://example.com/point"/>
              <extensions><ex:id>point</ex:id></extensions>
            </trkpt>
            <trkpt lat="1" lon="3"><desc>second point</desc></trkpt>
          </trkseg>
        </trk>
        <rte>
          <name>route</name>
          <rtept lat="1" lon="2"><cmt>first rtept</cmt><type>stop</type></rtept>
          <rtept lat="1" lon="3"/>
        </rte>
      </gpx>`,
      "text/xml"
    ) as unknown as Document;
    const [track, route, waypoint] = tj.gpx(dom).features;
    expect(track.properties).toEqual({
      _gpxType: "trk",
      ex_id: "track",
      coordinateProperties: {
        times: ["2024-01-01T00:00:00Z", null],
        "ex:ids": ["point", null],
      },
    });
    expect(route.properties).toEqual({ _gpxType: "rte", name: "route" });
    expect(waypoint.properties).toEqual({
      links: [
        { href: "http://example.com/a.jpg", text: "photo", type: "image/jpeg" },
      ],
    });
  });
  it("gpx line style keeps an opacity or width of 0", () => {
    const dom = new xmldom.DOMParser().parseFromString(
      `<gpx xmlns="http://www.topografix.com/GPX/1/1">
        <trk>
          <extensions>
            <line xmlns="http://www.topografix.com/GPX/gpx_style/0/2">
              <color>893380</color><opacity>0</opacity><width>0.0</width>
            </line>
          </extensions>
          <trkseg><trkpt lat="1" lon="2"/><trkpt lat="1" lon="3"/></trkseg>
        </trk>
      </gpx>`,
      "text/xml"
    ) as unknown as Document;
    const [track] = tj.gpx(dom).features;
    expect(track.properties).toMatchObject({
      stroke: "#893380",
      "stroke-opacity": 0,
      "stroke-width": 0,
    });
  });
  it("kml boolean elements read false and 0 as false", () => {
    const dom = new xmldom.DOMParser().parseFromString(
      `<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
        <Placemark>
          <name>hidden</name>
          <visibility>false</visibility>
          <Style><PolyStyle><fill>false</fill><outline> 0 </outline></PolyStyle></Style>
          <Point><coordinates>1,2</coordinates></Point>
        </Placemark>
        <Placemark>
          <name>shown</name>
          <visibility>true</visibility>
          <Style><PolyStyle><fill>true</fill><outline>1</outline></PolyStyle></Style>
          <Point><coordinates>1,2</coordinates></Point>
        </Placemark>
        <Placemark>
          <name>hidden too</name>
          <visibility>0</visibility>
          <Point><coordinates>1,2</coordinates></Point>
        </Placemark>
        <GroundOverlay>
          <visibility>false</visibility>
          <LatLonBox><north>1</north><south>0</south><east>1</east><west>0</west></LatLonBox>
        </GroundOverlay>
      </Document></kml>`,
      "text/xml"
    ) as unknown as Document;
    const [hidden, shown, hiddenToo, overlay] = tj.kml(dom).features;
    expect(hidden.properties).toEqual({
      name: "hidden",
      visibility: false,
      "fill-opacity": 0,
      "stroke-opacity": 0,
    });
    expect(shown.properties).toEqual({ name: "shown", visibility: true });
    expect(hiddenToo.properties).toEqual({
      name: "hidden too",
      visibility: false,
    });
    expect(overlay.properties?.visibility).toBe(false);
  });
  it("skip null geometries", () => {
    expect(
      tj.kml(parse(path.join(d, "null_geometry.kml")), {
        skipNullGeometry: true,
      }).features
    ).toHaveLength(0);
    expect(
      tj.kml(parse(path.join(d, "null_geometry.kml")), {
        skipNullGeometry: false,
      }).features
    ).toHaveLength(1);
  });
  it("folder nesting", () => {
    expect(
      tj.kmlWithFolders(parse(path.join(d, "inline_style_mini.kml")))
    ).toMatchInlineSnapshot(`
        {
          "children": [
            {
              "children": [
                {
                  "geometry": {
                    "coordinates": [
                      [
                        2.3101624,
                        48.7301875,
                      ],
                      [
                        2.3098714,
                        48.7300247,
                      ],
                      [
                        2.3098051,
                        48.7299542,
                      ],
                    ],
                    "type": "LineString",
                  },
                  "properties": {
                    "name": "With all inline styles",
                    "stroke": "#ff0000",
                    "stroke-opacity": 1,
                    "stroke-width": 3,
                  },
                  "type": "Feature",
                },
              ],
              "meta": {
                "name": "Inline style test",
              },
              "type": "folder",
            },
          ],
          "type": "root",
        }
      `);
  });
});
