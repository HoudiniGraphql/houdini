// this file exports a few functions that can be used to help generate
// commonjs files
export const cjsIndexFilePreamble = `"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });`

export function exportStarFrom(where: string): string {
	return `__exportStar(require("${where}"), exports);`
}

export function exportDefaultFrom(where: string, as: string): string {
	return `var ${as} = require("${where}");
Object.defineProperty(exports, "${as}", { enumerable: true, get: function () { return __importDefault(${as}).default; } });`
}
