import { $, getMulti, nodeVal } from "../shared";

export function extractMetadata(node: Document) {
  const properties = getMulti(node, [
    "name",
    "desc",
    "author",
    // "copyright",
    "time",
    "keywords",
  ]);
  const extensions = Array.from(
    node.getElementsByTagNameNS(
      "http://www.garmin.com/xmlschemas/GpxExtensions/v3",
      "*"
    )
  );
  for (const child of extensions) {
    if (child.parentNode?.parentNode === node) {
      properties[child.tagName.replace(":", "_")] = nodeVal(child);
    }
  }
  const links = $(node, "link");
  if (links.length) {
    properties.links = links.map((link) =>
      Object.assign(
        { href: link.getAttribute("href") },
        getMulti(link, ["text", "type"])
      )
    );
  }
  return properties;
}
