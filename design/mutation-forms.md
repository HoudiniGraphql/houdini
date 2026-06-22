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

1. **Register** the mutation in a server-side form-action manifest (name/hash → document
   + the existing `InputObject` coercion metadata).
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

`useMutationForm` renders a string-action form and intercepts `onSubmit`:

```tsx
// packages/houdini-react/runtime/hooks/useMutationForm.ts
import { useState } from 'react'
import { useMutation } from './useMutation.js'

export function useMutationForm(artifact, opts = {}) {
  const [send] = useMutation({ artifact })            // the normal send; coerced values marshal as usual
  const formId = opts.id ?? artifact.name
  const injected = useFormResults(formId)             // SSR-injected result, null when enhanced

  const [state, setState] = useState(injected)
  const [pending, setPending] = useState(false)

  async function onSubmit(event) {
    event.preventDefault()                            // only reached after hydration
    setPending(true)
    try {
      const variables = coerceFormData(new FormData(event.currentTarget), artifact.input)
      const data = await send({ variables })          // optimistic + cache for free
      setState({ data, errors: null })
      opts.onSuccess?.(data)                          // e.g. setSession, goto(redirect)
    } catch (e) {
      const errors = e.raw ?? [{ message: String(e) }]
      setState({ data: null, errors })
      opts.onError?.(errors)
    } finally {
      setPending(false)
    }
  }

  return {
    // a plain string action: native POST before hydration, intercepted after.
    // identical on server and client → clean hydration.
    form: {
      action: currentUrl,           // the page URL; server marks + dispatches the mutation
      method: 'post',
      onSubmit,
      // encType: 'multipart/form-data' when the mutation has Upload vars
    },
    state,                          // { data, errors } | null
    pending,                        // also exposed via useMutationFormStatus() context
  }
}
```

`pending` is also published on a React context so a `useMutationFormStatus()` hook can read
it from any child (the no-prop-drilling ergonomic of `useFormStatus`, but for our forms,
since React's built-in only tracks function-action submissions).

Hidden marker fields (`__houdini_form`, `__houdini_form_id`, and the CSRF token) are
rendered into the form by the hook so the no-JS POST carries everything the server handler
needs. `state` is seeded from the SSR-injected result (`injected`), so the no-JS re-render
path and the enhanced path converge on the same `{ data, errors }` shape.

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
4. Optional, opt-in: a signed double-submit token (HMAC over a per-session value using the
   existing `session_keys` / `jwt.ts`, rendered as a hidden field at SSR) for hardened
   shared-domain deployments. Deferred from v1.

Verify during implementation that the Yoga GraphQL endpoint rejects form-encoded bodies, so
it cannot be used as a bypass around the form handler (one-line test).

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
