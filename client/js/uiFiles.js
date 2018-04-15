/*uiFiles.js*/
/*jslint
    es6, maxerr: 15, browser, devel, fudge, maxlen: 100
*/
/*global
    FileReader, Promise, d
*/
/*we can then send data as arrayBuffer
*/

import d from "../../node_modules/dom99/built/dom99Module.js";
import {yesNoDialog, textDialog} from "../../node_modules/dom99/components/yesNoDialog/yesNoDialog.js";
import {keyFromObjectAndValue, OutOfOrderError} from "./utilities/utilities.js";
import rtc from "./rtc.js";
import bytes from "./bytes.js";
import {state} from "./state.js";
/* import "./external_dependencies/zip/zip_zip-ext.js"; with file concatenation*/

export { uiFiles as default };

const uiFiles = (function () {

    const fileNameFromKey = {}; // change

    const FILE_INPUT_PREFIX = "FI";

    const STRINGS = {
        CANNOT_LOAD_ZIP: "Could not load zip: ",
        FILE_LOADED: "file loaded"
    };

    const fileInputDescription = {
        "tagName": "input",
        "type": "file",
        "data-function": "xReadFileStart",
        "multiple": "multiple"
    };

    const detectCommonPrefix = function (fileInformations) {
        return fileInformations.map(function (fileInformation) {
            return fileInformation.name;
        }).reduce(function (previousPrefix, name, index) {
            const splitName = name.split("/");
            if (splitName.length > 1) {
                const currentPrefix = splitName[0] + "/";
                if (currentPrefix === previousPrefix || index === 0) {
                    return currentPrefix;
                }
            }
            return "";
        }, "");
    };

    const removeCommonPrefix = function (fileInformations, commonPrefix) {
        if (!commonPrefix) {
            return;
        }
        const prefixLength = commonPrefix.length;
        fileInformations.forEach(function (fileInformation) {
            fileInformation.name = fileInformation.name.substr(prefixLength);
        });
    };


    const readerOnLoadPrepare = function (inputElement, length) {
        let loaded = 0;
        let maybePackageObject;
        let maybePackageString;
        let all = [];
        d.elements.fileProgress.hidden = false;
        d.elements.fileProgress.max = length;
        d.elements.fileProgress.value = 0;

        const tryResolve = function () {
            if (loaded < length) {
                d.elements.fileProgress.value = loaded;
                return;
            }
            d.elements.fileProgress.hidden = true;

            //all loaded
            all = all.filter(function (fileInformation) {//remove empty things
                return fileInformation.arrayBuffer.byteLength !== 0;
            });
            removeCommonPrefix(all, detectCommonPrefix(all));

            const files = {
                files: all
            };
            if (maybePackageObject) {
                files.package = {
                    packageString: maybePackageString,
                    packageObject: maybePackageObject
                };
            }
            inputElement.readFileResolve(files);
            inputElement.remove();
        };

        return {
            add : function (arrayBuffer, mime, name) {
                all.push({arrayBuffer, mime, name});
                loaded += 1;
                tryResolve();
            },
            addPackage: function (JSONstring, packageObject) {
                maybePackageString = JSONstring;
                maybePackageObject = packageObject;
                loaded += 1;
                tryResolve();
            }
        };

    };

    const addBlob = function (addBuffer, blob, mime, name) {
        /*addBuffer is from readerOnLoadPrepare*/
        if (isPackageDotJsonFromFileName(name)) {
            bytes.stringPromiseFromBlob(blob).then(function (string) {
                let packageObject;
                try {
                    packageObject = JSON.parse(string);
                } catch (error) {
                    packageObject = {};
                }
                addBuffer.addPackage(string, packageObject);
            });
        } else {
            bytes.arrayBufferPromiseFromBlob(blob).then(
                function (arrayBuffer) {
                addBuffer.add(arrayBuffer, mime, name);
            });
        }
    };

    const isZipFromFileName = function (fileName) {
        /* "*.zip" */
        if (fileName.length < 4) {
            return false;
        }
        const split = fileName.split(".");
        return (split[1] && split[1] === "zip");
    };

    const isPackageDotJsonFromFileName = function (fileName) {
        return fileName.includes("package.json");
    };

    const readFiles = function () {
        return new Promise(function (resolve, reject) {
            const fileInput = d.createElement2(fileInputDescription);
            fileInput.readFileResolve = resolve;
            fileInput.readFileReject = reject;
            d.activate(fileInput);
            d.elements.readFilesContainer.appendChild(fileInput);
            fileInput.click();
        });
    };

    const zipEntriesFromFileObject = function(fileObject) {
        return new Promise(function (resolve, reject) {
            zip.createReader(new zip.BlobReader(fileObject), function(zipReader) {
                zipReader.getEntries(resolve);
            }, reject);
        });
    };

    const getFileNameList = function () {
        return state.files.map(function (file) {
            return file.name;
        });
    };

    const ressourceFromRessourceName = function (fileName) {
        const file = state.files.find(function (file) {
            return file.name === fileName;
        });

        if (file === undefined) {
            return; // undefined
        }

        return {
            header: {
                "Content-Type": file[`mime`]
            },
            body: file[`body`]
        };
    };


    const start = function () {

        d.functions.xReadFileStart = function (event) {
            const fileList = event.target.files; // FileList object
            let onLoadBuffer = readerOnLoadPrepare(event.target, fileList.length);
            let fileObject;

            for (fileObject of fileList) {
                const mime = fileObject.type || "";
                const name = fileObject.name;
                //fileObject.size
                if (isZipFromFileName(name)) {
                    /*we assume there is only 1 zip uploaded at once*/
                    zipEntriesFromFileObject(fileObject).then(function(entries) {
                        onLoadBuffer = readerOnLoadPrepare(event.target, entries.length);
                        entries.forEach(function(entry) {
                            entry.getData(new zip.BlobWriter(), function (blob) {
                                addBlob(onLoadBuffer, blob, "", entry.filename);
                            });
                        });
                    }).catch(function (error) {
                        console.log(STRINGS.CANNOT_LOAD_ZIP + error, error);
                    });
                    return;
                }
                addBlob(onLoadBuffer, fileObject, mime, name);
            }
        };

        d.functions.removeRessource = function (event) {
            const context = d.contextFromEvent(event);
            const oldFile = state.files.find(function (oldFile) {
                return oldFile.uiLink === context;
            });
            yesNoDialog(`Remove "${oldFile.name}" ressource ?`, "Yes", "No, Cancel").then(function (answer) {
                if (answer) {
                    d.elements[d.contextFromArray([context, "baseEl"])].remove();
                    d.forgetContext(context);
                    state.files.splice(state.files.indexOf(oldFile), 1);
                }
            });
        };


            d.functions.rememberFileName = function (event) {
                const context = d.contextFromEvent(event);
                const oldFile = state.files.find(function (oldFile) {
                    return oldFile.uiLink === context;
                });
                oldFile.name = d.variables[d.contextFromArray([context, `fileName`])];
            };

            d.functions.rememberFileBody = function (event) {
                const context = d.contextFromEvent(event);
                const oldFile = state.files.find(function (oldFile) {
                    return oldFile.uiLink === context;
                });
                oldFile.body = d.variables[d.contextFromArray([context, `fileBody`])];
            };

            d.functions.rememberMime = function (event) {
                const context = d.contextFromEvent(event);
                const oldFile = state.files.find(function (oldFile) {
                    return oldFile.uiLink === context;
                });
                oldFile.mime = d.variables[d.contextFromArray([context, `fileMime`])];
            };

        let ressourceUiId = 0;
        d.functions.addRessource = function (event) {
            readFiles().then(function (files) {
                /*files = {
                    files: [array],
                    ?package: {object}
                }*/
                const oldFiles = state.files;
                const dialogs = [];
                files.files.forEach(function (fileObject) {
                    const {arrayBuffer, mime, name} = fileObject;
                    const oldFileWithSameName = oldFiles.find(function (oldFile) {
                            return oldFile.name === name;
                    });
                    if (oldFileWithSameName) {
                        /*todo add more options see FileSystem.md
                        do not process package.json before this is finished*/
                        dialogs.push(yesNoDialog(
                        `A ressource named "${name}" is already loaded. Overwrite old ressource with the new one ?`, "Yes, overwrite", "No, keep old"
                            ).then(function (answer) {
                            if (answer === true) {
                                const uiLink = oldFileWithSameName.uiLink;
                                d.elements[
                                    d.contextFromArray([uiLink, `fileBody`])
                                ].disabled = true;
                                d.feed(uiLink, {
                                    "fileBody" : STRINGS.FILE_LOADED,
                                    fileMime: mime
                                });
                                oldFileWithSameName.body = arrayBuffer;
                            } else if (answer === false) {
                                ;//do nothing
                            }
                        }));
                        return;
                    }
                    const ressourceUiIdString = FILE_INPUT_PREFIX + String(ressourceUiId);
                    ressourceUiId += 1;
                    //todo remove duplicate code

                    const fileInputElement = d.createElement2({
                        tagName: "file-input",
                        "data-inside": ressourceUiIdString
                    });

                    d.feed(ressourceUiIdString, {
                        "fileName" : name,
                        "fileBody" : STRINGS.FILE_LOADED,
                        fileMime: mime
                    });
                    d.activate(fileInputElement);
                    d.elements[d.contextFromArray([ressourceUiIdString, `fileBody`])].disabled = true;
                    state.files.push({
                        name,
                        body: arrayBuffer,
                        mime,
                        uiLink: ressourceUiIdString
                    })
                    d.elements.ressourcesContainer.appendChild(fileInputElement);
                });

                Promise.all(dialogs).then(function (notUsedValues) {
                    //console.log("package.json", files.package, (!files.package || !files.package.packageObject.serverinthebrowser));
                    if (!files.package || !files.package.packageObject.serverinthebrowser) {
                        return;
                    }
                    const serverinthebrowser = files.package.packageObject.serverinthebrowser;

                    console.log("serverinthebrowser field detected",                    serverinthebrowser);
                    const server = serverinthebrowser.server;
                    if (server) {
                        const serverArrayBuffer = ressourceFromRessourceName(server).body;
                        //console.log("serverArrayBuffer", serverArrayBuffer);
                        if (serverArrayBuffer) {
                            const serverString = bytes.stringFromArrayBuffer(serverArrayBuffer);
                            //console.log("serverString",serverString);
                            d.feed(`userCode`, serverString);
                            // console.log("d.variables.userCode",d.variables.userCode);
                        }
                    }
                });
            }).catch(function (reason) {
                d.feed(`log`, "Could not load file: " + reason);
            });
        };

        d.functions.addRessourceEmpty = function (event) {

            const ressourceUiIdString = FILE_INPUT_PREFIX + String(ressourceUiId);
            ressourceUiId += 1;

            const fileInputElement = d.createElement2({
                "tagName": "file-input",
                "data-inside": ressourceUiIdString
            });
            d.feed(ressourceUiIdString, {
                "fileName" : "",
                "fileBody" : "",
                fileMime: ""
            });
            d.activate(fileInputElement);
            d.elements.ressourcesContainer.appendChild(fileInputElement);
            state.files.push({
                name : ``,
                body: ``,
                mime: ``,
                uiLink: ressourceUiIdString
            });
        };


        d.functions.generateIndex = function (event) {
            const name = "index.html";
            const mime = "text/html";
            const fileNameList = getFileNameList();
            const indexHtmlString = generateIndex(fileNameList);

            const oldFileWithSameName = state.files.find(function (oldFile) {
                return oldFile.name === name;
            });
            if (oldFileWithSameName) {
                yesNoDialog(`"${name}" already exists. Overwrite it ?`, "Yes", "No, Cancel").then(function (answer) {
                    if (answer) {
                        const uiLink = oldFileWithSameName.uiLink;
                        d.elements[d.contextFromArray([uiLink, "fileBody"])].disabled = false;
                        d.feed(uiLink, {
                            "fileBody" : indexHtmlString,
                            fileMime: mime
                        });
                        oldFileWithSameName.body = indexHtmlString;
                        oldFileWithSameName.mime = mime;
                    }
                });
                return;
            }
            const ressourceUiIdString = FILE_INPUT_PREFIX + String(ressourceUiId);
            ressourceUiId += 1;

            const fileInputElement = d.createElement2({
                "tagName": "file-input",
                "data-inside": ressourceUiIdString
            });
            d.feed(ressourceUiIdString, {
                "fileName" : name,
                "fileBody" : indexHtmlString,
                fileMime: mime
            });
            d.activate(fileInputElement);
            d.elements.ressourcesContainer.appendChild(fileInputElement);
            state.files.push({
                name,
                body: indexHtmlString,
                mime,
                uiLink: ressourceUiIdString
            });
        };
    };

    const generateIndex = function (ressourceList) {
        const htmlLinks = ressourceList.filter(function (ressource) {
            return ressource !== "index.html";
        }).map(function (ressource) {
            return `<li><a href="${encodeURI(ressource)}">${ressource}</a></li>`;
        }).join("");
        const indexHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <title>Index</title>
  </head>
  <body>
  <h1><a href="">Index</a></h1>
  <ul>
  ${htmlLinks}
  </ul>
  </body>
</html>`;
        return indexHtml;
    };

     const contentTypeFromFileExtension = {
        "": "text/html",
        "html": "text/html",
        "css": "text/css",
        "js": "application/javascript",
        "json": "application/json"
    };

    const contentTypeFromRessourceName = function (ressourceName) {
        const parts = ressourceName.split(".");
        const lastPart = parts[parts.length - 1];
        return contentTypeFromFileExtension[lastPart.toLowerCase()] || "octet/stream";
    };

    return {
        ressourceFromRessourceName,
        start,
        contentTypeFromRessourceName
    };
}());
