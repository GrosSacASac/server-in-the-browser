//real time communication
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white, node, eval
*/
/*global
    caches
*/
/*could add close connection button*/
import {MESSAGES} from "./settings/messages.js";

import d from "../../node_modules/dom99/built/dom99Module.js";
import {yesNoDialog, textDialog} from "../../node_modules/dom99/components/yesNoDialog/yesNoDialog.js";
import rtc from "./rtc.js";
import uiFiles from "./uiFiles.js";
import localData from "./localData.js";
import {state} from "./state.js";
import serviceWorkerManager from "./serviceWorkerManager.js";
import {socketSendAction} from "./sockets.js";
import browserServer from "./built/browserserver_with_node_emulator_for_worker.js";
export { ui as default };

window.d = d;

const ui = (function () {
    const MAX_MESSAGES = 50;
    const UISTRINGS = {
        CONNECTING: "Connecting",
        CONNECTED: "Connected",
        SELECT: "Select",
        SELECTED: "Selected",
        CONNECT_SELECT: "Connect and select",
        BAD_ID_FORMAT: "The ID didn't match the following requirement. An ID is 4 to 25 characters long, and only etters from a to Z and digits from 0 to 9  are allowed.",
        ALREADY_TAKEN_REJECTED: "The ID is already taken. Chose another ID.",
        NAME_CHANGE_REQUEST_SENT: "The request to change the ID has been sent. Waiting for an answer.",
        ID_CHANGE_SUCCESS: "Your ID has been successfully changed."
    };

    const ifEnter = function (event) {
        /*returns true if it was not keydown event or enter pressed and shift not pressed*/
        return (!event ||
            !(event.type === "keydown") ||
            ((event.keyCode === 13) && (!event.shiftKey))
        );
    };

    let acceptConditionResolve = function () {};
    let wantToConnectTo = "";
    let uiIdStrings = [];
    const uiUserRelationState = {}; // 0: None 1 Connecting 2 Connected


    const markUserAsConnecting = function (selectedUserId) {
        const uiIdString = "user_" + selectedUserId;
        if (selectedUserId) {
            d.elements[`${uiIdString}>connectButton`].disabled = true;
            d.feed(`${uiIdString}>connectButton`, UISTRINGS.CONNECTING);
            uiUserRelationState[selectedUserId] = 1;
        }
    };

    const markUserAsConnected = function (selectedUserId, connected = true) {
    /*multiple connections can be open at once.
    It is only possible to select an user if it is connected, we need to reflect that*/
        const uiIdString = "user_" + selectedUserId;
        // console.log(selectedUserId);
        if (selectedUserId) {
            d.elements[`${uiIdString}>connectButton`].disabled = connected;
            d.elements[`${uiIdString}>selectButton`].disabled = !connected;
            d.elements[`${uiIdString}>selectButton`].hidden = !connected;
            if (connected) {
                d.feed(uiIdString, {
                    connectButton: UISTRINGS.CONNECTED,
                    selectButton: UISTRINGS.SELECT
                });
                uiUserRelationState[selectedUserId] = 2;
            } else {
                d.elements[`${uiIdString}>connectButton`].disabled = false;
                d.elements[`${uiIdString}>selectButton`].disabled = true;
                d.elements[`${uiIdString}>selectButton`].hidden = true;
                d.feed(uiIdString, {
                    connectButton: UISTRINGS.CONNECT_SELECT
                });
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

        toggleCommunicationControls(selectedUserId);

        state.uiIdStringLastSelected = "user_" + state.selectedUserId;
        state.lastSelectedUserId = state.selectedUserId;
        if (state.lastSelectedUserId) {

            // console.log("previously selected", state.selectedUserId);
            if (selected) {
                d.elements[`${state.uiIdStringLastSelected}>selectButton`].disabled = false;
                d.feed(`${state.uiIdStringLastSelected}>selectButton`, UISTRINGS.SELECT);
                d.elements[state.uiIdStringLastSelected + "host"].className = "";
            }

        } else {
            // console.log("previously nothing selected");
        }

        if (selected) {
            state.selectedUserId = selectedUserId;
            const uiIdString = "user_" + state.selectedUserId;
            d.elements[`${uiIdString}>selectButton`].disabled = true;
            d.feed(`${uiIdString}>selectButton`, UISTRINGS.SELECTED);
            d.elements[uiIdString + "host"].className = "active";

        } else {
            state.selectedUserId = "";
            const uiIdString = "user_" + selectedUserId;
            d.elements[`${uiIdString}>selectButton`].disabled = false;
            d.feed(`${uiIdString}>selectButton`, UISTRINGS.SELECT);
            d.elements[uiIdString + "host"].className = "";
        }
    };

    const selectAfterConnected = function (selectedUserId) {
        if (wantToConnectTo === selectedUserId) {
            markUserAsSelected(selectedUserId);
        }
    };

    const updateUserList = function (list) {
        /*we might need to see what connection we already have*/

        //console.log(format, removeSelf, list);
        const connected_users = list.map(function (user) {
            return user.displayedName;
        }).filter((displayedName) => displayedName !== state.localDisplayedName);

        //console.log(connected_users);
        d.elements.connected_users.innerHTML = "";
        uiIdStrings.forEach(function (uiIdString) {
            d.forgetContext(uiIdString);
        });
        uiIdStrings = [];
        connected_users.map(function (displayedName) {
            const uiIdString = "user_" + displayedName;
            uiIdStrings.push(uiIdString);

            const userItemElement = d.createElement2({
                "tagName": "li",
                "is": "user-item",
                "data-inside": uiIdString,
                "data-element": uiIdString + "host"
            });
            d.feed(d.contextFromArray([uiIdString, "userDisplayName"]), displayedName);
            d.activate(userItemElement);

            if (rtc.rtcPeerConnectionFromId.hasOwnProperty(displayedName) && rtc.isOpenFromDisplayName(displayedName)) {
                d.elements[uiIdString + "host"].className = "";

                d.feed(`${uiIdString}>connectButton`, UISTRINGS.CONNECTED);
                d.elements[`${uiIdString}>connectButton`].disabled = true;
                d.elements[`${uiIdString}>selectButton`].disabled = false;
                d.elements[`${uiIdString}>selectButton`].hidden = false;

            }
            if (uiUserRelationState[displayedName] === 1) {
                markUserAsConnecting(displayedName);
            }

            if (uiUserRelationState[displayedName] === 2) {
                markUserAsConnected(displayedName);
            }
            d.elements.connected_users.appendChild(userItemElement);
        });

        //cleanup disconnected users from uiUserRelationState
        Object.keys(uiUserRelationState).forEach(function (userId) {
            if (!connected_users.includes(userId)) {
                delete uiUserRelationState[userId];
            }
        });
        if (state.selectedUserId) {
            markUserAsSelected(state.selectedUserId);
        }

    };

    const toggleCommunicationControls = function (id) {
        const able = rtc.isOpenFromDisplayName(id);
        const hasIndex = state.connectedUsers.some(function (connectedUser) {
            return (connectedUser.id === id && connectedUser.isServer);
        });
        const notAble = !able;
        d.elements.send_button.disabled = notAble;
        d.elements.input.disabled = notAble;
        d.elements.indexLink.classList.toggle("disabled", !hasIndex);
    };

    const displayOwnUserId = function () {
        d.feed(`your_id`, state.localDisplayedName);
    };

    const displayFatalError = function (error, ...more) {
        d.feed(`log`, error);
        console.log(error);
        if (more && more.length > 0) {
            console.log(...more);
        }
    };

    const display = function (wantToDisplay) {
        displayLandingPage(!wantToDisplay);
        d.elements.main.hidden = !wantToDisplay;
        const previous = localData.get("state.localDisplayedName");
        if (previous) {
            d.feed(`newName`, previous);
            d.functions.idChangeRequest();
        }
        d.feed(`log`, "");

    };

    const displayLandingPage = function (wantToDisplay = true) {
        d.elements.landingPage.hidden = !wantToDisplay;
        d.feed(`log`, "");
        return new Promise(function (resolve, reject) {
            acceptConditionResolve = resolve;
        });
    };

    const serverLog = function (any) {
        d.feed(`serverLog`, d.variables.serverLog + "\n" + JSON.stringify(any));
        console.log(any);
    };

    let displayNonMetRequirement = function (nonMetRequirement) {
        d.activate();
        let i = 0;
        const splitTextContentHref = function (link) {
            return {innerHTML: `<a href="${link}" target="_blank" rel="noopener noreferrer">${link}</a>`};
        };
        Object.keys(nonMetRequirement).forEach(function (technicalName) {
            i += 1;
            const iString = `i${i}`;
            const requirementI = nonMetRequirement[technicalName]

            const missingFeatureElement = d.createElement2({
                "tagName": "missing-feature",
                "data-inside": iString
            });

            d.feed(iString, {
                title : technicalName,
                text : requirementI.text,
                links: requirementI.links.map(splitTextContentHref)
            });

            d.activate(missingFeatureElement);
            d.elements.missingFeatures.appendChild(missingFeatureElement);
        });
    };

    const start = function () {
        uiFiles.start();
        d.functions.acceptAndStart = function (event) {
            acceptConditionResolve();
            display(true);
            localData.set(MESSAGES.CONDITION_ACCEPTED, "true");

        };

        d.functions.changeCustom = function (event) {

            const wantedToUseCustom = d.variables.useCustom;

            if (wantedToUseCustom) {
                d.feed(`useCustom`, false);
                d.feed(`parsingResult`, "Stopped while editing !");
                rtc.useHandleRequestCustom(false);
                browserServer.close();
            }
        };

        d.functions.warnBeforeLeaveChange = function (event) {
            console.log(d.variables.warnBeforeLeave);
            localData.set("warnBeforeLeave", d.variables.warnBeforeLeave);
            //todo display change saved
        };

        d.functions.wantNotificationChange = function (event) {
            // todo also handle the case where the user changes the setting in the browser ui (call the notification contructor, if it is dis
            // notificationEnabled = false
            const wantNotification = d.variables.wantNotification;
            let feedBackText;

            if (wantNotification) {
                if (!("Notification" in window)) {
                    feedBackText = "This browser does not support desktop notification, or this option has been disabled";
                    state.notificationEnabled = false;
                    localData.set("notifications", notificationEnabled);
                    d.feed(`wantNotification`, notificationEnabled);
                } else {

                    if (Notification.permission === "granted") {
                        feedBackText = "Notifications enabled";
                        state.notificationEnabled = true;
                        localData.set("notifications", state.notificationEnabled);
                    } else {
                        feedBackText = "Waiting for autorization";
                        d.feed(`wantNotification`, false);
                        Notification.requestPermission(function (permission) {
                            if (permission === "granted") {
                                state.notificationEnabled = true;
                                localData.set("notifications", state.notificationEnabled);
                                d.feed(`wantNotificationFeedBack`, "Notifications enabled");
                                d.feed(`wantNotification`, state.notificationEnabled);
                            } else {
                                d.feed(`wantNotificationFeedBack`, "Notifications access denied");
                                state.notificationEnabled = false;
                                localData.set("notifications", state.notificationEnabled);
                            }
                        });
                    }
                }
            } else {
                feedBackText = "Notifications disabled";
                state.notificationEnabled = false;
                localData.set("notifications", state.notificationEnabled);
            }
            d.feed(`wantNotificationFeedBack`, feedBackText);
        };


        d.functions.useCustom = function (event) {
            /*USE custom index.js as the pseudo server*/

            const wantToUseCustom = d.variables.useCustom;

            if (wantToUseCustom) {
                browserServer.setBrowserServerCode(d.variables.userCode);
                browserServer.run().then(function () {
                    d.elements.parsingResult.classList.toggle("error", false);
                    d.feed(`parsingResult`, "Successfully parsed");
                    rtc.useHandleRequestCustom(true);
                }).catch(lateReject);
            } else {
                browserServer.close();
                rtc.useHandleRequestCustom(false);
            }

        };

        d.functions.sendMessage = function (event) {
            if (!ifEnter(event)) {
                return;
            }
            rtc.sendRtcMessage(state.selectedUserId, d.variables.input);
            displayMessage(`You to ${state.selectedUserId}:  ${d.variables.input}`);
            d.feed(`input`, "");
            event.preventDefault();
        };

        d.functions.connectToUser = function (event) {
            const selectedUserName = d.variables[d.contextFromArray([d.contextFromEvent(event), "userDisplayName"])];
            markUserAsConnecting(selectedUserName);
            const selectedUserId = state.connectedUsers.find(function (user) {
                return user.displayedName = selectedUserName;
            });
            wantToConnectTo = selectedUserId;
            rtc.startConnectionWith(true, selectedUserId);
            //when connected will call markUserAsSelected
        };

        d.functions.selectUser = function (event) {
            const selectedUserId = d.variables[d.contextFromArray([d.contextFromEvent(event), "userDisplayName"])];
            //wantToConnectTo = selectedUserId;
            markUserAsSelected(selectedUserId);
        };

        d.functions.debug = function (event) {
            const a = 5;
            d.feed(`log`, a);
            console.log(a);
        };

        d.functions.idChangeRequest = function (event) {
            if (!ifEnter(event)) {
                return;
            }
            const PATTERN = /[a-zA-Z0-9]{4,25}/;
            const newId = d.variables.newName;
            const length = newId.length;
            if (!PATTERN.test(newId)) {
                d.feed(`idChangeFeedback`, UISTRINGS.BAD_ID_FORMAT);
                return;
            }
            socketSendAction(MESSAGES.NAME_CHANGE_REQUEST, {
                newName: newId
            });
            d.feed(`idChangeFeedback`, UISTRINGS.NAME_CHANGE_REQUEST_SENT);
            d.elements.idChangeRequestButton.disabled = true;
            d.elements.newName.disabled = true;
        };

        d.functions.changeLocalServerAvailability = function (event) {
        //todo needs server confirmation ? not important
            socketSendAction(MESSAGES.LOCAL_SERVER_STATE, {
                displayedName: state.localDisplayedName,
                isServer: d.variables.localServerAvailability
            });
        };

        d.functions.deleteAll = function (event) {
            yesNoDialog(`Delete all local data and quit ?`, "Yes", "No, Cancel").then(function (answer) {
                if (answer) {
                    localData.clearAll();
                    serviceWorkerManager.deleteServiceWorker();
                    /*also
                    close all webrtc connection
                    close websocket
                    */
                    d.feed(`warnBeforeLeave`, false);
                    caches.keys().then(function (cacheVersions) {
                        return Promise.all(
                            cacheVersions.map(function (cacheVersion) {
                                return caches.delete(cacheVersion);
                            })
                        );
                    }).then(function (notUsed) {
                        location.href = location.href + "quit";
                    });
                }
            });
        };
        const removeAndForget = function (elementName) {
            d.elements[elementName].remove();
            d.forgetContext(elementName);
        };
        displayNonMetRequirement = undefined;

        d.feed({
            log: "Starting ...",
            input: "",
            output: "",
            newName: "",
            warnBeforeLeave: localData.getElseDefault("warnBeforeLeave", false),
            wantNotification: localData.getElseDefault("notifications", state.notificationEnabled)
        });
        d.functions.wantNotificationChange();
        d.feed({
            useCustom: false,
            your_id: "not yet connected",
            localServerAvailability: false,
            userCode: `const http = require("http");
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
    `
        });

        d.activate();
        removeAndForget("missingFeatures");
        removeAndForget("missingFeatureTemplate");

    };

    const messageElementList = [];
    const displayMessage = function (text) {
        const beforeLastMessageCopyElement = document.createElement("p");
        beforeLastMessageCopyElement.textContent = d.variables.lastMessage;
        d.elements.allButLastMessages.appendChild(beforeLastMessageCopyElement);
        messageElementList.push(beforeLastMessageCopyElement);
        d.feed(`lastMessage`, text);
        if (messageElementList.length > MAX_MESSAGES) {
            messageElementList.shift().remove();
        }
    };

    const handleMessage = function (headerBodyObject, fromId) {
        displayMessage(`From ${fromId}:  ${headerBodyObject.body}`);
        return; // undefined
    };

    const handleChangeIdResponse = function (message, data) {
        if (message === MESSAGES.NAME_CHANGE || message === MESSAGES.CONFIRM_ID_CHANGE) {
            const {newId, oldId} = data;
            const newName = newId;
            state.connectedUsers.some(function (userObject) {
                if (userObject.displayedName === oldId) {
                    userObject.displayedName = newName;
                    return true;
                }
            });
            if (message === MESSAGES.CONFIRM_ID_CHANGE) {

                state.localDisplayedName = newName;
                localData.set("state.localDisplayedName", newName);
                d.feed({
                    newName: "",
                    your_id: newName,
                    idChangeFeedback: UISTRINGS.ID_CHANGE_SUCCESS
                });

            } else if (message === MESSAGES.NAME_CHANGE) {
                rtc.userIdChange(oldId, newName);
                updateUserList(state.connectedUsers);
                return;

            }
        } else if (message === MESSAGES.BAD_ID_FORMAT_REJECTED) {
            d.feed(`idChangeFeedback`, UISTRINGS.BAD_ID_FORMAT);
        } else if (message === MESSAGES.ALREADY_TAKEN_REJECTED) {
            d.feed(`idChangeFeedback`, UISTRINGS.ALREADY_TAKEN_REJECTED);
        }
        d.elements.idChangeRequestButton.disabled = false;
        d.elements.newName.disabled = false;
    };

    const lateReject = function (reason) {
        /*error in the worker, that handles requests, see browserserver.js
        browserServer has been  closed with browserServer.close() at this point*/
        d.elements.parsingResult.classList.toggle("error", true);
        d.feed(`parsingResult`, reason);
        d.feed(`useCustom`, false);
        rtc.useHandleRequestCustom(false);

    };

    return {
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
    };
}());
