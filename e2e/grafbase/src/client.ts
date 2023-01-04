import { HoudiniClient, type RequestHandler, type LiveQueryHandler } from '$houdini';

const api_url = 'https://grafbase-test-main-alecaivazis.grafbase.app/graphql';
const api_key =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2NzI1OTU1NDksImlzcyI6ImdyYWZiYXNlIiwiYXVkIjoiMDFHTlE3REFXRkI3UE5WTkhLWlFEQ1ZQQUsiLCJqdGkiOiIwMUdOUTdEQVdGRVFERFRCUTVGTVI3SkZNOCIsImVudiI6InByb2R1Y3Rpb24iLCJwdXJwb3NlIjoicHJvamVjdC1hcGkta2V5In0.iH9T9FaE9vTRjPvbMVZnWzPRXHbyzwigKY4RjE4lxpk';

const requestHandler: RequestHandler = async ({ fetch, text = '', variables = {}, metadata }) => {
	const result = await fetch(api_url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': api_key
		},
		body: JSON.stringify({
			query: text,
			variables
		})
	});
	return await result.json();
};

const liveQueryHandler: LiveQueryHandler = ({ text, variables, onMessage }) => {
	const url = new URL(api_url);
	url.searchParams.append('query', text);
	url.searchParams.append('variables', JSON.stringify(variables));
	url.searchParams.append('x-api-key', api_key);

	const eventSource = new EventSource(url);
	eventSource.addEventListener('message', (ev) => {
		onMessage(ev.data);
	});

	return () => {
		eventSource.close();
	};
};

export default new HoudiniClient(requestHandler, null, liveQueryHandler);
