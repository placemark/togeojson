import { Feature, Geometry } from "geojson";
import {
  StyleMap,
  $,
  get,
  get1,
  getMulti,
  nodeVal,
  normalizeId,
  val1,
} from "../shared";
import { extractStyle } from "./extractStyle";
import { getGeometry } from "./geometry";

function extractExtendedData(node: Element) {
  return get(node, "ExtendedData", (extendedData, properties) => {
    for (const data of $(extendedData, "Data")) {
      properties[data.getAttribute("name") || ""] = nodeVal(
        get1(data, "value")
      );
    }
    for (const simpleData of $(extendedData, "SimpleData")) {
      properties[simpleData.getAttribute("name") || ""] = nodeVal(simpleData);
    }
    return properties;
  });
}

export function getPlacemark(
  node: Element,
  styleMap: StyleMap
): Feature<Geometry | null> {
  const { coordTimes, geometries } = getGeometry(node);

  const feature: Feature<Geometry | null> = {
    type: "Feature",
    geometry:
      geometries.length === 0
        ? null
        : geometries.length === 1
        ? geometries[0]
        : {
            type: "GeometryCollection",
            geometries,
          },
    properties: Object.assign(
      getMulti(node, ["name", "address", "visibility", "description"]),
      val1(node, "styleUrl", (styleUrl) => {
        styleUrl = normalizeId(styleUrl);
        if (styleMap[styleUrl]) {
          return Object.assign({ styleUrl }, styleMap[styleUrl]);
        } else {
          // For backward-compatibility. Should we still include
          // styleUrl even if it's not resolved?
          return { styleUrl };
        }
      }),
      extractStyle(node),
      extractExtendedData(node),
      get(node, "TimeSpan", (timeSpan) => {
        return {
          timespan: {
            begin: nodeVal(get1(timeSpan, "begin")),
            end: nodeVal(get1(timeSpan, "end")),
          },
        };
      }),
      get(node, "TimeStamp", (timeStamp) => {
        return { timestamp: nodeVal(get1(timeStamp, "when")) };
      }),
      coordTimes.length
        ? {
            coordinateProperties: {
              times: coordTimes.length === 1 ? coordTimes[0] : coordTimes,
            },
          }
        : {}
    ),
  };

  const id = node.getAttribute("id");
  if (id !== null && id !== "") feature.id = id;
  return feature;
}
