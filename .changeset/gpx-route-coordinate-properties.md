---
"@tmcw/togeojson": patch
---

Keep per-point `time` and extension values (heart rate, cadence, etc.) on GPX routes instead of dropping them, matching how tracks already work. Also stop doubling a trailing `s` when pluralizing an extension name that already ends in one (eg. `opencpn:waypoint_range_rings`).
