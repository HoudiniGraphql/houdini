import type { Page_User_Friends$input } from '$houdini';
import type { Page_User_FriendsVariables as Variables } from './$houdini';

// should be gone with https://github.com/HoudiniGraphql/houdini/issues/372
export const Page_User_FriendsVariables: Variables = ({ params, url }) => {
  return magicPage_User_FriendsVariables(params, url.searchParams);
};

// this type should already exist in houdini
type input = { name: string; nullable: boolean; type: string };

// generate this in the store
function magicPage_User_FriendsVariables(
  params: Record<string, string>,
  searchParams: URLSearchParams
) {
  // graphql inputs
  const inputs_params: input[] = [
    { name: 'userId', nullable: false, type: 'String' },
    { name: 'size', nullable: true, type: 'Int' }
    // { name: 'info.size', nullable: true } // support from the start?
  ];

  return magicParams(params, searchParams, inputs_params);
}

// global houdini function
function magicParams(
  params: Record<string, string>,
  searchParams: URLSearchParams,
  inputs_params: input[] = []
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputs: Record<string, any> = {};

  inputs_params.forEach((param) => {
    // Prio params, then searchParams if nothing in params
    const raw = params[param.name] ?? searchParams.get(param.name);
    if (!param.nullable && raw === undefined) {
      throw new Error(
        `${param} is required if you want autimatic query inferd from url. 
If not, add your custom Page_User_FriendsVariables in page.ts`
      );
    }
    // unmarshal to be ready to give to fetch
    inputs[param.name] = unmarshal(raw, param.type);
  });

  return inputs as Page_User_Friends$input;
}

// global houdini function (already exists?)
function unmarshal(raw: string, type: string) {
  if (type === 'Int') {
    return parseInt(raw);
  }

  // ... all primitive & scalar...

  return raw;
}
