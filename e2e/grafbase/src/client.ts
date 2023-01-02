import { HoudiniClient, type RequestHandler, type SubscriptionHandler } from '$houdini';
import { browser } from '$app/environment';

const api_url = 'http://localhost:4000/graphql';
const api_key =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2NzI1OTU1NDksImlzcyI6ImdyYWZiYXNlIiwiYXVkIjoiMDFHTlE3REFXRkI3UE5WTkhLWlFEQ1ZQQUsiLCJqdGkiOiIwMUdOUTdEQVdGRVFERFRCUTVGTVI3SkZNOCIsImVudiI6InByb2R1Y3Rpb24iLCJwdXJwb3NlIjoicHJvamVjdC1hcGkta2V5In0.iH9T9FaE9vTRjPvbMVZnWzPRXHbyzwigKY4RjE4lxpk';

if (browser) {
	const eventSource = new EventSource(api_url + '?x-api-key=' + api_key);
	eventSource.addEventListener('message', (ev) => {
		console.log(ev.data);
	});
}

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

export default new HoudiniClient(requestHandler);
