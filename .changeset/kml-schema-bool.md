---
"@tmcw/togeojson": patch
---

KML `SimpleData` values of a `bool` `SimpleField` now follow `xsd:boolean`: `0` and `false` are `false`. Before, any non-empty value, including `0` and `false`, became `true`.
