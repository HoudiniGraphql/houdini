---
'houdini-react': minor
---

Add `useNavigation()`: exposes the router's in-flight navigation (`pending`, and the destination `to`) so apps can render their own pending UI — global progress bars, per-link spinners, or disabled controls. `pending` stays true until the destination renders its actual content, including while its `@loading` state is showing.
