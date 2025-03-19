Fixes #TICKET

### To help everyone out, please make sure your PR does the following:

- [ ] Update the first line to point to the ticket that this PR fixes
- [ ] Add a message that clearly describes the fix
- [ ] If applicable, add a test that would fail without this fix
- [ ] Make sure the unit and integration tests pass locally with `pnpm run tests` and `cd integration && pnpm run tests`
- [ ] Ensure your code is formatted to conform to standard style with `pnpm run format:write` (or `format:check` if you want to preview changes) and linted `pnpm run lint`
- [ ] Includes a changeset if your fix affects the user with `pnpm changeset`
