import { graphql } from '$houdini';

export const beforeLoad = async () => {
	console.log('coucou');
};

const query = graphql`
	query Hello1 {
		hello
	}
`;

export const houdini_load = [query];
