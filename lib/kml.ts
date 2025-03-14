import type { Document as XDocument } from "@xmldom/xmldom";
import type { FeatureCollection, Geometry } from "geojson";
import { extractStyle } from "./kml/extractStyle";
import { getGroundOverlay } from "./kml/ground_overlay";
import { getPlacemark } from "./kml/placemark";
import { type Schema, typeConverters } from "./kml/shared";
import { getNetworkLink } from './kml/networklink';
import {
  $,
  type F,
  type P,
  type StyleMap,
  isElement,
  nodeVal,
  normalizeId,
  val1,
} from "./shared";

/**
 * Options to customize KML output.
 *
 * The only option currently
 * is `skipNullGeometry`. Both the KML and GeoJSON formats support
 * the idea of features that don't have geometries: in KML,
 * this is a Placemark without a Point, etc element, and in GeoJSON
 * it's a geometry member with a value of `null`.
 *
 * toGeoJSON, by default, translates null geometries in KML to
 * null geometries in GeoJSON. For systems that use GeoJSON but
 * don't support null geometries, you can specify `skipNullGeometry`
 * to omit these features entirely and only include
 * features that have a geometry defined.
 */
export interface KMLOptions {
  skipNullGeometry?: boolean;
}

/**
 * A folder including metadata. Folders
 * may contain other folders or features,
 * or nothing at all.
 */
export interface Folder {
  type: "folder";
  /**
   * Standard values:
   *
   * * "name",
   * * "visibility",
   * * "open",
   * * "address",
   * * "description",
   * * "phoneNumber",
   * * "visibility",
   */
  meta: {
    [key: string]: unknown;
  };
  children: Array<Folder | F>;
}

/**
 * A nested folder structure, represented
 * as a tree with folders and features.
 */
export interface Root {
  type: "root";
  children: Array<Folder | F>;
}

type TreeContainer = Root | Folder;

function getStyleId(style: Element) {
  let id = style.getAttribute("id");
  const parentNode = style.parentNode;
  if (
    !id &&
    isElement(parentNode) &&
    parentNode.localName === "CascadingStyle"
  ) {
    id = parentNode.getAttribute("kml:id") || parentNode.getAttribute("id");
  }
  return normalizeId(id || "");
}

function buildStyleMap(node: Document): StyleMap {
  const styleMap: StyleMap = {};
  for (const style of $(node, "Style")) {
    styleMap[getStyleId(style)] = extractStyle(style);
  }
  for (const map of $(node, "StyleMap")) {
    const id = normalizeId(map.getAttribute("id") || "");
    val1(map, "styleUrl", (styleUrl) => {
      styleUrl = normalizeId(styleUrl);
      if (styleMap[styleUrl]) {
        styleMap[id] = styleMap[styleUrl];
      }
    });
  }
  return styleMap;
}

function buildSchema(node: Document): Schema {
  const schema: Schema = {};
  for (const field of $(node, "SimpleField")) {
    schema[field.getAttribute("name") || ""] =
      typeConverters[field.getAttribute("type") || ""] || typeConverters.string;
  }
  return schema;
}

const FOLDER_PROPS = [
  "name",
  "visibility",
  "open",
  "address",
  "description",
  "phoneNumber",
  "visibility",
] as const;

function getFolder(node: Element): Folder {
  const meta: P = {};

  for (const child of Array.from(node.childNodes)) {
    if (isElement(child) && FOLDER_PROPS.includes(child.tagName as any)) {
      meta[child.tagName] = nodeVal(child);
    }
  }

  return {
    type: "folder",
    meta,
    children: [],
  };
}

/**
 * Yield a nested tree with KML folder structure
 *
 * This generates a tree with the given structure:
 *
 * ```js
 * {
 *   "type": "root",
 *   "children": [
 *     {
 *       "type": "folder",
 *       "meta": {
 *         "name": "Test"
 *       },
 *       "children": [
 *          // ...features and folders
 *       ]
 *     }
 *     // ...features
 *   ]
 * }
 * ```
 *
 * ### GroundOverlay
 *
 * GroundOverlay elements are converted into
 * `Feature` objects with `Polygon` geometries,
 * a property like:
 *
 * ```json
 * {
 *   "@geometry-type": "groundoverlay"
 * }
 * ```
 *
 * And the ground overlay's image URL in the `href`
 * property. Ground overlays will need to be displayed
 * with a separate method to other features, depending
 * on which map framework you're using.
 */
export function kmlWithFolders(
  node: Document | XDocument,
  options: KMLOptions = {
    skipNullGeometry: false,
  }
): Root {
  const n = node as Document;
  const styleMap = buildStyleMap(n);
  const schema = buildSchema(n);

  // atomic geospatial types supported by KML - MultiGeometry is
  // handled separately
  // all root placemarks in the file
  const placemarks = [];
  const networkLinks = [];
  const tree: Root = { type: "root", children: [] };

  function traverse(
    node: Document | ChildNode | Element,
    pointer: TreeContainer,
    options: KMLOptions
  ) {
    if (isElement(node)) {
      switch (node.tagName) {
        case "GroundOverlay": {
          placemarks.push(node);
          const placemark = getGroundOverlay(node, styleMap, schema, options);
          if (placemark) {
            pointer.children.push(placemark);
          }
          break;
        }
        case "Placemark": {
          placemarks.push(node);
          const placemark = getPlacemark(node, styleMap, schema, options);
          if (placemark) {
            pointer.children.push(placemark);
          }
          break;
        }
        case "Folder": {
          const folder = getFolder(node);
          pointer.children.push(folder);
          pointer = folder;
          break;
        }
        case "NetworkLink": {
          networkLinks.push(node);
          const networkLink = getNetworkLink(node, styleMap, schema, options);
          if(networkLink) {
            pointer.children.push(networkLink);
          }
          break;
        }
      }
    }

    if (node.childNodes) {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i], pointer, options);
      }
    }
  }

  traverse(n, tree, options);

  return tree;
}

/**
 * Convert KML to GeoJSON incrementally, returning
 * a [Generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators)
 * that yields output feature by feature.
 */
export function* kmlGen(
  node: Document | XDocument,
  options: KMLOptions = {
    skipNullGeometry: false,
  }
): Generator<F> {
  const n = node as Document;
  const styleMap = buildStyleMap(n);
  const schema = buildSchema(n);
  for (const placemark of $(n, "Placemark")) {
    const feature = getPlacemark(placemark, styleMap, schema, options);
    if (feature) yield feature;
  }
  for (const groundOverlay of $(n, "GroundOverlay")) {
    const feature = getGroundOverlay(groundOverlay, styleMap, schema, options);
    if (feature) yield feature;
  }
}

/**
 * Convert a KML document to GeoJSON. The first argument, `doc`, must be a KML
 * document as an XML DOM - not as a string. You can get this using jQuery's default
 * `.ajax` function or using a bare XMLHttpRequest with the `.response` property
 * holding an XML DOM.
 *
 * The output is a JavaScript object of GeoJSON data. You can convert it to a string
 * with [JSON.stringify](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)
 * or use it directly in libraries.
 */
export function kml(
  node: Document | XDocument,
  options: KMLOptions = {
    skipNullGeometry: false,
  }
): FeatureCollection<Geometry | null> {
  return {
    type: "FeatureCollection",
    features: Array.from(kmlGen(node as Document, options)),
  };
}
