/*service_worker.js
todo fix undefined behaviour if there is more than 1 client (active window), client claim
todo fix, the page gets old js files sometimes, because they are loaded before the new
todo see if service worker timeout can cause bugs 


todo maybe swtich to µWS in the future

todo split file in 2 files, service_worker_common.js and my_service_worker.js, 
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
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white
*/
/*global
    self, fetch, caches, Response, Request, Header, 
*/


"use strict";

const SERVICE_WORKER_VERSION = "3.0.1"; // update if this file changes todo make run build do useless ?
const CACHE_VERSION = SERVICE_WORKER_VERSION; // update if the cache files change
//const ressourcesToSaveInCache = ["/"];
const HOME = "/";
const OFFLINE_ALTERNATIVE = "/offline";
/*see server/serve.js staticFileFromUrl variable*/
const ressourcesToSaveInCache = [
    /*"/", not included to enable the offline page support to appear, 
    todo change mechanism*/
    OFFLINE_ALTERNATIVE,
    "app",
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

const resolveFetchFromPeerToPeer = function (ressource) {
    clearTimeout(timeOutIdFromRessource[ressource]);
    resolveFromRessource[ressource](answerFromRessource[ressource]);
    delete answerFromRessource[ressource];//stop listening
    delete resolveFromRessource[ressource];
    delete rejectFromRessource[ressource];
};

const rejectFetchFromPeerToPeer = function (ressource, reason) {
    if (rejectFromRessource[ressource]) {
        rejectFromRessource[ressource](reason);
        delete resolveFromRessource[ressource];
        delete rejectFromRessource[ressource];
    }
};

const fetchFromPeerToPeer = function (customRequestObject) {
    /*asks all page for a ressource*/

    const ressource = customRequestObject.header.ressource;

    const promise = new Promise(function (resolve, reject) {
        resolveFromRessource[ressource] = resolve;
        rejectFromRessource[ressource] = reject;
        if (answerFromRessource.hasOwnProperty(ressource)) {
            resolveFetchFromPeerToPeer(ressource);
        }
        timeOutIdFromRessource[ressource] = setTimeout(function() {
            rejectFetchFromPeerToPeer(ressource, "No answer after 10 seconds");
        }, rtcFetchDelay);
    });
    
    self.clients.matchAll().then(function(clientList) {
        clientList.forEach(function(client) {
            client.postMessage(customRequestObject);
        });
    });
    return promise;
};

const logInTheUI = (function () {
    console.log("logInTheUI function exists");
    return function (what) {
        self.clients.matchAll().then(function(clientList) {
            clientList.forEach(function(client) {
                client.postMessage({LOG: what});
            });
        });
    };
}());

const fetchFromMainServer = function (request, options = {}) {
    /*wrap over fetch. The problem with fetch here, it doesn't reject properly sometimes
    see if statement below*/
    return fetch(request, options).then(function (fetchResponse) {
        // console.log("fetchFromMainServer:", fetchResponse.ok, fetchResponse);
        if ((!fetchResponse) || (!fetchResponse.ok)) {
            return Promise.reject("fetch failed");
        }
        return fetchResponse;
    });
};


const fetchFromCache = function (request) {
    return caches.open(CACHE_VERSION).then(function (cache) {
        return cache.match(request).then(function (CacheResponse) {
            //console.log("fetchFromCache:", CacheResponse.ok, CacheResponse);
            if ((!CacheResponse) || (!CacheResponse.ok)) {
                return Promise.reject("Not in Cache");
            }
            return CacheResponse;
        });
    });
};

const isLocalURL = function (url) {
    return !(String(url).match("rtc"));
};

const fillServiceWorkerCache = function () {
    /* save in cache some static ressources 
    this happens before activation */
    return caches.open(CACHE_VERSION).then(function(cache) {
        return cache.addAll(ressourcesToSaveInCache);
    });
};

const deleteServiceWorkerOldCache = function () {
    return caches.keys().then(function (cacheVersions) {
        return Promise.all(
            cacheVersions.map(function (cacheVersion) {
                if (CACHE_VERSION === cacheVersion) {
                    //console.log("No change in cache");
                } else {
                    //console.log("New SERVICE_WORKER_VERSION of cache, delete old");
                    return caches.delete(cacheVersion);          
                }
            })
        );
    });
};
const useOfflineAlternative = function () {
    return fetchFromCache(new Request(OFFLINE_ALTERNATIVE));
};

self.addEventListener("install", function (event) {
    /*the install event can occur while another service worker is still active
    
    waitUntil blocks the state (here installing) of the service worker until the 
    promise is fulfilled (resolved or rejected). It is useful to make the service worker more readable and more deterministic*/
    event.waitUntil(
        fillServiceWorkerCache()
        .then(skipWaiting)
        .catch(skipWaiting)
    );
});

self.addEventListener("activate", function (event) {
    /* about to take over, other service worker are killed after activate, syncronous
    a good moment to clear old cache*/
    event.waitUntil(deleteServiceWorkerOldCache().then(function() {
        //console.log("[ServiceWorker] Skip waiting on install caches:", caches);
        return self.clients.claim();
    }));
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
        resolveFetchFromPeerToPeer(ressource);
    }
});

self.addEventListener("fetch", function (fetchEvent) {
    /* fetchEvent interface FetchEvent
    see https://www.w3.org/TR/service-workers/#fetch-event-interface
    IMPORTANT: fetchEvent.respondWith must be called inside this handler immediately 
    syncronously fetchEvent.respondWith must be called with a response object or a 
    promise that resolves with a response object. if fetchEvent.respondWith is called 
    later in a callback the browser will take over and asks the remote server directly, do not do that
    
    why have fetchEvent.respondWith( and not respond with the return value of the callback function ?
    -->
    It allows to do other thing before killing the service worker, like saving stuff in cache
    */
    const request = fetchEvent.request;//Request implements Body;
    const requestClone = request.clone();//Request implements Body;
    const url = request.url;
    logInTheUI(["fetch"]);
    // Needs to activate to handle fetch
    if (isLocalURL(url)) {
        //Normal Fetch

        logInTheUI(["Normal Fetch"]);
        fetchEvent.respondWith(
            fetchFromCache(request).then(function (cacheResponse) {
                /* cannot use request again from here, use requestClone */
                //console.log(request, url);
                return cacheResponse;
            }).catch(function (reason) {
                // We don't have it in the cache, fetch it
                return fetchFromMainServer(requestClone);
            }).then(function (mainServerResponse) {
                return mainServerResponse;
            }).catch(function (reason) {
                if ((origin + HOME) === url) {
                    //if it is the landing page that is asked
                    return useOfflineAlternative();
                    //todo if we are offline , siplay /offline directly
                }
                return Promise.reject(reason);
            })
        );
    } else {
        //Special Fetch
        //console.log(SERVICE_WORKER_VERSION, "rtc fetch" url:", fetchEvent.request.url);
        // request, url are defined 
        const method = request.method;
        const requestHeaders = request.headers;

        logInTheUI(["Special Fetch"]);
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
                return fetchFromPeerToPeer(customRequestObject);
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
    }
});
