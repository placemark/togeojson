import type { Feature, Polygon } from "geojson";
import type { KMLOptions } from "lib/kml";
import { type StyleMap, get1, getMulti, num1 } from "../shared";
import { extractIconHref, extractStyle } from "./extractStyle";
import {
    type Schema,
    extractCascadedStyle,
    extractExtendedData,
    extractTimeSpan,
    extractTimeStamp,
    getMaybeHTMLDescription,
} from "./shared";
import { aL } from "vitest/dist/chunks/reporters.66aFHiyX";

interface BoxGeometry {
    bbox?: BBox;
    geometry: Polygon;
}

class AltitudeMode {
    static ABSOLUTE = new AltitudeMode("absolute");
    static RELATIVE_TO_GROUND = new AltitudeMode("relativeToGround");
    static CLAMP_TO_GROUND = new AltitudeMode("clampToGround");
    static CLAMP_TO_SEAFLOOR = new AltitudeMode("clampToSeaFloor");
    static RELATIVE_TO_SEAFLOOR = new AltitudeMode("relativeToSeaFloor");

    #name: string;
    constructor(name: string) {
        this.#name = name;
    }

    toString() {
        return this.#name;
    }
}

function getNetworkLinkRegion(node: Element): BoxGeometry | null {
    const region = get1(node, "Region");

    if (region) {
        return getLatLonAltBox(region);
    }
    return null;
}

type BBox = [number, number, number, number];

type LOD = [number, number | null, number | null, number | null];

function getLod(node: Element): LOD | null {
    let resLOD: LOD | null = null;

    const lod = get1(node, "Lod");

    if (lod) {
        resLOD = [
            num1(lod, "minLodPixels") ?? -1,
            num1(lod, "maxLodPixels") ?? -1,
            num1(lod, "minFadeExtent") ?? 0,
            num1(lod, "maxFadeExtent") ?? 0,
        ];
    }

    return resLOD;
}

function getLatLonAltBox(node: Element): BoxGeometry | null {
    const latLonAltBox = get1(node, "LatLonAltBox");

    if (latLonAltBox) {
        const north = num1(latLonAltBox, "north");
        const west = num1(latLonAltBox, "west");
        const east = num1(latLonAltBox, "east");
        const south = num1(latLonAltBox, "south");
        const minAlt = num1(latLonAltBox, "minAltitude");
        const maxAlt = num1(latLonAltBox, "maxAltitude");
        function processAltitudeMode(mode: Element | null) {
            if (mode?.textContent) return new AltitudeMode(mode.textContent);
            return null;
        }
        const altitudeMode =
            processAltitudeMode(get1(latLonAltBox, "altitudeMode")) ||
            processAltitudeMode(get1(latLonAltBox, "gx:altitudeMode"));

        if (altitudeMode) {
            switch (altitudeMode) {
                case AltitudeMode.ABSOLUTE:
                case AltitudeMode.CLAMP_TO_GROUND:
                case AltitudeMode.RELATIVE_TO_GROUND:
                    throw new Error(
                        "Altitude Parameter doesn't apply to conversion right now.  May be implemented in future versions"
                    );
                case AltitudeMode.CLAMP_TO_SEAFLOOR:
                case AltitudeMode.RELATIVE_TO_SEAFLOOR:
                default:
                    throw new Error("Currently Mode: " + altitudeMode.toString() + " is not supported.");
                    break;
            }
        } else {
            if (
                typeof north === "number" &&
                typeof south === "number" &&
                typeof west === "number" &&
                typeof east === "number"
            ) {
                const bbox: BBox = [west, south, east, north];
                let coordinates = [
                    [
                        [west, north], // top left
                        [east, north], // top right
                        [east, south], // top right
                        [west, south], // bottom left
                        [west, north], // top left (again)
                    ],
                ];
                return {
                    bbox,
                    geometry: {
                        type: "Polygon",
                        coordinates,
                    },
                };
            }
        }
    }

    return null;
}

export function getNetworkLink(
    node: Element,
    styleMap: StyleMap,
    schema: Schema,
    options: KMLOptions
): Feature<Polygon | null> | null {
    const box = getNetworkLinkRegion(node);

    const geometry = box?.geometry || null;

    if (!geometry && options.skipNullGeometry) {
        return null;
    }

    const feature: Feature<Polygon | null> = {
        type: "Feature",
        geometry,
        properties: Object.assign(
            /**
             * Related to
             * https://gist.github.com/tmcw/037a1cb6660d74a392e9da7446540f46
             */
            { "@geometry-type": "networklink" },
            getMulti(node, ["name", "address", "visibility", "open", "phoneNumber", "description"]),
            getMaybeHTMLDescription(node),
            extractCascadedStyle(node, styleMap),
            extractStyle(node),
            extractIconHref(node),
            extractExtendedData(node, schema),
            extractTimeSpan(node),
            extractTimeStamp(node)
        ),
    };

    if (box?.bbox) {
        feature.bbox = box.bbox;
    }

    if (feature.properties?.visibility !== undefined) {
        feature.properties.visibility = feature.properties.visibility !== "0";
    }

    const id = node.getAttribute("id");
    if (id !== null && id !== "") feature.id = id;
    return feature;
}
