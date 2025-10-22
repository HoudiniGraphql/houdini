import { HelloStore } from '$houdini';

/** @type {import('./$types').PageServerLoad} */
export const load = async (event) => {
  const hello = new HelloStore();
  const { data } = await hello.fetch({ event });

  return { hello: data?.hello };
};
