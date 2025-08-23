import { GQL_Hello } from '$houdini';

/** @type {import('./$types').PageServerLoad} */
export const load = async (event) => {
  const { data } = await GQL_Hello.fetch({ event });

  return { hello: data?.hello };
};
