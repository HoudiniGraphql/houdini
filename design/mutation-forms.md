# `useMutationForm` — progressive-enhancement forms for Houdini React

Status: design / feasibility exploration
Branch: `react-mutation-forms`

## Summary

A new React hook, `useMutationForm`, that turns a Houdini mutation into a `<form>` with
real progressive enhancement: the form submits natively (a normal HTTP POST) before or
without JavaScript, and once the page hydrates the *same* form behaves like an ordinary
client-side Houdini mutation (optimistic updates, cache writes, pending state).

The user writes a mutation and spreads the hook onto a form. Everything else (the submit
endpoint, the redirect, the FormData coercion) is generated machinery they never author.

```tsx
import { graphql, useMutationForm, useMutationFormStatus } from '$houdini'

function NewUser() {
  const { form, state } = useMutationForm(graphql(`
    mutation CreateUser($name: String!, $email: String!)
      @endpoint(redirect: "/users/{ createUser.id }") {
      createUser(name: $name, email: $email) { id }
    }
  `))

  return (
    <form {...form}>
      <input name="name" />
      <input name="email" type="email" required />
      {state?.errors && <p role="alert">{state.errors[0].message}</p>}
      <Submit />
    </form>
  )
}

function Submit() {
  // Houdini-provided, useFormStatus-shaped; see "Why not React function actions"
  const { pending } = useMutationFormStatus()
  return <button disabled={pending}>{pending ? 'Saving…' : 'Create user'}</button>
}
```

## Goals

- A `<form>` that works with JavaScript disabled or not-yet-loaded, then enhances on
  hydration with no change to the user's markup.
- A **pure wrapper over mutations**. No user-authored server action functions. This
  preserves Houdini's "point at a mutation, no per-route server code" property.
- Match the ergonomics of React 19 form primitives (a spreadable form, a `useFormStatus`-
  shaped status hook, a `state` carrying the result) while using the Remix/SvelteKit
  enhancement mechanism underneath. See [Why not React function actions](#why-not-react-function-actions).

## Non-goals (v1)

- SvelteKit/Next-style server action functions, or any arbitrary server-side branching
  beyond running the mutation.
- No-JS login that establishes a session (use the existing auth redirect flow; see
  [Auth and sessions](#auth-and-sessions)).
- A validation framework. We surface GraphQL errors; rich field validation is the
  schema's job (result unions).

## How it works

The server endpoint is necessary infrastructure, but it is generated and named by the
compiler. The user never sees it. There are two execution paths for the same form:

| | Before hydration (no JS) | After hydration |
|---|---|---|
| What submits | native POST to the page URL (string `action`) | our `onSubmit` handler intercepts |
| Where the mutation runs | server, via the local Yoga proxy | client, via `useMutation` (optimistic + cache) |
| `useMutationFormStatus().pending` | n/a | works (Houdini context) |
| Result / errors | re-rendered page or 303 from the server | `state` from the hook |
| Redirect | 303 from the server | client navigation after the mutation resolves |

Both paths derive their behavior from the same compiled artifact, so they cannot drift.
The form element is identical on server and client (a plain string `action` + `method`),
so hydration is clean. See [Why not React function actions](#why-not-react-function-actions)
for why we do not use `useActionState`/`useFormStatus` directly.

## The `@endpoint` directive

`@endpoint` is the static-analysis key. It marks a mutation as form-submittable and
is how the Go compiler knows to generate the endpoint and wire the runtime. It follows
the same document-directive pattern as `@plural`, `@refetch`, and friends.

The directive and everything the compiler does with it (registration, artifact emission,
validation) are **framework-neutral** — the form is the only per-framework surface
(`useMutationForm` in React, a `use:enhance` store action in Svelte, a signal-based action
in Solid). So it all lives in the **shared layer**, not in any one framework adapter:

- **`houdini-core`** (Go) owns the directive definition, extraction, validation, and
  artifact emission — registered in `schema/write.go` and validated as a rule in
  `documents/`, the same place `@plural`/`@refetch` live.
- **`houdini`** owns the shared runtime that both server paths and all framework adapters
  depend on (the `coerceFormData` coercer, the server form handler).

Each framework then needs only its thin runtime adapter (the hook/action) — none of the
compiler-side or shared-runtime work is duplicated per framework. The React router is the
first consumer; Svelte/Solid adapters slot in later without touching the directive.

```graphql
mutation CreateUser($name: String!) @endpoint(redirect: "/users/{ createUser.id }") {
  createUser(name: $name) { id }
}
```

Compiler responsibilities:

1. **Register** the mutation in a server-side form-action manifest. Realized as a
   `form_actions` export on the generated router manifest: a map of mutation name → a lazy
   literal-import thunk for its artifact (`() => import('$houdini/artifacts/CreateUser')`),
   one per `@endpoint` mutation. It mirrors how page-query artifacts are loaded (literal
   specifier so bundlers follow it; lazy so it's code-split and edge-safe) and is attached
   to `manifest.formActions` in the server entry, keeping mutation artifacts out of the
   client bundle. The handler does `await manifest.formActions[name]()` to get the
   artifact's `raw` query, `input` coercion metadata, and `endpoint` field.
2. **Emit** the artifact bits the runtime needs as an operation-level `endpoint` field
   whose presence marks the mutation as form-submittable (the form marker itself is just
   the artifact `name`/`hash`). The form `action` is the current page URL. The field
   carries: `multipart: true` when the mutation has `Upload` variables (so the hook sets
   the enctype); the explicit `id`; and, when present, the parsed `redirect` template as a
   **compact mixed array** — literal segments are strings, interpolation paths are nested
   arrays — so both the server and client interpolate it identically without re-parsing:

   ```js
   // @endpoint(redirect: "/users/{ createUser.id }")
   "endpoint": { "redirect": ["/users/", ["createUser", "id"]] }
   ```
3. **Validate** (table tests):
   - `@endpoint` only sits on mutation documents.
   - Each `redirect` interpolation path (`createUser.id`) exists in the selection set and
     resolves to a leaf scalar.
   - The `redirect` value is a relative path (starts with a single `/`, no scheme, no
     `//`). This is what closes open-redirect at build time.
   - Duplicate `@endpoint` usages of the same mutation on one route require an
     explicit `id` (see [Form identity](#form-identity)).

## Server

The server already knows how to render a page for a URL: `_serverHandler`
(`packages/houdini/src/router/server.ts`) does `find_match(manifest, url)` →
`collect_response_headers` → `on_render({ url, match, ... })`. The form handler lives in
that same closure and reuses that machinery.

### Interception

A new branch is added before the page-render fallthrough:

```
_serverHandler:
  graphql endpoint?              → yoga             (existing)
  auth request?                  → handle_request   (existing)
  POST + __houdini_form marker?  → handleForm()     (NEW)
  otherwise                      → page render      (existing)
```

### Post to the current page URL, not a dedicated route

The form posts to the **page it is on**, identifying the mutation by a hidden marker
rather than by the route:

```
POST /users/new
  __houdini_form    = CreateUser        (names the mutation; route-agnostic)
  __houdini_form_id = CreateUser:0      (disambiguates multiple forms)
  name=...
```

This keeps forms reusable (a `<CreateUserForm>` dropped on any page posts to that page),
while giving the handler the page context it needs to re-render with inline errors. It
supersedes an earlier "dedicated `/_houdini/forms/X` endpoint" idea, which could not know
which page to re-render.

### `handleForm()` outcomes

```
1. CSRF: Origin check (see below); reject on failure.
2. Coerce body → variables (shared coercer + InputObject metadata).
3. Run the mutation via the local Yoga proxy (client.registerProxy, already wired).
4. Branch:
   success + @endpoint(redirect:)     → 303 to the interpolated target
   success, no redirect                   → 303 back to the page URL (PRG, refresh-safe)
   error / validation failure             → re-render this page, status 4xx,
                                            with the result injected
```

Success redirects (so a refresh cannot resubmit). Errors re-render inline (a refresh on
an error is the accepted, universal behavior). This is the standard PRG split, and it is
why the `redirect` argument is load-bearing rather than cosmetic.

### Injecting the result on the re-render path

The error branch reuses the page renderer and threads the action result through:

```js
const [match] = find_match(manifest, url)
const headers = await collect_response_headers(match)
return on_render({
  url, match, is404: false, manifest, componentCache, headers,
  session: await get_session(...),
  formResult: { [formId]: { data, errors } },   // NEW field on on_render
})
```

`on_render` exposes `formResult` to the React tree via router context. This is the one
change that ripples beyond a single file: the `on_render` signature
(`server.ts` ~L36-44) and every adapter that implements it (the React adapter) must carry
the new field.

### Form identity

The injected result must land on the form that was submitted.

- Default `formId` is the mutation name (`CreateUser`). Fine for the common
  one-form-per-mutation-per-page case.
- Two forms using the same mutation on one page require an explicit
  `useMutationForm(doc, { id: 'invite' })`. The compiler warns (table test) when it sees
  duplicate `@endpoint` usage on a route with no id.

The hidden `__houdini_form_id` carries the id on submit; the server keys `formResult` by
it; only the submitted form receives a non-null initial state.

## Why not React function actions

We deliberately do **not** use React 19's `<form action={fn}>` / `useActionState` /
`useFormStatus`. A spike against React 19.2.7 (`renderToStaticMarkup`) settled this:

- A plain **client** function action does not server-render a usable `action`. React emits
  `action="javascript:throw new Error('React form unexpectedly submitted.')"` plus a
  `$$reactFormReplay` script that only works once JS loads. With JS disabled, the form
  submits nowhere. So function actions give no true no-JS progressive enhancement.
- `useActionState`'s `permalink` argument is **ignored** for a client function action (the
  SSR output is byte-for-byte identical with and without it). Its progressive-enhancement
  behavior is exclusive to RSC **server functions** (registered server references).
- React also warns that a function-action form cannot carry our own `method`/`encType`.

Getting React's native PE would require registering each generated endpoint as an RSC
server reference: a dependency on `react-server-dom-*` (which is bundler-coupled —
`-webpack`/`-parcel`/`-turbopack`; `-esm` is unpublished at `0.0.1` and there is no Vite
variant), the SSR renderer running in the `react-server` condition, and our endpoint
decoding React's evolving action wire protocol instead of plain FormData. That is a large,
fragile dependency to borrow two hooks.

Instead we use the **Remix / SvelteKit / SolidStart** mechanism: render a real string
`action` and enhance with `onSubmit`. It delivers identical no-JS PE, keeps the endpoint
something we fully own (plain FormData, which is exactly what the browser posts), adds zero
dependencies, and hydrates cleanly because the form element is identical on both sides. We
re-create the React-19 ergonomics (a `useFormStatus`-shaped status hook, a `state` return)
ourselves.

## Runtime hook

`useMutationForm` returns props for a string-action form plus the hidden markers, and
intercepts `onSubmit`:

```tsx
function NewUser() {
  const { form, hidden, state, pending } = useMutationForm(graphql(`
    mutation CreateUser($name: String!) @endpoint(redirect: "/users/{ createUser.id }") {
      createUser(name: $name) { id }
    }
  `))

  return (
    <form {...form}>
      {hidden}
      <input name="name" />
      {state?.errors && <p role="alert">{state.errors[0].message}</p>}
      <button disabled={pending}>Create user</button>
    </form>
  )
}
```

Internally it builds the send off `useDocumentStore` directly (not the `useMutation`
wrapper, which discards the result): `onSubmit` does `coerceFormData(new FormData(form),
artifact.input)` → `observer.send({ variables, session })`, sets `state` to the
`{ data, errors }` result, and on success interpolates `artifact.endpoint.redirect` against
the data and `goto()`s there. `pending` comes from the store's fetching state plus a local
submitting flag.

Because `{...form}` is a plain prop spread it can't add children, so the hook returns a
separate **`hidden`** node (the `__houdini_form` / `__houdini_form_id` markers) the user
renders inside the form. `form.action` is the current page URL (read from the router so it
is identical on server and client → clean hydration); `form.encType` is
`multipart/form-data` when `artifact.endpoint.multipart` is set. `state` is seeded from the
SSR-injected result (`useFormResult(formId)`, threaded through the router context on both
render paths), so the no-JS re-render and the enhanced path converge on the same shape.

The injected `formResult` is keyed by `formId` (`opts.id` ?? `@endpoint(id:)` ?? mutation
name), so only the submitted form shows a non-null initial `state`.

For the no-prop-drilling `useFormStatus` ergonomic, the hook also returns a **`Form`**
component — `<Form>…children…</Form>` renders the form, injects the markers, and provides a
context so **`useMutationFormStatus()`** can read `pending` from any child (a plain
`{...form}` spread can't, since it adds no provider). `Form` keeps a stable identity across
renders (live values via a ref) so flipping `pending` never remounts the form / drops input
focus.

```tsx
const { Form } = useMutationForm(doc)
// <Form><input name="name" /><Submit /></Form>
function Submit() {
  const { pending } = useMutationFormStatus()   // reads the nearest <Form>'s state
  return <button disabled={pending}>Create</button>
}
```

### `onSuccess` / `onError`

Enhanced-path-only callbacks for imperative side effects (analytics, focus, session). They
are no-ops without JS, which is the correct degradation. This is the home for
`setSession` on enhanced-path login (see [Auth and sessions](#auth-and-sessions)).

## FormData coercion

A single shared `coerceFormData(formData, input, config)` lives in the shared Houdini
runtime (`houdini/runtime`, alongside `marshalInputs`) and is used by the client enhanced
path, the dev server, and the built server. One implementation means the two paths are
symmetric by construction. It is driven by the artifact's `InputObject`
(`fields` / `types` / `defaults` / `runtimeScalars`).

It is a **domain wrapper over a shared coercion core** (`unmarshalValue` / `decodeScalar`
in `houdini/runtime/coerce`), the same core the router uses to turn search/route-param
strings back into rich values (`unmarshalScalars` in the React runtime). So a value coerces
identically whether it arrives via a URL or a form. The wrapper owns only what is genuinely
form-specific: the FormData fold and the HTML-form rules below.

Rules:

- **Nested inputs and lists** via a path convention: `name="input.address.city"`,
  `name="tags[]"`. The fold from flat keys to nested structure is guided by the metadata,
  not guessed.
- **Checkbox absence → `false`** for Boolean-typed fields (unchecked boxes vanish from
  FormData).
- **Empty string → `null`** for numeric/enum/custom-scalar fields; `""` passes through for
  String/ID.
- **Required fields lean on native HTML** `required`, which the browser enforces before
  POST on both paths.
- **Scalar coercion**: Int/Float → number, Boolean → real boolean (a present checkbox
  sends `"on"`); String/ID/enum pass through as strings; a **custom scalar runs through its
  `unmarshal`** (via the shared core) to a rich value.

The coercer produces **rich** runtime values, exactly like the URL path, so the enhanced
path sends them through the normal mutation pipeline — `marshalInputs` re-marshals them for
the request. No special marshal-bypassing send is needed; reusing the unmarshal core is
what makes that work. Residual edge case: a custom scalar whose input can't be expressed as
a form string at all is out of scope.

### File uploads

- The compiler auto-detects `Upload`-typed variables and `useMutationForm` emits
  `encType="multipart/form-data"` on the form props.
- Enhanced path: the coercer yields `File` objects and the existing `extractFiles`
  multipart handling (`packages/houdini-core/runtime/plugins/fetch.ts`) takes over.
- No-JS path: the endpoint parses the multipart parts and assembles the GraphQL multipart
  request spec, reusing the client implementation.

## Redirect

`redirect` is a static directive argument, so the compiler bakes the same target into both
paths: the server interpolates the template against the result and emits a 303, and the
runtime navigates after the client mutation resolves.

- **Open redirect**: closed at build time (relative-path-only validation) plus runtime
  URL-encoding of interpolated segments.
- **On error**: never redirect; always re-render with `state.errors`.
- **Null interpolation path on success**: skip the redirect, fall back to PRG-back-to-page,
  emit a dev-mode warning. Redirecting to `/users/undefined` is impossible by rule.

## Field errors

- Ship `state.errors` (the raw GraphQL errors array) for top-level display.
- Add a thin `state.fieldErrors` bucketed by `error.extensions.field` / `path` when the
  server provides it. Opt-in, zero schema requirement, degrades to empty.
- Document the **result-union pattern** (`... on ValidationError { field message }`) as
  the recommended approach for rich, typed field errors. That is a schema choice, not
  framework machinery.

## Auth and sessions

Session data already flows through the GraphQL context, so resolvers read identity from
context rather than from form fields. There is nothing to inject server-side and no
trusted-variable problem.

`useMutationForm` does **not** establish sessions:

- Non-auth mutations work identically on both paths.
- Enhanced-path login sets the session in `onSuccess` via the existing `useSession`
  mechanism.
- No-JS login (which must set a cookie without any JS) is deferred. It is better served by
  Houdini's existing auth redirect flow (`packages/houdini/src/router/session.ts`) than by
  overloading the generic form endpoint. Out of v1 scope.

## CSRF

The only new attack surface is the no-JS form endpoint. The enhanced path POSTs
`application/json` to the GraphQL endpoint, which is not a CORS simple request and is
preflight-protected. Native forms POST `x-www-form-urlencoded` / `multipart`, which are
simple requests and bypass preflight.

The session cookie is `SameSite=Lax; HttpOnly; Secure` (`session.ts` ~L91). Lax blocks the
classic cross-site form POST but not sibling-subdomain (same-site) attacks.

Recommendation (mirrors SvelteKit's default CSRF protection):

1. `SameSite=Lax` (already present) at the cookie layer.
2. **Mandatory Origin check, fail-closed** on the form handler: for POST with a form
   content-type, reject (403) when `Origin` is absent or does not match the app origin.
   Stateless, no anon/auth special-casing, and it closes the subdomain hole.
3. Config: an allowed-origins allowlist for legitimate multi-origin deployments (mirrors
   the existing `router.auth` config).
4. **Always-on signed token** (defense in depth, closes the same-site/subdomain gap): the
   server signs a token with `jwt.ts` at render, the hook renders it in a hidden
   `__houdini_csrf` field, and `handleForm` verifies it on submit. A cross-origin page
   can't read the token, so it can't forge a valid POST even on a shared parent domain.
   The signing key is `session_keys[0]` when configured, otherwise a **random per-process
   key** — so it's never something to opt into. This same fallback is applied to
   `session_keys` itself, so auth sessions also work out of the box; configuring keys is
   purely about *persistence* (surviving redeploys, verifying across a load-balanced
   fleet), and production should configure them.

**Implementation finding:** Yoga does *not* reject form-encoded bodies on its own — it
accepts `application/x-www-form-urlencoded` per the GraphQL-over-HTTP spec, which would let
a same-site `<form>` POST a mutation straight to the GraphQL endpoint (carrying the
`SameSite=Lax` cookie) and bypass the form handler's Origin check. So `_serverHandler`
rejects (`415`) `x-www-form-urlencoded` POSTs to the GraphQL endpoint, keeping the form
handler the only form-driven path. `multipart/form-data` is *not* rejected there because
the enhanced upload path legitimately posts the GraphQL multipart spec to that endpoint.

## Implementation architecture (as built)

This section is the full picture of what ships, written for a security review. It describes
the two request paths, every place untrusted input enters, and every control that gates it.

### Component / file map

| Layer | Where | Responsibility |
|---|---|---|
| Directive + validation | `packages/houdini-core/plugin/documents/endpoint.go` | Registers `@endpoint`; validates mutation-only placement, relative-path redirect, leaf-scalar interpolation paths (build time) |
| Artifact emission | `packages/houdini-core/plugin/documents/artifacts/endpoint.go` | Emits the `endpoint` field: parsed `redirect`, `multipart` flag (Upload/File var), `id` |
| Form-action manifest | `houdini-react/plugin/runtime.go` (emit), `generate.go` (attach) | `form_actions`: name → lazy `import()` of each `@endpoint` mutation's artifact; server-only |
| Request router | `packages/houdini/src/router/server.ts` `_serverHandler` | Dispatch, `handleForm()`, token mint/verify, page render |
| Coercion + transport | `packages/houdini/src/runtime/{formData,coerce,multipart,endpoint}.ts` | `coerceFormData`, scalar coercion, `buildGraphQLBody`, `interpolateRedirect` |
| Client hook | `houdini-react/runtime/hooks/useMutationForm.tsx` | Renders the form + hidden markers; intercepts submit; client navigation |
| Context plumbing | `houdini-react/runtime/{index.tsx,hydration.tsx,routing/Router.tsx}` | Threads `formResult` / `formToken` from server → tree |

### Request lifecycle (`_serverHandler` dispatch order)

Every request to the app server passes through, in order:

1. **GraphQL endpoint** (`/_api`): served by the local Yoga instance — *but* a POST with
   `application/x-www-form-urlencoded` is rejected `415` first (closes the same-site form
   bypass; multipart is allowed for uploads).
2. **Auth request**: `handle_request` (existing session/login flow). Returns early if it
   owns the request.
3. **`handleForm()`** (NEW): a `POST` whose content-type is a form type
   (`x-www-form-urlencoded` or `multipart/form-data`). Detailed below.
4. **Page render** (`renderPage`): SSR fallthrough.

`session_keys` is computed once per process: the configured `router.auth.sessionKeys`, or a
**random per-process key** when none are set. It signs both auth session cookies and the
form CSRF token (see [CSRF](#csrf)).

### No-JS path — `handleForm()` step by step (all inputs untrusted)

The browser POSTs a native form to the page URL. Everything in the request body and headers
is attacker-controllable; the session cookie is the only server-trusted input.

1. **Method + content-type gate** — non-POST or non-form requests return `null` (fall
   through). 
2. **Origin check (fail-closed)** — `Origin` header must equal the request's own origin or
   a `router.allowedOrigins` entry; otherwise `403`. Absent `Origin` ⇒ `403`. This is the
   primary CSRF control.
3. **Body size guard + parse** — reject (`413`) when `Content-Length` exceeds
   `router.formMaxBodyBytes` (default 10 MB) *before* buffering, then `await
   request.formData()`. (A chunked body with no `Content-Length` falls back to the
   host/proxy limit.)
4. **CSRF token (always on)** — the `__houdini_csrf` field must be a JWT that verifies
   against `session_keys[0]` (`jwt.ts` `verify`, HS256). Missing / malformed / bad-signature
   ⇒ `403`. (`verify` *throws* on a malformed token; that is caught and treated as invalid.)
5. **Identify the mutation** — the hidden `__houdini_form` field names the mutation;
   `__houdini_form_id` (default = mutation name) keys the result. The name is looked up in
   `manifest.formActions` — only `@endpoint` mutations are present; an unknown name ⇒ `400`.
   *An authenticated, same-origin user can invoke any `@endpoint` mutation by name with any
   variables they choose — this is by design (it is a mutation the app exposed as a form);
   authorization is the resolver's job via the session context, exactly as for any GraphQL
   request.*
6. **Coerce variables** — `coerceFormData(formData, artifact.input, config)`. Driven by the
   artifact's input metadata; it iterates the *known* fields, so the marker / token fields
   (and any unknown form field) are dropped and never reach the mutation. Produces rich
   values (e.g. a `Date`).
7. **Marshal** — `marshalInputs(...)` converts rich values to transport form, identical to
   the client send (so custom scalars go over the wire correctly).
8. **Build the request** — `buildGraphQLBody`: JSON, or a GraphQL-multipart-spec `FormData`
   when any variable is a `File`/`Blob`.
9. **Execute** — through the already-wired local Yoga proxy (`client.registerProxy`), with
   the caller's session forwarded as the cookie. Session/identity comes from the cookie, not
   from form fields — there is no trusted-variable injection surface.
10. **Branch** —
    - GraphQL errors ⇒ re-render the page with the result injected as `formResult`, status
      `422`. (Yoga masks error messages in production, so resolver internals don't leak.)
    - success + `redirect` ⇒ `303` to `interpolateRedirect(template, data)`.
    - success, no redirect ⇒ `303` back to the page URL (PRG, refresh-safe).

### Enhanced path (after hydration)

`useMutationForm` renders the *same* string-action form, so hydration is byte-identical.
After hydration `onSubmit` intercepts: `preventDefault` → `coerceFormData` (same function,
same rules) → `observer.send` through the normal client pipeline (which marshals and does
its own multipart handling) → set `state` → on success `interpolateRedirect` + client
`goto`. The enhanced path posts `application/json` (or multipart for files) to `/_api`,
which is not a CORS simple request and is preflight-protected. The hidden markers + CSRF
token are rendered but only consumed by the no-JS path.

### Redirect handling (open-redirect)

Closed at three layers: (1) **build time** — the compiler rejects any `redirect` that isn't
a single-leading-slash relative path (no scheme, no `//`) and requires each interpolation
path to resolve to a leaf scalar in the selection set; (2) **runtime** — `interpolateRedirect`
emits literal segments verbatim and `encodeURIComponent`s every interpolated value; (3) a
`null`/`undefined` interpolation value aborts the redirect (PRG-back instead of
`/users/undefined`). The template is a compiler-parsed array, never re-parsed from a string
at request time.

### CSRF trust model (layered, all fail-closed)

1. `SameSite=Lax; HttpOnly; Secure` session cookie (existing).
2. Mandatory `Origin` check on every form POST (primary control; closes cross-site and,
   with the allowlist, governs multi-origin).
3. `415` rejection of `x-www-form-urlencoded` at the GraphQL endpoint (prevents the same-site
   form-POST bypass around `handleForm`).
4. Always-on **signed token**: server signs `{ houdiniForm: true }` with `session_keys[0]`
   at render, renders it in `__houdini_csrf`, and verifies the signature on submit. A
   cross-origin page cannot read the token (same-origin policy on the response body), so it
   cannot forge a valid POST even from a sibling subdomain.

### Security notes & residual risks (for the reviewer)

- **Token shape.** The token is a *signed proof of server origin*, not a per-session /
  per-form / per-request nonce. The payload is a constant and there is **no expiry**, so any
  token this server issues is accepted for any form/session until the signing key rotates.
  This is sufficient for CSRF (an attacker cannot obtain a valid token cross-origin) but is
  **not** anti-replay and does not bind a token to a user. Tightening (per-session value,
  `exp`) is a candidate hardening — flagged explicitly for review.
- **Random key fallback.** Without configured `sessionKeys`, the signing key is random
  per-process: tokens (and auth sessions) do not survive a restart and do not verify across
  a load-balanced fleet. The defense still holds (a wrong key only ever *rejects*), but
  production deployments must configure `sessionKeys` for correctness, not just security.
- **Multipart bypass residual.** `x-www-form-urlencoded` is rejected at `/_api`, but
  `multipart/form-data` is not (uploads need it). A same-site attacker could in principle
  craft a GraphQL-multipart-spec `multipart` form POST to `/_api`. It is far harder to forge
  and still gated by `SameSite=Lax` for authenticated mutations; noted as a known gap.
- **Mutation reachability.** Any mutation carrying `@endpoint` is invocable by name through
  the form handler by anyone who passes the Origin + token checks. Treat `@endpoint` as
  "this mutation is exposed to first-party browser forms"; resolvers must still authorize.
- **Over-posting / mass assignment.** `coerceFormData` drives off the mutation's *input
  type*, not the inputs the page rendered — so it accepts any in-schema field whether or not
  a visible `<input>` exists. The "unknown fields are dropped" rule only covers fields that
  aren't in the schema; an in-schema field like `input.isAdmin` is still accepted from the
  POST. **The visible markup is not the trust boundary; the input type is.** Two mitigations:
  - **`@endpoint(fields: [...])`** — an optional compile-time allowlist of form-field names
    (`"name"`, `"input.email"`, `"tags[]"`). When present, `coerceFormData` drops any
    submitted key outside it, *on both paths* (the list is baked into the artifact, so the
    server handler and the client hook enforce the identical set; a hook-only option would
    leave the no-JS POST open). Absent `fields`, the whole input type is accepted.
  - **Loud documentation (the default-case mitigation):** never put authorization-sensitive
    fields (roles, ownership, account flags) in an `@endpoint` mutation's input — split them
    into a separate mutation or set them server-side from the session context, never from a
    variable.

  The compiler validates that each `fields` entry's top-level segment names a declared
  variable of the mutation (so a typo like `["nam"]` is a build error, not a silently-empty
  allowlist). Remaining gap: it does not yet walk *deeper* segments (`input.email`) against
  the input object's fields — those still pass as long as the top-level variable exists.
- **Origin-check baseline behind a proxy (audited).** The check compares the request
  `Origin` against `parsedURL.origin`, where `parsedURL = new URL(request.url)`. The node
  adapter (`adapter-node/app.ts`) builds that `Request` via `@whatwg-node/server` v0.11,
  whose `buildFullUrl` derives:
  - **host** from the `Host` header (or HTTP/2 `:authority`), then `req.hostname`, then the
    socket address — **it never reads any `X-Forwarded-*` header** (verified against the
    package source); and
  - **scheme** from `req.protocol || (socket.encrypted ? 'https' : 'http')`, which for the
    plain `node:http` server resolves to `http` whenever TLS is terminated upstream.

  Two consequences, neither a bypass:
  - **No forwarded-host spoofing vector.** Because `X-Forwarded-Host` is ignored and the only
    host input is `Host`, a cross-site attacker cannot make `parsedURL.origin` equal their
    own origin (the victim's browser sets `Host` to the *target* host). The session-bound
    token is a second layer regardless.
  - **Availability, not security:** behind a TLS-terminating proxy the derived scheme is
    `http` while the browser's `Origin` is `https://…`, so the bare check would **`403`
    legitimate** submissions. **Fix:** pin the canonical public origin(s) in
    `router.allowedOrigins` (e.g. `["https://app.example.com"]`); the check accepts any
    listed origin, so it no longer depends on the derived scheme. Production deployments
    behind a proxy must configure this. (A different adapter that *does* populate
    `req.protocol`/host from forwarded headers would reintroduce a trusted-proxy assumption;
    that is the adapter's responsibility to document.)
- **No-JS session establishment is out of scope** — login that must set a cookie without JS
  uses the existing auth redirect flow, not this endpoint.

## Test plan

Per the project testing heuristic, browser-verifiable behavior needs two layers:

- **Go table tests** (`packages/houdini-core/plugin/`): `@endpoint` placement validation,
  redirect interpolation-path and relative-path validation, duplicate-form-id warning, and
  the generated artifact shape (form marker, upload-enctype flag, redirect template,
  registration in the form-action manifest).
- **Playwright e2e** (`e2e/react/`): the no-JS native POST path (submit with JS disabled,
  assert redirect / inline errors) and the enhanced path (optimistic update, pending via
  `useMutationFormStatus`, `state` errors), plus a CSRF test (cross-origin POST rejected).

## Affected areas

Shared (framework-neutral — see [The `@endpoint` directive](#the-endpoint-directive)):

- `packages/houdini-core/plugin/` — `@endpoint` definition (`schema/write.go`), extraction,
  validation (`documents/endpoint.go`), and artifact emission.
- `packages/houdini/src/router/server.ts` — the `handleForm()` branch and the `on_render`
  `formResult` field.
- `packages/houdini/src/router/types.ts` — `on_render` signature.
- Houdini core runtime (`houdini`) — the shared `coerceFormData`.

Per-framework runtime adapters (the only framework-specific surface):

- `packages/houdini-react/` — `useMutationForm`, `useMutationFormStatus` + its context,
  the router-context plumbing for `formResult`, and the React adapter's `on_render`.
- `packages/houdini-svelte/` (future) — a `use:enhance` store action and the Svelte
  adapter's `on_render` equivalent.

## Open questions

- The exact shape of the `useMutationFormStatus()` context (single nearest form vs keyed
  by `formId` when several forms are nested) and whether `state` should also be exposable
  via that context for symmetry.
- Whether the opt-in signed-token CSRF layer is needed for any first-party deployment, or
  can stay purely a config option.

## Resolved by spike

- React 19's client function actions do **not** progressively enhance without RSC server
  references; `useActionState`'s `permalink` is ignored for client actions
  (verified against react-dom 19.2.7). Hence the Remix-style string-action + `onSubmit`
  approach. See [Why not React function actions](#why-not-react-function-actions).
