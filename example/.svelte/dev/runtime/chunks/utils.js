/** @param {HTMLDocument} doc */
function get_base_uri(doc) {
	let baseURI = doc.baseURI;

	if (!baseURI) {
		const baseTags = doc.getElementsByTagName('base');
		baseURI = baseTags.length ? baseTags[0].href : doc.URL;
	}

	return baseURI;
}

export { get_base_uri as g };
