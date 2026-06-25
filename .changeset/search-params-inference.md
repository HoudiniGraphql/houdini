---
'houdini-react': minor
---

Add search param integration into queries, Link, and goto, with custom scalars marshaled into the URL and unmarshaled on read. Route params and search are now read through useRoute() (typed per route via the generated PageRoute type), replacing useLocation.
