/*

*/

"use strict";

const {
    textFileContentPromiseFromPath,
    writeTextInFilePromiseFromPathAndString,
    copyFile,
    concatenateFiles,
    deleteFile
} = require("utilsac");

const rollup = require('rollup');
const rollup_babel = require('rollup-plugin-babel');
// const babel = require("babel-core");
// const UglifyJSES5 = require("uglify-js");
// const UglifyJS = require("uglify-es");
//
//
// const drop_console = false;
// const skipMinification = true;
const jsDirectory = `client/js`;
module.exports = function () {

// cut/pasted from other file
// could make better later
// browserserver.js + node_emulator_for_worker.js = browserserver_with_node_emulator_for_worker.js
// (dynamic worker creation at runtime needs a string of code)
const thisName = "buildbrowserserverwithemulator.js build";
const NODE_EMULATOR_FOR_WORKERTEXT = "NODE_EMULATOR_FOR_WORKERTEXT";//that string is in browserserver.js

const BROWSERSERVER_PATH = "client/js/browserserver.js";
const NODE_EMULATOR_FOR_WORKER_PATH = "client/js/node_emulator_for_worker.js";
const BROWSERSERVER_WITH_NODE_EMULATOR_FOR_WORKER_PATH = "client/js/built/browserserver_with_node_emulator_for_worker.js";



const putInsideTemplateStringSafe = function (jsCodeText) {
    return ("`" + (jsCodeText
        .replace(/  /g, "")) + "`");
        /*later preserve ${readyCodeText}, by reinjecting ?
        and do, use g to replace ALL can also minify emulator
        ("`" + (jsCodeText
        .replace(" ", "")
        .replace("\\", "\\\\")
        .replace("`", "\\`")
        .replace("`", "\\`")
        .replace("${", "\\${")
        .replace("}", "\\}")) + "`")*/
};


Promise.all([
    textFileContentPromiseFromPath(BROWSERSERVER_PATH),
    textFileContentPromiseFromPath(NODE_EMULATOR_FOR_WORKER_PATH),
]).then(function ([browserserverText, node_emulator_for_workerText]) {
    const node_emulator_for_workerTemplateString = putInsideTemplateStringSafe(node_emulator_for_workerText);
    const browserserver_with_node_emulator_for_workerText = browserserverText.replace(NODE_EMULATOR_FOR_WORKERTEXT, node_emulator_for_workerTemplateString);
    return writeTextInFilePromiseFromPathAndString(BROWSERSERVER_WITH_NODE_EMULATOR_FOR_WORKER_PATH, browserserver_with_node_emulator_for_workerText);
}).then(function () {
    //console.log(thisName + " finished with success !");
}).catch(function (reason) {
    const errorText = thisName + " failed: " + String(reason);
    console.log(errorText);
    throw new Error(errorText);
});



async function rollupBundle(inputOptions, outputOptions) {
  // create a bundle
  const bundle = await rollup.rollup(inputOptions);

  //console.log(bundle.imports); // an array of external dependencies
  const written = await bundle.write(outputOptions);
  return written;
}

const inputOptions = {
    input: `${jsDirectory}/declare.js`,
    plugins: [
        // also uses .
        rollup_babel({
          babelrc: false,
          exclude: 'node_modules/**',
          externalHelpers: false,
          "plugins": [
            "transform-object-rest-spread"
          ],
          "presets": [
                // not env
                "minify"
            ]
        })
    ]
};
// https://rollupjs.org/#core-functionality
const outputOptions = {
    format: "es",
    name: `serverInTheBrowser`,
    file: `${jsDirectory}/built/2018-bundle.min.js`
};

const bundlePromise = rollupBundle(inputOptions, outputOptions).then(function () {

    concatenateFiles([
        `${jsDirectory}/external_dependencies/zip/zip_zip-ext.js`,
        `${jsDirectory}/built/2018-bundle.min.js`

    ], `${jsDirectory}/built/all.min.js`, `\n`);

});


    // "bumpversion": "npm version patch --force",
    // "versioninserviceworker4": "node tools/service_worker_version.js",
    // "minifyserviceworkerjs5": "uglifyjs client/js/built/service_worker_with_version.js --mangle --compress --screw-ie8 --output client/js/built/service_worker.min.js",




}; // end export
