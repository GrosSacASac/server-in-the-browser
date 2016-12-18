/*node_emulator_for_worker.js
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
                headerBodyObject.header.url = "/" + headerBodyObject.header.ressource;
                
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
/*variables:  require, listenForRequest, respondToRequest*/
${readyCodeText};

};
