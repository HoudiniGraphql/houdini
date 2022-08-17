import Prism from 'prismjs'

Prism.languages.graphql = {
	comment: /#.*/,
	description: {
		pattern: /(?:"""(?:[^"]|(?!""")")*"""|"(?:\\.|[^\\"\r\n])*")(?=\s*[a-z_])/i,
		greedy: true,
		alias: 'string',
		inside: {
			'language-markdown': {
				pattern: /(^"(?:"")?)(?!\1)[\s\S]+(?=\1$)/,
				lookbehind: true,
				inside: Prism.languages.markdown
			}
		}
	},
	string: {
		pattern: /"""(?:[^"]|(?!""")")*"""|"(?:\\.|[^\\"\r\n])*"/,
		greedy: true
	},
	number: /(?:\B-|\b)\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
	boolean: /\b(?:false|true)\b/,
	variable: /\$[a-z_]\w*/i,
	directive: {
		pattern: /@[a-z_]\w*/i,
		alias: 'function'
	},
	'attr-name': {
		pattern: /\b[a-z_]\w*(?=\s*(?:\((?:[^()"]|"(?:\\.|[^\\"\r\n])*")*\))?:)/i,
		greedy: true
	},
	'atom-input': {
		pattern: /\b[A-Z]\w*Input\b/,
		alias: 'class-name'
	},
	scalar: /\b(?:Boolean|Float|ID|Int|String)\b/,
	constant: /\b[A-Z][A-Z_\d]*\b/,
	'class-name': {
		pattern: /(\b(?:enum|implements|interface|on|scalar|type|union)\s+|&\s*|:\s*|\[)[A-Z_]\w*/,
		lookbehind: true
	},
	fragment: {
		pattern: /(\bfragment\s+|\.{3}\s*(?!on\b))[a-zA-Z_]\w*/,
		lookbehind: true,
		alias: 'function'
	},
	'definition-mutation': {
		pattern: /(\bmutation\s+)[a-zA-Z_]\w*/,
		lookbehind: true,
		alias: 'function'
	},
	'definition-query': {
		pattern: /(\bquery\s+)[a-zA-Z_]\w*/,
		lookbehind: true,
		alias: 'function'
	},
	keyword:
		/\b(?:directive|enum|extend|fragment|implements|input|interface|mutation|on|query|repeatable|scalar|schema|subscription|type|union)\b/,
	operator: /[!=|&]|\.{3}/,
	'property-query': /\w+(?=\s*\()/,
	object: /\w+(?=\s*\{)/,
	punctuation: /[!(){}\[\]:=,]/,
	property: /\w+/
}

Prism.hooks.add('after-tokenize', function afterTokenizeGraphql(env) {
	if (env.language !== 'graphql') {
		return
	}

	/**
	 * get the graphql token stream that we want to customize
	 *
	 * @typedef {InstanceType<import("./prism-core")["Token"]>} Token
	 * @type {Token[]}
	 */
	var validTokens = env.tokens.filter(function (token) {
		return typeof token !== 'string' && token.type !== 'comment' && token.type !== 'scalar'
	})

	var currentIndex = 0

	/**
	 * Returns whether the token relative to the current index has the given type.
	 *
	 * @param {number} offset
	 * @returns {Token | undefined}
	 */
	function getToken(offset) {
		return validTokens[currentIndex + offset]
	}

	/**
	 * Returns whether the token relative to the current index has the given type.
	 *
	 * @param {readonly string[]} types
	 * @param {number} [offset=0]
	 * @returns {boolean}
	 */
	function isTokenType(types, offset) {
		offset = offset || 0
		for (var i = 0; i < types.length; i++) {
			var token = getToken(i + offset)
			if (!token || token.type !== types[i]) {
				return false
			}
		}
		return true
	}

	/**
	 * Returns the index of the closing bracket to an opening bracket.
	 *
	 * It is assumed that `token[currentIndex - 1]` is an opening bracket.
	 *
	 * If no closing bracket could be found, `-1` will be returned.
	 *
	 * @param {RegExp} open
	 * @param {RegExp} close
	 * @returns {number}
	 */
	function findClosingBracket(open, close) {
		var stackHeight = 1

		for (var i = currentIndex; i < validTokens.length; i++) {
			var token = validTokens[i]
			var content = token.content

			if (token.type === 'punctuation' && typeof content === 'string') {
				if (open.test(content)) {
					stackHeight++
				} else if (close.test(content)) {
					stackHeight--

					if (stackHeight === 0) {
						return i
					}
				}
			}
		}

		return -1
	}

	/**
	 * Adds an alias to the given token.
	 *
	 * @param {Token} token
	 * @param {string} alias
	 * @returns {void}
	 */
	function addAlias(token, alias) {
		var aliases = token.alias
		if (!aliases) {
			token.alias = aliases = []
		} else if (!Array.isArray(aliases)) {
			token.alias = aliases = [aliases]
		}
		aliases.push(alias)
	}

	for (; currentIndex < validTokens.length; ) {
		var startToken = validTokens[currentIndex++]

		// add special aliases for mutation tokens
		if (startToken.type === 'keyword' && startToken.content === 'mutation') {
			// any array of the names of all input variables (if any)
			var inputVariables = []

			if (isTokenType(['definition-mutation', 'punctuation']) && getToken(1).content === '(') {
				// definition

				currentIndex += 2 // skip 'definition-mutation' and 'punctuation'

				var definitionEnd = findClosingBracket(/^\($/, /^\)$/)
				if (definitionEnd === -1) {
					continue
				}

				// find all input variables
				for (; currentIndex < definitionEnd; currentIndex++) {
					var t = getToken(0)
					if (t.type === 'variable') {
						addAlias(t, 'variable-input')
						inputVariables.push(t.content)
					}
				}

				currentIndex = definitionEnd + 1
			}

			if (isTokenType(['punctuation', 'property-query']) && getToken(0).content === '{') {
				currentIndex++ // skip opening bracket

				addAlias(getToken(0), 'property-mutation')

				if (inputVariables.length > 0) {
					var mutationEnd = findClosingBracket(/^\{$/, /^\}$/)
					if (mutationEnd === -1) {
						continue
					}

					// give references to input variables a special alias
					for (var i = currentIndex; i < mutationEnd; i++) {
						var varToken = validTokens[i]
						if (varToken.type === 'variable' && inputVariables.indexOf(varToken.content) >= 0) {
							addAlias(varToken, 'variable-input')
						}
					}
				}
			}
		}
	}
})

Prism.languages.typescript = Prism.languages.extend('javascript', {
	'class-name': {
		pattern:
			/(\b(?:class|extends|implements|instanceof|interface|new|type)\s+)(?!keyof\b)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?:\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>)?/,
		lookbehind: true,
		greedy: true,
		inside: null // see below
	},
	builtin: /\b(?:Array|Function|Promise|any|boolean|console|never|number|string|symbol|unknown)\b/
})

// The keywords TypeScript adds to JavaScript
Prism.languages.typescript.keyword.push(
	/\b(?:abstract|declare|is|keyof|readonly|require)\b/,
	// keywords that have to be followed by an identifier
	/\b(?:asserts|infer|interface|module|namespace|type)\b(?=\s*(?:[{_$a-zA-Z\xA0-\uFFFF]|$))/,
	// This is for `import type *, {}`
	/\btype\b(?=\s*(?:[\{*]|$))/
)

// doesn't work with TS because TS is too complex
delete Prism.languages.typescript['parameter']
delete Prism.languages.typescript['literal-property']

// a version of typescript specifically for highlighting types
var typeInside = Prism.languages.extend('typescript', {})
delete typeInside['class-name']

Prism.languages.typescript['class-name'].inside = typeInside

Prism.languages.insertBefore('typescript', 'function', {
	decorator: {
		pattern: /@[$\w\xA0-\uFFFF]+/,
		inside: {
			at: {
				pattern: /^@/,
				alias: 'operator'
			},
			function: /^[\s\S]+/
		}
	},
	'generic-function': {
		// e.g. foo<T extends "bar" | "baz">( ...
		pattern:
			/#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>(?=\s*\()/,
		greedy: true,
		inside: {
			function: /^#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*/,
			generic: {
				pattern: /<[\s\S]+/, // everything after the first <
				alias: 'class-name',
				inside: typeInside
			}
		}
	}
})

Prism.languages.ts = Prism.languages.typescript

// $ set | grep '^[A-Z][^[:space:]]*=' | cut -d= -f1 | tr '\n' '|'
// + LC_ALL, RANDOM, REPLY, SECONDS.
// + make sure PS1..4 are here as they are not always set,
// - some useless things.
var envVars =
	'\\b(?:BASH|BASHOPTS|BASH_ALIASES|BASH_ARGC|BASH_ARGV|BASH_CMDS|BASH_COMPLETION_COMPAT_DIR|BASH_LINENO|BASH_REMATCH|BASH_SOURCE|BASH_VERSINFO|BASH_VERSION|COLORTERM|COLUMNS|COMP_WORDBREAKS|DBUS_SESSION_BUS_ADDRESS|DEFAULTS_PATH|DESKTOP_SESSION|DIRSTACK|DISPLAY|EUID|GDMSESSION|GDM_LANG|GNOME_KEYRING_CONTROL|GNOME_KEYRING_PID|GPG_AGENT_INFO|GROUPS|HISTCONTROL|HISTFILE|HISTFILESIZE|HISTSIZE|HOME|HOSTNAME|HOSTTYPE|IFS|INSTANCE|JOB|LANG|LANGUAGE|LC_ADDRESS|LC_ALL|LC_IDENTIFICATION|LC_MEASUREMENT|LC_MONETARY|LC_NAME|LC_NUMERIC|LC_PAPER|LC_TELEPHONE|LC_TIME|LESSCLOSE|LESSOPEN|LINES|LOGNAME|LS_COLORS|MACHTYPE|MAILCHECK|MANDATORY_PATH|NO_AT_BRIDGE|OLDPWD|OPTERR|OPTIND|ORBIT_SOCKETDIR|OSTYPE|PAPERSIZE|PATH|PIPESTATUS|PPID|PS1|PS2|PS3|PS4|PWD|RANDOM|REPLY|SECONDS|SELINUX_INIT|SESSION|SESSIONTYPE|SESSION_MANAGER|SHELL|SHELLOPTS|SHLVL|SSH_AUTH_SOCK|TERM|UID|UPSTART_EVENTS|UPSTART_INSTANCE|UPSTART_JOB|UPSTART_SESSION|USER|WINDOWID|XAUTHORITY|XDG_CONFIG_DIRS|XDG_CURRENT_DESKTOP|XDG_DATA_DIRS|XDG_GREETER_DATA_DIR|XDG_MENU_PREFIX|XDG_RUNTIME_DIR|XDG_SEAT|XDG_SEAT_PATH|XDG_SESSION_DESKTOP|XDG_SESSION_ID|XDG_SESSION_PATH|XDG_SESSION_TYPE|XDG_VTNR|XMODIFIERS)\\b'

var commandAfterHeredoc = {
	pattern: /(^(["']?)\w+\2)[ \t]+\S.*/,
	lookbehind: true,
	alias: 'punctuation', // this looks reasonably well in all themes
	inside: null // see below
}

var insideString = {
	bash: commandAfterHeredoc,
	environment: {
		pattern: RegExp('\\$' + envVars),
		alias: 'constant'
	},
	variable: [
		// [0]: Arithmetic Environment
		{
			pattern: /\$?\(\([\s\S]+?\)\)/,
			greedy: true,
			inside: {
				// If there is a $ sign at the beginning highlight $(( and )) as variable
				variable: [
					{
						pattern: /(^\$\(\([\s\S]+)\)\)/,
						lookbehind: true
					},
					/^\$\(\(/
				],
				number: /\b0x[\dA-Fa-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[Ee]-?\d+)?/,
				// Operators according to https://www.gnu.org/software/bash/manual/bashref.html#Shell-Arithmetic
				operator: /--|\+\+|\*\*=?|<<=?|>>=?|&&|\|\||[=!+\-*/%<>^&|]=?|[?~:]/,
				// If there is no $ sign at the beginning highlight (( and )) as punctuation
				punctuation: /\(\(?|\)\)?|,|;/
			}
		},
		// [1]: Command Substitution
		{
			pattern: /\$\((?:\([^)]+\)|[^()])+\)|`[^`]+`/,
			greedy: true,
			inside: {
				variable: /^\$\(|^`|\)$|`$/
			}
		},
		// [2]: Brace expansion
		{
			pattern: /\$\{[^}]+\}/,
			greedy: true,
			inside: {
				operator: /:[-=?+]?|[!\/]|##?|%%?|\^\^?|,,?/,
				punctuation: /[\[\]]/,
				environment: {
					pattern: RegExp('(\\{)' + envVars),
					lookbehind: true,
					alias: 'constant'
				}
			}
		},
		/\$(?:\w+|[#?*!@$])/
	],
	// Escape sequences from echo and printf's manuals, and escaped quotes.
	entity: /\\(?:[abceEfnrtv\\"]|O?[0-7]{1,3}|U[0-9a-fA-F]{8}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{1,2})/
}

Prism.languages.bash = {
	shebang: {
		pattern: /^#!\s*\/.*/,
		alias: 'important'
	},
	comment: {
		pattern: /(^|[^"{\\$])#.*/,
		lookbehind: true
	},
	'function-name': [
		// a) function foo {
		// b) foo() {
		// c) function foo() {
		// but not “foo {”
		{
			// a) and c)
			pattern: /(\bfunction\s+)[\w-]+(?=(?:\s*\(?:\s*\))?\s*\{)/,
			lookbehind: true,
			alias: 'function'
		},
		{
			// b)
			pattern: /\b[\w-]+(?=\s*\(\s*\)\s*\{)/,
			alias: 'function'
		}
	],
	// Highlight variable names as variables in for and select beginnings.
	'for-or-select': {
		pattern: /(\b(?:for|select)\s+)\w+(?=\s+in\s)/,
		alias: 'variable',
		lookbehind: true
	},
	// Highlight variable names as variables in the left-hand part
	// of assignments (“=” and “+=”).
	'assign-left': {
		pattern: /(^|[\s;|&]|[<>]\()\w+(?:\.\w+)*(?=\+?=)/,
		inside: {
			environment: {
				pattern: RegExp('(^|[\\s;|&]|[<>]\\()' + envVars),
				lookbehind: true,
				alias: 'constant'
			}
		},
		alias: 'variable',
		lookbehind: true
	},
	// Highlight parameter names as variables
	parameter: {
		pattern: /(^|\s)-{1,2}(?:\w+:[+-]?)?\w+(?:\.\w+)*(?=[=\s]|$)/,
		alias: 'variable',
		lookbehind: true
	},
	string: [
		// Support for Here-documents https://en.wikipedia.org/wiki/Here_document
		{
			pattern: /((?:^|[^<])<<-?\s*)(\w+)\s[\s\S]*?(?:\r?\n|\r)\2/,
			lookbehind: true,
			greedy: true,
			inside: insideString
		},
		// Here-document with quotes around the tag
		// → No expansion (so no “inside”).
		{
			pattern: /((?:^|[^<])<<-?\s*)(["'])(\w+)\2\s[\s\S]*?(?:\r?\n|\r)\3/,
			lookbehind: true,
			greedy: true,
			inside: {
				bash: commandAfterHeredoc
			}
		},
		// “Normal” string
		{
			// https://www.gnu.org/software/bash/manual/html_node/Double-Quotes.html
			pattern: /(^|[^\\](?:\\\\)*)"(?:\\[\s\S]|\$\([^)]+\)|\$(?!\()|`[^`]+`|[^"\\`$])*"/,
			lookbehind: true,
			greedy: true,
			inside: insideString
		},
		{
			// https://www.gnu.org/software/bash/manual/html_node/Single-Quotes.html
			pattern: /(^|[^$\\])'[^']*'/,
			lookbehind: true,
			greedy: true
		},
		{
			// https://www.gnu.org/software/bash/manual/html_node/ANSI_002dC-Quoting.html
			pattern: /\$'(?:[^'\\]|\\[\s\S])*'/,
			greedy: true,
			inside: {
				entity: insideString.entity
			}
		}
	],
	environment: {
		pattern: RegExp('\\$?' + envVars),
		alias: 'constant'
	},
	variable: insideString.variable,
	function: {
		pattern:
			/(^|[\s;|&]|[<>]\()(?:add|apropos|apt|apt-cache|apt-get|aptitude|aspell|automysqlbackup|awk|basename|bash|bc|bconsole|bg|bzip2|cal|cargo|cat|cfdisk|chgrp|chkconfig|chmod|chown|chroot|cksum|clear|cmp|column|comm|composer|cp|cron|crontab|csplit|curl|cut|date|dc|dd|ddrescue|debootstrap|df|diff|diff3|dig|dir|dircolors|dirname|dirs|dmesg|docker|docker-compose|du|egrep|eject|env|ethtool|expand|expect|expr|fdformat|fdisk|fg|fgrep|file|find|fmt|fold|format|free|fsck|ftp|fuser|gawk|git|gparted|grep|groupadd|groupdel|groupmod|groups|grub-mkconfig|gzip|halt|head|hg|history|host|hostname|htop|iconv|id|ifconfig|ifdown|ifup|import|install|ip|java|jobs|join|kill|killall|less|link|ln|locate|logname|logrotate|look|lpc|lpr|lprint|lprintd|lprintq|lprm|ls|lsof|lynx|make|man|mc|mdadm|mkconfig|mkdir|mke2fs|mkfifo|mkfs|mkisofs|mknod|mkswap|mmv|more|most|mount|mtools|mtr|mutt|mv|nano|nc|netstat|nice|nl|node|nohup|notify-send|npm|nslookup|op|open|parted|passwd|paste|pathchk|ping|pkill|pnpm|podman|podman-compose|popd|pr|printcap|printenv|ps|pushd|pv|quota|quotacheck|quotactl|ram|rar|rcp|reboot|remsync|rename|renice|rev|rm|rmdir|rpm|rsync|scp|screen|sdiff|sed|sendmail|seq|service|sftp|sh|shellcheck|shuf|shutdown|sleep|slocate|sort|split|ssh|stat|strace|su|sudo|sum|suspend|swapon|sync|sysctl|tac|tail|tar|tee|time|timeout|top|touch|tr|traceroute|tsort|tty|umount|uname|unexpand|uniq|units|unrar|unshar|unzip|update-grub|uptime|useradd|userdel|usermod|users|uudecode|uuencode|v|vcpkg|vdir|vi|vim|virsh|vmstat|wait|watch|wc|wget|whereis|which|who|whoami|write|xargs|xdg-open|yarn|yes|zenity|zip|zsh|zypper)(?=$|[)\s;|&])/,
		lookbehind: true
	},
	keyword: {
		pattern:
			/(^|[\s;|&]|[<>]\()(?:case|do|done|elif|else|esac|fi|for|function|if|in|select|then|until|while)(?=$|[)\s;|&])/,
		lookbehind: true
	},
	// https://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html
	builtin: {
		pattern:
			/(^|[\s;|&]|[<>]\()(?:\.|:|alias|bind|break|builtin|caller|cd|command|continue|declare|echo|enable|eval|exec|exit|export|getopts|hash|help|let|local|logout|mapfile|printf|pwd|read|readarray|readonly|return|set|shift|shopt|source|test|times|trap|type|typeset|ulimit|umask|unalias|unset)(?=$|[)\s;|&])/,
		lookbehind: true,
		// Alias added to make those easier to distinguish from strings.
		alias: 'class-name'
	},
	boolean: {
		pattern: /(^|[\s;|&]|[<>]\()(?:false|true)(?=$|[)\s;|&])/,
		lookbehind: true
	},
	'file-descriptor': {
		pattern: /\B&\d\b/,
		alias: 'important'
	},
	operator: {
		// Lots of redirections here, but not just that.
		pattern: /\d?<>|>\||\+=|=[=~]?|!=?|<<[<-]?|[&\d]?>>|\d[<>]&?|[<>][&=]?|&[>&]?|\|[&|]?/,
		inside: {
			'file-descriptor': {
				pattern: /^\d/,
				alias: 'important'
			}
		}
	},
	punctuation: /\$?\(\(?|\)\)?|\.\.|[{}[\];\\]/,
	number: {
		pattern: /(^|\s)(?:[1-9]\d*|0)(?:[.,]\d+)?\b/,
		lookbehind: true
	}
}

commandAfterHeredoc.inside = Prism.languages.bash

/* Patterns in command substitution. */
var toBeCopied = [
	'comment',
	'function-name',
	'for-or-select',
	'assign-left',
	'parameter',
	'string',
	'environment',
	'function',
	'keyword',
	'builtin',
	'boolean',
	'file-descriptor',
	'operator',
	'punctuation',
	'number'
]
var inside = insideString.variable[1].inside
for (var i = 0; i < toBeCopied.length; i++) {
	inside[toBeCopied[i]] = Prism.languages.bash[toBeCopied[i]]
}

Prism.languages.shell = Prism.languages.bash
