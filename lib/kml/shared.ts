import {
  $,
  type P,
  type StyleMap,
  get,
  get1,
  nodeVal,
  normalizeId,
  val1,
} from "../shared";

export type TypeConverter = (x: string) => unknown;
export type Schema = { [key: string]: TypeConverter };

const toNumber: TypeConverter = (x) => Number(x);
export const typeConverters: Record<string, TypeConverter> = {
  string: (x) => x,
  int: toNumber,
  uint: toNumber,
  short: toNumber,
  ushort: toNumber,
  float: toNumber,
  double: toNumber,
  bool: (x) => Boolean(x),
};

export function extractExtendedData(node: Element, schema: Schema) {
  return get(node, "ExtendedData", (extendedData, properties) => {
    for (const data of $(extendedData, "Data")) {
      properties[data.getAttribute("name") || ""] = nodeVal(
        get1(data, "value")
      );
    }
    for (const simpleData of $(extendedData, "SimpleData")) {
      const name = simpleData.getAttribute("name") || "";
      const typeConverter = schema[name] || typeConverters.string;
      properties[name] = typeConverter(nodeVal(simpleData));
    }
    return properties;
  });
}

export function getMaybeHTMLDescription(node: Element) {
  const descriptionNode = get1(node, "description");
  for (const c of Array.from(descriptionNode?.childNodes || [])) {
    if (c.nodeType === 4) {
      return {
        description: {
          "@type": "html",
          value: nodeVal(c as Element),
        },
      };
    }
  }
  return {};
}

export function extractTimeSpan(node: Element): P {
  return get(node, "TimeSpan", (timeSpan) => {
    return {
      timespan: {
        begin: nodeVal(get1(timeSpan, "begin")),
        end: nodeVal(get1(timeSpan, "end")),
      },
    };
  });
}

export function extractTimeStamp(node: Element): P {
  return get(node, "TimeStamp", (timeStamp) => {
    return { timestamp: nodeVal(get1(timeStamp, "when")) };
  });
}

export function extractCascadedStyle(node: Element, styleMap: StyleMap): P {
  return val1(node, "styleUrl", (styleUrl) => {
    styleUrl = normalizeId(styleUrl);
    if (styleMap[styleUrl]) {
      return Object.assign({ styleUrl }, styleMap[styleUrl]);
    }
    // For backward-compatibility. Should we still include
    // styleUrl even if it's not resolved?
    return { styleUrl };
  });
}

export enum AltitudeMode {
  ABSOLUTE = "absolute",
  RELATIVE_TO_GROUND = "relativeToGround",
  CLAMP_TO_GROUND = "clampToGround",
  CLAMP_TO_SEAFLOOR = "clampToSeaFloor",
  RELATIVE_TO_SEAFLOOR = "relativeToSeaFloor",
}

export function processAltitudeMode(mode: Element | null): AltitudeMode | null {
  switch (mode?.textContent) {
    case AltitudeMode.ABSOLUTE:
      return AltitudeMode.ABSOLUTE;
    case AltitudeMode.CLAMP_TO_GROUND:
      return AltitudeMode.CLAMP_TO_GROUND;
    case AltitudeMode.CLAMP_TO_SEAFLOOR:
      return AltitudeMode.CLAMP_TO_SEAFLOOR;
    case AltitudeMode.RELATIVE_TO_GROUND:
      return AltitudeMode.RELATIVE_TO_GROUND;
    case AltitudeMode.RELATIVE_TO_SEAFLOOR:
      return AltitudeMode.RELATIVE_TO_SEAFLOOR;
    default:
      break;
  }
  return null;
}

export type BBox = [number, number, number, number];
