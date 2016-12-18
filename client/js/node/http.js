/*Response class already exists, could we use it need more research*/
module.exports = (function () {
    const Response2 = {};
    
    Response2.setHeader = function (response2Object, key, value) {
        response2Object.response.header[key] = value;
    };    
    
    Response2.end = function (response2Object, text) {
        response2Object.response.body = text;
        respondToRequest(response2Object.response);
    };
    
    const normalizeFileName = function (fileName) {
        if (fileName.startsWith("/")) {
            return fileName.substr(1);
        }
        return fileName;
    };
    
    Response2.create = function (options) {
        const response2Object = {
            response: {
                header: {
                    "Content-Type": "text/plain",
                    status:  200,
                    statusText : "OK"
                },
                body: "",
                internalId: options.internalId
            },
            setHeader: function (key, value) {
                Response2.setHeader(response2Object, key, value);
            },
            end: function (text) {
                Response2.end(response2Object, text);
            },
            sendFile: function (fileName) {
                //console.log("sendfile called");
                readStaticFile(normalizeFileName(fileName)).then(function (customFileObject) {
                    //console.log("readStaticFile.then body:", customFileObject.body);
                    response2Object.response.header["Content-Type"] = customFileObject["Content-Type"] || "text/plain";
                    //console.log("sendfile", response2Object.response);
                    Response2.end(response2Object, customFileObject.body);
                }).catch(function (reason) {
                    Response2.end(response2Object, `${fileName}: Error ${reason}`);
                });
                
            }
        };
        
        Object.defineProperty(response2Object, "statusCode", {
            get: function () {
                return response2Object.response.status;
            },
            set: function (status) {
                response2Object.response.header.status = status;
                return status
            },
            enumerable: true,
            configurable: false
        });
        
        return response2Object;
    };
    
    const listenInternal = function (handler) {
        listenForRequest(function (headerBodyObject) {
            const request = headerBodyObject;
            const response = Response2.create(request);
            handler(request, response);
        });
    };
    
    const Server = function (requestListener) {
        if (!(this instanceof Server)) {
            return new Server(requestListener);
        }

        return {
            listen: function () {
                let handler;
                if (requestListener.handler) {
                    handler = requestListener.handler;
                } else {
                    handler = requestListener;
                }
                listenInternal(handler);
            }
        };
        
    };
    
    const createServer = function (handleFunction) {
        return {
            listen: function (port, hostname, callback) {
                listenInternal(handleFunction);
                callback();
            }
        };
    };
    
    return {
        createServer,
        Server
    };
}());
