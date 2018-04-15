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
        browserServerCode = `/*node_emulator_for_worker.js
*/
/*jslint
es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white: true, node, eval
*/
/*global
URL, Blob, Worker, self, importScripts
*/
"use strict";
/*need to manually escape some template strings*/
let module;
let exports;
let require;
let listenForRequest;
let respondToRequest;
let readStaticFile;
let process;
let __dirname;
//let _emptyFunction = function () {};
let _customFunction;
//let cleanUp;
(function () {
/*store local reference*/
const postMessage = self.postMessage;
const addEventListener = self.addEventListener;


const listeners = [];
const staticFilesResolves = {};
const COMMANDS = {
START: "START",
CLOSE: "CLOSE",
COMMAND: "COMMAND",
URLSTART: "URLSTART"
};

let state = 0;
let urlStart = "";

const tryCatchUserCode = function (tryFunction) {
try {
tryFunction();
} catch (error) {
let line;
if (error.lineNumber) {
line = Number(error.lineNumber) - ${LENGTHBEFORE};
} else {
line = "?";
}
postMessage({"ERROR": {
line: line,
name: error.name,
message: error.message
}});
}
};

addEventListener("message", function(event) {
const message = event.data;
if (message[COMMANDS.COMMAND] === COMMANDS.START) {
state = 1;
urlStart = message[COMMANDS.URLSTART];
postMessage({"STARTSUCCES": "STARTSUCCES"});
tryCatchUserCode(_customFunction);
} else if (message[COMMANDS.COMMAND] === COMMANDS.CLOSE) {
state = 0;
self.close();
} else if (state) {

if (message.hasOwnProperty("headerBodyObject")) {
const headerBodyObject = message.headerBodyObject;//it s a copy
headerBodyObject.header.url = "/" + headerBodyObject.header.fileName;

tryCatchUserCode(function () {
listeners.forEach(function (listener) {

listener(headerBodyObject);
});
});
} else if (message.hasOwnProperty("staticFile")) {
const staticFileName = message.staticFile;
const body = message.body;
if (!staticFilesResolves.hasOwnProperty(staticFileName)) {
//why are we here? At this point we are not listening for the file body
return;
}
if (body === undefined) {
const errorMessage = message.error;
staticFilesResolves[staticFileName].reject.forEach(function (
rejectFunction) {
rejectFunction(errorMessage);
});

} else {
staticFilesResolves[staticFileName].resolve.forEach(function (
resolveFunction) {
resolveFunction(message);
});
}
delete staticFilesResolves[staticFileName];
}
}
}, false);

//remove access for the rest
const removeAccess = function (anObject, propertyName) {
Object.defineProperty(anObject, propertyName, {
value: undefined,
writable: false,
configurable: false,
enumerable: false
});
};
const hiddenAccessList = ["postMessage", "addEventListener", "onmessage", "close"];
hiddenAccessList.forEach(function (propertyName) {
removeAccess(self, propertyName);
});



/*cleanUp = function () {
;
};*/


(function () {
/* emulates nodes let module, exports, require
what should happen with exports = x ?
maybe change Object.defineProperty(self,"exports",
 setter: use single value= true, and store ... low prio
todo make overwriting the global module and export immpossible ?
limitation everything is public by default
it means that to port code from node you have to put everything in an IFFE and use module.export ... for the things to export
 */
const exportsObject = {};
const moduleObject = {};
const EXPORT = "exports";

let currentExportObject;// = {};
let currentExportSingleValue;// = undefined
let currentModuleObject;// = {};
let currentExportSingleValueUsed;// = false;

const exportsTraps = {
get: function (target, name) {
/*return the current local exports*/
return currentExportObject[name];
},
set: function (target, name, value) {
currentExportObject[name] = value;
}
};

const moduleTraps = {
/*todo add more traps*/
get: function (target, name) {
/*return the current local exports*/
if (name === EXPORT) {
if (currentExportSingleValueUsed) {
return currentExportSingleValue;
}
return exports;
}
return currentModuleObject[name];
},
set: function (target, name, value) {
currentModuleObject[name] = value;
if (name === EXPORT) {
currentExportSingleValue = value;
currentExportSingleValueUsed = true;
}
}
};

exports = new Proxy(exportsObject, exportsTraps);

module = new Proxy(moduleObject, moduleTraps);
const requireCache = {};
require = function(requiredName) {
if (requireCache.hasOwnProperty(requiredName)) {
/*if something is required twice do not execute the code again*/
return requireCache[requiredName];
}
currentExportObject = {};
currentExportSingleValue = undefined;
currentModuleObject = {};
currentExportSingleValueUsed = false;

const requiredUrl = urlStart + requiredName;
importScripts(requiredUrl); //downloads and execute

let returnValue;
if (currentExportSingleValueUsed) {
returnValue = currentExportSingleValue;
} else {
returnValue = currentExportObject;
}
requireCache[requiredName] = returnValue;
return returnValue;
};


}());
process = {
env: {}
};

__dirname = "";

listenForRequest = function (afunction) {
listeners.push(afunction);
};

respondToRequest = function (headerBodyObject) {
//console.log("the worker is responding to a request with", headerBodyObject);
postMessage({headerBodyObject});
};

readStaticFile = function (staticFileName) {
/*reads a static file from the main thread
returns a promise that resolves with an Object
{staticFile: staticFileName,
body: *the body*,
"Content-Type": "string"}
or
(reject)
{staticFile: staticFileName,
body: undefined,
error: errorString}
*/
return new Promise(function (resolve, reject) {
const stillWaiting = staticFilesResolves[staticFileName];
if (stillWaiting) {
/*already listeners*/
staticFilesResolves[staticFileName].resolve.push(resolve);
staticFilesResolves[staticFileName].reject.push(reject);
} else {
staticFilesResolves[staticFileName] = {};
staticFilesResolves[staticFileName].resolve = [resolve];
staticFilesResolves[staticFileName].reject= [reject];
}
postMessage({staticFile: staticFileName});
});
};

/*could still access hiddenAccessList with trow catch error.trace.object*/
//self = undefined;//cannot assign to self
}());

//have access to self [object DedicatedWorkerGlobalScope]
//const self = self;
const window = self; // to emulate
const global = self;
//cleanUp();
_customFunction = function () {
/*variables:require, listenForRequest, respondToRequest*/
${readyCodeText};

};
`;//see buildbrowserserverwithemulator.js
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
