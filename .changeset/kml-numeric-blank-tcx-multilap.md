---
"@tmcw/togeojson": patch
---

Fix two more cases of silently incorrect data:

- KML: a blank `SimpleData` value for a numeric Schema field (eg `int`/`double`) is now read as `null` instead of being fabricated as `0`.
- TCX: a Course with multiple Laps now sums `TotalTimeSeconds`/`DistanceMeters` across all its laps instead of silently reporting only the first lap's totals as if they covered the whole course. Max/average lap fields have no single correct course-wide value, so they're dropped rather than misattributed to one lap.
