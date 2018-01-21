/*

*/

"use strict";

const {
    textFileContentPromiseFromPath,
    writeTextInFilePromiseFromPathAndString,
    copyFile,
    concatenateFiles,
    copyFile,
    deleteFile
} = require("utilsac");

const rollup = require('rollup');
const rollup_babel = require('rollup-plugin-babel');
const babel = require("babel-core");
const UglifyJSES5 = require("uglify-js");
const UglifyJS = require("uglify-es");


const drop_console = false;
const skipMinification = true;

module.exports = function () {
concatenateFiles
"build1js": "cd client/js && concat-files declare.js external_dependencies/zip/zip_zip-ext.js ui.js uiFiles.js rtc.js bytes.js localData.js sockets.js built/browserserver_with_node_emulator_for_worker.js serviceWorkerManager.js launcher.js -o built/concat.js && cd ../..",
    "build2js": "cd client/js && browserify built/concat.js -o built/browserified.js && concat-files external_dependencies/zip/zip_zip-ext.js built/browserified.js -o built/all.js && cd ../..",
    "minifytest": "uglifyjs temp/uglifyjstest/u.js --mangle --compress --preamble \"//See u.js/ to see the source;\" --screw-ie8 --output temp/uglifyjstest/u.min.js",
    "minifyjs3": "uglifyjs client/js/built/all.js --mangle --compress --preamble \"//See client/ to see the source;\" --screw-ie8 --output client/js/built/all.min.js",
    "minifyjs3verbose": "uglifyjs client/js/built/all.js --mangle --compress --preamble \"//See client/ to see the source;\" --screw-ie8 --verbose --lint --output client/js/built/all.min.js",
    "minifylintconclusion": "Ramda is almost not used",
    "bumpversion": "npm version patch --force",
    "versioninserviceworker4": "node tools/service_worker_version.js",
    "minifyserviceworkerjs5": "uglifyjs client/js/built/service_worker_with_version.js --mangle --compress --screw-ie8 --output client/js/built/service_worker.min.js",
// do not use those because minify mutates options
// const uglifyES5Options = {
    // toplevel: true, // could pass in above <script>s for max minifaction with this
    // compress: {
        // ie8: false, // ie8 (default false) - set to true to support IE8.
        // drop_console
    // },
    // output: {
        // beautify: false,
        // preamble: "/*contact for source*/"
    // }
// };

// const uglifyOptions = {
    // ecma: 6,
    // toplevel: true, // could pass in above <script>s for max minifaction with this
    // compress: {
        // ie8: false, // ie8 (default false) - set to true to support IE8.
        // drop_console
    // },
    // output: {
        // beautify: false,
        // preamble: "/*contact for source*/"
    // }
// }
// entry points
// const files = [
    // "main"
// ];

async function rollupBundle(inputOptions, outputOptions) {
  // create a bundle
  const bundle = await rollup.rollup(inputOptions);
  
  //console.log(bundle.imports); // an array of external dependencies
  const written = await bundle.write(outputOptions);
  return written;
}

// first build <script nomodule src="">
const bundlePromise = Promise.all(files.map(function (fileName) {
    /* rollups bundles and transpiles except node_modules imports
    */
    const inputOptions = {
        input: `js/${fileName}.js`,
        plugins: [
            // also uses .babelrc
            rollup_babel({
              exclude: 'node_modules/**',
              externalHelpers: false
            })
        ]
    };
    const outputOptions = {
        format: "iife",
        name: `${fileName}`,
        file: `built/${fileName}-script.js`
    };
    
    return rollupBundle(inputOptions, outputOptions)
}));


bundlePromise.then(function () {
    /* transpile the single file bundled ,
    this will transpile node_modules imports that are inside the thing
    then minify it*/
    return Promise.all(files.map(function (fileName) {
        return new Promise(function (resolve, reject) {
                babel.transformFile(`built/${fileName}-script.js`, {}, function (err, result) {
                if (err) {
                    reject(err);
                }
                // result; // => { code, map, ast }
                writeTextInFilePromiseFromPathAndString(
                    `built/${fileName}-script.es5.js`,
                    String(result.code)
                ).then(resolve);
            });
        });
    })).then(function () {
        return Promise.all(files.map(function (fileName) {
            return textFileContentPromiseFromPath(`built/${fileName}-script.es5.js`)
                .then(function (content) {
                    return [fileName, content];
            });

        })).then(function (contents) {
            return Promise.all(contents.map(function ([fileName, code]) {
                let resultCode;
                if (skipMinification) {
                    resultCode = code;
                } else {
                    const result = UglifyJSES5.minify(code, {
                        toplevel: true, // could pass in above <script>s for max minifaction with this
                        compress: {
                            ie8: false, // ie8 (default false) - set to true to support IE8.
                            drop_console
                        },
                        output: {
                            beautify: false,
                            preamble: "/*contact for source*/"
                        }
                    });
                    if (result.error) {
                        return Promise.reject(result.error);
                    }
                    resultCode = result.code;
                }
                return writeTextInFilePromiseFromPathAndString(
                    `built/${fileName}-script.es5.min.js`,
                    resultCode
                );
            }));
        });
    });
});

// second build <script type="module" src="">

const bundlePromise2 = Promise.all(files.map(function (fileName) {
    const inputOptions = {
        input: `js/${fileName}.js`,
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
                  
                ]
            })
        ]
    };
    // https://rollupjs.org/#core-functionality
    const outputOptions = {
        format: "es",
        name: `${fileName}`,
        file: `built/${fileName}-es-module.js`
    };
    return rollupBundle(inputOptions, outputOptions);
}));



bundlePromise2.then(function () {
    /* as every browser supporting <script type="module" src="">
        also support es2015 we don't need to transpile italics
        only minify it*/ 
    return Promise.all(files.map(function (fileName) {
        return textFileContentPromiseFromPath(`built/${fileName}-es-module.js`)
            .then(function (content) {
                return [fileName, content];
        });

    })).then(function (contents) {
        return Promise.all(contents.map(function ([fileName, code]) {
            let resultCode;
            if (skipMinification) {
                resultCode = code;
            } else {
                const result = UglifyJS.minify(code, {
                    ecma: 6,
                    toplevel: true, // could pass in above <script>s for max minifaction with this
                    compress: {
                        ie8: false, // ie8 (default false) - set to true to support IE8.
                        drop_console
                    },
                    output: {
                        beautify: false,
                        preamble: "/*contact for source*/"
                    }
                });
                if (result.error) {
                    console.log("error:", result);
                    return Promise.reject(result.error);
                }
                resultCode = result.code;
            }
            return writeTextInFilePromiseFromPathAndString(
                `built/${fileName}-es-module.min.js`,
                resultCode
            );
        }));
    });
});



// service worker


textFileContentPromiseFromPath(`js/service_worker/service_worker.js`)
.then(function (content) {

    let resultCode;
    if (skipMinification) {
        resultCode = content;
    } else {
        const result = UglifyJS.minify(content, {
            ecma: 6,
            toplevel: true, // could pass in above <script>s for max minifaction with this
            compress: {
                ie8: false, // ie8 (default false) - set to true to support IE8.
                drop_console
            },
            output: {
                beautify: false,
                preamble: "/*contact for source*/"
            }
        });
        if (result.error) {
            console.log("error:", result);
            return Promise.reject(result.error);
        }
        resultCode = result.code;
    }


    return writeTextInFilePromiseFromPathAndString(
        `built/service_worker.min.js`,
        resultCode
    );
});



}; // end export