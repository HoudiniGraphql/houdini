import { graphql, setSession } from '$houdini';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { COOKIE_NAME } from '../../hooks.server';

const store = graphql(`
  mutation SignIn($login: String!, $password: String!) {
    signIn(login: $login, password: $password)
  }
`);

export const actions = {
  sign_in: async (event) => {
    const data = await event.request.formData();
    const login = data.get('login');
    const password = data.get('password');

    if (login && password) {
      try {
        const res = await store.mutate(
          { login: login.toString(), password: password.toString() },
          { event }
        );
        if (res.data?.signIn) {
          const token = res.data?.signIn;
          event.cookies.set(COOKIE_NAME, token);
          setSession(event, { user: { token } });

          return {
            body: {
              message: 'sign_in done successfully'
            }
          };
        }
      } catch (error) {}
    }
    return fail(401, { message: 'sign_in error' });
  },
  sign_out: async (event) => {
    event.cookies.delete(COOKIE_NAME);
    setSession(event, { user: undefined });
    return {
      body: {
        message: 'sign_out done successfully'
      }
    };
  }
} satisfies Actions;
