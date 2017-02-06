//launcher.js
(function () {
    if (window.test) {
        //console.log("test");
        return;
    }
    /*API evaluation to detect missing features, 
    use window. to use the wanted Error flow
    See RTCPeerConnection*/
    const minimumRequirement = {
        "Service Worker": {
            API: navigator.serviceWorker,
            text: "Service Worker must be enabled. Service Worker cannot be used in private browsing mode.",
            links: ["https://duckduckgo.com/?q=how+to+enable+service+worker"]
        },
        WebRTC: {
            API: window.RTCPeerConnection,
            text: "WebRTC must be enabled.",
            links: ["https://duckduckgo.com/?q=how+to+enable+webrtc"]
        }
    };

    

    const checkRequirements = function (requirement) {
        /**/
        let nonMet = false;
        const nonMetRequirement = {};
        Object.keys(requirement).forEach(function (technicalName) {
            if (!requirement[technicalName].API) {
                nonMet = true;
                nonMetRequirement[technicalName] = requirement[technicalName];
            }
        });
        if (nonMet) {
            return nonMetRequirement;
        }
        return false;
    };
    
    const nonMetRequirement = checkRequirements(minimumRequirement);
    if (nonMetRequirement) {
        ui.displayNonMetRequirement(nonMetRequirement);
        return; // cannot start
    }
    ui.start();

    const accepted = localData.get(MESSAGES.CONDITION_ACCEPTED);
    
    const startServiceWorkerAndSockets = function () {
        serviceWorkerManager.start();
        sockets.start();
        window.addEventListener("beforeunload", function (event) {
            /*https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload
            if the setting warnBeforeLeave is true
            then we prompt user if really want to leave
            https://html.spec.whatwg.org/#the-beforeunloadevent-interface says to use
            preventDefault but it does not work in a test*/
            if (D.vr.warnBeforeLeave) {
                const message = "Are you sure you want to leave ?";
                /*if (event.preventDefault) {
                    const answer = prompt("Are you sure you want to leave ?");
                    if (answer) {
                        event.preventDefault();
                    }
                } else {*/
                    event.returnValue = message;
                    return message;
                /*}*/
            } else {
                ; // do not warn before leaving
            }
        }, false);
        window.addEventListener("unload", function (event) {
            /*not necessary but better*/
            sockets.socket.emit(MESSAGES.EXIT, 
                {}
            );
        }, false);
        window.addEventListener("error", function (event) {
            console.log(event);
            if (event.stopPropagation) {
                event.stopPropagation();
            }
            if (event.preventDefault) {
                event.preventDefault();
            }
        }, false);
        
        const updateOnLineState = function (event) {
            if (!notificationEnabled) {
                return;
            }
            isOnLine = navigator.onLine;
            let text;
            if (isOnLine) {
                text = "Connected to the network";
            } else {
                text = "Not connected to the network";
            }
            const onLineNotification = new Notification("Online Status", {
                body: text,
                tag: "onLine",
                noscreen: true /* don't force turn on screen*/
            });
            setTimeout(onLineNotification.close.bind(onLineNotification), MAX_NOTIFICATION_TIME); 
        };
        window.addEventListener("online", updateOnLineState);
        window.addEventListener("offline", updateOnLineState);
    };
    if (accepted) {
        startServiceWorkerAndSockets();
        ui.display(true);
    } else {
        ui.displayLandingPage(true).then(startServiceWorkerAndSockets);
    }
}());
