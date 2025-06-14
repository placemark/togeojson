import type { Document as XDocument } from "@xmldom/xmldom";
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
  Position,
} from "geojson";
import { coordPair } from "./gpx/coord_pair";
import { getLineStyle } from "./gpx/line";
import { extractProperties } from "./gpx/properties";
import { $, type NS, type P, get1, getMulti } from "./shared";

/**
 * Extract points from a trkseg or rte element.
 */
function getPoints(node: Element, pointname: "trkpt" | "rtept") {
  const pts = $(node, pointname);
  const line: Position[] = [];
  const times = [];
  const extendedValues: P = {};

  for (let i = 0; i < pts.length; i++) {
    const c = coordPair(pts[i]);
    if (!c) {
      continue;
    }
    line.push(c.coordinates);
    if (c.time) times.push(c.time);
    for (const [name, val] of c.extendedValues) {
      const plural =
        name === "heart" ? name : `${name.replace("gpxtpx:", "")}s`;
      if (!extendedValues[plural]) {
        extendedValues[plural] = Array(pts.length).fill(null);
      }
      extendedValues[plural][i] = val;
    }
  }

  if (line.length < 2) return; // Invalid line in GeoJSON

  return {
    line: line,
    times: times,
    extendedValues: extendedValues,
  };
}

/**
 * Extract a LineString geometry from a rte
 * element.
 */
function getRoute(ns: NS, node: Element): Feature<LineString> | undefined {
  const line = getPoints(node, "rtept");
  if (!line) return;
  return {
    type: "Feature",
    properties: Object.assign(
      { _gpxType: "rte" },
      extractProperties(ns, node),
      getLineStyle(get1(node, "extensions"))
    ),
    geometry: {
      type: "LineString",
      coordinates: line.line,
    },
  };
}

function getTrack(
  ns: NS,
  node: Element
): Feature<LineString | MultiLineString> | null {
  const segments = $(node, "trkseg");
  const track = [];
  const times = [];
  const extractedLines = [];

  for (const segment of segments) {
    const line = getPoints(segment, "trkpt");
    if (line) {
      extractedLines.push(line);
      if (line.times?.length) times.push(line.times);
    }
  }

  if (extractedLines.length === 0) return null;

  const multi = extractedLines.length > 1;

  const properties: Feature["properties"] = Object.assign(
    { _gpxType: "trk" },
    extractProperties(ns, node),
    getLineStyle(get1(node, "extensions")),
    times.length
      ? {
          coordinateProperties: {
            times: multi ? times : times[0],
          },
        }
      : {}
  );

  for (let i = 0; i < extractedLines.length; i++) {
    const line = extractedLines[i];
    track.push(line.line);
    if (!properties.coordinateProperties) {
      properties.coordinateProperties = {};
    }
    const props = properties.coordinateProperties;
    // Generally extendedValues will be things like heart
    // rate, and this is an array like { heart: [100, 101...] }
    for (const [name, val] of Object.entries(line.extendedValues)) {
      if (multi) {
        if (!props[name]) {
          props[name] = extractedLines.map((line) =>
            new Array(line.line.length).fill(null)
          );
        }
        props[name][i] = val;
      } else {
        props[name] = val;
      }
    }
  }

  return {
    type: "Feature",
    properties: properties,
    geometry: multi
      ? {
          type: "MultiLineString",
          coordinates: track,
        }
      : {
          type: "LineString",
          coordinates: track[0],
        },
  };
}

/**
 * Extract a point, if possible, from a given node,
 * which is usually a wpt or trkpt
 */
function getPoint(ns: NS, node: Element): Feature<Point> | null {
  const properties: Feature["properties"] = Object.assign(
    extractProperties(ns, node),
    getMulti(node, ["sym"])
  );
  const pair = coordPair(node);
  if (!pair) return null;
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Point",
      coordinates: pair.coordinates,
    },
  };
}

/**
 * Convert GPX to GeoJSON incrementally, returning
 * a [Generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators)
 * that yields output feature by feature.
 */
export function* gpxGen(node: Document | XDocument): Generator<Feature> {
  const n = node as Document;
  const GPXX = "gpxx";
  const GPXX_URI = "http://www.garmin.com/xmlschemas/GpxExtensions/v3";
  // Namespaces
  const ns: NS = [[GPXX, GPXX_URI]];
  const attrs = n.getElementsByTagName("gpx")[0]?.attributes;
  if (attrs) {
    for (const attr of Array.from(attrs)) {
      if (attr.name?.startsWith("xmlns:") && attr.value !== GPXX_URI) {
        ns.push([attr.name, attr.value]);
      }
    }
  }

  for (const track of $(n, "trk")) {
    const feature = getTrack(ns, track);
    if (feature) yield feature;
  }

  for (const route of $(n, "rte")) {
    const feature = getRoute(ns, route);
    if (feature) yield feature;
  }

  for (const waypoint of $(n, "wpt")) {
    const point = getPoint(ns, waypoint);
    if (point) yield point;
  }
}

/**
 *
 * Convert a GPX document to GeoJSON. The first argument, `doc`, must be a GPX
 * document as an XML DOM - not as a string. You can get this using jQuery's default
 * `.ajax` function or using a bare XMLHttpRequest with the `.response` property
 * holding an XML DOM.
 *
 * The output is a JavaScript object of GeoJSON data, same as `.kml` outputs, with the
 * addition of a `_gpxType` property on each `LineString` feature that indicates whether
 * the feature was encoded as a route (`rte`) or track (`trk`) in the GPX document.
 */
export function gpx(node: Document | XDocument): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: Array.from(gpxGen(node)),
  };
}
