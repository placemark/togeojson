import { Feature, Geometry } from "geojson";
import { StyleMap, getMulti } from "../shared";
import {
  extractCascadedStyle,
  extractExtendedData,
  extractTimeSpan,
  extractTimeStamp,
  getMaybeHTMLDescription,
  Schema,
} from "./shared";
import { extractStyle } from "./extractStyle";
import { getGeometry } from "./geometry";

function geometryListToGeometry(geometries: Geometry[]): Geometry | null {
  return geometries.length === 0
    ? null
    : geometries.length === 1
    ? geometries[0]
    : {
        type: "GeometryCollection",
        geometries,
      };
}

export function getPlacemark(
  node: Element,
  styleMap: StyleMap,
  schema: Schema
): Feature<Geometry | null> {
  const { coordTimes, geometries } = getGeometry(node);

  const feature: Feature<Geometry | null> = {
    type: "Feature",
    geometry: geometryListToGeometry(geometries),
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
      extractExtendedData(node, schema),
      extractTimeSpan(node),
      extractTimeStamp(node),
      coordTimes.length
        ? {
            coordinateProperties: {
              times: coordTimes.length === 1 ? coordTimes[0] : coordTimes,
            },
          }
        : {}
    ),
  };

  if (feature.properties?.visibility !== undefined) {
    feature.properties.visibility = feature.properties.visibility !== "0";
  }

  const id = node.getAttribute("id");
  if (id !== null && id !== "") feature.id = id;
  return feature;
}
