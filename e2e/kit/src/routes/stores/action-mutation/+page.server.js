import { graphql } from '$houdini';
import { fail } from '@sveltejs/kit';

/** @type {import('./$types').Actions} */
export const actions = {
  add: async (event) => {
    const data = await event.request.formData();

    const name = data.get('name')?.toString();

    if (!name) {
      return fail(403, { name: '*' });
    }

    const actionMutation = graphql(`
      mutation ActionMutation($name: String!) {
        addUser(name: $name, birthDate: 254143016000, snapshot: "ActionMutation") {
          id
          name
        }
      }
    `);

    return await actionMutation.mutate({ name }, { event });
  }
};
