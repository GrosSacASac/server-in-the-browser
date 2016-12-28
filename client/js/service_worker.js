/*service_worker.js
todo fix undefined behaviour if there is more than 1 client (active window), client claim
todo fix, the page gets old js files sometimes, because they are loaded before the new
todo see if service worker timeout can cause bugs 
*/
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white
*/
/*global
    self, fetch, caches, Response, Request, Header, 
*/
/*
a service worker is a special kind of program, it cannot be included with a <script> tag, 
search for service worker on mdn for more info
service worker simplified lifecycle
install or register
activate (if there is an old active, wait)
service worker is active
idle
fetch
... idle
... terminated after 30 sec-- awake when needed

https://heycam.github.io/webidl/#es-ByteString
*/

"use strict";

const version = "2.0.23"; // update if this file changes todo make run build do useless ?
const latestCacheVersion = version; // update if the cache files change
//const ressourcesToSaveInCache = ["/"];
const HOME = "/";
const OFFLINE_ALTERNATIVE = "/offline";
/*see server/serve.js staticFileFromUrl variable*/
const ressourcesToSaveInCache = [
    OFFLINE_ALTERNATIVE,
    "/favicon.png",
    "/css",
    "/doc.css",
    "/about",
    "/help",
    "/open_source",
    "/offline",
    "/quit",
    "/z-worker.js",
    "/inflate.js",
    /*not sure if we let this stay here or move it closer to the application layer*/
    "/http",
    "/express",
    "/body-parser",
    "/socket.io"
];
const rtcLength = 4; // "rtc/".length; 
const rtcFetchDelay = 10000;//ms
const origin = location.origin;
const answerFromRessource = {};
const resolveFromRessource = {};
const rejectFromRessource = {};
const timeOutIdFromRessource = {};
// todo put all into single container

const resolveAskPageForRessource = function (ressource) {
    clearTimeout(timeOutIdFromRessource[ressource]);
    resolveFromRessource[ressource](answerFromRessource[ressource]);
    delete answerFromRessource[ressource];//stop listening
    delete resolveFromRessource[ressource];
    delete rejectFromRessource[ressource];
};

const rejectAskPageForRessource = function (ressource, reason) {
    if (rejectFromRessource[ressource]) {
        rejectFromRessource[ressource](reason);
        delete resolveFromRessource[ressource];
        delete rejectFromRessource[ressource];
    }
};

const askPageForRessource = function (customRequestObject) {
    /*asks all page for a ressource*/

    const ressource = customRequestObject.header.ressource;

    const promise = new Promise(function (resolve, reject) {
        resolveFromRessource[ressource] = resolve;
        rejectFromRessource[ressource] = reject;
        if (answerFromRessource.hasOwnProperty(ressource)) {
            resolveAskPageForRessource(ressource);
        }
        timeOutIdFromRessource[ressource] = setTimeout(function() {
            rejectAskPageForRessource(ressource, "No answer after 10 seconds");
        }, rtcFetchDelay);
    });
    
    self.clients.matchAll().then(function(clientList) {
        clientList.forEach(function(client) {
            client.postMessage(customRequestObject);
        });
    });
    return promise;
};

const isLocalURL = function (url) {
    return !(String(url).match("rtc"));
};


self.addEventListener("install", function (event) {
    // save in cache some static ressources
    event.waitUntil(
        caches.open(latestCacheVersion).then(function(cache) {
            return cache.addAll(ressourcesToSaveInCache);
        }).then(function() {
            //console.log("[ServiceWorker] Skip waiting on install caches:", caches);
            return self.skipWaiting();
        })
    );
});

self.addEventListener("activate", function (event) {
    //delete old cache versions if necessary
    event.waitUntil(
        caches.keys().then(function (cacheVersions) {
            return Promise.all(
                cacheVersions.map(function (cacheVersion) {
                    if (latestCacheVersion === cacheVersion) {
                        //console.log("No change in cache");
                    } else {
                        //console.log("New version of cache, delete old");
                        return caches.delete(cacheVersion);          
                    }
                })
            );
        })
    );
});

self.addEventListener("message", function (event) {
    const message = event.data;
    /*
    if (message.hasOwnProperty("FUTURE")) {
        console.log(message.FUTURE);
        return;
    }
    */
    const ressource = message.ressource;
    const answer = message.answer;
    answerFromRessource[ressource] = answer;
    //console.log(ressource, answer, resolveFromRessource);
    if (resolveFromRessource.hasOwnProperty(ressource)) {//
        resolveAskPageForRessource(ressource);
    }
});

self.addEventListener("fetch", function (fetchEvent) {
    /* fetchEvent interface FetchEvent
    see https://www.w3.org/TR/service-workers/#fetch-event-interface
    IMPORTANT: fetchEvent.respondWith must be called inside this handler immediately 
    syncronously fetchEvent.respondWith must be called with a response object or a 
    promise that resolves with a response object. if fetchEvent.respondWith is called 
    later in a callback the browser will take over and asks the remote server directly, do not do that
    */
    const request = fetchEvent.request;//Request implements Body;
    const url = request.url;
    // Needs to activate to handle fetch
    if (isLocalURL(url)) {
        //Normal Fetch
        fetchEvent.respondWith(
            caches.match(request).then(function (response) {

                //console.log(request, url);
                if (response) {
                    // We have it in the cache
                    return response;
                }
                // We don't have it in the cache, fetch it
                return fetch(request).then(function (fetchResponse) {
                    if (fetchResponse) {
                        return fetchResponse;
                    }
                }).catch(function (reason) {
                    if ((origin + HOME) === url) {
                        //if it is the landing page that is asked
                        return caches.match(new Request(OFFLINE_ALTERNATIVE));
                        //todo if we are offline , siplay /offline directly
                    }
                    throw new Error(reason);
                });
            })
        );
        return;
    }
    //Special Fetch
    //console.log(version, "rtc fetch" url:", fetchEvent.request.url);
    // request, url are defined 
    const method = request.method;
    const requestHeaders = request.headers;

    const customRequestObject = {
        header: {
            ressource: url.substring(url.indexOf("rtc/") + rtcLength),
            method
        },
        body: ""
    };
    requestHeaders.forEach(function (value, key) {
        //value, key correct order
        //is there a standard way to use Object.assign with Map like iterables ?
        //todo handle duplicates
        //https://fetch.spec.whatwg.org/#terminology-headers            
        customRequestObject.header[key] = value;
    });

    //console.log(request);
    fetchEvent.respondWith(
        /*should provide the peer the full request*/
        request.arrayBuffer().then(function (bodyAsArrayBuffer) {
            const bodyUsed = request.bodyUsed;
            if (bodyUsed && bodyAsArrayBuffer) {
                customRequestObject.body = bodyAsArrayBuffer;
            }
        }).catch(function (reason) {
            /*console.log("no body sent, a normal GET or HEAD request has no body", 
            reason);*/
        }).then(function (notUsed) {
            return askPageForRessource(customRequestObject);
        }).then(function (response) {
            const responseInstance = new Response(response.body, {
                headers: response.header,
                status: response.header.status || 200,
                statusText : response.header.statusText || "OK"
            });
            
            return responseInstance;
        }).catch(function (error) {
            const responseInstance = new Response(`<html><p>${error}</p></html>`,
                {
                headers: {
                    "Content-type": "text/html"
                },
                status: 500,
                statusText : "timedout"
            });
            
            return responseInstance;
        })
    );
});
