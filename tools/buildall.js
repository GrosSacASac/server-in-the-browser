/*
todo make promises cahin so that cleanup promise can run after the others
*/

"use strict";

const buildjs = require("./buildjs.js");
const buildcss = require("./buildcss.js");
const buildhtml = require("./buildhtml.js");
const builddoc = require("./builddoc.js");
const cli_inputs = process.argv.slice(2); // command line inputs
// const buildAssets = require("./buildAssets.js");
// const cleanup = require("./cleanup.js");

const JS = "JS";
const HTML = "HTML";
const CSS = "CSS";
const DOC = "DOC";
const ASSETS = "ASSETS";
const CLEAN = "CLEAN";


if (cli_inputs.length === 0) {
    console.warn("Pass arguments for something to happen");
}

if (cli_inputs.includes(JS)) {
    buildjs(cli_inputs);
}
if (cli_inputs.includes(CSS)) {
    buildcss();
}
if (cli_inputs.includes(HTML)) {
    buildhtml();
}
if (cli_inputs.includes(DOC)) {
    builddoc();
}
//
// if (cli_inputs.includes(ASSETS)) {
//     buildAssets();
// }
//
// if (cli_inputs.includes(CLEAN)) {
//     cleanup();
// }
