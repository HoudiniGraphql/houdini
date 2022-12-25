export function load({ cookies }) {
	return {
		ui_theme: parseInt(cookies.get('ui_theme') ?? 0),
		lang: cookies.get('lang') ?? 0
	}
}
