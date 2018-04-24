/*service_worker.js
todo fix undefined behaviour if there is more than 1 client (active window),
todo the page gets old js files sometimes, because they are loaded before the new --> client claim
todo see if service worker time-outs can cause bugs

todo how to update the cache with just 1 or 2 files an not do a request for things that didn't change. Concat css and js files still a good practice, for first visit always, but do some research for later visits with cache invalidation so that not everything has to be reloaded


todo split file in 2 files, service_worker_common.js and my_service_worker.js,


a service worker is a special kind of program, it cannot be included with a <script> tag,

service worker simplified life-cycle
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
    maxerr: 100, browser, devel, fudge, maxlen: 120, white
*/
/*global
    self, fetch, caches, Response, Request, Header,
*/


"use strict";

const SERVICE_WORKER_VERSION = "0.20.38"; // updated with tools/service_worker_version.js (String)
const CACHE_VERSION = SERVICE_WORKER_VERSION;
//const fileNamesToSaveInCache = ["/"];
const HOME = "/";
const OFFLINE_ALTERNATIVE = "/offline";
/*see server/serve.js staticFileFromUrl variable*/
const fileNamesToSaveInCache /* for dev don't use cache */ = [];
const fileNamesToSaveInCacheProd = [
    /*"/", not included to enable the offline page support to appear,
    todo change mechanism*/
    OFFLINE_ALTERNATIVE,
    "/all-external.js",
    "/app",
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
    "/body-parser"
];
const rtcLength = 4; // "rtc/".length;
const rtcFetchDelay = 10000;//ms
const origin = location.origin;
const answerFromfileName = {};
const resolveFromfileName = {};
const rejectFromfileName = {};
const timeOutIdFromfileName = {};
let logLater = [];
// todo put all into single container

const resolveFetchFromPeerToPeer = function (fileName) {
    clearTimeout(timeOutIdFromfileName[fileName]);
    resolveFromfileName[fileName](answerFromfileName[fileName]);
    delete answerFromfileName[fileName];//stop listening
    delete resolveFromfileName[fileName];
    delete rejectFromfileName[fileName];
};

const rejectFetchFromPeerToPeer = function (fileName, reason) {
    if (rejectFromfileName[fileName]) {
        rejectFromfileName[fileName](reason);
        delete resolveFromfileName[fileName];
        delete rejectFromfileName[fileName];
    }
};

const fetchFromPeerToPeer = function (customRequestObject) {
    /*asks all page for a fileName*/

    const fileName = customRequestObject.header.fileName;

    const promise = new Promise(function (resolve, reject) {
        resolveFromfileName[fileName] = resolve;
        rejectFromfileName[fileName] = reject;
        if (answerFromfileName.hasOwnProperty(fileName)) {
            resolveFetchFromPeerToPeer(fileName);
        }
        timeOutIdFromfileName[fileName] = setTimeout(function() {
            rejectFetchFromPeerToPeer(fileName, "No answer after 10 seconds");
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
    //console.log("logInTheUI function exists");
    return function (what) {
        console.log(what);
        self.clients.matchAll().then(function(clientList) {
            clientList.forEach(function(client) {
                client.postMessage({LOG: JSON.parse(JSON.stringify(what))});
            });
        });
    };
}());

const logInTheUIWhenActivated = function (what) {
    logLater.push(what);
};

const fetchFromMainServer = function (request, options = {}) {
    /*wrap over fetch. The problem with fetch here, it doesn't reject properly sometimes
    see if statement below*/
    return fetch(request, options).then(function (fetchResponse) {
        // console.log("fetchFromMainServer:", fetchResponse.ok, fetchResponse);
        // logInTheUI([request, options]);
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

const fillServiceWorkerCache2 = function () {
    /*It will not cache and also not reject for individual resources that failed to be added in the cache. unlike fillServiceWorkerCache which stops caching as soon as one problem occurs. see http://stackoverflow.com/questions/41388616/what-can-cause-a-promise-rejected-with-invalidstateerror-here*/
    return caches.open(CACHE_VERSION).then(function (cache) {
        return Promise.all(
            fileNamesToSaveInCache.map(function (url) {
                return cache.add(url).catch(function (reason) {
                    return logInTheUIWhenActivated([url + "failed: " + String(reason)]);
                });
            })
        );
    });
};

const latePutToCache = function (request, response) {
    return caches.open(CACHE_VERSION).then(function(cache) {
        cache.put(request, response.clone());
        return response;
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

const isAppPage = function (url) {
    /*appPage does not work offline, and we don't serve it if offline
    returns Boolean*/
    return (origin + HOME) === url;
};

self.addEventListener("install", function (event) {
    /*the install event can occur while another service worker is still active

    waitUntil blocks the state (here installing) of the service worker until the
    promise is fulfilled (resolved or rejected). It is useful to make the service worker more readable and more deterministic

    save in cache some static fileNames
    this happens before activation */
    event.waitUntil(
        fillServiceWorkerCache2()
        .then(skipWaiting)
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
    const fileName = message.fileName;
    const answer = message.answer;
    answerFromfileName[fileName] = answer;
    //console.log(fileName, answer, resolveFromfileName);
    if (resolveFromfileName.hasOwnProperty(fileName)) {//
        resolveFetchFromPeerToPeer(fileName);
    }
});

self.addEventListener("fetch", function (fetchEvent) {
    /* fetchEvent interface FetchEvent
    see https://www.w3.org/TR/service-workers/#fetch-event-interface
    IMPORTANT: fetchEvent.respondWith must be called inside this handler immediately
    synchronously fetchEvent.respondWith must be called with a response object or a
    promise that resolves with a response object. if fetchEvent.respondWith is called
    later in a callback the browser will take over and asks the remote server directly, do not do that

    why have fetchEvent.respondWith( and not respond with the return value of the callback function ?
    -->
    It allows to do other thing before killing the service worker, like saving stuff in cache
    */
    const request = fetchEvent.request;//Request implements Body;
    //const requestClone = request.clone(); //no need to clone ?
    const url = request.url;
    if (logLater) {
        logLater.forEach(logInTheUI);
        logLater = undefined;
    }
    // logInTheUI(["fetch service worker " + SERVICE_WORKER_VERSION, fetchEvent]);
    // Needs to activate to handle fetch
    if (isLocalURL(url)) {
        //Normal Fetch

        if (request.method === "POST") {
            // logInTheUI(["POST ignored", request]);
            return;
        }

        // logInTheUI(["Normal Fetch"]);
        fetchEvent.respondWith(
            fetchFromCache(request.clone()).then(function (cacheResponse) {
                /* cannot use request again from here, use requestClone */
                //console.log(request, url);
                return cacheResponse;
            }).catch(function (reason) {
                // We don't have it in the cache, fetch it
                // logInTheUI(fetchEvent);
                return fetchFromMainServer(request);
            }).then(function (mainServerResponse) {
                if (isAppPage(url)) {
                    return mainServerResponse;
                }
                return latePutToCache(request, mainServerResponse).catch(
                    function (reason) {
                        /*failed to put in cache do not propagate catch, not important enough*/
                        return mainServerResponse;
                    }
                );

            }).catch(function (reason) {
                if (isAppPage(url)) {
                    //if it is the landing page that is asked
                    return useOfflineAlternative();
                    //todo if we are offline , display /offline directly
                }
                return Promise.reject(reason);
            })
        );
    } else {
        // Peer to peer Fetch
        //console.log(SERVICE_WORKER_VERSION, "rtc fetch" url:", fetchEvent.request.url);
        // request, url are defined
        const method = request.method;
        const requestHeaders = request.headers;

        //logInTheUI(["Special Fetch"]);
        const customRequestObject = {
            header: {
                fileName: url.substring(url.indexOf("rtc/") + rtcLength),
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

    /*here we could do more with event.waitUntil()*/
});
