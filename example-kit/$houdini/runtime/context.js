"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVariables = exports.setVariables = void 0;
var svelte_1 = require("svelte");
var setVariables = function (vars) { return svelte_1.setContext('variables', vars); };
exports.setVariables = setVariables;
var getVariables = function () { return svelte_1.getContext('variables') || {}; };
exports.getVariables = getVariables;
