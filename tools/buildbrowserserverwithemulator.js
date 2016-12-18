/*buildbrowserserverwithemulator.js*/
"use strict";

const files = require("./files.js");


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
    files.textFileContentPromiseFromPath(BROWSERSERVER_PATH),
    files.textFileContentPromiseFromPath(NODE_EMULATOR_FOR_WORKER_PATH),
]).then(function ([browserserverText, node_emulator_for_workerText]) {
    const node_emulator_for_workerTemplateString = putInsideTemplateStringSafe(node_emulator_for_workerText);
    const browserserver_with_node_emulator_for_workerText = browserserverText.replace(NODE_EMULATOR_FOR_WORKERTEXT, node_emulator_for_workerTemplateString);
    return files.writeTextInFilePromiseFromPathAndString(BROWSERSERVER_WITH_NODE_EMULATOR_FOR_WORKER_PATH, browserserver_with_node_emulator_for_workerText);
}).then(function () {
    console.log(thisName + " finished with success !");
}).catch(function (reason) {
    const errorText = thisName + " failed: " + String(reason);
    console.log(errorText);
    throw new Error(errorText);
});
