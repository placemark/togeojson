---
"@tmcw/togeojson": patch
---

KML coordinates with whitespace around the commas inside a tuple (`6.47, 46.21, 1542`, as written by Therion) are parsed instead of being dropped.
