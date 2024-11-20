import type { Feature, Geometry } from "geojson";
import type { KMLOptions } from "lib/kml";
import { type StyleMap, getMulti } from "../shared";
import { extractStyle } from "./extractStyle";
import { getGeometry } from "./geometry";
import {
	type Schema,
	extractCascadedStyle,
	extractExtendedData,
	extractTimeSpan,
	extractTimeStamp,
	getMaybeHTMLDescription,
} from "./shared";

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
	schema: Schema,
	options: KMLOptions,
): Feature<Geometry | null> | null {
	const { coordTimes, geometries } = getGeometry(node);

	const geometry = geometryListToGeometry(geometries);

	if (!geometry && options.skipNullGeometry) {
		return null;
	}

	const feature: Feature<Geometry | null> = {
		type: "Feature",
		geometry,
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
				: {},
		),
	};

	if (feature.properties?.visibility !== undefined) {
		feature.properties.visibility = feature.properties.visibility !== "0";
	}

	const id = node.getAttribute("id");
	if (id !== null && id !== "") feature.id = id;
	return feature;
}
