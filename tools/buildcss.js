/*

*/

"use strict";

const {
    textFileContent,
    writeTextInFile,
    copyFile,
    concatenateFiles,
    deleteFile
} = require("filesac");

const cssDirectory = `client/css`;
module.exports = function () {

    concatenateFiles([

        `node_modules/dom99/components/yesNoDialog/yesNoDialog.css`,
        `${cssDirectory}/base.css`,
        `${cssDirectory}/header.css`,
        `${cssDirectory}/userlist.css`,
        `${cssDirectory}/fileinput.css`
    ], `${cssDirectory}/built/all.css`, `\n`);

    concatenateFiles([
        `${cssDirectory}/base.css`,
        `${cssDirectory}/header.css`,
        `${cssDirectory}/pre.css`
    ], `${cssDirectory}/built/documentation.css`, `\n`);
};
