import xmldom from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { kml } from "../kml";

function parse(str: string) {
  return new xmldom.DOMParser().parseFromString(
    str,
    "text/xml"
  ) as unknown as Document;
}

function schemaKml(type: string, values: string[]) {
  return parse(`<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Schema name="s" id="s"><SimpleField name="flag" type="${type}"/></Schema>
  ${values
    .map(
      (v) => `<Placemark><ExtendedData><SchemaData schemaUrl="#s">
    <SimpleData name="flag">${v}</SimpleData>
  </SchemaData></ExtendedData><Point><coordinates>1,2</coordinates></Point></Placemark>`
    )
    .join("")}
</Document></kml>`);
}

describe("SimpleData with a bool SimpleField", () => {
  it("reads 1 and true as true, 0 and false as false", () => {
    const values = ["1", "true", "0", "false", " true ", "TRUE", "False", ""];
    const flags = kml(schemaKml("bool", values)).features.map(
      (f) => f.properties?.flag
    );
    expect(flags).toEqual([true, true, false, false, true, true, false, false]);
  });
});
