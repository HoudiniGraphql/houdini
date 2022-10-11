import type { Page_User_FirendsVariables as Variables } from './$houdini';

// should be gone with https://github.com/HoudiniGraphql/houdini/issues/372
export const Page_User_FirendsVariables: Variables = ({ params, url }) => {
  // 1 we know that Page_User can take a "size" and it's an Int
  // 2 check if size is in searchParams
  // 3 cast string to... primitives, or marchal (or the other one, I never know! the type... not the serialized one)
  const rawSize = url.searchParams.get('size');
  const size: number | undefined = rawSize ? parseInt(rawSize, 10) : undefined;

  return { userId: params.userId, size };
};
