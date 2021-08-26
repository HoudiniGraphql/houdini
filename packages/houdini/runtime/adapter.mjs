// this file is ignored when building the runtime, its only here for testing purposes

module.exports.getSession = function () {
	return {}
}

module.exports.goTo = function (location, options) {
	window.location = location
}
