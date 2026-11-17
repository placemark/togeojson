import { isElement, nodeVal } from "../shared";

export type ExtendedValues = [string, string | number][];

export function getExtensions(node: Element | null): ExtendedValues {
  let values: [string, string | number][] = [];
  if (node === null) return values;
  for (const child of Array.from(node.childNodes)) {
    if (!isElement(child)) continue;
    const name = abbreviateName(child.nodeName);
    if (child.localName === "TrackPointExtension") {
      // loop again for nested garmin extensions (eg. "gpxtpx:hr"). The
      // prefix differs between apps (gpxtpx: from Strava, ns3: from
      // Garmin Connect), so match on the local name.
      values = values.concat(
        getExtensions(child).map(([name, val]) => [
          abbreviateName(name.replace(/^[^:]*:/, "gpxtpx:")),
          val,
        ])
      );
    } else {
      // push custom extension (eg. "power")
      const val = nodeVal(child);
      values.push([name, parseNumeric(val)]);
    }
  }
  return values;
}

function abbreviateName(name: string) {
  return ["heart", "gpxtpx:hr", "hr"].includes(name) ? "heart" : name;
}

function parseNumeric(val: string) {
  const num = Number.parseFloat(val);
  return Number.isNaN(num) ? val : num;
}
