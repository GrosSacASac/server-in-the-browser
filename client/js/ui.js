//real time communication
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white, node, eval
*/
/*global
    ui, D, R, rtc, sockets, MESSAGES, localDisplayedName,
*/
/*could add close connection button*/
ui = (function () {
    const API = {
        selectedUserId : ""
    };
    const MAX_MESSAGES = 50;
    const UISTRINGS = {
        CONNECTING: "Connecting",
        CONNECTED: "Connected",
        SELECT: "Select",
        SELECTED: "Selected",
        CONNECT_SELECT: "Connect and select",
        BAD_ID_FORMAT: "The ID didn't match the following requirement. An ID is 4 to 25 characters long, and only etters from a to Z and digits from 0 to 9  are allowed.",
        ALREADY_TAKEN_REJECTED: "The ID is already taken. Chose another ID.",
        ID_CHANGE_REQUEST_SENT: "The request to change the ID has been sent. Waiting for an answer.",
        ID_CHANGE_SUCCESS: "Your ID has been successfully changed."
    };
    
    let acceptConditionResolve = function () {};
    let wantToConnectTo = "";
    let uiIdStrings = [];
    const uiUserRelationState = {}; // 0: None 1 Connecting 2 Connected
    
    
    const markUserAsConnecting = function (selectedUserId) {   
        const uiIdString = "user_" + selectedUserId;     
        if (selectedUserId && D.el[uiIdString]) {
            D.el[uiIdString].connectButton.disabled = true;
            D.vr[uiIdString].connectButton = UISTRINGS.CONNECTING;
            uiUserRelationState[selectedUserId] = 1;
        }
    };
    
    const markUserAsConnected = function (selectedUserId, connected = true) {
    /*multiple connections can be open at once.
    It is only possible to select an user if it is connected, we need to reflect that*/
        const uiIdString = "user_" + selectedUserId;
        if (selectedUserId && D.el[uiIdString]) {
            D.el[uiIdString].connectButton.disabled = connected;
            D.el[uiIdString].selectButton.disabled = !connected;
            D.el[uiIdString].selectButton.hidden = !connected;
            if (connected) {
                D.vr[uiIdString].connectButton = UISTRINGS.CONNECTED;
                D.vr[uiIdString].selectButton = UISTRINGS.SELECT;
                uiUserRelationState[selectedUserId] = 2;
            } else {
                D.el[uiIdString].connectButton.disabled = false;
                D.el[uiIdString].selectButton.disabled = true;
                D.el[uiIdString].selectButton.hidden = true;
                D.vr[uiIdString].connectButton = UISTRINGS.CONNECT_SELECT;
                uiUserRelationState[selectedUserId] = 0;
            
            }
        }
    };
    
    const markUserAsSelected = function (selectedUserId, selected = true) {
        /*only 1 can be selected at a time*/
        if (uiUserRelationState[selectedUserId] !== 2) {
            //non connected, means we cannot select it
            selected = false;
        }
        const uiIdString = "user_" + selectedUserId;
        const uiIdStringLastSelected = "user_" + API.selectedUserId;

        if (selected) {
            if (API.selectedUserId && D.el[uiIdStringLastSelected]) {
                D.el[uiIdStringLastSelected].selectButton.disabled = false;
                D.vr[uiIdStringLastSelected].selectButton = UISTRINGS.SELECT;
                D.el[uiIdStringLastSelected + "host"].className = "";
            }
            
            if (selectedUserId && D.el[uiIdString]) {
                D.el[uiIdString].selectButton.disabled = true;
                D.vr[uiIdString].selectButton = UISTRINGS.SELECTED;
                D.el[uiIdString + "host"].className = "active";
            }
            
            API.selectedUserId = selectedUserId;
            toggleCommunicationControls(selectedUserId);
        } else {
            if (selectedUserId && D.el[uiIdString]) {
                D.el[uiIdString].selectButton.disabled = false;
                D.vr[uiIdString].selectButton = UISTRINGS.SELECT;
                D.el[uiIdString + "host"].className = "";
            }
        }
    };
    
    const selectAfterConnected = function (selectedUserId) {
        if (wantToConnectTo === selectedUserId) {
            markUserAsSelected(selectedUserId);
        }
    };
    
    const updateUserList = function (list) {
        /*we might need to see what connection we already have*/
        const removeSelf = R.filter((displayedName) => displayedName !== localDisplayedName);
        const format = R.map(function (user) {
            return user.displayedName;
        });
        
        //console.log(format, removeSelf, list);
        const connected_users = R.pipe(format , removeSelf)(list);
        
        //console.log(connected_users);
        D.el.connected_users.innerHTML = "";
        uiIdStrings.forEach(function (uiIdString) {
            D.forgetKey(uiIdString);
        });
        uiIdStrings = [];
        connected_users.map(function (displayedName) {
            const uiIdString = "user_" + displayedName;
            uiIdStrings.push(uiIdString);
            
            const userItemElement = D.createElement2({
                "tagName": "li",
                "is": "user-item",
                "data-in": uiIdString,
                "data-el": uiIdString + "host"
            });
            /*D.vr = {
                [uiIdString]: {
                    userDisplayName : displayedName
                }
            };*/
            D.vr[uiIdString] = {
                userDisplayName : displayedName
            };
            D.linkJsAndDom(userItemElement);
            
            if (rtc.rtcPeerConnectionFromId.has(displayedName) && rtc.isOpenFromDisplayName(displayedName)) {
                D.el[uiIdString + "host"].className = "";
                D.el[uiIdString].connectButton.disabled = true;
                D.vr[uiIdString].connectButton = "Connected";
                D.el[uiIdString].selectButton.disabled = false;
                D.el[uiIdString].selectButton.hidden = false;
                
            }
            if (uiUserRelationState[displayedName] === 1) {
                markUserAsConnecting(displayedName);
            }
            
            if (uiUserRelationState[displayedName] === 2) {
                markUserAsConnected(displayedName);
            }
            D.el.connected_users.appendChild(userItemElement);
        });
        
        //cleanup disconnected users from uiUserRelationState
        Object.keys(uiUserRelationState).forEach(function (userId) {
            if (!connected_users.includes(userId)) {
                delete uiUserRelationState[userId];
            }
        });
        if (API.selectedUserId) {
            markUserAsSelected(API.selectedUserId);
        }
        
    };

    const toggleCommunicationControls = function (displayName) {        
        const able = rtc.isOpenFromDisplayName(displayName);
        const hasIndex = rtc.connectedUsers.some(function (connectedUser) {
            return (connectedUser.displayedName === displayName && connectedUser.isServer);
        });
        const notAble = !able;
        D.el.send_button.disabled = notAble;
        D.el.input.disabled = notAble;
        D.el.indexLink.classList.toggle("disabled", !hasIndex);
    };
          
    const displayOwnUserId = function () {
        D.vr.your_id = localDisplayedName;
    };
    
    const displayFatalError = function (error, ...more) {
        D.vr.log = error;
        console.log(error);
        if (more && more.length > 0) {
            console.log(...more);
        }
    };
    
    const display = function (wantToDisplay) {
        displayLandingPage(!wantToDisplay);
        D.el.main.hidden = !wantToDisplay;
        const previous = localData.get("localDisplayedName");
        if (previous) {
            D.vr.newId = previous;
            D.fx.idChangeRequest();
        }
        D.vr.log = "";
        
    };
    
    const displayLandingPage = function (wantToDisplay = true) {
        D.el.landingPage.hidden = !wantToDisplay;
        D.vr.log = "";
        return new Promise(function (resolve, reject) {
            acceptConditionResolve = resolve;
        });
    };
    
    const serverLog = function (any) {
        D.vr.serverLog += "\n" + JSON.stringify(any);
        console.log(any);
    };
    
    const displayNonMetRequirement = function (nonMetRequirement) {
        D.linkJsAndDom();
        let i = 0;
        const splitTextContentHref = function (link) {
            return {textContent: link, href: link, target:"_blank"};
        };
        Object.keys(nonMetRequirement).forEach(function (technicalName) {
            i += 1;
            const iString = "i" + String(i);
            const requirementI = nonMetRequirement[technicalName]
            
            const missingFeatureElement = D.createElement2({
                "tagName": "missing-feature",
                "data-in": iString
            });

            D.vr = {
                [iString]: {
                    title : technicalName,
                    text : requirementI.text,
                    links: requirementI.links.map(splitTextContentHref)/*ul > a ? not good*/
                }
            };
            D.linkJsAndDom(missingFeatureElement);
            D.el.missingFeatures.appendChild(missingFeatureElement);
        });
    };
    
    const start = function () {
        D.linkJsAndDom();
        uiFiles.start();
        
        D.vr.log = "Starting ...";
        D.el.input.disabled = true;
        D.el.send_button.disabled = true;
        D.vr.input = "";
        D.vr.output = "";
        D.vr.newId = "";
        D.vr.useCustom = false;
        D.vr.your_id = "not yet connected";
        D.vr.localServerAvailability = false;
        //needs to be same as handleRequestDefault
        D.vr.userCode = `const http = require("http");
const hostname = "127.0.0.1";
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("Hello World\\n");
});

server.listen(port, hostname, () => {
  console.log(\`Server running at http://\${hostname}:\${port}/\`);
});
`;

        D.fx.acceptAndStart = function (event) {
            acceptConditionResolve();
            display(true);
            localData.set(MESSAGES.CONDITION_ACCEPTED, "true");

        };
        
        D.fx.changeCustom = function (event) {
                    
            const wantedToUseCustom = D.bool(D.vr.useCustom);
            
            if (wantedToUseCustom) {
                D.vr.useCustom = false;
                D.vr.parsingResult = "Stopped while editing !";
                rtc.useHandleRequestCustom(false);
                browserServer.close();
            }
        };

        D.fx.useCustom = function (event) {
            /*USE custom index.js as the pseudo server*/
            
            const wantToUseCustom = D.bool(D.vr.useCustom);
            
            if (wantToUseCustom) {
                browserServer.setBrowserServerCode(D.vr.userCode);
                browserServer.run().then(function () {
                    D.el.parsingResult.classList.toggle("error", false);
                    D.vr.parsingResult = "Successfully parsed";
                    rtc.useHandleRequestCustom(true);
                }).catch(lateReject);
            } else {
                browserServer.close();
                rtc.useHandleRequestCustom(false);
            }
            
        };

        D.fx.sendMessage = function (event) {
            rtc.sendRtcMessage(API.selectedUserId, D.vr.input);
            displayMessage(`You to ${API.selectedUserId}:  ${D.vr.input}`);
            D.vr.input = "";
        };

        D.fx.connectToUser = function (event) {
            const selectedUserId = D.followPath(D.vr, event.dKeys).userDisplayName;
            markUserAsConnecting(selectedUserId);
            wantToConnectTo = selectedUserId;
            rtc.startConnectionWith(true, selectedUserId);
            //when connected will call markUserAsSelected   
        };

        D.fx.selectUser = function (event) {
            const selectedUserId = D.followPath(D.vr, event.dKeys).userDisplayName;
            //wantToConnectTo = selectedUserId;
            markUserAsSelected(selectedUserId);
        };

        D.fx.debug = function (event) {
            const a = 5;
            D.vr.log = a;
            console.log(a);
        };
        
        D.fx.idChangeRequest = function (event) {
            /*min="4" max="25" pattern="[a-zA-Z0-9]+"*/
            const MIN = 4;
            const MAX = 25;
            const PATTERN = /[a-zA-Z0-9]{4,25}/;
            const newId = D.vr.newId;
            const length = newId.length;
            if (length < MIN || length > MAX || !PATTERN.test(newId)) {
                D.vr.idChangeFeedback = UISTRINGS.BAD_ID_FORMAT;
                return;
            }
            sockets.requestIdChange(newId);
            D.vr.idChangeFeedback = UISTRINGS.ID_CHANGE_REQUEST_SENT;
            D.el.idChangeRequestButton.disabled = true;
            D.el.newId.disabled = true;
        };
    
        D.fx.changeLocalServerAvailability = function (event) {
        //todo needs server confirmation ? not important
            sockets.socket.emit(MESSAGES.LOCAL_SERVER_STATE, {
                displayedName: localDisplayedName,
                isServer: D.bool(D.vr.localServerAvailability)
            });
        };

        D.fx.deleteAll = function (event) {
            yesNoDialog(`Delete all local data and quit ?`, "Yes", "No, Cancel").then(function (answer) {
                if (answer) {
                    localData.clearAll();
                    serviceWorkerManager.deleteServiceWorker();
                    /*also
                    close all webrtc connection
                    close websocket
                    uninstall service worker
                    */
                    location.href = location.href + "quit";
                }
            });
        };
        
        
        
        
    };
    
    const messageElementList = [];
    const displayMessage = function (text) {
        const beforeLastMessageCopyElement = document.createElement("p");
        beforeLastMessageCopyElement.textContent = D.vr.lastMessage;
        D.el.allButLastMessages.appendChild(beforeLastMessageCopyElement);
        messageElementList.push(beforeLastMessageCopyElement);
        D.vr.lastMessage = text;
        if (messageElementList.length > MAX_MESSAGES) {
            messageElementList.shift().remove();
        }
    };
    
    const handleMessage = function (headerBodyObject, fromId) {
        displayMessage(`From ${fromId}:  ${headerBodyObject.body}`);
        return; // undefined
    };
    
    const handleChangeIdResponse = function (message, data) {
        if (message === MESSAGES.USER_ID_CHANGE || message === MESSAGES.CONFIRM_ID_CHANGE) {
            const {newId, oldId} = data;
            rtc.connectedUsers.some(function (userObject) {
                if (userObject.displayedName === oldId) {
                    userObject.displayedName = newId;
                    return true;
                }
            });
            if (message === MESSAGES.CONFIRM_ID_CHANGE) {
            
                D.vr.newId = "";
                D.vr.your_id = newId;
                localDisplayedName = newId;
                D.vr.idChangeFeedback = UISTRINGS.ID_CHANGE_SUCCESS;
                localData.set("localDisplayedName", newId);
                
            } else if (message === MESSAGES.USER_ID_CHANGE) {
                if (wantToConnectTo === oldId) {
                    wantToConnectTo = newId;
                }
                if (API.selectedUserId === oldId) {
                    API.selectedUserId = newId;
                }
                if (uiUserRelationState[oldId]) {
                    uiUserRelationState[newId] = uiUserRelationState[oldId];
                    delete uiUserRelationState[oldId];
                }
                rtc.userIdChange(oldId, newId);
                updateUserList(rtc.connectedUsers);
                return;
                
            }
        } else if (message === MESSAGES.BAD_ID_FORMAT_REJECTED) {
            D.vr.idChangeFeedback = UISTRINGS.BAD_ID_FORMAT;
        } else if (message === MESSAGES.ALREADY_TAKEN_REJECTED) {
            D.vr.idChangeFeedback = UISTRINGS.ALREADY_TAKEN_REJECTED;
        }
        D.el.idChangeRequestButton.disabled = false;
        D.el.newId.disabled = false;
    };
    
    const lateReject = function (reason) {
        /*error in the worker, that handles requests, see browserserver.js
        browserServer has been  closed with browserServer.close() at this point*/
        D.vr.useCustom = false;
        D.el.parsingResult.classList.toggle("error", true);
        D.vr.parsingResult = reason;
        rtc.useHandleRequestCustom(false);

    };
    
    Object.assign(API, {
        start,
        updateUserList,
        displayOwnUserId,
        displayFatalError,
        display,
        displayLandingPage,
        markUserAsConnected,
        markUserAsSelected,
        selectAfterConnected,
        serverLog,
        handleMessage,
        handleChangeIdResponse,
        displayNonMetRequirement,
        lateReject
    });
    
    return API;
}());
