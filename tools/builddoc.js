/*minifyHtml.js*/
"use strict";
const files = require("./files.js");
const minify = require("html-minifier").minify;
const markdown = require("markdown-it")("default", {
    html: true,
    linkify: true,
    typographer: true
}).use(require('markdown-it-lazy-headers'));


const thisName = "Parse markdown and produce html";

const BEFORE_BODY_TEMPLATE_PATH = "client/html/beforeBodyTemplate.part.html";
const AFTER_BODY_TEMPLATE_PATH = "client/html/afterBodyTemplate.part.html";
const ABOUT_MD_PATH = "documentation/about.md";
const HELP_MD_PATH = "documentation/help.md";
const OPEN_SOURCE_MD_PATH = "documentation/open_source.md";
const OUTPUTS_FROM_INPUT_PATH = {
    [ABOUT_MD_PATH]: [
        "client/html/built/about.part.min.html", //fragment
        "client/html/built/about.min.html" // standalone
    ],
    [HELP_MD_PATH]: [
        "client/html/built/help.part.min.html",
        "client/html/built/help.min.html"
    ],
    [OPEN_SOURCE_MD_PATH]: [
        "client/html/built/open_source.part.min.html",
        "client/html/built/open_source.min.html"
    ]
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
Promise.all([
    files.textFileContentPromiseFromPath(BEFORE_BODY_TEMPLATE_PATH),
    files.textFileContentPromiseFromPath(AFTER_BODY_TEMPLATE_PATH)
]).then(function ([beforeBodyTemplate, afterBodyTemplate]) {
    Object.keys(OUTPUTS_FROM_INPUT_PATH).forEach(function (path) {
        files.textFileContentPromiseFromPath(path).then(function (textFileContent) {
            //console.log(textFileContent);
            const htmlText = markdown.render(textFileContent);
            const minifiedHtml = minify(htmlText, OPTIONS);
            const standalone = minify((beforeBodyTemplate + minifiedHtml + afterBodyTemplate), OPTIONS);
            return Promise.all([
                files.writeTextInFilePromiseFromPathAndString(
                    OUTPUTS_FROM_INPUT_PATH[path][0], minifiedHtml),
                files.writeTextInFilePromiseFromPathAndString(
                    OUTPUTS_FROM_INPUT_PATH[path][1], standalone)
            ]);
        }).then(function () {
            console.log(path + " markdown parsed !");
        }).catch(function (reason) {
            const errorText = thisName + " failed: " + String(reason);
            console.log(errorText);
            throw new Error(errorText);
        });
    });
});
