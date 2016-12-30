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


serviceWorkerManager = (function () {
    let serviceWorkerRegistration;
    const register = function () {
        if (!navigator.serviceWorker) {
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
        if (!serviceWorkerRegistration) {
            return;
        }
        serviceWorkerRegistration.unregister().then(function(hasBeenUnregistered) {
            ;//
        });
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
