---
'houdini': patch
---

fix fragment spreads that combine @mask_disable with @include/@skip: the condition is propagated onto the inlined fields so a falsy condition no longer bubbles null up to the parent (#1550), unmasked fragment fields now show up in the generated result types (optional when the spread is conditional), and defaultFragmentMasking: 'disable' is honored by type generation
