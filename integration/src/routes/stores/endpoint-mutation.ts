import { GQL_AddUser } from '$houdini';

export async function post() {
  await GQL_AddUser.mutate({
    variables: { name: 'JYC', birthDate: new Date('1986-11-07'), delay: 200 },
    fetch
  });

  return {
    body: {
      text: 'OK'
    }
  };
}
