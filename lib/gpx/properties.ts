import { $, getMulti, nodeVal, type NS } from "../shared";

export function extractProperties(ns: NS, node: Element) {
	const properties = getMulti(node, [
		"name",
		"cmt",
		"desc",
		"type",
		"time",
		"keywords",
	]);

	for (const [n, url] of ns) {
		for (const child of Array.from(node.getElementsByTagNameNS(url, "*"))) {
			properties[child.tagName.replace(":", "_")] = nodeVal(child);
		}
	}

	const links = $(node, "link");
	if (links.length) {
		properties.links = links.map((link) =>
			Object.assign(
				{ href: link.getAttribute("href") },
				getMulti(link, ["text", "type"]),
			),
		);
	}

	return properties;
}
