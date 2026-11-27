import { type NS, type P, isElement, isWithin, nodeVal } from "../shared";

/**
 * Tags inside these elements belong to a track or route point,
 * not to the track or route itself.
 */
const POINT_CONTAINERS = ["trkseg", "rtept"];

function children(node: Element, tagName: string): Element[] {
  return Array.from(node.childNodes).filter(
    (child): child is Element => isElement(child) && child.tagName === tagName
  );
}

function childValues(node: Element, propertyNames: string[]): P {
  const properties: P = {};
  for (const property of propertyNames) {
    const val = nodeVal(children(node, property)[0] || null);
    if (val) properties[property] = val;
  }
  return properties;
}

export function extractProperties(ns: NS, node: Element) {
  const properties = childValues(node, [
    "name",
    "cmt",
    "desc",
    "type",
    "time",
    "keywords",
  ]);

  for (const [n, url] of ns) {
    for (const child of Array.from(node.getElementsByTagNameNS(url, "*"))) {
      if (isWithin(node, child, POINT_CONTAINERS)) continue;
      if (Array.from(child.childNodes).some(isElement)) continue;
      properties[child.tagName.replace(":", "_")] = nodeVal(child)?.trim();
    }
  }

  const links = children(node, "link");
  if (links.length) {
    properties.links = links.map((link) =>
      Object.assign(
        { href: link.getAttribute("href") },
        childValues(link, ["text", "type"])
      )
    );
  }

  return properties;
}
