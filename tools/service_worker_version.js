/*service_worker_version.js*/
/*npm version patch --force
 is used before, see package.json */
"use strict";

const files = require("./files.js");


const thisName = "service_worker_version.js build";
const REPLACED_WITH_SERVICE_WORKER_VERSION = "REPLACED_WITH_SERVICE_WORKER_VERSION";//that string is in browserserver.js

const SERVICE_WORKER_PATH = "client/js/service_worker.js";
const PACKAGE_PATH = "package.json";
const SERVICE_WORKER_WITH_VERSION_PATH = "client/js/built/service_worker_with_version.js";





Promise.all([
    files.textFileContentPromiseFromPath(SERVICE_WORKER_PATH),
    files.textFileContentPromiseFromPath(PACKAGE_PATH),
]).then(function ([service_workerText, packageText]) {
    const packageVersion = JSON.parse(packageText)["version"];
    const service_workerTextWithVersion = service_workerText.replace(REPLACED_WITH_SERVICE_WORKER_VERSION, packageVersion);

    return files.writeTextInFilePromiseFromPathAndString(SERVICE_WORKER_WITH_VERSION_PATH, service_workerTextWithVersion);
}).then(function () {
    //console.log(thisName + " finished with success !");
}).catch(function (reason) {
    const errorText = thisName + " failed: " + String(reason);
    console.log(errorText);
    throw new Error(errorText);
});
