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

interface BoxGeometry {
    bbox?: BBox;
    geometry: Polygon;
}

enum AltitudeMode {
    ABSOLUTE = "absolute",
    RELATIVE_TO_GROUND = "relativeToGround",
    CLAMP_TO_GROUND = "clampToGround",
    CLAMP_TO_SEAFLOOR = "clampToSeaFloor",
    RELATIVE_TO_SEAFLOOR = "relativeToSeaFloor",
}

type BBox = [number, number, number, number];

type LOD = [number, number | null, number | null, number | null];
interface IRegion {
    coordinateBox: BoxGeometry | null;
    lod: LOD | null;
}

function getNetworkLinkRegion(node: Element): IRegion | null {
    const region = get1(node, "Region");

    if (region) {
        return {
            coordinateBox: getLatLonAltBox(region),
            lod: getLod(node),
        };
    }
    return null;
}

function getLod(node: Element): LOD | null {
    let resLOD: LOD | null = null;

    const lod = get1(node, "Lod");

    if (lod) {
        resLOD = [
            num1(lod, "minLodPixels") ?? -1,
            num1(lod, "maxLodPixels") ?? -1,
            num1(lod, "minFadeExtent") ?? null,
            num1(lod, "maxFadeExtent") ?? null,
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
        function processAltitudeMode(mode: Element | null): AltitudeMode | null {
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

function getLinkObject(node: Element) {
    /*
    <Link id="ID">
      <!-- specific to Link -->
      <href>...</href>                      <!-- string -->
      <refreshMode>onChange</refreshMode>
        <!-- refreshModeEnum: onChange, onInterval, or onExpire -->
      <refreshInterval>4</refreshInterval>  <!-- float -->
      <viewRefreshMode>never</viewRefreshMode>
        <!-- viewRefreshModeEnum: never, onStop, onRequest, onRegion -->
      <viewRefreshTime>4</viewRefreshTime>  <!-- float -->
      <viewBoundScale>1</viewBoundScale>    <!-- float -->
      <viewFormat>BBOX=[bboxWest],[bboxSouth],[bboxEast],[bboxNorth]</viewFormat>
                                            <!-- string -->
      <httpQuery>...</httpQuery>            <!-- string -->
    </Link>
  */
    let linkObj = get1(node, "Link");

    if (linkObj) {
        return getMulti(linkObj, [
            "href",
            "refreshMode",
            "refreshInterval",
            "viewRefreshMode",
            "viewRefreshTime",
            "viewBoundScale",
            "viewFormat",
            "httpQuery",
        ]);
    }

    return {};
}

export function getNetworkLink(
    node: Element,
    styleMap: StyleMap,
    schema: Schema,
    options: KMLOptions
): Feature<Polygon | null> | null {
    const box = getNetworkLinkRegion(node);

    const geometry = box?.coordinateBox?.geometry || null;

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
            getMulti(node, [
                "name",
                "address",
                "visibility",
                "open",
                "phoneNumber",
                "styleUrl",
                "refreshVisibility",
                "flyToView",
                "description",
            ]),
            getMaybeHTMLDescription(node),
            extractCascadedStyle(node, styleMap),
            extractStyle(node),
            extractIconHref(node),
            extractExtendedData(node, schema),
            extractTimeSpan(node),
            extractTimeStamp(node),
            getLinkObject(node),
            box?.lod ? { lod: box.lod } : {}
        ),
    };

    if (box?.coordinateBox?.bbox) {
        feature.bbox = box.coordinateBox.bbox;
    }

    if (feature.properties?.visibility !== undefined) {
        feature.properties.visibility = feature.properties.visibility !== "0";
    }

    const id = node.getAttribute("id");
    if (id !== null && id !== "") feature.id = id;
    return feature;
}
