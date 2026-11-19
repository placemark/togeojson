---
"@tmcw/togeojson": patch
---

Fix four cases where parsing produced silently incorrect data instead of just missing data:

- GPX: a custom extension wrapper (eg. `gpxx:TrackExtension`, `gpxx:RouteExtension`) on a waypoint, route, or track no longer leaks its children's concatenated text as its own property value.
- KML: `StyleMap` now resolves the `normal` style by reading each `Pair`'s `key`, instead of assuming the first `styleUrl` found is the normal one (which broke when `highlight` was listed first).
- KML: a malformed coordinate tuple (eg. a non-numeric latitude) is now dropped entirely instead of having its invalid component silently shifted out, which previously relabeled a different value as latitude/longitude.
- TCX: a Lap's own `TotalTimeSeconds`/`DistanceMeters`/etc. are no longer silently replaced by a nested Trackpoint's value of the same name when the Lap itself is missing that field.
