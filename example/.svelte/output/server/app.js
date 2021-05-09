import {randomBytes, createHash} from "crypto";
import http from "http";
import https from "https";
import zlib from "zlib";
import Stream, {PassThrough, pipeline} from "stream";
import {types} from "util";
import {format, parse, resolve} from "url";
import {SubscriptionClient} from "subscriptions-transport-ws";
var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
var unsafeChars = /[<>\b\f\n\r\t\0\u2028\u2029]/g;
var reserved = /^(?:do|if|in|for|int|let|new|try|var|byte|case|char|else|enum|goto|long|this|void|with|await|break|catch|class|const|final|float|short|super|throw|while|yield|delete|double|export|import|native|return|switch|throws|typeof|boolean|default|extends|finally|package|private|abstract|continue|debugger|function|volatile|interface|protected|transient|implements|instanceof|synchronized)$/;
var escaped$1 = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "	": "\\t",
  "\0": "\\0",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};
var objectProtoOwnPropertyNames = Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
function devalue(value) {
  var counts = new Map();
  function walk(thing) {
    if (typeof thing === "function") {
      throw new Error("Cannot stringify a function");
    }
    if (counts.has(thing)) {
      counts.set(thing, counts.get(thing) + 1);
      return;
    }
    counts.set(thing, 1);
    if (!isPrimitive(thing)) {
      var type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
        case "Date":
        case "RegExp":
          return;
        case "Array":
          thing.forEach(walk);
          break;
        case "Set":
        case "Map":
          Array.from(thing).forEach(walk);
          break;
        default:
          var proto = Object.getPrototypeOf(thing);
          if (proto !== Object.prototype && proto !== null && Object.getOwnPropertyNames(proto).sort().join("\0") !== objectProtoOwnPropertyNames) {
            throw new Error("Cannot stringify arbitrary non-POJOs");
          }
          if (Object.getOwnPropertySymbols(thing).length > 0) {
            throw new Error("Cannot stringify POJOs with symbolic keys");
          }
          Object.keys(thing).forEach(function(key) {
            return walk(thing[key]);
          });
      }
    }
  }
  walk(value);
  var names = new Map();
  Array.from(counts).filter(function(entry) {
    return entry[1] > 1;
  }).sort(function(a, b) {
    return b[1] - a[1];
  }).forEach(function(entry, i) {
    names.set(entry[0], getName(i));
  });
  function stringify(thing) {
    if (names.has(thing)) {
      return names.get(thing);
    }
    if (isPrimitive(thing)) {
      return stringifyPrimitive(thing);
    }
    var type = getType(thing);
    switch (type) {
      case "Number":
      case "String":
      case "Boolean":
        return "Object(" + stringify(thing.valueOf()) + ")";
      case "RegExp":
        return "new RegExp(" + stringifyString(thing.source) + ', "' + thing.flags + '")';
      case "Date":
        return "new Date(" + thing.getTime() + ")";
      case "Array":
        var members = thing.map(function(v, i) {
          return i in thing ? stringify(v) : "";
        });
        var tail = thing.length === 0 || thing.length - 1 in thing ? "" : ",";
        return "[" + members.join(",") + tail + "]";
      case "Set":
      case "Map":
        return "new " + type + "([" + Array.from(thing).map(stringify).join(",") + "])";
      default:
        var obj = "{" + Object.keys(thing).map(function(key) {
          return safeKey(key) + ":" + stringify(thing[key]);
        }).join(",") + "}";
        var proto = Object.getPrototypeOf(thing);
        if (proto === null) {
          return Object.keys(thing).length > 0 ? "Object.assign(Object.create(null)," + obj + ")" : "Object.create(null)";
        }
        return obj;
    }
  }
  var str = stringify(value);
  if (names.size) {
    var params_1 = [];
    var statements_1 = [];
    var values_1 = [];
    names.forEach(function(name2, thing) {
      params_1.push(name2);
      if (isPrimitive(thing)) {
        values_1.push(stringifyPrimitive(thing));
        return;
      }
      var type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
          values_1.push("Object(" + stringify(thing.valueOf()) + ")");
          break;
        case "RegExp":
          values_1.push(thing.toString());
          break;
        case "Date":
          values_1.push("new Date(" + thing.getTime() + ")");
          break;
        case "Array":
          values_1.push("Array(" + thing.length + ")");
          thing.forEach(function(v, i) {
            statements_1.push(name2 + "[" + i + "]=" + stringify(v));
          });
          break;
        case "Set":
          values_1.push("new Set");
          statements_1.push(name2 + "." + Array.from(thing).map(function(v) {
            return "add(" + stringify(v) + ")";
          }).join("."));
          break;
        case "Map":
          values_1.push("new Map");
          statements_1.push(name2 + "." + Array.from(thing).map(function(_a) {
            var k = _a[0], v = _a[1];
            return "set(" + stringify(k) + ", " + stringify(v) + ")";
          }).join("."));
          break;
        default:
          values_1.push(Object.getPrototypeOf(thing) === null ? "Object.create(null)" : "{}");
          Object.keys(thing).forEach(function(key) {
            statements_1.push("" + name2 + safeProp(key) + "=" + stringify(thing[key]));
          });
      }
    });
    statements_1.push("return " + str);
    return "(function(" + params_1.join(",") + "){" + statements_1.join(";") + "}(" + values_1.join(",") + "))";
  } else {
    return str;
  }
}
function getName(num) {
  var name2 = "";
  do {
    name2 = chars[num % chars.length] + name2;
    num = ~~(num / chars.length) - 1;
  } while (num >= 0);
  return reserved.test(name2) ? name2 + "_" : name2;
}
function isPrimitive(thing) {
  return Object(thing) !== thing;
}
function stringifyPrimitive(thing) {
  if (typeof thing === "string")
    return stringifyString(thing);
  if (thing === void 0)
    return "void 0";
  if (thing === 0 && 1 / thing < 0)
    return "-0";
  var str = String(thing);
  if (typeof thing === "number")
    return str.replace(/^(-)?0\./, "$1.");
  return str;
}
function getType(thing) {
  return Object.prototype.toString.call(thing).slice(8, -1);
}
function escapeUnsafeChar(c) {
  return escaped$1[c] || c;
}
function escapeUnsafeChars(str) {
  return str.replace(unsafeChars, escapeUnsafeChar);
}
function safeKey(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? key : escapeUnsafeChars(JSON.stringify(key));
}
function safeProp(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? "." + key : "[" + escapeUnsafeChars(JSON.stringify(key)) + "]";
}
function stringifyString(str) {
  var result = '"';
  for (var i = 0; i < str.length; i += 1) {
    var char = str.charAt(i);
    var code = char.charCodeAt(0);
    if (char === '"') {
      result += '\\"';
    } else if (char in escaped$1) {
      result += escaped$1[char];
    } else if (code >= 55296 && code <= 57343) {
      var next = str.charCodeAt(i + 1);
      if (code <= 56319 && (next >= 56320 && next <= 57343)) {
        result += char + str[++i];
      } else {
        result += "\\u" + code.toString(16).toUpperCase();
      }
    } else {
      result += char;
    }
  }
  result += '"';
  return result;
}
function noop$1() {
}
function safe_not_equal$1(a, b) {
  return a != a ? b == b : a !== b || (a && typeof a === "object" || typeof a === "function");
}
const subscriber_queue$1 = [];
function writable$1(value, start = noop$1) {
  let stop;
  const subscribers = [];
  function set(new_value) {
    if (safe_not_equal$1(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue$1.length;
        for (let i = 0; i < subscribers.length; i += 1) {
          const s2 = subscribers[i];
          s2[1]();
          subscriber_queue$1.push(s2, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue$1.length; i += 2) {
            subscriber_queue$1[i][0](subscriber_queue$1[i + 1]);
          }
          subscriber_queue$1.length = 0;
        }
      }
    }
  }
  function update(fn) {
    set(fn(value));
  }
  function subscribe2(run2, invalidate = noop$1) {
    const subscriber = [run2, invalidate];
    subscribers.push(subscriber);
    if (subscribers.length === 1) {
      stop = start(set) || noop$1;
    }
    run2(value);
    return () => {
      const index2 = subscribers.indexOf(subscriber);
      if (index2 !== -1) {
        subscribers.splice(index2, 1);
      }
      if (subscribers.length === 0) {
        stop();
        stop = null;
      }
    };
  }
  return {set, update, subscribe: subscribe2};
}
const s$1 = JSON.stringify;
async function render_response({
  options,
  $session,
  page_config,
  status,
  error: error2,
  branch,
  page: page2
}) {
  const css2 = new Set();
  const js = new Set();
  const styles = new Set();
  const serialized_data = [];
  let rendered;
  let is_private = false;
  let maxage;
  if (branch) {
    branch.forEach(({node, loaded, fetched, uses_credentials}) => {
      if (node.css)
        node.css.forEach((url) => css2.add(url));
      if (node.js)
        node.js.forEach((url) => js.add(url));
      if (node.styles)
        node.styles.forEach((content) => styles.add(content));
      if (fetched && page_config.hydrate)
        serialized_data.push(...fetched);
      if (uses_credentials)
        is_private = true;
      maxage = loaded.maxage;
    });
    if (error2) {
      if (options.dev) {
        error2.stack = await options.get_stack(error2);
      } else {
        error2.stack = String(error2);
      }
    }
    const session2 = writable$1($session);
    const props = {
      stores: {
        page: writable$1(null),
        navigating: writable$1(null),
        session: session2
      },
      page: page2,
      components: branch.map(({node}) => node.module.default)
    };
    for (let i = 0; i < branch.length; i += 1) {
      props[`props_${i}`] = await branch[i].loaded.props;
    }
    let session_tracking_active = false;
    const unsubscribe = session2.subscribe(() => {
      if (session_tracking_active)
        is_private = true;
    });
    session_tracking_active = true;
    try {
      rendered = options.root.render(props);
    } finally {
      unsubscribe();
    }
  } else {
    rendered = {head: "", html: "", css: ""};
  }
  const links = options.amp ? styles.size > 0 ? `<style amp-custom>${Array.from(styles).join("\n")}</style>` : "" : [
    ...Array.from(js).map((dep) => `<link rel="modulepreload" href="${dep}">`),
    ...Array.from(css2).map((dep) => `<link rel="stylesheet" href="${dep}">`)
  ].join("\n		");
  let init2 = "";
  if (options.amp) {
    init2 = `
		<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style>
		<noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
		<script async src="https://cdn.ampproject.org/v0.js"></script>`;
  } else if (page_config.router || page_config.hydrate) {
    init2 = `<script type="module">
			import { start } from ${s$1(options.entry)};
			start({
				target: ${options.target ? `document.querySelector(${s$1(options.target)})` : "document.body"},
				paths: ${s$1(options.paths)},
				session: ${try_serialize($session, (error3) => {
      throw new Error(`Failed to serialize session data: ${error3.message}`);
    })},
				host: ${page2.host ? s$1(page2.host) : "location.host"},
				route: ${!!page_config.router},
				spa: ${!page_config.ssr},
				hydrate: ${page_config.ssr && page_config.hydrate ? `{
					status: ${status},
					error: ${serialize_error(error2)},
					nodes: [
						${branch.map(({node}) => `import(${s$1(node.entry)})`).join(",\n						")}
					],
					page: {
						host: ${page2.host ? s$1(page2.host) : "location.host"}, // TODO this is redundant
						path: ${s$1(page2.path)},
						query: new URLSearchParams(${s$1(page2.query.toString())}),
						params: ${s$1(page2.params)}
					}
				}` : "null"}
			});
		</script>`;
  }
  const head = [
    rendered.head,
    styles.size && !options.amp ? `<style data-svelte>${Array.from(styles).join("\n")}</style>` : "",
    links,
    init2
  ].join("\n\n		");
  const body = options.amp ? rendered.html : `${rendered.html}

			${serialized_data.map(({url, json}) => `<script type="svelte-data" url="${url}">${json}</script>`).join("\n\n			")}
		`.replace(/^\t{2}/gm, "");
  const headers = {
    "content-type": "text/html"
  };
  if (maxage) {
    headers["cache-control"] = `${is_private ? "private" : "public"}, max-age=${maxage}`;
  }
  return {
    status,
    headers,
    body: options.template({head, body})
  };
}
function try_serialize(data, fail) {
  try {
    return devalue(data);
  } catch (err) {
    if (fail)
      fail(err);
    return null;
  }
}
function serialize_error(error2) {
  if (!error2)
    return null;
  let serialized = try_serialize(error2);
  if (!serialized) {
    const {name: name2, message, stack} = error2;
    serialized = try_serialize({name: name2, message, stack});
  }
  if (!serialized) {
    serialized = "{}";
  }
  return serialized;
}
function dataUriToBuffer(uri) {
  if (!/^data:/i.test(uri)) {
    throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');
  }
  uri = uri.replace(/\r?\n/g, "");
  const firstComma = uri.indexOf(",");
  if (firstComma === -1 || firstComma <= 4) {
    throw new TypeError("malformed data: URI");
  }
  const meta = uri.substring(5, firstComma).split(";");
  let charset = "";
  let base64 = false;
  const type = meta[0] || "text/plain";
  let typeFull = type;
  for (let i = 1; i < meta.length; i++) {
    if (meta[i] === "base64") {
      base64 = true;
    } else {
      typeFull += `;${meta[i]}`;
      if (meta[i].indexOf("charset=") === 0) {
        charset = meta[i].substring(8);
      }
    }
  }
  if (!meta[0] && !charset.length) {
    typeFull += ";charset=US-ASCII";
    charset = "US-ASCII";
  }
  const encoding = base64 ? "base64" : "ascii";
  const data = unescape(uri.substring(firstComma + 1));
  const buffer = Buffer.from(data, encoding);
  buffer.type = type;
  buffer.typeFull = typeFull;
  buffer.charset = charset;
  return buffer;
}
var src = dataUriToBuffer;
const {Readable} = Stream;
const wm = new WeakMap();
async function* read(parts) {
  for (const part of parts) {
    if ("stream" in part) {
      yield* part.stream();
    } else {
      yield part;
    }
  }
}
class Blob {
  constructor(blobParts = [], options = {type: ""}) {
    let size = 0;
    const parts = blobParts.map((element) => {
      let buffer;
      if (element instanceof Buffer) {
        buffer = element;
      } else if (ArrayBuffer.isView(element)) {
        buffer = Buffer.from(element.buffer, element.byteOffset, element.byteLength);
      } else if (element instanceof ArrayBuffer) {
        buffer = Buffer.from(element);
      } else if (element instanceof Blob) {
        buffer = element;
      } else {
        buffer = Buffer.from(typeof element === "string" ? element : String(element));
      }
      size += buffer.length || buffer.size || 0;
      return buffer;
    });
    const type = options.type === void 0 ? "" : String(options.type).toLowerCase();
    wm.set(this, {
      type: /[^\u0020-\u007E]/.test(type) ? "" : type,
      size,
      parts
    });
  }
  get size() {
    return wm.get(this).size;
  }
  get type() {
    return wm.get(this).type;
  }
  async text() {
    return Buffer.from(await this.arrayBuffer()).toString();
  }
  async arrayBuffer() {
    const data = new Uint8Array(this.size);
    let offset = 0;
    for await (const chunk of this.stream()) {
      data.set(chunk, offset);
      offset += chunk.length;
    }
    return data.buffer;
  }
  stream() {
    return Readable.from(read(wm.get(this).parts));
  }
  slice(start = 0, end = this.size, type = "") {
    const {size} = this;
    let relativeStart = start < 0 ? Math.max(size + start, 0) : Math.min(start, size);
    let relativeEnd = end < 0 ? Math.max(size + end, 0) : Math.min(end, size);
    const span = Math.max(relativeEnd - relativeStart, 0);
    const parts = wm.get(this).parts.values();
    const blobParts = [];
    let added = 0;
    for (const part of parts) {
      const size2 = ArrayBuffer.isView(part) ? part.byteLength : part.size;
      if (relativeStart && size2 <= relativeStart) {
        relativeStart -= size2;
        relativeEnd -= size2;
      } else {
        const chunk = part.slice(relativeStart, Math.min(size2, relativeEnd));
        blobParts.push(chunk);
        added += ArrayBuffer.isView(chunk) ? chunk.byteLength : chunk.size;
        relativeStart = 0;
        if (added >= span) {
          break;
        }
      }
    }
    const blob = new Blob([], {type});
    Object.assign(wm.get(blob), {size: span, parts: blobParts});
    return blob;
  }
  get [Symbol.toStringTag]() {
    return "Blob";
  }
  static [Symbol.hasInstance](object) {
    return typeof object === "object" && typeof object.stream === "function" && object.stream.length === 0 && typeof object.constructor === "function" && /^(Blob|File)$/.test(object[Symbol.toStringTag]);
  }
}
Object.defineProperties(Blob.prototype, {
  size: {enumerable: true},
  type: {enumerable: true},
  slice: {enumerable: true}
});
var fetchBlob = Blob;
class FetchBaseError extends Error {
  constructor(message, type) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.type = type;
  }
  get name() {
    return this.constructor.name;
  }
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
}
class FetchError extends FetchBaseError {
  constructor(message, type, systemError) {
    super(message, type);
    if (systemError) {
      this.code = this.errno = systemError.code;
      this.erroredSysCall = systemError.syscall;
    }
  }
}
const NAME = Symbol.toStringTag;
const isURLSearchParameters = (object) => {
  return typeof object === "object" && typeof object.append === "function" && typeof object.delete === "function" && typeof object.get === "function" && typeof object.getAll === "function" && typeof object.has === "function" && typeof object.set === "function" && typeof object.sort === "function" && object[NAME] === "URLSearchParams";
};
const isBlob = (object) => {
  return typeof object === "object" && typeof object.arrayBuffer === "function" && typeof object.type === "string" && typeof object.stream === "function" && typeof object.constructor === "function" && /^(Blob|File)$/.test(object[NAME]);
};
function isFormData(object) {
  return typeof object === "object" && typeof object.append === "function" && typeof object.set === "function" && typeof object.get === "function" && typeof object.getAll === "function" && typeof object.delete === "function" && typeof object.keys === "function" && typeof object.values === "function" && typeof object.entries === "function" && typeof object.constructor === "function" && object[NAME] === "FormData";
}
const isAbortSignal = (object) => {
  return typeof object === "object" && object[NAME] === "AbortSignal";
};
const carriage = "\r\n";
const dashes = "-".repeat(2);
const carriageLength = Buffer.byteLength(carriage);
const getFooter = (boundary) => `${dashes}${boundary}${dashes}${carriage.repeat(2)}`;
function getHeader(boundary, name2, field) {
  let header = "";
  header += `${dashes}${boundary}${carriage}`;
  header += `Content-Disposition: form-data; name="${name2}"`;
  if (isBlob(field)) {
    header += `; filename="${field.name}"${carriage}`;
    header += `Content-Type: ${field.type || "application/octet-stream"}`;
  }
  return `${header}${carriage.repeat(2)}`;
}
const getBoundary = () => randomBytes(8).toString("hex");
async function* formDataIterator(form, boundary) {
  for (const [name2, value] of form) {
    yield getHeader(boundary, name2, value);
    if (isBlob(value)) {
      yield* value.stream();
    } else {
      yield value;
    }
    yield carriage;
  }
  yield getFooter(boundary);
}
function getFormDataLength(form, boundary) {
  let length = 0;
  for (const [name2, value] of form) {
    length += Buffer.byteLength(getHeader(boundary, name2, value));
    if (isBlob(value)) {
      length += value.size;
    } else {
      length += Buffer.byteLength(String(value));
    }
    length += carriageLength;
  }
  length += Buffer.byteLength(getFooter(boundary));
  return length;
}
const INTERNALS$2 = Symbol("Body internals");
class Body {
  constructor(body, {
    size = 0
  } = {}) {
    let boundary = null;
    if (body === null) {
      body = null;
    } else if (isURLSearchParameters(body)) {
      body = Buffer.from(body.toString());
    } else if (isBlob(body))
      ;
    else if (Buffer.isBuffer(body))
      ;
    else if (types.isAnyArrayBuffer(body)) {
      body = Buffer.from(body);
    } else if (ArrayBuffer.isView(body)) {
      body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
    } else if (body instanceof Stream)
      ;
    else if (isFormData(body)) {
      boundary = `NodeFetchFormDataBoundary${getBoundary()}`;
      body = Stream.Readable.from(formDataIterator(body, boundary));
    } else {
      body = Buffer.from(String(body));
    }
    this[INTERNALS$2] = {
      body,
      boundary,
      disturbed: false,
      error: null
    };
    this.size = size;
    if (body instanceof Stream) {
      body.on("error", (err) => {
        const error2 = err instanceof FetchBaseError ? err : new FetchError(`Invalid response body while trying to fetch ${this.url}: ${err.message}`, "system", err);
        this[INTERNALS$2].error = error2;
      });
    }
  }
  get body() {
    return this[INTERNALS$2].body;
  }
  get bodyUsed() {
    return this[INTERNALS$2].disturbed;
  }
  async arrayBuffer() {
    const {buffer, byteOffset, byteLength} = await consumeBody(this);
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }
  async blob() {
    const ct = this.headers && this.headers.get("content-type") || this[INTERNALS$2].body && this[INTERNALS$2].body.type || "";
    const buf = await this.buffer();
    return new fetchBlob([buf], {
      type: ct
    });
  }
  async json() {
    const buffer = await consumeBody(this);
    return JSON.parse(buffer.toString());
  }
  async text() {
    const buffer = await consumeBody(this);
    return buffer.toString();
  }
  buffer() {
    return consumeBody(this);
  }
}
Object.defineProperties(Body.prototype, {
  body: {enumerable: true},
  bodyUsed: {enumerable: true},
  arrayBuffer: {enumerable: true},
  blob: {enumerable: true},
  json: {enumerable: true},
  text: {enumerable: true}
});
async function consumeBody(data) {
  if (data[INTERNALS$2].disturbed) {
    throw new TypeError(`body used already for: ${data.url}`);
  }
  data[INTERNALS$2].disturbed = true;
  if (data[INTERNALS$2].error) {
    throw data[INTERNALS$2].error;
  }
  let {body} = data;
  if (body === null) {
    return Buffer.alloc(0);
  }
  if (isBlob(body)) {
    body = body.stream();
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (!(body instanceof Stream)) {
    return Buffer.alloc(0);
  }
  const accum = [];
  let accumBytes = 0;
  try {
    for await (const chunk of body) {
      if (data.size > 0 && accumBytes + chunk.length > data.size) {
        const err = new FetchError(`content size at ${data.url} over limit: ${data.size}`, "max-size");
        body.destroy(err);
        throw err;
      }
      accumBytes += chunk.length;
      accum.push(chunk);
    }
  } catch (error2) {
    if (error2 instanceof FetchBaseError) {
      throw error2;
    } else {
      throw new FetchError(`Invalid response body while trying to fetch ${data.url}: ${error2.message}`, "system", error2);
    }
  }
  if (body.readableEnded === true || body._readableState.ended === true) {
    try {
      if (accum.every((c) => typeof c === "string")) {
        return Buffer.from(accum.join(""));
      }
      return Buffer.concat(accum, accumBytes);
    } catch (error2) {
      throw new FetchError(`Could not create Buffer from response body for ${data.url}: ${error2.message}`, "system", error2);
    }
  } else {
    throw new FetchError(`Premature close of server response while trying to fetch ${data.url}`);
  }
}
const clone = (instance, highWaterMark) => {
  let p1;
  let p2;
  let {body} = instance;
  if (instance.bodyUsed) {
    throw new Error("cannot clone body after it is used");
  }
  if (body instanceof Stream && typeof body.getBoundary !== "function") {
    p1 = new PassThrough({highWaterMark});
    p2 = new PassThrough({highWaterMark});
    body.pipe(p1);
    body.pipe(p2);
    instance[INTERNALS$2].body = p1;
    body = p2;
  }
  return body;
};
const extractContentType = (body, request) => {
  if (body === null) {
    return null;
  }
  if (typeof body === "string") {
    return "text/plain;charset=UTF-8";
  }
  if (isURLSearchParameters(body)) {
    return "application/x-www-form-urlencoded;charset=UTF-8";
  }
  if (isBlob(body)) {
    return body.type || null;
  }
  if (Buffer.isBuffer(body) || types.isAnyArrayBuffer(body) || ArrayBuffer.isView(body)) {
    return null;
  }
  if (body && typeof body.getBoundary === "function") {
    return `multipart/form-data;boundary=${body.getBoundary()}`;
  }
  if (isFormData(body)) {
    return `multipart/form-data; boundary=${request[INTERNALS$2].boundary}`;
  }
  if (body instanceof Stream) {
    return null;
  }
  return "text/plain;charset=UTF-8";
};
const getTotalBytes = (request) => {
  const {body} = request;
  if (body === null) {
    return 0;
  }
  if (isBlob(body)) {
    return body.size;
  }
  if (Buffer.isBuffer(body)) {
    return body.length;
  }
  if (body && typeof body.getLengthSync === "function") {
    return body.hasKnownLength && body.hasKnownLength() ? body.getLengthSync() : null;
  }
  if (isFormData(body)) {
    return getFormDataLength(request[INTERNALS$2].boundary);
  }
  return null;
};
const writeToStream = (dest, {body}) => {
  if (body === null) {
    dest.end();
  } else if (isBlob(body)) {
    body.stream().pipe(dest);
  } else if (Buffer.isBuffer(body)) {
    dest.write(body);
    dest.end();
  } else {
    body.pipe(dest);
  }
};
const validateHeaderName = typeof http.validateHeaderName === "function" ? http.validateHeaderName : (name2) => {
  if (!/^[\^`\-\w!#$%&'*+.|~]+$/.test(name2)) {
    const err = new TypeError(`Header name must be a valid HTTP token [${name2}]`);
    Object.defineProperty(err, "code", {value: "ERR_INVALID_HTTP_TOKEN"});
    throw err;
  }
};
const validateHeaderValue = typeof http.validateHeaderValue === "function" ? http.validateHeaderValue : (name2, value) => {
  if (/[^\t\u0020-\u007E\u0080-\u00FF]/.test(value)) {
    const err = new TypeError(`Invalid character in header content ["${name2}"]`);
    Object.defineProperty(err, "code", {value: "ERR_INVALID_CHAR"});
    throw err;
  }
};
class Headers extends URLSearchParams {
  constructor(init2) {
    let result = [];
    if (init2 instanceof Headers) {
      const raw2 = init2.raw();
      for (const [name2, values] of Object.entries(raw2)) {
        result.push(...values.map((value) => [name2, value]));
      }
    } else if (init2 == null)
      ;
    else if (typeof init2 === "object" && !types.isBoxedPrimitive(init2)) {
      const method = init2[Symbol.iterator];
      if (method == null) {
        result.push(...Object.entries(init2));
      } else {
        if (typeof method !== "function") {
          throw new TypeError("Header pairs must be iterable");
        }
        result = [...init2].map((pair) => {
          if (typeof pair !== "object" || types.isBoxedPrimitive(pair)) {
            throw new TypeError("Each header pair must be an iterable object");
          }
          return [...pair];
        }).map((pair) => {
          if (pair.length !== 2) {
            throw new TypeError("Each header pair must be a name/value tuple");
          }
          return [...pair];
        });
      }
    } else {
      throw new TypeError("Failed to construct 'Headers': The provided value is not of type '(sequence<sequence<ByteString>> or record<ByteString, ByteString>)");
    }
    result = result.length > 0 ? result.map(([name2, value]) => {
      validateHeaderName(name2);
      validateHeaderValue(name2, String(value));
      return [String(name2).toLowerCase(), String(value)];
    }) : void 0;
    super(result);
    return new Proxy(this, {
      get(target, p, receiver) {
        switch (p) {
          case "append":
          case "set":
            return (name2, value) => {
              validateHeaderName(name2);
              validateHeaderValue(name2, String(value));
              return URLSearchParams.prototype[p].call(receiver, String(name2).toLowerCase(), String(value));
            };
          case "delete":
          case "has":
          case "getAll":
            return (name2) => {
              validateHeaderName(name2);
              return URLSearchParams.prototype[p].call(receiver, String(name2).toLowerCase());
            };
          case "keys":
            return () => {
              target.sort();
              return new Set(URLSearchParams.prototype.keys.call(target)).keys();
            };
          default:
            return Reflect.get(target, p, receiver);
        }
      }
    });
  }
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
  toString() {
    return Object.prototype.toString.call(this);
  }
  get(name2) {
    const values = this.getAll(name2);
    if (values.length === 0) {
      return null;
    }
    let value = values.join(", ");
    if (/^content-encoding$/i.test(name2)) {
      value = value.toLowerCase();
    }
    return value;
  }
  forEach(callback) {
    for (const name2 of this.keys()) {
      callback(this.get(name2), name2);
    }
  }
  *values() {
    for (const name2 of this.keys()) {
      yield this.get(name2);
    }
  }
  *entries() {
    for (const name2 of this.keys()) {
      yield [name2, this.get(name2)];
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  raw() {
    return [...this.keys()].reduce((result, key) => {
      result[key] = this.getAll(key);
      return result;
    }, {});
  }
  [Symbol.for("nodejs.util.inspect.custom")]() {
    return [...this.keys()].reduce((result, key) => {
      const values = this.getAll(key);
      if (key === "host") {
        result[key] = values[0];
      } else {
        result[key] = values.length > 1 ? values : values[0];
      }
      return result;
    }, {});
  }
}
Object.defineProperties(Headers.prototype, ["get", "entries", "forEach", "values"].reduce((result, property) => {
  result[property] = {enumerable: true};
  return result;
}, {}));
function fromRawHeaders(headers = []) {
  return new Headers(headers.reduce((result, value, index2, array) => {
    if (index2 % 2 === 0) {
      result.push(array.slice(index2, index2 + 2));
    }
    return result;
  }, []).filter(([name2, value]) => {
    try {
      validateHeaderName(name2);
      validateHeaderValue(name2, String(value));
      return true;
    } catch (e) {
      return false;
    }
  }));
}
const redirectStatus = new Set([301, 302, 303, 307, 308]);
const isRedirect = (code) => {
  return redirectStatus.has(code);
};
const INTERNALS$1 = Symbol("Response internals");
class Response extends Body {
  constructor(body = null, options = {}) {
    super(body, options);
    const status = options.status || 200;
    const headers = new Headers(options.headers);
    if (body !== null && !headers.has("Content-Type")) {
      const contentType = extractContentType(body);
      if (contentType) {
        headers.append("Content-Type", contentType);
      }
    }
    this[INTERNALS$1] = {
      url: options.url,
      status,
      statusText: options.statusText || "",
      headers,
      counter: options.counter,
      highWaterMark: options.highWaterMark
    };
  }
  get url() {
    return this[INTERNALS$1].url || "";
  }
  get status() {
    return this[INTERNALS$1].status;
  }
  get ok() {
    return this[INTERNALS$1].status >= 200 && this[INTERNALS$1].status < 300;
  }
  get redirected() {
    return this[INTERNALS$1].counter > 0;
  }
  get statusText() {
    return this[INTERNALS$1].statusText;
  }
  get headers() {
    return this[INTERNALS$1].headers;
  }
  get highWaterMark() {
    return this[INTERNALS$1].highWaterMark;
  }
  clone() {
    return new Response(clone(this, this.highWaterMark), {
      url: this.url,
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      ok: this.ok,
      redirected: this.redirected,
      size: this.size
    });
  }
  static redirect(url, status = 302) {
    if (!isRedirect(status)) {
      throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');
    }
    return new Response(null, {
      headers: {
        location: new URL(url).toString()
      },
      status
    });
  }
  get [Symbol.toStringTag]() {
    return "Response";
  }
}
Object.defineProperties(Response.prototype, {
  url: {enumerable: true},
  status: {enumerable: true},
  ok: {enumerable: true},
  redirected: {enumerable: true},
  statusText: {enumerable: true},
  headers: {enumerable: true},
  clone: {enumerable: true}
});
const getSearch = (parsedURL) => {
  if (parsedURL.search) {
    return parsedURL.search;
  }
  const lastOffset = parsedURL.href.length - 1;
  const hash2 = parsedURL.hash || (parsedURL.href[lastOffset] === "#" ? "#" : "");
  return parsedURL.href[lastOffset - hash2.length] === "?" ? "?" : "";
};
const INTERNALS = Symbol("Request internals");
const isRequest = (object) => {
  return typeof object === "object" && typeof object[INTERNALS] === "object";
};
class Request extends Body {
  constructor(input, init2 = {}) {
    let parsedURL;
    if (isRequest(input)) {
      parsedURL = new URL(input.url);
    } else {
      parsedURL = new URL(input);
      input = {};
    }
    let method = init2.method || input.method || "GET";
    method = method.toUpperCase();
    if ((init2.body != null || isRequest(input)) && input.body !== null && (method === "GET" || method === "HEAD")) {
      throw new TypeError("Request with GET/HEAD method cannot have body");
    }
    const inputBody = init2.body ? init2.body : isRequest(input) && input.body !== null ? clone(input) : null;
    super(inputBody, {
      size: init2.size || input.size || 0
    });
    const headers = new Headers(init2.headers || input.headers || {});
    if (inputBody !== null && !headers.has("Content-Type")) {
      const contentType = extractContentType(inputBody, this);
      if (contentType) {
        headers.append("Content-Type", contentType);
      }
    }
    let signal = isRequest(input) ? input.signal : null;
    if ("signal" in init2) {
      signal = init2.signal;
    }
    if (signal !== null && !isAbortSignal(signal)) {
      throw new TypeError("Expected signal to be an instanceof AbortSignal");
    }
    this[INTERNALS] = {
      method,
      redirect: init2.redirect || input.redirect || "follow",
      headers,
      parsedURL,
      signal
    };
    this.follow = init2.follow === void 0 ? input.follow === void 0 ? 20 : input.follow : init2.follow;
    this.compress = init2.compress === void 0 ? input.compress === void 0 ? true : input.compress : init2.compress;
    this.counter = init2.counter || input.counter || 0;
    this.agent = init2.agent || input.agent;
    this.highWaterMark = init2.highWaterMark || input.highWaterMark || 16384;
    this.insecureHTTPParser = init2.insecureHTTPParser || input.insecureHTTPParser || false;
  }
  get method() {
    return this[INTERNALS].method;
  }
  get url() {
    return format(this[INTERNALS].parsedURL);
  }
  get headers() {
    return this[INTERNALS].headers;
  }
  get redirect() {
    return this[INTERNALS].redirect;
  }
  get signal() {
    return this[INTERNALS].signal;
  }
  clone() {
    return new Request(this);
  }
  get [Symbol.toStringTag]() {
    return "Request";
  }
}
Object.defineProperties(Request.prototype, {
  method: {enumerable: true},
  url: {enumerable: true},
  headers: {enumerable: true},
  redirect: {enumerable: true},
  clone: {enumerable: true},
  signal: {enumerable: true}
});
const getNodeRequestOptions = (request) => {
  const {parsedURL} = request[INTERNALS];
  const headers = new Headers(request[INTERNALS].headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "*/*");
  }
  let contentLengthValue = null;
  if (request.body === null && /^(post|put)$/i.test(request.method)) {
    contentLengthValue = "0";
  }
  if (request.body !== null) {
    const totalBytes = getTotalBytes(request);
    if (typeof totalBytes === "number" && !Number.isNaN(totalBytes)) {
      contentLengthValue = String(totalBytes);
    }
  }
  if (contentLengthValue) {
    headers.set("Content-Length", contentLengthValue);
  }
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", "node-fetch");
  }
  if (request.compress && !headers.has("Accept-Encoding")) {
    headers.set("Accept-Encoding", "gzip,deflate,br");
  }
  let {agent} = request;
  if (typeof agent === "function") {
    agent = agent(parsedURL);
  }
  if (!headers.has("Connection") && !agent) {
    headers.set("Connection", "close");
  }
  const search = getSearch(parsedURL);
  const requestOptions = {
    path: parsedURL.pathname + search,
    pathname: parsedURL.pathname,
    hostname: parsedURL.hostname,
    protocol: parsedURL.protocol,
    port: parsedURL.port,
    hash: parsedURL.hash,
    search: parsedURL.search,
    query: parsedURL.query,
    href: parsedURL.href,
    method: request.method,
    headers: headers[Symbol.for("nodejs.util.inspect.custom")](),
    insecureHTTPParser: request.insecureHTTPParser,
    agent
  };
  return requestOptions;
};
class AbortError extends FetchBaseError {
  constructor(message, type = "aborted") {
    super(message, type);
  }
}
const supportedSchemas = new Set(["data:", "http:", "https:"]);
async function fetch(url, options_) {
  return new Promise((resolve2, reject) => {
    const request = new Request(url, options_);
    const options = getNodeRequestOptions(request);
    if (!supportedSchemas.has(options.protocol)) {
      throw new TypeError(`node-fetch cannot load ${url}. URL scheme "${options.protocol.replace(/:$/, "")}" is not supported.`);
    }
    if (options.protocol === "data:") {
      const data = src(request.url);
      const response2 = new Response(data, {headers: {"Content-Type": data.typeFull}});
      resolve2(response2);
      return;
    }
    const send = (options.protocol === "https:" ? https : http).request;
    const {signal} = request;
    let response = null;
    const abort = () => {
      const error2 = new AbortError("The operation was aborted.");
      reject(error2);
      if (request.body && request.body instanceof Stream.Readable) {
        request.body.destroy(error2);
      }
      if (!response || !response.body) {
        return;
      }
      response.body.emit("error", error2);
    };
    if (signal && signal.aborted) {
      abort();
      return;
    }
    const abortAndFinalize = () => {
      abort();
      finalize();
    };
    const request_ = send(options);
    if (signal) {
      signal.addEventListener("abort", abortAndFinalize);
    }
    const finalize = () => {
      request_.abort();
      if (signal) {
        signal.removeEventListener("abort", abortAndFinalize);
      }
    };
    request_.on("error", (err) => {
      reject(new FetchError(`request to ${request.url} failed, reason: ${err.message}`, "system", err));
      finalize();
    });
    request_.on("response", (response_) => {
      request_.setTimeout(0);
      const headers = fromRawHeaders(response_.rawHeaders);
      if (isRedirect(response_.statusCode)) {
        const location = headers.get("Location");
        const locationURL = location === null ? null : new URL(location, request.url);
        switch (request.redirect) {
          case "error":
            reject(new FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request.url}`, "no-redirect"));
            finalize();
            return;
          case "manual":
            if (locationURL !== null) {
              try {
                headers.set("Location", locationURL);
              } catch (error2) {
                reject(error2);
              }
            }
            break;
          case "follow": {
            if (locationURL === null) {
              break;
            }
            if (request.counter >= request.follow) {
              reject(new FetchError(`maximum redirect reached at: ${request.url}`, "max-redirect"));
              finalize();
              return;
            }
            const requestOptions = {
              headers: new Headers(request.headers),
              follow: request.follow,
              counter: request.counter + 1,
              agent: request.agent,
              compress: request.compress,
              method: request.method,
              body: request.body,
              signal: request.signal,
              size: request.size
            };
            if (response_.statusCode !== 303 && request.body && options_.body instanceof Stream.Readable) {
              reject(new FetchError("Cannot follow redirect with body being a readable stream", "unsupported-redirect"));
              finalize();
              return;
            }
            if (response_.statusCode === 303 || (response_.statusCode === 301 || response_.statusCode === 302) && request.method === "POST") {
              requestOptions.method = "GET";
              requestOptions.body = void 0;
              requestOptions.headers.delete("content-length");
            }
            resolve2(fetch(new Request(locationURL, requestOptions)));
            finalize();
            return;
          }
        }
      }
      response_.once("end", () => {
        if (signal) {
          signal.removeEventListener("abort", abortAndFinalize);
        }
      });
      let body = pipeline(response_, new PassThrough(), (error2) => {
        reject(error2);
      });
      if (process.version < "v12.10") {
        response_.on("aborted", abortAndFinalize);
      }
      const responseOptions = {
        url: request.url,
        status: response_.statusCode,
        statusText: response_.statusMessage,
        headers,
        size: request.size,
        counter: request.counter,
        highWaterMark: request.highWaterMark
      };
      const codings = headers.get("Content-Encoding");
      if (!request.compress || request.method === "HEAD" || codings === null || response_.statusCode === 204 || response_.statusCode === 304) {
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      const zlibOptions = {
        flush: zlib.Z_SYNC_FLUSH,
        finishFlush: zlib.Z_SYNC_FLUSH
      };
      if (codings === "gzip" || codings === "x-gzip") {
        body = pipeline(body, zlib.createGunzip(zlibOptions), (error2) => {
          reject(error2);
        });
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      if (codings === "deflate" || codings === "x-deflate") {
        const raw2 = pipeline(response_, new PassThrough(), (error2) => {
          reject(error2);
        });
        raw2.once("data", (chunk) => {
          if ((chunk[0] & 15) === 8) {
            body = pipeline(body, zlib.createInflate(), (error2) => {
              reject(error2);
            });
          } else {
            body = pipeline(body, zlib.createInflateRaw(), (error2) => {
              reject(error2);
            });
          }
          response = new Response(body, responseOptions);
          resolve2(response);
        });
        return;
      }
      if (codings === "br") {
        body = pipeline(body, zlib.createBrotliDecompress(), (error2) => {
          reject(error2);
        });
        response = new Response(body, responseOptions);
        resolve2(response);
        return;
      }
      response = new Response(body, responseOptions);
      resolve2(response);
    });
    writeToStream(request_, request);
  });
}
function normalize(loaded) {
  if (loaded.error) {
    const error2 = typeof loaded.error === "string" ? new Error(loaded.error) : loaded.error;
    const status = loaded.status;
    if (!(error2 instanceof Error)) {
      return {
        status: 500,
        error: new Error(`"error" property returned from load() must be a string or instance of Error, received type "${typeof error2}"`)
      };
    }
    if (!status || status < 400 || status > 599) {
      console.warn('"error" returned from load() without a valid status code \u2014 defaulting to 500');
      return {status: 500, error: error2};
    }
    return {status, error: error2};
  }
  if (loaded.redirect) {
    if (!loaded.status || Math.floor(loaded.status / 100) !== 3) {
      return {
        status: 500,
        error: new Error('"redirect" property returned from load() must be accompanied by a 3xx status code')
      };
    }
    if (typeof loaded.redirect !== "string") {
      return {
        status: 500,
        error: new Error('"redirect" property returned from load() must be a string')
      };
    }
  }
  return loaded;
}
const s = JSON.stringify;
async function load_node({
  request,
  options,
  route,
  page: page2,
  node,
  $session,
  context,
  is_leaf,
  is_error,
  status,
  error: error2
}) {
  const {module} = node;
  let uses_credentials = false;
  const fetched = [];
  let loaded;
  if (module.load) {
    const load_input = {
      page: page2,
      get session() {
        uses_credentials = true;
        return $session;
      },
      fetch: async (resource, opts = {}) => {
        let url;
        if (typeof resource === "string") {
          url = resource;
        } else {
          url = resource.url;
          opts = {
            method: resource.method,
            headers: resource.headers,
            body: resource.body,
            mode: resource.mode,
            credentials: resource.credentials,
            cache: resource.cache,
            redirect: resource.redirect,
            referrer: resource.referrer,
            integrity: resource.integrity,
            ...opts
          };
        }
        if (options.local && url.startsWith(options.paths.assets)) {
          url = url.replace(options.paths.assets, "");
        }
        const parsed = parse(url);
        let response;
        if (parsed.protocol) {
          response = await fetch(parsed.href, opts);
        } else {
          const resolved = resolve(request.path, parsed.pathname);
          const filename = resolved.slice(1);
          const filename_html = `${filename}/index.html`;
          const asset = options.manifest.assets.find((d2) => d2.file === filename || d2.file === filename_html);
          if (asset) {
            if (options.get_static_file) {
              response = new Response(options.get_static_file(asset.file), {
                headers: {
                  "content-type": asset.type
                }
              });
            } else {
              response = await fetch(`http://${page2.host}/${asset.file}`, opts);
            }
          }
          if (!response) {
            const headers = {...opts.headers};
            if (opts.credentials !== "omit") {
              uses_credentials = true;
              headers.cookie = request.headers.cookie;
              if (!headers.authorization) {
                headers.authorization = request.headers.authorization;
              }
            }
            const rendered = await ssr$1({
              host: request.host,
              method: opts.method || "GET",
              headers,
              path: resolved,
              body: opts.body,
              query: new URLSearchParams(parsed.query || "")
            }, {
              ...options,
              fetched: url,
              initiator: route
            });
            if (rendered) {
              if (options.dependencies) {
                options.dependencies.set(resolved, rendered);
              }
              response = new Response(rendered.body, {
                status: rendered.status,
                headers: rendered.headers
              });
            }
          }
        }
        if (response) {
          const proxy = new Proxy(response, {
            get(response2, key, receiver) {
              async function text() {
                const body = await response2.text();
                const headers = {};
                response2.headers.forEach((value, key2) => {
                  if (key2 !== "etag" && key2 !== "set-cookie")
                    headers[key2] = value;
                });
                fetched.push({
                  url,
                  json: `{"status":${response2.status},"statusText":${s(response2.statusText)},"headers":${s(headers)},"body":${escape$1(body)}}`
                });
                return body;
              }
              if (key === "text") {
                return text;
              }
              if (key === "json") {
                return async () => {
                  return JSON.parse(await text());
                };
              }
              return Reflect.get(response2, key, receiver);
            }
          });
          return proxy;
        }
        return response || new Response("Not found", {
          status: 404
        });
      },
      context: {...context}
    };
    if (is_error) {
      load_input.status = status;
      load_input.error = error2;
    }
    loaded = await module.load.call(null, load_input);
  } else {
    loaded = {};
  }
  if (!loaded && is_leaf && !is_error)
    return;
  return {
    node,
    loaded: normalize(loaded),
    context: loaded.context || context,
    fetched,
    uses_credentials
  };
}
const escaped$2 = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "	": "\\t",
  "\0": "\\0",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};
function escape$1(str) {
  let result = '"';
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charAt(i);
    const code = char.charCodeAt(0);
    if (char === '"') {
      result += '\\"';
    } else if (char in escaped$2) {
      result += escaped$2[char];
    } else if (code >= 55296 && code <= 57343) {
      const next = str.charCodeAt(i + 1);
      if (code <= 56319 && next >= 56320 && next <= 57343) {
        result += char + str[++i];
      } else {
        result += `\\u${code.toString(16).toUpperCase()}`;
      }
    } else {
      result += char;
    }
  }
  result += '"';
  return result;
}
async function respond_with_error({request, options, $session, status, error: error2}) {
  const default_layout = await options.load_component(options.manifest.layout);
  const default_error = await options.load_component(options.manifest.error);
  const page2 = {
    host: request.host,
    path: request.path,
    query: request.query,
    params: {}
  };
  const loaded = await load_node({
    request,
    options,
    route: null,
    page: page2,
    node: default_layout,
    $session,
    context: {},
    is_leaf: false,
    is_error: false
  });
  const branch = [
    loaded,
    await load_node({
      request,
      options,
      route: null,
      page: page2,
      node: default_error,
      $session,
      context: loaded.context,
      is_leaf: false,
      is_error: true,
      status,
      error: error2
    })
  ];
  try {
    return await render_response({
      request,
      options,
      $session,
      page_config: {
        hydrate: options.hydrate,
        router: options.router,
        ssr: options.ssr
      },
      status,
      error: error2,
      branch,
      page: page2
    });
  } catch (error3) {
    return {
      status: 500,
      headers: {},
      body: options.dev ? error3.stack : error3.message
    };
  }
}
async function respond({request, options, $session, route}) {
  const match = route.pattern.exec(request.path);
  const params = route.params(match);
  const page2 = {
    host: request.host,
    path: request.path,
    query: request.query,
    params
  };
  let nodes;
  try {
    nodes = await Promise.all(route.a.map((id) => id && options.load_component(id)));
  } catch (error3) {
    return await respond_with_error({
      request,
      options,
      $session,
      status: 500,
      error: error3
    });
  }
  const leaf = nodes[nodes.length - 1].module;
  const page_config = {
    ssr: "ssr" in leaf ? leaf.ssr : options.ssr,
    router: "router" in leaf ? leaf.router : options.router,
    hydrate: "hydrate" in leaf ? leaf.hydrate : options.hydrate
  };
  if (options.only_render_prerenderable_pages && !leaf.prerender) {
    return {
      status: 204,
      headers: {},
      body: null
    };
  }
  let branch;
  let status = 200;
  let error2;
  ssr:
    if (page_config.ssr) {
      let context = {};
      branch = [];
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        let loaded;
        if (node) {
          try {
            loaded = await load_node({
              request,
              options,
              route,
              page: page2,
              node,
              $session,
              context,
              is_leaf: i === nodes.length - 1,
              is_error: false
            });
            if (!loaded)
              return;
            if (loaded.loaded.redirect) {
              return {
                status: loaded.loaded.status,
                headers: {
                  location: loaded.loaded.redirect
                }
              };
            }
            if (loaded.loaded.error) {
              ({status, error: error2} = loaded.loaded);
            }
          } catch (e) {
            status = 500;
            error2 = e;
          }
          if (error2) {
            while (i--) {
              if (route.b[i]) {
                const error_node = await options.load_component(route.b[i]);
                let error_loaded;
                let node_loaded;
                let j = i;
                while (!(node_loaded = branch[j])) {
                  j -= 1;
                }
                try {
                  error_loaded = await load_node({
                    request,
                    options,
                    route,
                    page: page2,
                    node: error_node,
                    $session,
                    context: node_loaded.context,
                    is_leaf: false,
                    is_error: true,
                    status,
                    error: error2
                  });
                  if (error_loaded.loaded.error) {
                    continue;
                  }
                  branch = branch.slice(0, j + 1).concat(error_loaded);
                  break ssr;
                } catch (e) {
                  continue;
                }
              }
            }
            return await respond_with_error({
              request,
              options,
              $session,
              status,
              error: error2
            });
          }
        }
        branch.push(loaded);
        if (loaded && loaded.loaded.context) {
          context = {
            ...context,
            ...loaded.loaded.context
          };
        }
      }
    }
  try {
    return await render_response({
      request,
      options,
      $session,
      page_config,
      status,
      error: error2,
      branch: branch && branch.filter(Boolean),
      page: page2
    });
  } catch (error3) {
    return await respond_with_error({
      request,
      options,
      $session,
      status: 500,
      error: error3
    });
  }
}
async function render_page(request, route, options) {
  if (options.initiator === route) {
    return {
      status: 404,
      headers: {},
      body: `Not found: ${request.path}`
    };
  }
  const $session = await options.hooks.getSession({context: request.context});
  if (route) {
    const response = await respond({
      request,
      options,
      $session,
      route
    });
    if (response) {
      return response;
    }
    if (options.fetched) {
      return {
        status: 500,
        headers: {},
        body: `Bad request in load function: failed to fetch ${options.fetched}`
      };
    }
  } else {
    return await respond_with_error({
      request,
      options,
      $session,
      status: 404,
      error: new Error(`Not found: ${request.path}`)
    });
  }
}
async function render_route(request, route) {
  const mod = await route.load();
  const handler = mod[request.method.toLowerCase().replace("delete", "del")];
  if (handler) {
    const match = route.pattern.exec(request.path);
    const params = route.params(match);
    const response = await handler({...request, params});
    if (response) {
      if (typeof response !== "object" || response.body == null) {
        return {
          status: 500,
          body: `Invalid response from route ${request.path}; ${response.body == null ? "body is missing" : `expected an object, got ${typeof response}`}`,
          headers: {}
        };
      }
      let {status = 200, body, headers = {}} = response;
      headers = lowercase_keys(headers);
      if (typeof body === "object" && !("content-type" in headers) || headers["content-type"] === "application/json") {
        headers = {...headers, "content-type": "application/json"};
        body = JSON.stringify(body);
      }
      return {status, body, headers};
    }
  }
}
function lowercase_keys(obj) {
  const clone2 = {};
  for (const key in obj) {
    clone2[key.toLowerCase()] = obj[key];
  }
  return clone2;
}
function md5(body) {
  return createHash("md5").update(body).digest("hex");
}
async function ssr$1(incoming, options) {
  if (incoming.path.endsWith("/") && incoming.path !== "/") {
    const q = incoming.query.toString();
    return {
      status: 301,
      headers: {
        location: incoming.path.slice(0, -1) + (q ? `?${q}` : "")
      }
    };
  }
  const context = await options.hooks.getContext(incoming) || {};
  try {
    return await options.hooks.handle({
      request: {
        ...incoming,
        params: null,
        context
      },
      render: async (request) => {
        for (const route of options.manifest.routes) {
          if (!route.pattern.test(request.path))
            continue;
          const response = route.type === "endpoint" ? await render_route(request, route) : await render_page(request, route, options);
          if (response) {
            if (response.status === 200) {
              if (!/(no-store|immutable)/.test(response.headers["cache-control"])) {
                const etag = `"${md5(response.body)}"`;
                if (request.headers["if-none-match"] === etag) {
                  return {
                    status: 304,
                    headers: {},
                    body: null
                  };
                }
                response.headers["etag"] = etag;
              }
            }
            return response;
          }
        }
        return await render_page(request, null, options);
      }
    });
  } catch (e) {
    if (e && e.stack) {
      e.stack = await options.get_stack(e);
    }
    console.error(e && e.stack || e);
    return {
      status: 500,
      headers: {},
      body: options.dev ? e.stack : e.message
    };
  }
}
function noop() {
}
function run(fn) {
  return fn();
}
function blank_object() {
  return Object.create(null);
}
function run_all(fns) {
  fns.forEach(run);
}
function is_function(thing) {
  return typeof thing === "function";
}
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || (a && typeof a === "object" || typeof a === "function");
}
function subscribe(store, ...callbacks) {
  if (store == null) {
    return noop;
  }
  const unsub = store.subscribe(...callbacks);
  return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
let current_component;
function set_current_component(component) {
  current_component = component;
}
function get_current_component() {
  if (!current_component)
    throw new Error("Function called outside component initialization");
  return current_component;
}
function onMount(fn) {
  get_current_component().$$.on_mount.push(fn);
}
function afterUpdate(fn) {
  get_current_component().$$.after_update.push(fn);
}
function onDestroy(fn) {
  get_current_component().$$.on_destroy.push(fn);
}
function setContext(key, context) {
  get_current_component().$$.context.set(key, context);
}
function getContext(key) {
  return get_current_component().$$.context.get(key);
}
const escaped = {
  '"': "&quot;",
  "'": "&#39;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;"
};
function escape(html) {
  return String(html).replace(/["'&<>]/g, (match) => escaped[match]);
}
function each(items, fn) {
  let str = "";
  for (let i = 0; i < items.length; i += 1) {
    str += fn(items[i], i);
  }
  return str;
}
const missing_component = {
  $$render: () => ""
};
function validate_component(component, name2) {
  if (!component || !component.$$render) {
    if (name2 === "svelte:component")
      name2 += " this={...}";
    throw new Error(`<${name2}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
  }
  return component;
}
let on_destroy;
function create_ssr_component(fn) {
  function $$render(result, props, bindings, slots, context) {
    const parent_component = current_component;
    const $$ = {
      on_destroy,
      context: new Map(parent_component ? parent_component.$$.context : context || []),
      on_mount: [],
      before_update: [],
      after_update: [],
      callbacks: blank_object()
    };
    set_current_component({$$});
    const html = fn(result, props, bindings, slots);
    set_current_component(parent_component);
    return html;
  }
  return {
    render: (props = {}, {$$slots = {}, context = new Map()} = {}) => {
      on_destroy = [];
      const result = {title: "", head: "", css: new Set()};
      const html = $$render(result, props, {}, $$slots, context);
      run_all(on_destroy);
      return {
        html,
        css: {
          code: Array.from(result.css).map((css2) => css2.code).join("\n"),
          map: null
        },
        head: result.title + result.head
      };
    },
    $$render
  };
}
function add_attribute(name2, value, boolean) {
  if (value == null || boolean && !value)
    return "";
  return ` ${name2}${value === true ? "" : `=${typeof value === "string" ? JSON.stringify(escape(value)) : `"${value}"`}`}`;
}
function add_classes(classes) {
  return classes ? ` class="${classes}"` : "";
}
var root_svelte_svelte_type_style_lang = "#svelte-announcer.svelte-1j55zn5{position:absolute;left:0;top:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;width:1px;height:1px}";
const css = {
  code: "#svelte-announcer.svelte-1j55zn5{position:absolute;left:0;top:0;clip:rect(0 0 0 0);clip-path:inset(50%);overflow:hidden;white-space:nowrap;width:1px;height:1px}",
  map: '{"version":3,"file":"root.svelte","sources":["root.svelte"],"sourcesContent":["<!-- This file is generated by @sveltejs/kit \u2014 do not edit it! -->\\n<script>import { setContext, afterUpdate, onMount } from \\"svelte\\";\\nexport let stores;\\nexport let page;\\nexport let components;\\nexport let props_0 = null;\\nexport let props_1 = null;\\nexport let props_2 = null;\\nsetContext(\\"__svelte__\\", stores);\\n\\n$:\\nstores.page.set(page);\\n\\nafterUpdate(stores.page.notify);\\nlet mounted = false;\\nlet navigated = false;\\nlet title = null;\\n\\nonMount(() => {\\n    const unsubscribe = stores.page.subscribe(() => {\\n        if (mounted) {\\n            navigated = true;\\n            title = document.title;\\n        }\\n    });\\n\\n    mounted = true;\\n    return unsubscribe;\\n});</script>\\n\\n<svelte:component this={components[0]} {...(props_0 || {})}>\\n\\t{#if components[1]}\\n\\t\\t<svelte:component this={components[1]} {...(props_1 || {})}>\\n\\t\\t\\t{#if components[2]}\\n\\t\\t\\t\\t<svelte:component this={components[2]} {...(props_2 || {})}/>\\n\\t\\t\\t{/if}\\n\\t\\t</svelte:component>\\n\\t{/if}\\n</svelte:component>\\n\\n{#if mounted}\\n\\t<div id=\\"svelte-announcer\\" aria-live=\\"assertive\\" aria-atomic=\\"true\\">\\n\\t\\t{#if navigated}\\n\\t\\t\\tNavigated to {title}\\n\\t\\t{/if}\\n\\t</div>\\n{/if}\\n\\n<style>\\n\\t#svelte-announcer {\\n\\t\\tposition: absolute;\\n\\t\\tleft: 0;\\n\\t\\ttop: 0;\\n\\t\\tclip: rect(0 0 0 0);\\n\\t\\tclip-path: inset(50%);\\n\\t\\toverflow: hidden;\\n\\t\\twhite-space: nowrap;\\n\\t\\twidth: 1px;\\n\\t\\theight: 1px;\\n\\t}\\n</style>"],"names":[],"mappings":"AAiDC,iBAAiB,eAAC,CAAC,AAClB,QAAQ,CAAE,QAAQ,CAClB,IAAI,CAAE,CAAC,CACP,GAAG,CAAE,CAAC,CACN,IAAI,CAAE,KAAK,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CAAC,CACnB,SAAS,CAAE,MAAM,GAAG,CAAC,CACrB,QAAQ,CAAE,MAAM,CAChB,WAAW,CAAE,MAAM,CACnB,KAAK,CAAE,GAAG,CACV,MAAM,CAAE,GAAG,AACZ,CAAC"}'
};
const Root = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let {stores} = $$props;
  let {page: page2} = $$props;
  let {components} = $$props;
  let {props_0 = null} = $$props;
  let {props_1 = null} = $$props;
  let {props_2 = null} = $$props;
  setContext("__svelte__", stores);
  afterUpdate(stores.page.notify);
  let mounted = false;
  let navigated = false;
  let title = null;
  onMount(() => {
    const unsubscribe = stores.page.subscribe(() => {
      if (mounted) {
        navigated = true;
        title = document.title;
      }
    });
    mounted = true;
    return unsubscribe;
  });
  if ($$props.stores === void 0 && $$bindings.stores && stores !== void 0)
    $$bindings.stores(stores);
  if ($$props.page === void 0 && $$bindings.page && page2 !== void 0)
    $$bindings.page(page2);
  if ($$props.components === void 0 && $$bindings.components && components !== void 0)
    $$bindings.components(components);
  if ($$props.props_0 === void 0 && $$bindings.props_0 && props_0 !== void 0)
    $$bindings.props_0(props_0);
  if ($$props.props_1 === void 0 && $$bindings.props_1 && props_1 !== void 0)
    $$bindings.props_1(props_1);
  if ($$props.props_2 === void 0 && $$bindings.props_2 && props_2 !== void 0)
    $$bindings.props_2(props_2);
  $$result.css.add(css);
  {
    stores.page.set(page2);
  }
  return `


${validate_component(components[0] || missing_component, "svelte:component").$$render($$result, Object.assign(props_0 || {}), {}, {
    default: () => `${components[1] ? `${validate_component(components[1] || missing_component, "svelte:component").$$render($$result, Object.assign(props_1 || {}), {}, {
      default: () => `${components[2] ? `${validate_component(components[2] || missing_component, "svelte:component").$$render($$result, Object.assign(props_2 || {}), {}, {})}` : ``}`
    })}` : ``}`
  })}

${mounted ? `<div id="${"svelte-announcer"}" aria-live="${"assertive"}" aria-atomic="${"true"}" class="${"svelte-1j55zn5"}">${navigated ? `Navigated to ${escape(title)}` : ``}</div>` : ``}`;
});
var user_hooks = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module"
});
const template = ({head, body}) => '<!DOCTYPE html>\n<html lang="en">\n	<head>\n		<meta charset="utf-8" />\n		<link rel="icon" href="/favicon.ico" />\n		<meta name="viewport" content="width=device-width, initial-scale=1" />\n		' + head + '\n	</head>\n	<body>\n		<div id="svelte">' + body + "</div>\n	</body>\n</html>\n";
function init({paths, prerendering}) {
}
const d = decodeURIComponent;
const empty = () => ({});
const manifest = {
  assets: [{file: "favicon.ico", size: 1150, type: "image/vnd.microsoft.icon"}, {file: "robots.txt", size: 67, type: "text/plain"}],
  layout: "src/routes/$layout.svelte",
  error: ".svelte/build/components/error.svelte",
  routes: [
    {
      type: "page",
      pattern: /^\/$/,
      params: empty,
      a: ["src/routes/$layout.svelte", "src/routes/index.svelte"],
      b: [".svelte/build/components/error.svelte"]
    },
    {
      type: "page",
      pattern: /^\/([^/]+?)\/?$/,
      params: (m) => ({filter: d(m[1])}),
      a: ["src/routes/$layout.svelte", "src/routes/[filter].svelte"],
      b: [".svelte/build/components/error.svelte"]
    }
  ]
};
const get_hooks = (hooks2) => ({
  getContext: hooks2.getContext || (() => ({})),
  getSession: hooks2.getSession || (() => ({})),
  handle: hooks2.handle || (({request, render: render2}) => render2(request))
});
const hooks = get_hooks(user_hooks);
const module_lookup = {
  "src/routes/$layout.svelte": () => Promise.resolve().then(function() {
    return $layout$1;
  }),
  ".svelte/build/components/error.svelte": () => Promise.resolve().then(function() {
    return error;
  }),
  "src/routes/index.svelte": () => Promise.resolve().then(function() {
    return index;
  }),
  "src/routes/[filter].svelte": () => Promise.resolve().then(function() {
    return _filter_;
  })
};
const metadata_lookup = {"src/routes/$layout.svelte": {entry: "/./_app/pages/$layout.svelte-7ab6c2b7.js", css: [], js: ["/./_app/pages/$layout.svelte-7ab6c2b7.js", "/./_app/chunks/index-d2ff60c6.js", "/./_app/chunks/network-de0a377e.js"], styles: null}, ".svelte/build/components/error.svelte": {entry: "/./_app/error.svelte-8662bf8f.js", css: [], js: ["/./_app/error.svelte-8662bf8f.js", "/./_app/chunks/index-d2ff60c6.js"], styles: null}, "src/routes/index.svelte": {entry: "/./_app/pages/index.svelte-8c0bd30e.js", css: [], js: ["/./_app/pages/index.svelte-8c0bd30e.js", "/./_app/chunks/index-d2ff60c6.js"], styles: null}, "src/routes/[filter].svelte": {entry: "/./_app/pages/[filter].svelte-c42c79de.js", css: [], js: ["/./_app/pages/[filter].svelte-c42c79de.js", "/./_app/chunks/index-d2ff60c6.js", "/./_app/chunks/network-de0a377e.js", "/./_app/chunks/index-ee7cf8b5.js"], styles: null}};
async function load_component(file) {
  if (!module_lookup[file]) {
    console.log({file});
  }
  return {
    module: await module_lookup[file](),
    ...metadata_lookup[file]
  };
}
function render(request, {
  paths = {base: "", assets: "/."},
  local = false,
  dependencies,
  only_render_prerenderable_pages = false,
  get_static_file
} = {}) {
  return ssr$1({
    ...request,
    host: request.headers["host"]
  }, {
    paths,
    local,
    template,
    manifest,
    load_component,
    target: "#svelte",
    entry: "/./_app/start-402f27a0.js",
    root: Root,
    hooks,
    dev: false,
    amp: false,
    dependencies,
    only_render_prerenderable_pages,
    get_component_path: (id) => "/./_app/" + entry_lookup[id],
    get_stack: (error2) => error2.stack,
    get_static_file,
    ssr: true,
    router: true,
    hydrate: true
  });
}
class Environment {
  constructor(networkFn, subscriptionHandler) {
    this.fetch = networkFn;
    this.socket = subscriptionHandler;
  }
  sendRequest(ctx, params, session2) {
    return this.fetch.call(ctx, params, session2);
  }
}
let currentEnv = null;
function setEnvironment(env2) {
  currentEnv = env2;
}
function getEnvironment() {
  return currentEnv;
}
async function fetchQuery$1(ctx, {text, variables}, session2) {
  const environment = getEnvironment();
  if (!environment) {
    return {data: {}, errors: [{message: "could not find houdini environment"}]};
  }
  return await environment.sendRequest(ctx, {text, variables}, session2);
}
class RequestContext {
  constructor(ctx) {
    this.continue = true;
    this.returnValue = {};
    this.context = ctx;
  }
  error(status, message) {
    this.continue = false;
    this.returnValue = {
      error: message,
      status
    };
  }
  redirect(status, location) {
    this.continue = false;
    this.returnValue = {
      redirect: location,
      status
    };
  }
  fetch(input, init2) {
    return this.context.fetch(input, init2);
  }
  graphqlErrors(errors) {
    console.log("registering graphql errors", errors);
    return this.error(500, errors.map(({message}) => message).join("\n"));
  }
  computeInput(mode, func) {
    if (mode === "kit") {
      return func(this.context);
    }
    return func.call(this, this.context.page, this.context.session);
  }
}
const subscriber_queue = [];
function readable(value, start) {
  return {
    subscribe: writable(value, start).subscribe
  };
}
function writable(value, start = noop) {
  let stop;
  const subscribers = [];
  function set(new_value) {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        const run_queue = !subscriber_queue.length;
        for (let i = 0; i < subscribers.length; i += 1) {
          const s2 = subscribers[i];
          s2[1]();
          subscriber_queue.push(s2, value);
        }
        if (run_queue) {
          for (let i = 0; i < subscriber_queue.length; i += 2) {
            subscriber_queue[i][0](subscriber_queue[i + 1]);
          }
          subscriber_queue.length = 0;
        }
      }
    }
  }
  function update(fn) {
    set(fn(value));
  }
  function subscribe2(run2, invalidate = noop) {
    const subscriber = [run2, invalidate];
    subscribers.push(subscriber);
    if (subscribers.length === 1) {
      stop = start(set) || noop;
    }
    run2(value);
    return () => {
      const index2 = subscribers.indexOf(subscriber);
      if (index2 !== -1) {
        subscribers.splice(index2, 1);
      }
      if (subscribers.length === 0) {
        stop();
        stop = null;
      }
    };
  }
  return {set, update, subscribe: subscribe2};
}
function derived(stores, fn, initial_value) {
  const single = !Array.isArray(stores);
  const stores_array = single ? [stores] : stores;
  const auto = fn.length < 2;
  return readable(initial_value, (set) => {
    let inited = false;
    const values = [];
    let pending = 0;
    let cleanup = noop;
    const sync = () => {
      if (pending) {
        return;
      }
      cleanup();
      const result = fn(single ? values[0] : values, set);
      if (auto) {
        set(result);
      } else {
        cleanup = is_function(result) ? result : noop;
      }
    };
    const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
      values[i] = value;
      pending &= ~(1 << i);
      if (inited) {
        sync();
      }
    }, () => {
      pending |= 1 << i;
    }));
    inited = true;
    sync();
    return function stop() {
      run_all(unsubscribers);
      cleanup();
    };
  });
}
class Record {
  constructor(cache2) {
    this.fields = {};
    this.keyVersions = {};
    this.subscribers = {};
    this.recordLinks = {};
    this.listLinks = {};
    this.referenceCounts = {};
    this.connections = [];
    this.cache = cache2;
  }
  allSubscribers() {
    return Object.values(this.subscribers).flatMap((subscribers) => subscribers);
  }
  getField(fieldName) {
    return this.fields[fieldName];
  }
  writeField(fieldName, value) {
    this.fields[fieldName] = value;
  }
  writeRecordLink(fieldName, value) {
    this.recordLinks[fieldName] = value;
  }
  writeListLink(fieldName, value) {
    this.listLinks[fieldName] = value;
  }
  linkedRecord(fieldName) {
    return this.cache.internal.getRecord(this.recordLinks[fieldName]);
  }
  linkedRecordID(fieldName) {
    return this.recordLinks[fieldName];
  }
  linkedListIDs(fieldName) {
    return this.listLinks[fieldName] || [];
  }
  linkedList(fieldName) {
    return (this.listLinks[fieldName] || []).map((link) => this.cache.internal.getRecord(link)).filter((record) => record !== null);
  }
  appendLinkedList(fieldName, id) {
    if (!this.listLinks[fieldName]) {
      this.listLinks[fieldName] = [];
    }
    this.listLinks[fieldName].push(id);
  }
  prependLinkedList(fieldName, id) {
    if (!this.listLinks[fieldName]) {
      this.listLinks[fieldName] = [];
    }
    this.listLinks[fieldName].unshift(id);
  }
  removeFromLinkedList(fieldName, id) {
    this.listLinks[fieldName] = (this.listLinks[fieldName] || []).filter((link) => link !== id);
  }
  addSubscriber(rawKey, key, ...specs) {
    if (!this.keyVersions[rawKey]) {
      this.keyVersions[rawKey] = new Set();
    }
    this.keyVersions[rawKey].add(key);
    const existingSubscribers = (this.subscribers[key] || []).map(({set}) => set);
    const newSubscribers = specs.filter(({set}) => !existingSubscribers.includes(set));
    this.subscribers[key] = this.getSubscribers(key).concat(...newSubscribers);
    if (!this.referenceCounts[key]) {
      this.referenceCounts[key] = new Map();
    }
    const counts = this.referenceCounts[key];
    for (const spec of specs) {
      counts.set(spec.set, (counts.get(spec.set) || 0) + 1);
    }
  }
  getSubscribers(fieldName) {
    return this.subscribers[fieldName] || [];
  }
  forgetSubscribers(...targets) {
    this.forgetSubscribers_walk(targets.map(({set}) => set));
  }
  removeAllSubscribers() {
    this.forgetSubscribers(...this.allSubscribers());
  }
  addConnectionReference(ref) {
    this.connections.push(ref);
  }
  removeConnectionReference(ref) {
    this.connections = this.connections.filter((conn) => !(conn.name === ref.name && conn.parentID === ref.parentID));
  }
  removeAllSubscriptionVerions(keyRaw, spec) {
    const versions = this.keyVersions[keyRaw];
    if (!versions) {
      return;
    }
    this.removeSubscribers([...this.keyVersions[keyRaw]], [spec.set]);
  }
  forgetSubscribers_walk(targets) {
    var _a;
    this.removeSubscribers(Object.keys(this.subscribers), targets);
    const linkedIDs = Object.keys(this.recordLinks).concat(Object.keys(this.listLinks).flatMap((key) => this.listLinks[key]));
    for (const linkedRecordID of linkedIDs) {
      (_a = this.cache.internal.getRecord(linkedRecordID)) === null || _a === void 0 ? void 0 : _a.forgetSubscribers_walk(targets);
    }
  }
  removeSubscribers(fields, sets) {
    var _a;
    for (const fieldName of fields) {
      let targets = [];
      for (const set of sets) {
        if (!((_a = this.referenceCounts[fieldName]) === null || _a === void 0 ? void 0 : _a.has(set))) {
          continue;
        }
        const counts = this.referenceCounts[fieldName];
        const newVal = (counts.get(set) || 0) - 1;
        counts.set(set, newVal);
        if (newVal <= 0) {
          targets.push(set);
          counts.delete(set);
        }
      }
      this.subscribers[fieldName] = this.getSubscribers(fieldName).filter(({set}) => !targets.includes(set));
    }
  }
}
class ConnectionHandler {
  constructor({name: name2, cache: cache2, record, key, connectionType, selection: selection2, when, filters, parentID}) {
    this.record = record;
    this.key = key;
    this.connectionType = connectionType;
    this.cache = cache2;
    this.selection = selection2;
    this._when = when;
    this.filters = filters;
    this.name = name2;
    this.parentID = parentID;
  }
  when(when) {
    return new ConnectionHandler({
      cache: this.cache,
      record: this.record,
      key: this.key,
      connectionType: this.connectionType,
      selection: this.selection,
      when,
      filters: this.filters,
      parentID: this.parentID,
      name: this.name
    });
  }
  append(selection2, data, variables = {}) {
    return this.addToConnection(selection2, data, variables, "last");
  }
  prepend(selection2, data, variables = {}) {
    return this.addToConnection(selection2, data, variables, "first");
  }
  addToConnection(selection2, data, variables = {}, where) {
    if (!this.validateWhen()) {
      return;
    }
    const dataID = this.cache.id(this.connectionType, data);
    this.cache.write(selection2, data, variables, dataID);
    if (where === "first") {
      this.record.prependLinkedList(this.key, dataID);
    } else {
      this.record.appendLinkedList(this.key, dataID);
    }
    const subscribers = this.record.getSubscribers(this.key);
    this.cache.internal.notifySubscribers(subscribers, variables);
    const newRecord = this.cache.internal.record(dataID);
    newRecord.addConnectionReference({
      parentID: this.parentID,
      name: this.name
    });
    this.cache.internal.insertSubscribers(newRecord, this.selection, variables, ...subscribers);
  }
  removeID(id, variables = {}) {
    if (!this.validateWhen()) {
      return;
    }
    this.record.removeFromLinkedList(this.key, id);
    const subscribers = this.record.getSubscribers(this.key);
    this.cache.internal.notifySubscribers(subscribers, variables);
    this.cache.internal.unsubscribeSelection(this.cache.internal.record(id), this.selection, variables, ...subscribers.map(({set}) => set));
  }
  remove(data, variables = {}) {
    this.removeID(this.cache.id(this.connectionType, data), variables);
  }
  validateWhen() {
    let ok = true;
    if (this._when) {
      const targets = this.filters;
      if (this._when.must && targets) {
        ok = Object.entries(this._when.must).reduce((prev, [key, value]) => Boolean(prev && targets[key] == value), ok);
      }
      if (this._when.must_not) {
        ok = !targets || Object.entries(this._when.must_not).reduce((prev, [key, value]) => Boolean(prev && targets[key] != value), ok);
      }
    }
    return ok;
  }
  *[Symbol.iterator]() {
    for (let record of this.record.linkedList(this.key)) {
      yield record;
    }
  }
}
class Cache {
  constructor() {
    this._data = new Map();
    this._connections = new Map();
    this.lastKnownVariables = new Map();
  }
  write(selection2, data, variables = {}, id) {
    const specs = [];
    const parentID = id || rootID;
    this._write(parentID, parentID, selection2, parentID, data, variables, specs);
    this.notifySubscribers(specs, variables);
  }
  id(type, data) {
    return type + ":" + (typeof data === "string" ? data : this.computeID(data));
  }
  idFields(type) {
    return ["id"];
  }
  subscribe(spec, variables = {}) {
    let rootRecord = spec.parentID ? this.record(spec.parentID) : this.root();
    if (!rootRecord) {
      throw new Error("Could not find root of subscription");
    }
    this.addSubscribers(rootRecord, spec, spec.selection, variables);
  }
  unsubscribe(spec, variables = {}) {
    let rootRecord = spec.parentID ? this.getRecord(spec.parentID) : this.root();
    if (!rootRecord) {
      return;
    }
    if (this.lastKnownVariables.has(spec.set)) {
      this.lastKnownVariables.delete(spec.set);
    }
    this.removeSubscribers(rootRecord, spec, spec.selection, variables);
  }
  connection(name2, id) {
    var _a;
    const handler = (_a = this._connections.get(name2)) === null || _a === void 0 ? void 0 : _a.get(id || rootID);
    if (!handler) {
      throw new Error(`Cannot find connection with name: ${name2} under parent: ${id}. Is it possible that the query is not mounted?`);
    }
    return handler;
  }
  delete(id, variables = {}) {
    const record = this.record(id);
    record.removeAllSubscribers();
    for (const {name: name2, parentID} of record.connections) {
      const connection = this.connection(name2, parentID);
      connection.removeID(id, variables);
    }
    return this._data.delete(id);
  }
  record(id) {
    if (!this._data.has(id)) {
      this._data.set(id, new Record(this));
    }
    return this._data.get(id);
  }
  get internal() {
    return {
      notifySubscribers: this.notifySubscribers.bind(this),
      insertSubscribers: this.insertSubscribers.bind(this),
      unsubscribeSelection: this.unsubscribeSelection.bind(this),
      evaluateKey: this.evaluateKey.bind(this),
      record: this.record.bind(this),
      getRecord: this.getRecord.bind(this)
    };
  }
  computeID(data) {
    return data.id;
  }
  root() {
    return this.record(rootID);
  }
  getData(spec, parent, selection2, variables) {
    const target = {};
    for (const [attributeName, {type, keyRaw, fields}] of Object.entries(selection2)) {
      const key = this.evaluateKey(keyRaw, variables);
      if (this.isScalarLink(type)) {
        target[attributeName] = parent.getField(key);
        continue;
      }
      const linkedRecord = parent.linkedRecord(key);
      if (linkedRecord && fields) {
        target[attributeName] = this.getData(spec, linkedRecord, fields, variables);
        continue;
      }
      const linkedList = parent.linkedList(key);
      if (linkedList && fields) {
        target[attributeName] = linkedList.map((linkedRecord2) => this.getData(spec, linkedRecord2, fields, variables));
      }
    }
    return target;
  }
  addSubscribers(rootRecord, spec, selection2, variables) {
    var _a;
    for (const {type, keyRaw, fields, connection, filters} of Object.values(selection2)) {
      const key = this.evaluateKey(keyRaw, variables);
      const oldVariables = this.lastKnownVariables.get(spec.set);
      if (keyRaw.includes("$") && JSON.stringify(variables) !== JSON.stringify(oldVariables)) {
        rootRecord.removeAllSubscriptionVerions(keyRaw, spec);
      }
      rootRecord.addSubscriber(keyRaw, key, spec);
      if (!this.isScalarLink(type)) {
        const linkedRecord = rootRecord.linkedRecord(key);
        let children = linkedRecord ? [linkedRecord] : rootRecord.linkedList(key);
        if (connection && fields) {
          if (!this._connections.has(connection)) {
            this._connections.set(connection, new Map());
          }
          (_a = this._connections.get(connection)) === null || _a === void 0 ? void 0 : _a.set(spec.parentID || rootID, new ConnectionHandler({
            name: connection,
            parentID: spec.parentID,
            cache: this,
            record: rootRecord,
            connectionType: type,
            key,
            selection: fields,
            filters: Object.entries(filters || {}).reduce((acc, [key2, {kind: kind2, value}]) => {
              return {
                ...acc,
                [key2]: kind2 !== "Variable" ? value : variables[value]
              };
            }, {})
          }));
        }
        if (!children || !fields) {
          continue;
        }
        for (const child of children) {
          if (connection) {
            child.addConnectionReference({
              name: connection,
              parentID: spec.parentID
            });
          }
          this.addSubscribers(child, spec, fields, variables);
        }
      }
    }
  }
  removeSubscribers(rootRecord, spec, selection2, variables) {
    for (const {type, keyRaw, fields, connection} of Object.values(selection2)) {
      const key = this.evaluateKey(keyRaw, variables);
      rootRecord.forgetSubscribers(spec);
      if (connection) {
        this._connections.delete(connection);
        rootRecord.removeConnectionReference({
          name: connection,
          parentID: spec.parentID
        });
      }
      if (!this.isScalarLink(type)) {
        const linkedRecord = rootRecord.linkedRecord(key);
        let children = linkedRecord ? [linkedRecord] : rootRecord.linkedList(key);
        if (!children || !fields) {
          continue;
        }
        for (const child of children) {
          this.removeSubscribers(child, spec, fields, variables);
        }
      }
    }
  }
  _write(rootID2, parentID, selection2, recordID, data, variables, specs) {
    var _a, _b;
    const record = this.record(recordID);
    for (const [field, value] of Object.entries(data)) {
      if (!selection2 || !selection2[field]) {
        throw new Error("Could not find field listing in selection for " + field + " @ " + JSON.stringify(selection2) + "");
      }
      const {type: linkedType, keyRaw, fields, operations, connection} = selection2[field];
      const key = this.evaluateKey(keyRaw, variables);
      if (!linkedType) {
        throw new Error("could not find the field information for " + field);
      }
      const subscribers = record.getSubscribers(key);
      if (value instanceof Object && !Array.isArray(value) && fields) {
        const oldID = record.linkedRecordID(key);
        const embedded = ((_a = this.idFields(linkedType)) === null || _a === void 0 ? void 0 : _a.filter((field2) => typeof value[field2] === "undefined").length) > 0;
        const linkedID = !embedded ? this.id(linkedType, value) : `${parentID}.${key}`;
        if (oldID !== linkedID) {
          record.writeRecordLink(key, linkedID);
          if (oldID) {
            this.record(oldID).forgetSubscribers(...subscribers);
          }
          specs.push(...subscribers);
        }
        this._write(rootID2, recordID, fields, linkedID, value, variables, specs);
      } else if (!this.isScalarLink(linkedType) && Array.isArray(value) && fields) {
        const linkedIDs = [];
        const oldIDs = record.linkedListIDs(this.evaluateKey(key, variables));
        const embedded = value.length > 0 && ((_b = this.idFields(linkedType)) === null || _b === void 0 ? void 0 : _b.filter((field2) => typeof value.find((val) => val)[field2] === "undefined").length) > 0;
        for (const [i, entry] of value.entries()) {
          if (!(entry instanceof Object) || Array.isArray(entry)) {
            throw new Error("Encountered link to non objects");
          }
          const linkedID = !embedded ? this.id(linkedType, entry) : `${parentID}.${key}[${i}]`;
          this._write(rootID2, recordID, fields, linkedID, entry, variables, specs);
          linkedIDs.push(linkedID);
          if (!oldIDs.includes(linkedID)) {
            if (connection) {
              this.record(linkedID).addConnectionReference({
                parentID: rootID2,
                name: connection
              });
            }
          }
        }
        const contentChanged = JSON.stringify(linkedIDs) !== JSON.stringify(oldIDs);
        let oldSubscribers = {};
        for (const subscriber of subscribers) {
          const variablesChanged = JSON.stringify(this.lastKnownVariables.get(subscriber.set) || {}) !== JSON.stringify(variables);
          if (contentChanged || variablesChanged) {
            specs.push(subscriber);
          }
          this.lastKnownVariables.set(subscriber.set, variables);
        }
        for (const lostID of oldIDs.filter((id) => !linkedIDs.includes(id))) {
          for (const sub of subscribers) {
            if (!oldSubscribers[lostID]) {
              oldSubscribers[lostID] = new Set();
            }
            oldSubscribers[lostID].add(sub);
          }
        }
        for (const [id, subscribers2] of Object.entries(oldSubscribers)) {
          this.record(id).forgetSubscribers(...subscribers2);
        }
        if (contentChanged) {
          record.writeListLink(key, linkedIDs);
        }
      } else {
        if (value !== record.getField(key)) {
          record.writeField(key, value);
          specs.push(...subscribers);
        }
      }
      for (const operation of operations || []) {
        let parentID2;
        if (operation.parentID) {
          if (operation.parentID.kind !== "Variable") {
            parentID2 = operation.parentID.value;
          } else {
            const value2 = variables[operation.parentID.value];
            if (typeof value2 !== "string") {
              throw new Error("parentID value must be a string");
            }
            parentID2 = value2;
          }
        }
        if (operation.action === "insert" && value instanceof Object && !Array.isArray(value) && fields && operation.connection) {
          this.connection(operation.connection, parentID2).when(operation.when).addToConnection(fields, value, variables, operation.position || "last");
        } else if (operation.action === "remove" && value instanceof Object && !Array.isArray(value) && fields && operation.connection) {
          this.connection(operation.connection, parentID2).when(operation.when).remove(value, variables);
        } else if (operation.action === "delete" && operation.type) {
          if (typeof value !== "string") {
            throw new Error("Cannot delete a record with a non-string ID");
          }
          this.delete(this.id(operation.type, value), variables);
        }
      }
    }
  }
  getRecord(id) {
    if (!id) {
      return null;
    }
    return this._data.get(id) || null;
  }
  isScalarLink(type) {
    return ["String", "Boolean", "Float", "ID", "Int"].includes(type);
  }
  notifySubscribers(specs, variables = {}) {
    for (const spec of specs) {
      let rootRecord = spec.parentID ? this.getRecord(spec.parentID) : this.root();
      if (!rootRecord) {
        throw new Error("Could not find root of subscription");
      }
      spec.set(this.getData(spec, rootRecord, spec.selection, variables));
    }
  }
  insertSubscribers(record, selection2, variables, ...subscribers) {
    for (const {keyRaw, fields} of Object.values(selection2)) {
      const key = this.evaluateKey(keyRaw, variables);
      record.addSubscriber(keyRaw, key, ...subscribers);
      if (fields) {
        const linkedRecord = record.linkedRecord(key);
        const children = linkedRecord ? [linkedRecord] : record.linkedList(key);
        for (const linkedRecord2 of children) {
          this.insertSubscribers(linkedRecord2, fields, variables, ...subscribers);
        }
      }
    }
  }
  unsubscribeSelection(record, selection2, variables, ...subscribers) {
    for (const {keyRaw, fields} of Object.values(selection2)) {
      const key = this.evaluateKey(keyRaw, variables);
      record.removeSubscribers([key], subscribers);
      if (fields) {
        const children = record.linkedList(key) || [record.linkedRecord(key)];
        for (const linkedRecord of children) {
          this.unsubscribeSelection(linkedRecord, fields, variables, ...subscribers);
        }
      }
    }
  }
  evaluateKey(key, variables = {}) {
    let evaluated = "";
    let varName = "";
    let inString = false;
    for (const char of key) {
      if (varName) {
        if (varChars.includes(char)) {
          varName += char;
          continue;
        }
        const value = variables[varName.slice(1)];
        evaluated += typeof value !== "undefined" ? JSON.stringify(value) : "undefined";
        varName = "";
      }
      if (char === "$" && !inString) {
        varName = "$";
        continue;
      }
      if (char === '"') {
        inString = !inString;
      }
      evaluated += char;
    }
    return evaluated;
  }
}
const varChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789";
const rootID = "_ROOT_";
var cache = new Cache();
const setVariables = (vars) => setContext("variables", vars);
const getVariables = () => getContext("variables") || (() => ({}));
function query(document2) {
  if (document2.kind !== "HoudiniQuery") {
    throw new Error("query() must be passed a query document");
  }
  let variables = document2.variables;
  setVariables(() => variables);
  const initialValue = document2.initialValue.data;
  const store = writable(initialValue);
  let subscriptionSpec = {
    rootType: document2.artifact.rootType,
    selection: document2.artifact.selection,
    set: store.set
  };
  onMount(() => {
    cache.write(document2.artifact.selection, initialValue, variables);
    if (subscriptionSpec) {
      cache.subscribe(subscriptionSpec, variables);
    }
  });
  onDestroy(() => {
    subscriptionSpec = null;
    cache.unsubscribe({
      rootType: document2.artifact.rootType,
      selection: document2.artifact.selection,
      set: store.set
    }, variables);
  });
  return {
    data: {subscribe: store.subscribe},
    writeData(newData, newVariables) {
      variables = newVariables || {};
      if (subscriptionSpec) {
        cache.subscribe(subscriptionSpec, variables);
      }
      cache.write(document2.artifact.selection, newData.data, variables);
    }
  };
}
const getQuery = (arg) => arg;
const ssr = typeof window === "undefined";
const getStores = () => {
  const stores = getContext("__svelte__");
  return {
    page: {
      subscribe: stores.page.subscribe
    },
    navigating: {
      subscribe: stores.navigating.subscribe
    },
    get preloading() {
      console.error("stores.preloading is deprecated; use stores.navigating instead");
      return {
        subscribe: stores.navigating.subscribe
      };
    },
    session: stores.session
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};
const error$1 = (verb) => {
  throw new Error(ssr ? `Can only ${verb} session store in browser` : `Cannot ${verb} session store before subscribing`);
};
const session = {
  subscribe(fn) {
    const store = getStores().session;
    if (!ssr) {
      session.set = store.set;
      session.update = store.update;
    }
    return store.subscribe(fn);
  },
  set: (value) => {
    error$1("set");
  },
  update: (updater) => {
    error$1("update");
  }
};
function getSession() {
  return session;
}
function mutation(document2) {
  if (document2.kind !== "HoudiniMutation") {
    throw new Error("mutation() must be passed a mutation document");
  }
  const {raw: text} = document2.artifact;
  const session2 = getSession();
  const queryVariables = getVariables();
  return (variables) => new Promise(async (resolve2, reject) => {
    let result;
    try {
      const mutationCtx = {
        fetch: window.fetch.bind(window),
        session: session2,
        context: {},
        page: {
          host: "",
          path: "",
          params: {},
          query: new URLSearchParams()
        }
      };
      const {data, errors} = await fetchQuery$1(mutationCtx, {text, variables}, session2);
      if (errors) {
        reject(errors);
        return;
      }
      if (!data) {
        reject([new Error("Encountered empty data response in mutation payload")]);
        return;
      }
      result = data;
    } catch (e) {
      reject(e);
      return;
    }
    cache.write(document2.artifact.selection, result, queryVariables());
    resolve2(result);
  });
}
function fragment(fragment2, initialValue) {
  if (fragment2.artifact.kind !== "HoudiniFragment") {
    throw new Error("getFragment can only take fragment documents");
  }
  let subscriptionSpec;
  const queryVariables = getVariables();
  const value = readable(initialValue, (set) => {
    const parentID = cache.id(fragment2.artifact.rootType, initialValue);
    subscriptionSpec = {
      rootType: fragment2.artifact.rootType,
      selection: fragment2.artifact.selection,
      set,
      parentID
    };
    onMount(() => {
      if (parentID && subscriptionSpec) {
        cache.subscribe(subscriptionSpec, queryVariables());
      }
    });
    return () => {
      if (parentID) {
        cache.unsubscribe({
          rootType: fragment2.artifact.rootType,
          parentID,
          selection: fragment2.artifact.selection,
          set
        }, queryVariables());
      }
    };
  });
  return value;
}
function subscription(document2, variables) {
  if (document2.kind !== "HoudiniSubscription") {
    throw new Error("subscription() must be passed a subscription document");
  }
  const env2 = getEnvironment();
  if (!env2) {
    throw new Error("Could not find network environment");
  }
  const {raw: text, selection: selection2} = document2.artifact;
  const store = writable(null);
  let unsubscribe;
  onMount(() => {
    if (!env2.socket) {
      throw new Error("The current environment is not configured to handle subscriptions. Make sure you passed a client to its constructor.");
    }
    unsubscribe = env2.socket.subscribe({query: text, variables}, {
      next({data, errors}) {
        if (errors) {
          throw errors;
        }
        if (data) {
          cache.write(selection2, data, variables);
          store.set(data);
        }
      },
      error(data) {
      },
      complete() {
      }
    });
  });
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
  return {data: {subscribe: store.subscribe}};
}
const API_URL = "localhost:4000/graphql";
async function fetchQuery({text, variables = {}}) {
  const result = await this.fetch("http://" + API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: text,
      variables
    })
  });
  return await result.json();
}
let socketClient = null;
if (process.browser) {
  const client = new SubscriptionClient("ws://" + API_URL, {
    reconnect: true
  });
  socketClient = {
    subscribe(payload, handlers) {
      const {unsubscribe} = client.request(payload).subscribe(handlers);
      return unsubscribe;
    }
  };
}
var env = new Environment(fetchQuery, socketClient);
const $layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  setEnvironment(env);
  return `${$$result.head += `${$$result.title = `<title>Houdini \u2022 TodoMVC</title>`, ""}<link rel="${"stylesheet"}" href="${"//unpkg.com/todomvc-common/base.css"}" data-svelte="svelte-10d177f"><link rel="${"stylesheet"}" href="${"//unpkg.com/todomvc-app-css/index.css"}" data-svelte="svelte-10d177f">`, ""}

<section class="${"todoapp"}">${slots.default ? slots.default({}) : ``}</section>

<footer class="${"info"}"><p>Double-click to edit a todo</p>
	<p>Created by <a href="${"http://todomvc.com"}">Alec Aivazis</a></p>
	<p>Part of <a href="${"http://todomvc.com"}">TodoMVC</a></p></footer>`;
});
var $layout$1 = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: $layout
});
function load$2({error: error2, status}) {
  return {props: {error: error2, status}};
}
const Error$1 = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let {status} = $$props;
  let {error: error2} = $$props;
  if ($$props.status === void 0 && $$bindings.status && status !== void 0)
    $$bindings.status(status);
  if ($$props.error === void 0 && $$bindings.error && error2 !== void 0)
    $$bindings.error(error2);
  return `<h1>${escape(status)}</h1>

<p>${escape(error2.message)}</p>


${error2.stack ? `<pre>${escape(error2.stack)}</pre>` : ``}`;
});
var error = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: Error$1,
  load: load$2
});
async function load$1() {
  return {redirect: "all", status: 302};
}
const Routes = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  return ``;
});
var index = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: Routes,
  load: load$1
});
const name$6 = "AllItems";
const kind$6 = "HoudiniQuery";
const hash$6 = "89d2e5393b2bb371f44b1110fc7c0c39";
const raw$6 = `query AllItems($completed: Boolean) {
  filteredItems: items(completed: $completed) {
    id
    completed
    ...ItemEntry_item
  }
  allItems: items {
    id
    completed
  }
}

fragment ItemEntry_item on TodoItem {
  id
  text
  completed
}
`;
const rootType$6 = "Query";
const selection$6 = {
  filteredItems: {
    type: "TodoItem",
    keyRaw: "filteredItems(completed: $completed)",
    fields: {
      id: {
        type: "ID",
        keyRaw: "id"
      },
      completed: {
        type: "Boolean",
        keyRaw: "completed"
      },
      text: {
        type: "String",
        keyRaw: "text"
      }
    },
    connection: "Filtered_Items",
    filters: {
      completed: {
        kind: "Variable",
        value: "completed"
      }
    }
  },
  allItems: {
    type: "TodoItem",
    keyRaw: "allItems",
    fields: {
      id: {
        type: "ID",
        keyRaw: "id"
      },
      completed: {
        type: "Boolean",
        keyRaw: "completed"
      }
    },
    connection: "All_Items"
  }
};
var _AllItemsArtifact = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  name: name$6,
  kind: kind$6,
  hash: hash$6,
  raw: raw$6,
  rootType: rootType$6,
  selection: selection$6
});
const name$5 = "AddItem";
const kind$5 = "HoudiniMutation";
const hash$5 = "02e47d392ba612a24af66597d1c019cf";
const raw$5 = `mutation AddItem($input: AddItemInput!) {
  addItem(input: $input) {
    item {
      ...Filtered_Items_insert
      ...All_Items_insert
    }
  }
}

fragment Filtered_Items_insert on TodoItem {
  id
  completed
  ...ItemEntry_item
}

fragment All_Items_insert on TodoItem {
  id
  completed
}

fragment ItemEntry_item on TodoItem {
  id
  text
  completed
}
`;
const rootType$5 = "Mutation";
const selection$5 = {
  addItem: {
    type: "AddItemOutput",
    keyRaw: "addItem(input: $input)",
    fields: {
      item: {
        type: "TodoItem",
        keyRaw: "item",
        fields: {
          id: {
            type: "ID",
            keyRaw: "id"
          },
          completed: {
            type: "Boolean",
            keyRaw: "completed"
          },
          text: {
            type: "String",
            keyRaw: "text"
          }
        },
        operations: [{
          action: "insert",
          connection: "Filtered_Items",
          position: "first",
          when: {
            must_not: {
              completed: true
            }
          }
        }, {
          action: "insert",
          connection: "All_Items",
          position: "last"
        }]
      }
    }
  }
};
var _AddItemArtifact = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  name: name$5,
  kind: kind$5,
  hash: hash$5,
  raw: raw$5,
  rootType: rootType$5,
  selection: selection$5
});
const name$4 = "ItemUpdate";
const kind$4 = "HoudiniSubscription";
const hash$4 = "81c95f0d292097fc59295113720a9272";
const raw$4 = `subscription ItemUpdate($id: ID!) {
  itemUpdate(id: $id) {
    item {
      id
      completed
      text
    }
  }
}
`;
const rootType$4 = "Subscription";
const selection$4 = {
  itemUpdate: {
    type: "ItemUpdate",
    keyRaw: "itemUpdate(id: $id)",
    fields: {
      item: {
        type: "TodoItem",
        keyRaw: "item",
        fields: {
          id: {
            type: "ID",
            keyRaw: "id"
          },
          completed: {
            type: "Boolean",
            keyRaw: "completed"
          },
          text: {
            type: "String",
            keyRaw: "text"
          }
        }
      }
    }
  }
};
var _ItemUpdateArtifact = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  name: name$4,
  kind: kind$4,
  hash: hash$4,
  raw: raw$4,
  rootType: rootType$4,
  selection: selection$4
});
const name$3 = "DeleteItem";
const kind$3 = "HoudiniMutation";
const hash$3 = "af0426e6e061efc22564e42bf13412db";
const raw$3 = `mutation DeleteItem($id: ID!) {
  deleteItem(item: $id) {
    itemID
  }
}
`;
const rootType$3 = "Mutation";
const selection$3 = {
  deleteItem: {
    type: "DeleteIemOutput",
    keyRaw: "deleteItem(item: $id)",
    fields: {
      itemID: {
        type: "ID",
        keyRaw: "itemID",
        operations: [{
          action: "delete",
          type: "TodoItem"
        }]
      }
    }
  }
};
var _DeleteItemArtifact = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  name: name$3,
  kind: kind$3,
  hash: hash$3,
  raw: raw$3,
  rootType: rootType$3,
  selection: selection$3
});
const name$2 = "UncompleteItem";
const kind$2 = "HoudiniMutation";
const hash$2 = "d3d08fdcd348934829a1f7c24bcdac5e";
const raw$2 = `mutation UncompleteItem($id: ID!) {
  uncheckItem(item: $id) {
    item {
      id
      completed
      ...Filtered_Items_remove
    }
  }
}

fragment Filtered_Items_remove on TodoItem {
  id
}
`;
const rootType$2 = "Mutation";
const selection$2 = {
  uncheckItem: {
    type: "UpdateItemOutput",
    keyRaw: "uncheckItem(item: $id)",
    fields: {
      item: {
        type: "TodoItem",
        keyRaw: "item",
        fields: {
          id: {
            type: "ID",
            keyRaw: "id"
          },
          completed: {
            type: "Boolean",
            keyRaw: "completed"
          }
        },
        operations: [{
          action: "remove",
          connection: "Filtered_Items",
          when: {
            must: {
              completed: true
            }
          }
        }]
      }
    }
  }
};
var _UncompleteItemArtifact = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  name: name$2,
  kind: kind$2,
  hash: hash$2,
  raw: raw$2,
  rootType: rootType$2,
  selection: selection$2
});
const name$1 = "CompleteItem";
const kind$1 = "HoudiniMutation";
const hash$1 = "cce9318067ed9ac433f0fed6c7337634";
const raw$1 = `mutation CompleteItem($id: ID!) {
  checkItem(item: $id) {
    item {
      id
      completed
      ...Filtered_Items_remove
    }
  }
}

fragment Filtered_Items_remove on TodoItem {
  id
}
`;
const rootType$1 = "Mutation";
const selection$1 = {
  checkItem: {
    type: "UpdateItemOutput",
    keyRaw: "checkItem(item: $id)",
    fields: {
      item: {
        type: "TodoItem",
        keyRaw: "item",
        fields: {
          id: {
            type: "ID",
            keyRaw: "id"
          },
          completed: {
            type: "Boolean",
            keyRaw: "completed"
          }
        },
        operations: [{
          action: "remove",
          connection: "Filtered_Items",
          when: {
            must: {
              completed: false
            }
          }
        }]
      }
    }
  }
};
var _CompleteItemArtifact = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  name: name$1,
  kind: kind$1,
  hash: hash$1,
  raw: raw$1,
  rootType: rootType$1,
  selection: selection$1
});
const name = "ItemEntry_item";
const kind = "HoudiniFragment";
const hash = "bb754a63ce6081f2ed825ec696d4f375";
const raw = `fragment ItemEntry_item on TodoItem {
  id
  text
  completed
}

fragment Filtered_Items_insert on TodoItem {
  id
  completed
  ...ItemEntry_item
}

fragment Filtered_Items_remove on TodoItem {
  id
}

fragment All_Items_insert on TodoItem {
  id
  completed
}

fragment All_Items_remove on TodoItem {
  id
}

directive @TodoItem_delete repeatable on FIELD
`;
const rootType = "TodoItem";
const selection = {
  id: {
    type: "ID",
    keyRaw: "id"
  },
  text: {
    type: "String",
    keyRaw: "text"
  },
  completed: {
    type: "Boolean",
    keyRaw: "completed"
  }
};
var _ItemEntry_itemArtifact = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  name,
  kind,
  hash,
  raw,
  rootType,
  selection
});
const ItemEntry = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $data, $$unsubscribe_data;
  let {item} = $$props;
  const data = fragment({
    kind: "HoudiniFragment",
    artifact: _ItemEntry_itemArtifact
  }, item);
  $$unsubscribe_data = subscribe(data, (value) => $data = value);
  mutation({
    kind: "HoudiniMutation",
    artifact: _CompleteItemArtifact
  });
  mutation({
    kind: "HoudiniMutation",
    artifact: _UncompleteItemArtifact
  });
  mutation({
    kind: "HoudiniMutation",
    artifact: _DeleteItemArtifact
  });
  subscription({
    kind: "HoudiniSubscription",
    artifact: _ItemUpdateArtifact
  }, {id: $data.id});
  if ($$props.item === void 0 && $$bindings.item && item !== void 0)
    $$bindings.item(item);
  $$unsubscribe_data();
  return `<li${add_classes([$data.completed ? "completed" : ""].join(" ").trim())}><div class="${"view"}"><input${add_attribute("name", $data.text, 0)} class="${"toggle"}" type="${"checkbox"}" ${$data.completed ? "checked" : ""}>
		<label${add_attribute("for", $data.text, 0)}>${escape($data.text)}</label>
		<button class="${"destroy"}"></button></div></li>`;
});
function AllItemsVariables({page: page2}) {
  if (!page2.params.filter || page2.params.filter === "all")
    ;
  if (!["active", "completed", "all"].includes(page2.params.filter)) {
    this.error(400, "filter must be one of 'active' or 'completed'");
    return;
  }
  return {
    completed: page2.params.filter === "completed"
  };
}
async function load(context) {
  const _houdini_context = new RequestContext(context);
  const _AllItems_Input = _houdini_context.computeInput("kit", AllItemsVariables);
  if (!_houdini_context.continue) {
    return _houdini_context.returnValue;
  }
  const _AllItems = await fetchQuery$1(_houdini_context, {
    text: raw$6,
    variables: _AllItems_Input
  }, context.session);
  if (_AllItems.errors) {
    _houdini_context.graphqlErrors(_AllItems.errors);
    return _houdini_context.returnValue;
  }
  return {props: {_AllItems, _AllItems_Input}};
}
const U5Bfilteru5D = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let $data, $$unsubscribe_data;
  let $numberOfItems, $$unsubscribe_numberOfItems;
  let $itemsLeft, $$unsubscribe_itemsLeft;
  let $currentPage, $$unsubscribe_currentPage;
  let $hasCompleted, $$unsubscribe_hasCompleted;
  let {_AllItems} = $$props;
  let {_AllItems_Input} = $$props;
  let _AllItems_handler = query({
    initialValue: _AllItems,
    variables: _AllItems_Input,
    kind: "HoudiniQuery",
    artifact: _AllItemsArtifact
  });
  const {data} = getQuery(_AllItems_handler);
  $$unsubscribe_data = subscribe(data, (value) => $data = value);
  mutation({
    kind: "HoudiniMutation",
    artifact: _AddItemArtifact
  });
  const numberOfItems = derived(data, ($data2) => $data2.allItems.length);
  $$unsubscribe_numberOfItems = subscribe(numberOfItems, (value) => $numberOfItems = value);
  const itemsLeft = derived(data, ($data2) => $data2.allItems.filter((item) => !item.completed).length);
  $$unsubscribe_itemsLeft = subscribe(itemsLeft, (value) => $itemsLeft = value);
  const hasCompleted = derived(data, ($data2) => Boolean($data2.allItems.find((item) => item.completed)));
  $$unsubscribe_hasCompleted = subscribe(hasCompleted, (value) => $hasCompleted = value);
  const currentPage = derived(page, ($page) => {
    if ($page.path.includes("active")) {
      return "active";
    } else if ($page.path.includes("completed")) {
      return "completed";
    }
    return "all";
  });
  $$unsubscribe_currentPage = subscribe(currentPage, (value) => $currentPage = value);
  let inputValue = "";
  if ($$props._AllItems === void 0 && $$bindings._AllItems && _AllItems !== void 0)
    $$bindings._AllItems(_AllItems);
  if ($$props._AllItems_Input === void 0 && $$bindings._AllItems_Input && _AllItems_Input !== void 0)
    $$bindings._AllItems_Input(_AllItems_Input);
  {
    {
      _AllItems_handler.writeData(_AllItems, _AllItems_Input);
    }
  }
  $$unsubscribe_data();
  $$unsubscribe_numberOfItems();
  $$unsubscribe_itemsLeft();
  $$unsubscribe_currentPage();
  $$unsubscribe_hasCompleted();
  return `<header class="${"header"}"><a href="${"/"}"><h1>todos</h1></a>
	<input class="${"new-todo"}" placeholder="${"What needs to be done?"}"${add_attribute("value", inputValue, 1)}></header>

<section class="${"main"}"><input id="${"toggle-all"}" class="${"toggle-all"}" type="${"checkbox"}">
	<label for="${"toggle-all"}">Mark all as complete</label>
	<ul class="${"todo-list"}">${each($data.filteredItems, (item) => `${validate_component(ItemEntry, "ItemEntry").$$render($$result, {item}, {}, {})}`)}</ul></section>
${$numberOfItems > 0 ? `<footer class="${"footer"}"><span class="${"todo-count"}"><strong>${escape($itemsLeft)}</strong> item left</span>
		<ul class="${"filters"}"><li><a class="${["selected", $currentPage === "all" ? "selected" : ""].join(" ").trim()}" href="${"/"}">All</a></li>
			<li><a href="${"/active"}"${add_classes([$currentPage === "active" ? "selected" : ""].join(" ").trim())}>Active</a></li>
			<li><a href="${"/completed"}"${add_classes([$currentPage === "completed" ? "selected" : ""].join(" ").trim())}>Completed</a></li></ul>
		${$hasCompleted ? `<button class="${"clear-completed"}">Clear completed</button>` : ``}</footer>` : ``}`;
});
var _filter_ = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  [Symbol.toStringTag]: "Module",
  default: U5Bfilteru5D,
  AllItemsVariables,
  load
});
export {init, render};
