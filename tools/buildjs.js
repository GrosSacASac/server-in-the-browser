"use strict";

const {
    textFileContent,
    writeTextInFile,
    copyFile,
    concatenateFiles,
    deleteFile
} = require("filesac");

const rollup = require('rollup');
const rollup_babel = require('rollup-plugin-babel');


const skipMinification = true;
let presets = [];
if (!skipMinification) {
    presets.push("minify")
}
const jsDirectory = `client/js`;


const OWN = "OWN";
const EXTERNAL = "EXTERNAL";
module.exports = function (inputs) {

    if (inputs.includes(OWN)) {

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


        const part1 = Promise.all([
            textFileContent(BROWSERSERVER_PATH),
            textFileContent(NODE_EMULATOR_FOR_WORKER_PATH),
        ]).then(function ([browserserverText, node_emulator_for_workerText]) {
            const node_emulator_for_workerTemplateString = putInsideTemplateStringSafe(node_emulator_for_workerText);
            const browserserver_with_node_emulator_for_workerText = browserserverText.replace(NODE_EMULATOR_FOR_WORKERTEXT, node_emulator_for_workerTemplateString);
            return writeTextInFilePromiseFromPathAndString(BROWSERSERVER_WITH_NODE_EMULATOR_FOR_WORKER_PATH, browserserver_with_node_emulator_for_workerText);
        });



        async function rollupBundle(inputOptions, outputOptions) {
            // create a bundle
            const bundle = await rollup.rollup(inputOptions);

            //console.log(bundle.imports); // an array of external dependencies
            const written = await bundle.write(outputOptions);
            return written;
        }

        const inputOptions = {
            input: `${jsDirectory}/launcher.js`,
            plugins: [
                // also uses .
                rollup_babel({
                    babelrc: false,
                    exclude: 'node_modules/**',
                    externalHelpers: false,
                    "plugins": [
                        "@babel/plugin-proposal-object-rest-spread"
                    ],
                    presets
                })
            ]
        };
        // https://rollupjs.org/#core-functionality
        const outputOptions = {
            format: "es",
            name: `serverInTheBrowser`,
            file: `${jsDirectory}/built/all.min.js`
        };

        part1.then(function () {
            const bundlePromise = rollupBundle(inputOptions, outputOptions);
        }).catch(function (reason) {
            const errorText = thisName + " failed: " + String(reason);
            console.log(errorText);
            throw new Error(errorText);
        });;
    }
    if (inputs.includes(EXTERNAL)) {
        // imported via a separate <script>
        concatenateFiles([


            `${jsDirectory}/external_dependencies/zip/zip_zip-ext.js`,
            `node_modules/webrtc-adapter/out/adapter.js`

        ], `${jsDirectory}/built/all-external.js`, `\n`);
    }
};
