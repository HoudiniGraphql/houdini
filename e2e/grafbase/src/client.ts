import { HoudiniClient } from '$houdini';

const api_url = 'https://grafbase-test-main-alecaivazis.grafbase.app/graphql';
const api_key =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2NzI1OTU1NDksImlzcyI6ImdyYWZiYXNlIiwiYXVkIjoiMDFHTlE3REFXRkI3UE5WTkhLWlFEQ1ZQQUsiLCJqdGkiOiIwMUdOUTdEQVdGRVFERFRCUTVGTVI3SkZNOCIsImVudiI6InByb2R1Y3Rpb24iLCJwdXJwb3NlIjoicHJvamVjdC1hcGkta2V5In0.iH9T9FaE9vTRjPvbMVZnWzPRXHbyzwigKY4RjE4lxpk';

export default new HoudiniClient({
	url: api_url,
	fetchParams() {
		return {
			headers: {
				'x-api-key': api_key
			}
		};
	}
});
