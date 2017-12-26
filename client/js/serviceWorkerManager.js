/*serviceWorkerManager.js
lives on the main thread
registers service_worker.js
todo listen to the events and make the app active/not active accordingly
*/
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white
*/
/*global
    navigator
*/

// true means maybe
const serviceWorkerSupport = (
    window.navigator &&
    window.navigator.serviceWorker && 
    window.navigator.serviceWorker.register
);

serviceWorkerManager = (function () {
    let serviceWorkerRegistration;
    const register = function () {
        if (!serviceWorkerSupport) {
            return false;
        }
        //const options = {scope: "./"};
        navigator.serviceWorker.register("/service_worker").then(
            function(registrationObject) {
                serviceWorkerRegistration = registrationObject;
                //console.log("service worker installed success!", registration);
        }).catch(
            function(reason) {
                console.error("service worker could not install:", reason);
            }
        );

        navigator.serviceWorker.addEventListener("message", function(event) {
            const message = event.data;
            
            if (message.hasOwnProperty("LOG")) {
                ui.serverLog(message.LOG);
                return;
            }
            
            const requestObject = message;
            const ressource = requestObject.header.ressource;
            rtc.rtcRequest(requestObject).then(function (answer) {
                //console.log("We have answer for", ressource, " answer", answer);
                navigator.serviceWorker.controller.postMessage({
                    ressource, //is the key, todo change and give internal id
                    answer
                });
            });
        });
        
        navigator.serviceWorker.addEventListener("activate", function(event) {
            console.log("serviceWorker: activate", location.origin);
        });
        
        navigator.serviceWorker.addEventListener("controllerchange", function(event) {
            console.log("serviceWorker: controllerchange");
        });
        return true;//success
    };

    const deleteServiceWorker = function () {
        if (!serviceWorkerSupport) {
            return;
        }
        if (navigator.serviceWorker.getRegistrations) {
            navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                    registration.unregister().then(function(event) {
                        console.log("serviceWorker: unregistered", event);
                    });
                }
            });
        } else if (navigator.serviceWorker.getRegistration) {
            // not plural
            navigator.serviceWorker.getRegistration().then(function(registration) {
                if (registration) {
                    registration.unregister().then(function(event) {
                        console.log("serviceWorker: unregistered", event);
                    });
                }
            });
        }
        
        // this could fail to remove something not yet active
        // serviceWorkerRegistration.unregister().then(function(event) {
            // console.log("serviceWorker: unregistered", event);
        // });
    };
    
    
    const start = function () {
        if (!register()) {
            ui.displayFatalError("Service worker must be enabled");
        }
    };
    
    return {
        start,
        deleteServiceWorker
    };
}());
