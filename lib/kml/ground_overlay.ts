import { Feature, Geometry } from "geojson";
import { StyleMap, get1, num1, getMulti } from "../shared";
import {
  extractCascadedStyle,
  extractExtendedData,
  extractTimeSpan,
  extractTimeStamp,
  getMaybeHTMLDescription,
} from "./shared";
import { extractIconHref, extractStyle } from "./extractStyle";
import { coord, fixRing, getCoordinates } from "./geometry";

function getGroundOverlayBox(node: Element): Geometry | null {
  const latLonQuad = get1(node, "gx:LatLonQuad");

  if (latLonQuad) {
    const ring = fixRing(coord(getCoordinates(node)));
    return {
      type: "Polygon",
      coordinates: [ring],
    };
  }

  const latLonBox = get1(node, "LatLonBox");

  if (latLonBox) {
    const north = num1(latLonBox, "north");
    const west = num1(latLonBox, "west");
    const east = num1(latLonBox, "east");
    const south = num1(latLonBox, "south");

    // FIXME: rotation support
    // const rotation = num1(latLonBox, "rotation");

    if (
      typeof north === "number" &&
      typeof south === "number" &&
      typeof west === "number" &&
      typeof east === "number"
    ) {
      return {
        type: "Polygon",
        coordinates: [
          [
            [west, south], // bottom left
            [west, north], // top left
            [east, north], // top right
            [west, north], // bottom right
            [west, south], // bottom left (again)
          ],
        ],
      };
    }
  }

  return null;
}

export function getGroundOverlay(
  node: Element,
  styleMap: StyleMap
): Feature<Geometry | null> {
  const geometry = getGroundOverlayBox(node);

  const feature: Feature<Geometry | null> = {
    type: "Feature",
    geometry,
    properties: Object.assign(
      getMulti(node, [
        "name",
        "address",
        "visibility",
        "open",
        "phoneNumber",
        "description",
      ]),
      getMaybeHTMLDescription(node),
      extractCascadedStyle(node, styleMap),
      extractStyle(node),
      extractIconHref(node),
      extractExtendedData(node),
      extractTimeSpan(node),
      extractTimeStamp(node)
    ),
  };

  if (feature.properties?.visibility !== undefined) {
    feature.properties.visibility = feature.properties.visibility !== "0";
  }

  const id = node.getAttribute("id");
  if (id !== null && id !== "") feature.id = id;
  return feature;
}
