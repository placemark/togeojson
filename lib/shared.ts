import type { Feature, Geometry } from "geojson";
import type xmldom from "@xmldom/xmldom";

export function $(element: Element | xmldom.Element | Document | xmldom.Document, tagName: string) {
  return [...element.getElementsByTagName(tagName)];
}

export type P = NonNullable<Feature["properties"]>;
export type F = Feature<Geometry | null>;

export type StyleMap = { [key: string]: P };

export function normalizeId(id: string) {
  return id[0] === "#" ? id : `#${id}`;
}

export function $ns(
  element: Element | xmldom.Element | Document | xmldom.Document,
  tagName: string,
  ns: string
) {
  return [...element.getElementsByTagNameNS(ns, tagName)];
}

/**
 * get the content of a text node, if any
 */
export function nodeVal(node: Element | xmldom.Element | null) {
  node?.normalize();
  return (node && node.textContent) || "";
}

/**
 * Get one Y child of X, if any, otherwise null
 */
export function get1(
  node: Element | xmldom.Element,
  tagName: string,
  callback?: (elem: Element | xmldom.Element) => unknown
) {
  const n = node.getElementsByTagName(tagName);
  const result = n.length ? n[0] : null;
  if (result && callback) callback(result);
  return result;
}

export function get(
  node: Element | xmldom.Element | null,
  tagName: string,
  callback?: (elem: Element | xmldom.Element, properties: P) => P
) {
  const properties: Feature["properties"] = {};
  if (!node) return properties;
  const n = node.getElementsByTagName(tagName);
  const result = n.length ? n[0] : null;
  if (result && callback) {
    return callback(result, properties);
  }
  return properties;
}

export function val1(
  node: Element | xmldom.Element,
  tagName: string,
  callback: (val: string) => P | void
): P {
  const val = nodeVal(get1(node, tagName));
  if (val && callback) return callback(val) || {};
  return {};
}

export function $num(
  node: Element | xmldom.Element,
  tagName: string,
  callback: (val: number) => Feature["properties"]
) {
  const val = parseFloat(nodeVal(get1(node, tagName)));
  if (isNaN(val)) return undefined;
  if (val && callback) return callback(val) || {};
  return {};
}

export function num1(
  node: Element | xmldom.Element,
  tagName: string,
  callback?: (val: number) => unknown
) {
  const val = parseFloat(nodeVal(get1(node, tagName)));
  if (isNaN(val)) return undefined;
  if (callback) callback(val);
  return val;
}

export function getMulti(node: Element | xmldom.Element, propertyNames: string[]): P {
  const properties: P = {};
  for (const property of propertyNames) {
    val1(node, property, (val) => {
      properties[property] = val;
    });
  }
  return properties;
}

export function isElement(node: Node | xmldom.Node | null): node is Element | xmldom.Element {
  return node?.nodeType === 1;
}
