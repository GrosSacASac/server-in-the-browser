"use strict";
const escapeHtml = require("escape-html");


const { textFileContent, writeTextInFile } = require("filesac");
const markdown = require("markdown-it")("default", {
    html: true,
    linkify: true,
    typographer: true
}).use(require("markdown-it-lazy-headers"));


module.exports = function () {
    const thisName = "Parse markdown and produce html";

    const BEFORE_BODY_TEMPLATE_PATH = "client/html/beforeBodyTemplate.part.html";
    const AFTER_BODY_TEMPLATE_PATH = "client/html/afterBodyTemplate.part.html";
    const OPEN_SOURCE_PREAMBLE_MD_PATH = "documentation/open_source/open_source_preamble.md";
    const OPEN_SOURCE_BUILT_PATH = "client/html/built/open_source.min.html";
    const OPEN_SOURCE_BUILT_PATH_PART = "client/html/built/open_source.part.min.html";
    const OPEN_SOURCE_NOTES = [
        [
            "documentation/open_source/dom99.txt",
            "documentation/open_source/dom99.md"
        ],
        [
            "documentation/open_source/webrtc_adapter.txt",
            "documentation/open_source/webrtc_adapter.md"
        ],
        [
            "documentation/open_source/nodejs.txt",
            "documentation/open_source/nodejs.md"
        ],
        [
            "documentation/open_source/zipjs.txt",
            "documentation/open_source/zipjs.md"
        ]
    ];

    const OUTPUTS_FROM_INPUT_PATH = {
        "documentation/about.md": [
            "client/html/built/about.part.min.html", //fragment
            "client/html/built/about.min.html" // standalone
        ],
        "documentation/help.md": [
            "client/html/built/help.part.min.html",
            "client/html/built/help.min.html"
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

    const buildOpenSourceNotes = function ([textPath, markdownPath]) {
        return Promise.all([
            textFileContent(markdownPath),
            textFileContent(textPath)
        ]).then(function ([markdownText, LicenseText]) {
            const htmlText = markdown.render(markdownText);
            const htmlTextLicense = `<pre>${escapeHtml(LicenseText)}</pre>`;
            const allHtmlText = htmlText + htmlTextLicense;

            return allHtmlText;
        });
    };



    Promise.all([
        textFileContent(BEFORE_BODY_TEMPLATE_PATH),
        textFileContent(AFTER_BODY_TEMPLATE_PATH),
        textFileContent(OPEN_SOURCE_PREAMBLE_MD_PATH)
    ]).then(function ([beforeBodyTemplate, afterBodyTemplate, open_source_preamble]) {
        Object.keys(OUTPUTS_FROM_INPUT_PATH).forEach(function (path) {
            textFileContent(path).then(function (textFileContent) {
                //console.log(textFileContent);
                const htmlText = markdown.render(textFileContent);
                const minifiedHtml = htmlText;
                const standalone = beforeBodyTemplate + minifiedHtml + afterBodyTemplate;
                return Promise.all([
                    writeTextInFile(
                        OUTPUTS_FROM_INPUT_PATH[path][0], minifiedHtml),
                    writeTextInFile(
                        OUTPUTS_FROM_INPUT_PATH[path][1], standalone)
                ]);
            }).then(function () {
                //console.log(path + " markdown parsed !");
            }).catch(function (reason) {
                const errorText = thisName + " failed: " + String(reason);
                console.log(errorText);
                throw new Error(errorText);
            });
        });
        Promise.all(OPEN_SOURCE_NOTES.map(buildOpenSourceNotes))
            .then(function (htmlTexts) {
                const allHtmlNotes = htmlTexts.reduce(function (before, current) {
                    return before + current;
                }, "");
                //console.log(typeof allHtmlNotes); // string
                const htmlTextPreamble = markdown.render(open_source_preamble);
                const minifiedHtml = htmlTextPreamble + allHtmlNotes;
                const standalone = beforeBodyTemplate + minifiedHtml + afterBodyTemplate;
                return Promise.all([
                    writeTextInFile(OPEN_SOURCE_BUILT_PATH_PART, minifiedHtml),
                    writeTextInFile(OPEN_SOURCE_BUILT_PATH, standalone)
                ]);
            }).then(function () {
                //console.log("open source notes success");
            }).catch(function (reason) {
                const errorText = thisName + " open source notes failed: " + String(reason);
                console.log(errorText);
                throw new Error(errorText);
            });
    });

}; // end export
