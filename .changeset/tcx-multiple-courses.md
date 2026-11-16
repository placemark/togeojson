---
"@tmcw/togeojson": patch
---

A TCX file with several `Course` elements now gives one feature per course. Before, all courses were merged into one `MultiLineString` feature that took its name and lap values from the first course.
