/*uiFiles.js*/
/*jslint
    es6, maxerr: 15, browser, devel, fudge, maxlen: 100
*/
/*global
    FileReader, Promise, D
*/
/*we can then send data as arrayBuffer 
*/
uiFiles = (function () {

    const ressourceContentFromElement = new WeakMap();
    const fileNameFromKey = {}; 
    
    const STRINGS = {
        CANNOT_LOAD_ZIP: "Could not load zip: ",
        FILE_LOADED: "file loaded"
    };
    
    const fileInputDescription = {
        "tagName": "input",
        "type": "file",
        "data-fx": "xReadFileStart",
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
        D.el.fileProgress.hidden = false;
        D.el.fileProgress.max = length;
        D.el.fileProgress.value = 0;
        
        const tryResolve = function () {
            if (loaded < length) {
                D.el.fileProgress.value = loaded;
                return;
            }
            D.el.fileProgress.hidden = true;
            
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
            const fileInput = D.createElement2(fileInputDescription);
            fileInput.readFileResolve = resolve;
            fileInput.readFileReject = reject;
            D.linkJsAndDom(fileInput);
            D.el.readFilesContainer.appendChild(fileInput);
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

    const keyFromFileName = function (fileName) {
        return keyFromObjectAndValue(fileNameFromKey, fileName);
    };

    const getFileNameList = function () {
        return Object.values(fileNameFromKey);
    };

    const ressourceFromRessourceName = function (fileName) {
        // console.log(fileName);
        const key = keyFromFileName(fileName)
        if (!D.vr.hasOwnProperty(key)) {
            return; // undefined
        }

        return {
            header: {
                "Content-Type": D.vr[key].fileMime
            },
            body: ressourceContentFromElement.get(D.el[key].fileBody) ||
                    D.vr[key].fileBody
        };
    };


    const start = function () {

        D.fx.xReadFileStart = function (event) {
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

        D.fx.removeRessource = function (event) {
            const key = event.dKeys[0];
            yesNoDialog(`Remove "${fileNameFromKey[key]}" ressource ?`, "Yes", "No, Cancel").then(function (answer) {
                if (answer) {
                    event.dHost.remove();
                    delete fileNameFromKey[key];
                    D.forgetKey(event.dKeys);
                }
            });
        };

        D.fx.rememberFileName = function (event) {
            const key = event.dKeys[0];
            fileNameFromKey[key] =  D.followPath(D.vr, event.dKeys).fileName;
        };

        let ressourceUiId = 0;
        D.fx.addRessource = function (event) {
            readFiles().then(function (files) {
                /*files = {
                    files: [array],
                    ?package: {object}
                }*/
                const oldFileNames = getFileNameList();
                const dialogs = [];
                files.files.forEach(function (fileObject) {
                    const {arrayBuffer, mime, name} = fileObject;
                    if (oldFileNames.includes(name)) {
                        /*todo add more options see FileSystem.md
                        do not process package.json before this is finished*/
                        dialogs.push(yesNoDialog(
                        `A ressource named "${name}" is already loaded. Overwrite old ressource with the new one ?`, "Yes, overwrite", "No, keep old"
                            ).then(function (answer) {
                            if (answer === true) {
                                const key = keyFromFileName(name)
                                D.vr[key].fileBody = STRINGS.FILE_LOADED;
                                D.el[key].fileBody.disabled = true;
                                ressourceContentFromElement.set(D.el[key].fileBody, arrayBuffer);
                                D.vr[key].fileMime = mime;
                            } else if (answer === false) {
                                ;//do nothing
                            }
                        }));
                        return;
                    }
                    const ressourceUiIdString = "ressource_" + String(ressourceUiId);
                    ressourceUiId += 1;
                    //todo remove duplicate code
                    
                    const fileInputElement = D.createElement2({
                        "tagName": "file-input",
                        "data-in": ressourceUiIdString
                    });
                    D.vr = {
                        [ressourceUiIdString]: {
                            "fileName" : name,
                            "fileBody" : STRINGS.FILE_LOADED,
                            fileMime: mime
                        }
                    };
                    D.linkJsAndDom(fileInputElement);
                    D.el[ressourceUiIdString].fileBody.disabled = true;
                    //D.el[ressourceUiIdString].fileBody.classList.toggle("hiddenvalue", true);
                    ressourceContentFromElement.set(
                        D.el[ressourceUiIdString].fileBody,
                        arrayBuffer
                    );
                    D.el.ressourcesContainer.appendChild(fileInputElement);
                    D.fx.rememberFileName({dKeys:[ressourceUiIdString]});
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
                            D.vr.userCode = serverString;
                            // console.log("D.vr.userCode",D.vr.userCode);
                        }
                    }
                });
            }).catch(function (reason) {
                D.vr.log = "Could not load file: " + reason;
            });
        };
        
        D.fx.addRessourceEmpty = function (event) {
        
            const ressourceUiIdString = "ressource_" + String(ressourceUiId);
            ressourceUiId += 1;
            
            const fileInputElement = D.createElement2({
                "tagName": "file-input",
                "data-in": ressourceUiIdString
            });
            D.vr = {
                [ressourceUiIdString]: {
                    "fileName" : "",
                    "fileBody" : "",
                    fileMime: ""
                }
            };
            D.linkJsAndDom(fileInputElement);
            D.el.ressourcesContainer.appendChild(fileInputElement);
        };
        
        
        D.fx.generateIndex = function (event) {
            const name = "index.html";
            const mime = "text/html";
            const fileNameList = getFileNameList();
            const indexHtmlString = generateIndex(fileNameList);
            
            if (ressourceFromRessourceName(name)) {
                yesNoDialog(`"${name}" already exists. Overwrite it ?`, "Yes", "No, Cancel").then(function (answer) {
                    if (answer) {
                        const key = keyFromFileName(name)
                        D.vr[key].fileBody = indexHtmlString;
                        D.el[key].fileBody.disabled = false;
                        D.vr[key].fileMime = mime;
                        ressourceContentFromElement.delete(D.el[key].fileBody);
                    }
                });
            } else {
                const ressourceUiIdString = "ressource_" + String(ressourceUiId);
                ressourceUiId += 1;
                
                const fileInputElement = D.createElement2({
                    "tagName": "file-input",
                    "data-in": ressourceUiIdString
                });
                D.vr = {
                    [ressourceUiIdString]: {
                        "fileName" : name,
                        "fileBody" : indexHtmlString,
                        fileMime: mime
                    }
                };
                D.linkJsAndDom(fileInputElement);
                D.el.ressourcesContainer.appendChild(fileInputElement);
                D.fx.rememberFileName({dKeys:[ressourceUiIdString]});
            }
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
