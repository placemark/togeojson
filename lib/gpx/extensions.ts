import { isElement, nodeVal } from "../shared";

export type ExtendedValues = [string, string | number][];

export function getExtensions(node: Element | null): ExtendedValues {
  let values: [string, string | number][] = [];
  if (node !== null) {
    for (const child of Array.from(node.childNodes)) {
      if (!isElement(child)) continue;
      const name = ["heart", "gpxtpx:hr", "hr"].includes(child.nodeName)
        ? "heart"
        : child.nodeName;
      if (name === "gpxtpx:TrackPointExtension") {
        // loop again for nested garmin extensions (eg. "gpxtpx:hr")
        values = values.concat(getExtensions(child));
      } else {
        // push custom extension (eg. "power")
        const val = nodeVal(child);
        values.push([name, isNaN(parseFloat(val)) ? val : parseFloat(val)]);
      }
    }
  }
  return values;
}
