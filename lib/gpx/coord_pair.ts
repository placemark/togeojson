import type { Position } from "geojson";
import { get1, nodeVal, num1 } from "../shared";
import { type ExtendedValues, getExtensions } from "./extensions";

interface CoordPair {
	coordinates: Position;
	time: string | null;
	extendedValues: ExtendedValues;
}

export function coordPair(node: Element): CoordPair | null {
	const ll = [
		Number.parseFloat(node.getAttribute("lon") || ""),
		Number.parseFloat(node.getAttribute("lat") || ""),
	];

	if (Number.isNaN(ll[0]) || Number.isNaN(ll[1])) {
		return null;
	}

	num1(node, "ele", (val) => {
		ll.push(val);
	});

	const time = get1(node, "time");
	return {
		coordinates: ll,
		time: time ? nodeVal(time) : null,
		extendedValues: getExtensions(get1(node, "extensions")),
	};
}
