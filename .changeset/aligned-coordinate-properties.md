---
"@tmcw/togeojson": patch
---

TCX and GPX per-point arrays (`times`, `heart`, `cadences`, `watts`, `speeds`, and GPX extensions) now have one entry for each coordinate. Missing values are `null`, and points without a position no longer leave an entry behind.
