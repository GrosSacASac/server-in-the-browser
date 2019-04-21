/*

*/

"use strict";

const {
    textFileContent,
    writeTextInFile,
    copyFile
} = require("filesac");

const minify = require("html-minifier").minify;


// const skipMinification = false;



module.exports = function () {


    const thisName = "HTML minifier";

    const OUTPUT_FROM_INPUT_PATH = {
        "client/html/index.html": "client/html/built/index.min.html",
        "client/html/offline.html": "client/html/built/offline.min.html",
        "client/html/quit.html": "client/html/built/quit.min.html"
    };
    const OPTIONS = {
        removeAttributeQuotes: false,
        caseSensitive: true,
        collapseBooleanAttributes: true,
        collapseInlineTagWhitespace: false,
        collapseWhitespace: true,
        decodeEntities: true,
        html5: true,
        removeComments: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: false
    };

    Object.keys(OUTPUT_FROM_INPUT_PATH).forEach(function (path) {
        textFileContent(path).then(function (textFileContent) {
            //console.log(textFileContent);
            const minifiedHtml = minify(textFileContent, OPTIONS);
            return writeTextInFilePromiseFromPathAndString(OUTPUT_FROM_INPUT_PATH[path],
                minifiedHtml);
        }).then(function () {
            //console.log(path + " minified !");
        }).catch(function (reason) {
            const errorText = thisName + " failed: " + String(reason);
            console.log(errorText);
            throw new Error(errorText);
        });

    });


}; // end export
