/*minifyHtml.js*/
"use strict";
const files = require("./files.js");
const minify = require("html-minifier").minify;

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
    files.textFileContentPromiseFromPath(path).then(function (textFileContent) {
        //console.log(textFileContent);
        const minifiedHtml = minify(textFileContent, OPTIONS);
        return files.writeTextInFilePromiseFromPathAndString(OUTPUT_FROM_INPUT_PATH[path], 
            minifiedHtml);
    }).then(function () {
        //console.log(path + " minified !");
    }).catch(function (reason) {
        const errorText = thisName + " failed: " + String(reason);
        console.log(errorText);
        throw new Error(errorText);
    });
    
});
