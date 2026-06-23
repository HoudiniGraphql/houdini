# Security review — `useMutationForm` / `@endpoint`

Reviewer: security audit pass over `design/mutation-forms.md` **and the as-built code**
(`server.ts`, `jwt.ts`, `coerce.ts`, `formData.ts`, `endpoint.ts`, `useMutationForm.tsx`).
Cross-checked against the current OWASP CSRF Prevention Cheat Sheet.

This is a reply doc for the author agent. Findings are severity-ranked. Each has a concrete
location, why it matters, the relevant OWASP guidance, and a recommendation or an
already-agreed decision. A "What's already correct" section at the end lists controls that
must **not** be regressed while fixing these.

---

## 1. HIGH — `multipart/form-data` to `/_api` is an unguarded CSRF channel for *all* mutations

**Where:** `packages/houdini/src/router/server.ts:303-308` — the GraphQL-endpoint guard
rejects only `application/x-www-form-urlencoded`. `multipart/form-data` falls straight
through to Yoga with **no Origin check and no token check** (both live only in
`handleForm`).

**Why it matters:**
- `multipart/form-data` is a CORS *simple* content type → **no preflight**, so a browser
  sends it cross-origin without CORS intervening.
- `SameSite=Lax` does **not** cover this. OWASP: *"A cookie set on app.example.com with any
  SameSite value is still considered same-site when the request originates from
  anything.example.com."* So a sibling subdomain (`evil.app.com`, or any host you don't
  fully control under the same registrable domain) can POST a GraphQL-multipart-spec request
  to `app.com/_api`, the victim's `Lax` cookie rides along, and **any mutation runs** — not
  just `@endpoint` ones, since this goes straight to Yoga.
- The design doc downplays this ("far harder to forge", § residual risks). It is not — the
  GraphQL multipart spec is a fixed, documented wire format.

This is the most important finding: the form handler is double-guarded (Origin + token)
while `/_api` — a strictly broader attack surface — has neither.

**Recommendation:** give `/_api` CSRF parity with the form handler. Options, roughly in
order of preference:
- Require a custom request header on `/_api` mutations (e.g. `x-houdini: 1`). The enhanced
  client already uses `fetch`, so it can attach it; a cross-origin simple `<form>`/multipart
  POST cannot. This is the cheapest robust fix and matches Yoga's own CSRF-prevention plugin
  model.
- Or apply the same Origin allowlist check to `/_api` POSTs.
- Or enable `@graphql-yoga/plugin-csrf-prevention` on the embedded instance.

---

## 2. MED — the signed token is not a real CSRF token — **make it real**

As built, the token is a constant signed blob, not a CSRF token, and it must not ship in
that form. **Do not retire it — fix it.** The native no-JS `<form>` cannot send a custom
header, so Origin (a *supporting* control that OWASP notes is stripped for ~1–2% of traffic)
is its only other guard; a real, session-bound token is the one mechanism that gives the
no-JS path the token-based defense-in-depth layer OWASP requires. The required changes are in
the Recommendation below. Four problems with the current implementation:

**(a) Redundant with the Origin check on the form path.** `handleForm` requires *both* the
Origin check (`server.ts:187-191`, exact full-origin match via `allowedOrigins.includes`)
*and* a valid token (`server.ts:198-210`). Because the Origin compare includes the host, a
sibling subdomain already has a *different origin* and is already rejected — the exact
"subdomain hole" the token claims to close (§CSRF point 4, §trust-model point 4) is closed
by Origin. Since both must pass, the token can never independently admit or reject a request
the Origin check wouldn't already decide. Its only marginal value appears if the Origin
check is ever relaxed.

**(b) Not an OWASP-shaped CSRF token.** `CSRF_PAYLOAD = { houdiniForm: true }`
(`server.ts:29`) is a constant — no `exp`, no per-session value, no `jti`. OWASP requires
CSRF tokens to be *"unique per user session," "secret,"* and, for the signed double-submit
variant, *"explicitly bound to session-dependent values like the server-side session ID."*
A signed-but-unbound constant is, per OWASP, *"minimal protection"*: any token the server
ever emits is valid forever for every user until the key rotates.

**(c) Verify checks only the signature, and shares the session key.** `verifyJWT(token,
session_keys[0])` (`server.ts:203`) returns a boolean for signature validity and never
asserts `houdiniForm === true`. The signing key is the **same** `session_keys[0]` used for
session cookies, so *any* JWT this app signs — including a user's session cookie — satisfies
the CSRF check. No domain separation.

**(d) Doc/code drift on "always-on".** The doc says the token is always-on. The hook treats
it as opt-in: `useFormToken()` is "null unless `router.formToken` is enabled"
(`useMutationForm.tsx:73-74`) and the hidden field only renders `{csrfToken && …}`
(`:128`). But `handleForm` requires a valid token unconditionally (`server.ts:208`). With
`formToken` disabled, the no-JS POST ships no `__houdini_csrf` field → server `403`s every
native submission. Either make it truly always-on (mint server-side regardless) or make the
server requirement conditional — but the two sides must agree.

**Recommendation: make it a real token.** Specifically:
- **Bind it to the session** — put the session id (or a per-session secret) in the payload
  and verify it matches the request's session on submit, so a token is useless on another
  user's session.
- **Add `exp`** (and verify it) so tokens are not valid forever.
- **Enforce the `houdiniForm` claim** in verify — check the decoded payload, not just the
  signature.
- **Sign with a separate key** (or an enforced `aud`/purpose claim) so a CSRF token and a
  session cookie can never be interchanged.
- **Make it genuinely always-on** — mint it server-side on every form render and require it
  unconditionally, resolving the opt-in (client) vs mandatory (server) drift in (d).

Lower priority than finding 1 (while `/_api` is open the form path is already the
double-guarded one), but it must land before this ships — a fake token is worse than none.

---

## 3. MED — over-posting / mass assignment — **DECISION AGREED**

**Where:** `packages/houdini/src/runtime/formData.ts:84` — `coerceFormData` iterates the
mutation's **input type** (`for (const [field, type] of Object.entries(fields))`), not the
inputs the developer rendered. Every field the input type declares is accepted from the
POST, whether or not the form showed an `<input>` for it.

**Why it matters:** a mutation taking `UpdateUserInput { name, email, role, isAdmin }` whose
form renders only `name`/`email` still accepts an attacker-supplied `input.role` /
`input.isAdmin`. The visible markup is *not* the trust boundary — the input type is. This is
ordinary GraphQL semantics (the resolver must authorize), but `@endpoint` turns the mutation
into a browser-reachable native POST, so the gap is far easier to hit than a hand-written
query. The design doc currently frames "unknown fields are dropped" as if it resolved this;
it resolves *unknown-field* injection, not *in-schema over-posting*.

**Agreed decision (both, per discussion):**

1. **Loud documentation.** `@endpoint` exposes the mutation's *entire input type* to
   first-party browser forms. Docs must warn: never place authorization-sensitive fields
   (roles, ownership, account flags) in an `@endpoint` mutation's input — split them into a
   separate mutation or set them server-side from the session context, never from a
   variable.

2. **An opt-in compile-time allowlist on the directive:** `@endpoint(fields: ["name",
   "email"])`.
   - Lives on `@endpoint` (not in hook options) so it is baked into the artifact — the one
     thing **both** the server `handleForm` (`server.ts:235`) and the client hook
     (`useMutationForm.tsx:87`) share. A hook-only option would lock the enhanced path and
     silently leave the native POST open — i.e. fail exactly when JS is off. This is why it
     must be a directive argument.
   - Entries use the same dotted/`[]` vocabulary as the form field names (`input.name`,
     `tags[]`).
   - Compiler validates each entry resolves to a real input path (table test); unknown path
     ⇒ build error. Emitted to `artifact.endpoint.fields`.
   - `coerceFormData` gains an allowlist parameter (sourced from `artifact.endpoint.fields`)
     and drops any submitted key outside it. Both paths pass the same list.
   - Absent `fields`, the whole input type is accepted (backward compatible) — with the loud
     doc warning standing as the default-case mitigation.

**Implementation touch points:**
- `packages/houdini-core/plugin/documents/endpoint.go` — parse + validate the `fields` arg.
- `packages/houdini-core/plugin/documents/artifacts/endpoint.go` — emit `fields`.
- `packages/houdini/src/runtime/types.ts` — add `fields?: string[]` to `EndpointSpec`.
- `packages/houdini/src/runtime/formData.ts` — honor the allowlist in `coerceFormData`.
- `packages/houdini/src/router/server.ts` + `useMutationForm.tsx` — pass
  `artifact.endpoint.fields` through (or have `coerceFormData` read it off the artifact).
- Go table test for `fields` validation + artifact shape; e2e asserting an out-of-allowlist
  field is dropped on **both** paths.
- Docs: the loud warning + `fields` reference.

(Open naming choice: `fields` vs `only` vs `expose` — `fields` reads clearly; author's call.)

---

## 4. MED — Origin trust depends on how `request.url` is derived — **RESOLVED: not a vulnerability**

**Where:** `server.ts:188` builds `allowedOrigins = [parsedURL.origin, ...]` from
`parsedURL = new URL(request.url)`. The CSRF model rests on `parsedURL.origin` being the
*true* app origin.

**Resolution (confirmed against `@whatwg-node/server` v0.11 `buildFullUrl`):**
- **No forwarded-host spoofing vector.** The host is derived from `:authority` (HTTP/2) or
  the `Host` header → `req.hostname` → socket address → `localhost`. **No `X-Forwarded-*`
  header is read** anywhere in the package. On a cross-site POST the victim's browser sets
  `Host` to the *target* app (and the attacker can't redirect the request elsewhere without
  losing the app's cookie), so an attacker cannot make `parsedURL.origin` equal their own
  origin. The match is exact (`allowedOrigins.includes(origin)`, `server.ts:189`) — no
  wildcard expansion — so the comparison can't be silently widened either. The Origin check
  is sound.
- **The proxy case is fail-closed availability, not a bypass.** `adapter-node` runs a plain
  `node:http` server, so behind a TLS-terminating proxy the derived scheme is `http` while
  the browser's `Origin` is `https` → mismatch → legitimate submissions `403`. This pushes
  deployers to explicit config rather than silently trusting a forwarded header (a *good*
  failure mode).

**Action (docs only):** behind a proxy, pin `router.allowedOrigins` to the exact public
origin **including scheme and port** (the `http`/`https` and implicit-`:port` mismatches are
the two ways legit traffic 403s). Warn against over-broad entries. No code change required.

---

## 5. LOW — no-JS multipart parse has no size cap (DoS)

**Where:** `server.ts:193` — `await request.formData()` buffers the entire body; no apparent
limit on the no-JS upload path. Add a configurable max body / file size and reject early.

## 6. LOW — verify the `formResult` SSR injection is XSS-safe

**Where:** the `422` re-render injects `{ data, errors }` (attacker-influenced) into the
page (`server.ts:257-260`). Confirm it goes through Houdini's hydration serializer (escaping
`</script>`, `<!--`, U+2028/2029) and is rendered as React text, never via
`dangerouslySetInnerHTML`. Yoga masks resolver errors in production, but `data` can echo
submitted values.

---

## What's already correct — do NOT regress these

- **JWT algorithm pinning.** `verify` uses `options.algorithm` (default HS256), never the
  token's own `alg` header (`jwt.ts:278`) — no `alg:none` / algorithm-confusion. The token's
  weakness is binding/claims (finding 2), not the primitive.
- **Origin check fail-closed.** Absent or mismatched `Origin` ⇒ `403` (`server.ts:187-191`).
  Keep fail-closed.
- **`415` on `x-www-form-urlencoded` at `/_api`** (`server.ts:303-308`) — good catch closing
  the urlencoded same-site bypass. (Finding 1 is that multipart needs the same treatment.)
- **Open-redirect handling is solid** (`endpoint.ts:14-28`): `encodeURIComponent` on every
  interpolated value (blocks CRLF header injection and `//` host injection), literal segments
  build-time validated to a single leading `/`, null aborts the redirect. Template is a
  compiler-parsed array, never re-parsed at request time.
- **PRG split** (303 on success, inline re-render on error) — correct and refresh-safe.
- **Unknown-field dropping** in `coerceFormData` — genuinely closes unknown-variable
  injection (it's the *in-schema* over-posting in finding 3 that remains).

---

## Status (post-fix verification)

All findings have been verified against the implementation diff:

- **Finding 1 — CLOSED.** `/_api` POST now rejects `x-www-form-urlencoded` (`415`) and
  requires the `x-houdini-request` header on every CORS-simple body (`multipart`,
  `text/plain`, empty content-type); JSON stays preflight-protected. The client sets the
  header on both the JSON and the multipart-upload paths (`handleMultipart` strips only
  `content-type: application/json`, so the header survives).
- **Finding 2 — CLOSED.** Token is now session-bound (HMAC fingerprint `sid`), time-limited
  (`exp`), purpose-claim-checked, signed with a domain-separated key, and always-on on both
  sides.
- **Finding 3 — IMPLEMENTED, one follow-up.** `@endpoint(fields)` allowlist enforced on both
  paths. Remaining: build-time validation that each entry resolves to a real input path
  (DX/correctness, not a security downgrade — a bad allowlist only over-restricts).
- **Finding 4 — RESOLVED (not a vulnerability).** See finding 4 above; docs-only action.
- **Finding 5 — CLOSED.** `formMaxBodyBytes` (default 10 MB) → `413` before buffering.
- **Finding 6 — CLOSED.** `escapeScriptTag` applied to `formResult`/`formToken` (and
  retrofitted onto the previously-unescaped cache/session hydration injections).

Remaining open items: (1) `fields` build-time validation (finding 3 follow-up); (2) the docs
notes — the loud over-posting warning (finding 3) and the proxy/`allowedOrigins` guidance
(finding 4).
