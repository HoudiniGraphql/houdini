---
'houdini-react': minor
---

Add `useNavigation()`: exposes the router's in-flight navigation (`pending`, the destination `to`, and `goto`) so apps can render their own pending UI — global progress bars, per-link spinners, or disabled controls. `pending` stays true until the destination renders its actual content, including while its `@loading` state is showing.
