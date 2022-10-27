import {
  get,
  get1,
  nodeVal,
  $,
  normalizeId,
  P,
  StyleMap,
  val1,
} from "../shared";

export function extractExtendedData(node: Element) {
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
