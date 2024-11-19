import type { Feature, Polygon } from "geojson";
import type { KMLOptions } from "lib/kml";
import { type StyleMap, get1, getMulti, num1 } from "../shared";
import { extractIconHref, extractStyle } from "./extractStyle";
import { coord, fixRing, getCoordinates } from "./geometry";
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

function getGroundOverlayBox(node: Element): BoxGeometry | null {
	const latLonQuad = get1(node, "gx:LatLonQuad");

	if (latLonQuad) {
		const ring = fixRing(coord(getCoordinates(node)));
		return {
			geometry: {
				type: "Polygon",
				coordinates: [ring],
			},
		};
	}

	return getLatLonBox(node);
}

type BBox = [number, number, number, number];

const DEGREES_TO_RADIANS = Math.PI / 180;

function rotateBox(
	bbox: BBox,
	coordinates: Polygon["coordinates"],
	rotation: number,
): Polygon["coordinates"] {
	const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];

	return [
		coordinates[0].map((coordinate) => {
			const dy = coordinate[1] - center[1];
			const dx = coordinate[0] - center[0];
			const distance = Math.sqrt(dy ** 2 + dx ** 2);
			const angle = Math.atan2(dy, dx) + rotation * DEGREES_TO_RADIANS;

			return [
				center[0] + Math.cos(angle) * distance,
				center[1] + Math.sin(angle) * distance,
			];
		}),
	];
}

function getLatLonBox(node: Element): BoxGeometry | null {
	const latLonBox = get1(node, "LatLonBox");

	if (latLonBox) {
		const north = num1(latLonBox, "north");
		const west = num1(latLonBox, "west");
		const east = num1(latLonBox, "east");
		const south = num1(latLonBox, "south");
		const rotation = num1(latLonBox, "rotation");

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
			if (typeof rotation === "number") {
				coordinates = rotateBox(bbox, coordinates, rotation);
			}
			return {
				bbox,
				geometry: {
					type: "Polygon",
					coordinates,
				},
			};
		}
	}

	return null;
}

export function getGroundOverlay(
	node: Element,
	styleMap: StyleMap,
	schema: Schema,
	options: KMLOptions,
): Feature<Polygon | null> | null {
	const box = getGroundOverlayBox(node);

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
			{ "@geometry-type": "groundoverlay" },
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
			extractExtendedData(node, schema),
			extractTimeSpan(node),
			extractTimeStamp(node),
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
