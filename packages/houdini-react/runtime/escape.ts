// escapeScriptTag makes an already-serialized JSON string safe to embed inside an inline
// <script>. JSON.stringify does not escape these, so without it a value that echoes
// attacker input (e.g. a form result on the error re-render) could break out of the script
// tag -- a reflected XSS. We escape:
//   - "<"              -> neutralizes </script> and <!-- breakouts
//   - U+2028 / U+2029  -> JS line terminators that would otherwise end the inline script
const LS = String.fromCharCode(0x2028)
const PS = String.fromCharCode(0x2029)

export function escapeScriptTag(json: string): string {
	return json
		.replace(/</g, '\\u003c')
		.replace(new RegExp(LS, 'g'), '\\u2028')
		.replace(new RegExp(PS, 'g'), '\\u2029')
}
