import { GQL_Hello } from '$houdini';

export async function GET(event) {
  const { data } = await GQL_Hello.fetch({ event, fetch });

  return {
    body: {
      data
    }
  };
}
