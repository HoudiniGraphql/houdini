---
'houdini-react': patch
---

Fix SSR middleware intercepting Vite module requests and missing Content-Type header; fix FOUC by enforcing correct CSS link precedence and deduplicating links; silence pre-warm noise by checking file existence before ssrLoadModule; set HOUDINI_PORT on server listen
