/*browserserver.js

how to RUN LIKE NODE JS
challenges
 * make require() work
 * make command line with something similar to npm run start, npm run build etc
 * clean environement after each run start no variables left
 * refuse variable access
 * similar all around
 * reuqire(http) and require express does same thing

 * USE browserify
 * close worker
 * use web worker with messaging system
*/
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white, node, eval
*/
/*global
    window, URL, Blob, Worker
*/
export { browserServer as default };
import uiFiles from "../uiFiles.js"; // path relative from built becuase of how the build works

const browserServer = (function () {

    const states = {
        DISABLED: 0,
        RUNNING: 1
    };
    const COMMANDS = {
        START: "START",
        CLOSE: "CLOSE",
        COMMAND: "COMMAND",
        URLSTART: "URLSTART",
        URLSTARTVALUE: String(location)
    };
    const workerStartTimeLimit = 1000; // ms
    const workerStartTimeLimitSeconds = workerStartTimeLimit / 1000;
    let worker;
    let workerState = states.DISABLED;
    let browserServerCode = "";
    let timeoutId;

    const LENGTHBEFORE = 140;

    const setBrowserServerCode = function (readyCodeText) {
        /*a web worker needs direct source code becuase it has a new separate
        execution context. Below gets injected readyCodeText*/
        browserServerCode = NODE_EMULATOR_FOR_WORKERTEXT;//see buildbrowserserverwithemulator.js
    };


    const run = function () {
        /*uses worker, browserServerCode*/
        if (!browserServerCode) {
            return;
        }
        close();

        if (timeoutId) {
            window.clearTimeout(timeoutId);
        }
        let resolved = false;
        return new Promise(function (resolve, reject) {
            timeoutId = setTimeout(function () {
                if (!resolved) {
                    //this timeout should not reject except if it took too long
                    reject(`Long startup time. More than ${workerStartTimeLimitSeconds}s. This happens when an error is found.`);
                    resolved = true;
                    timeoutId = undefined;
                }
            }, workerStartTimeLimit);
            const wokerJsBlob = new Blob([browserServerCode], { type: "text/javascript" });
            const wokerJsObjectURL = URL.createObjectURL(wokerJsBlob);
            try {
                worker = new Worker(wokerJsObjectURL); // eval called
            } catch (error) {
                close();
                resolved = true;
                reject(
`${error.name}: "${error.message}" at line ${Number(error.lineNumber) - LENGTHBEFORE}`);
            }
            worker.addEventListener("error", function (event) {
                /*this is the only good way to catch syntax errors*/
                close();
                resolved = true;
                reject(`${event.message}`);
                event.stopPropagation();
                event.preventDefault();
            }, false);
            URL.revokeObjectURL(wokerJsObjectURL); // clean space
            workerState = states.RUNNING;
            worker.addEventListener("message", function(event) {
                const message = event.data;
                //console.log(message);
                if (message.hasOwnProperty("STARTSUCCES")) {
                    resolve();
                    resolved = true;
                } else if (message.hasOwnProperty("headerBodyObject")) {
                    const headerBodyObject = message.headerBodyObject;
                    //console.log("worker.onmessage 1 ", headerBodyObject, resolveFromPromiseId);
                    if (headerBodyObject.hasOwnProperty("internalId")) {
                        const internalId = headerBodyObject.internalId;
                        delete headerBodyObject.internalId;//cleanup
                        //console.log("worker.onmessage 2 ", headerBodyObject, internalId);
                        if (resolveFromPromiseId.hasOwnProperty(internalId)) {
                            //console.log("worker.onmessage 3", resolveFromPromiseId[internalId]);
                            resolveFromPromiseId[internalId](headerBodyObject);
                            delete resolveFromPromiseId[internalId];//cleanup
                        }
                    }
                } else if (message.hasOwnProperty("staticFile")) {
                    /*            */
                    const staticFileName = message.staticFile;
                    //console.log();
                    let answer = uiFiles.fileFromFileName(staticFileName);
                    let staticFileObject = {
                        body: undefined,
                        staticFile: staticFileName
                    };
                    if (answer) {
                        staticFileObject.body = answer.body
                        staticFileObject["Content-Type"] = answer.header["Content-Type"] ||
                            uiFiles.contentTypeFromFileName(staticFileName);

                    } else {
                        staticFileObject.error = "No file";
                    }
                    worker.postMessage(staticFileObject);

                } else if (message.hasOwnProperty("ERROR")) {
                    const errorInformation = message.ERROR;
                    const errorString = `${errorInformation.name}: "${errorInformation.message}" at line ${errorInformation.line}`;
                    close();
                    if (!resolved) {
                        reject(errorString);
                        resolved = true;
                    } else {
                        ui.lateReject(errorString);
                    }
                }
            }, false);
            //the worker starts with the first postMessage
            worker.postMessage({
                [COMMANDS.COMMAND]: COMMANDS.START,
                [COMMANDS.URLSTART]: COMMANDS.URLSTARTVALUE
            });
        });
    };

    const resultFromRequest = function (headerBodyObject) {
        if (!worker) {
            return;
        }
        worker.postMessage(headerBodyObject);
    };

    let promiseId = 1;
    const resolveFromPromiseId = {};
    const answerObjectPromiseFromRequest = function (headerBodyObject) {
        return new Promise(function (resolve, reject) {
            if (!worker) {
                reject("No worker existing");
                return;
            }
            const internalId = String(promiseId);
            promiseId += 1;
            resolveFromPromiseId[internalId] = resolve;
            headerBodyObject.internalId = internalId,
            worker.postMessage({headerBodyObject});
        });
    };

    const close = function () {
        if (!worker) {
            return;
        }
        workerState = states.DISABLED;
        //worker.postMessage(COMMANDS.CLOSE); // soft close let finish last task
        worker.terminate(); // forced close don t let finish last task
        worker = undefined;
    };

    return {
        setBrowserServerCode,
        resultFromRequest,
        answerObjectPromiseFromRequest,
        run,
        close
    };
}());
