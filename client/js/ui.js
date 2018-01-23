//real time communication
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white, node, eval
*/
/*global
    ui, d, rtc, sockets, MESSAGES, state.localDisplayedName, caches
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
import sockets from "./sockets.js";
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
        ID_CHANGE_REQUEST_SENT: "The request to change the ID has been sent. Waiting for an answer.",
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
            d.feed(UISTRINGS.CONNECTING, `${uiIdString}>connectButton`);
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
                d.feed({
                    connectButton: UISTRINGS.CONNECTED,
                    selectButton: UISTRINGS.SELECT
                }, uiIdString);
                uiUserRelationState[selectedUserId] = 2;
            } else {
                d.elements[`${uiIdString}>connectButton`].disabled = false;
                d.elements[`${uiIdString}>selectButton`].disabled = true;
                d.elements[`${uiIdString}>selectButton`].hidden = true;
                d.feed({
                    connectButton: UISTRINGS.CONNECT_SELECT
                }, uiIdString);
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
                d.feed(UISTRINGS.SELECT, `${state.uiIdStringLastSelected}>selectButton`);
                d.elements[state.uiIdStringLastSelected + "host"].className = "";
            }

        } else {
            // console.log("previously nothing selected");
        }

        if (selected) {
            state.selectedUserId = selectedUserId;
            const uiIdString = "user_" + state.selectedUserId;
            d.elements[`${uiIdString}>selectButton`].disabled = true;
            d.feed(UISTRINGS.SELECTED, `${uiIdString}>selectButton`);
            d.elements[uiIdString + "host"].className = "active";

        } else {
            state.selectedUserId = "";
            const uiIdString = "user_" + selectedUserId;
            d.elements[`${uiIdString}>selectButton`].disabled = false;
            d.feed(UISTRINGS.SELECT, `${uiIdString}>selectButton`);
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
            d.feed(displayedName, d.contextFromArray([uiIdString, "userDisplayName"]));
            d.activate(userItemElement);

            if (rtc.rtcPeerConnectionFromId.has(displayedName) && rtc.isOpenFromDisplayName(displayedName)) {
                d.elements[uiIdString + "host"].className = "";

                d.feed(UISTRINGS.CONNECTED, `${uiIdString}>connectButton`);
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

    const toggleCommunicationControls = function (displayName) {
        const able = rtc.isOpenFromDisplayName(displayName);
        const hasIndex = rtc.connectedUsers.some(function (connectedUser) {
            return (connectedUser.displayedName === displayName && connectedUser.isServer);
        });
        const notAble = !able;
        d.elements.send_button.disabled = notAble;
        d.elements.input.disabled = notAble;
        d.elements.indexLink.classList.toggle("disabled", !hasIndex);
    };

    const displayOwnUserId = function () {
        d.feed(state.localDisplayedName, `your_id`);
    };

    const displayFatalError = function (error, ...more) {
        d.feed(error, `log`);
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
            d.feed(previous, `newId`);
            d.functions.idChangeRequest();
        }
        d.feed("", `log`);

    };

    const displayLandingPage = function (wantToDisplay = true) {
        d.elements.landingPage.hidden = !wantToDisplay;
        d.feed("", `log`);
        return new Promise(function (resolve, reject) {
            acceptConditionResolve = resolve;
        });
    };

    const serverLog = function (any) {
        d.feed(d.variables.serverLog + "\n" + JSON.stringify(any), `serverLog`);
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
            const iString = "i" + String(i);
            const requirementI = nonMetRequirement[technicalName]

            const missingFeatureElement = d.createElement2({
                "tagName": "missing-feature",
                "data-inside": iString
            });

            d.feed({
                title : technicalName,
                text : requirementI.text,
                links: requirementI.links.map(splitTextContentHref)
            }, `iString`);

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
                d.feed(false, `useCustom`);
                d.feed("Stopped while editing !", `parsingResult`);
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
                    d.feed(notificationEnabled, `wantNotification`);
                } else {

                    if (Notification.permission === "granted") {
                        feedBackText = "Notifications enabled";
                        state.notificationEnabled = true;
                        localData.set("notifications", state.notificationEnabled);
                    } else {
                        feedBackText = "Waiting for autorization";
                        d.feed(false, `wantNotification`);
                        Notification.requestPermission(function (permission) {
                            if (permission === "granted") {
                                state.notificationEnabled = true;
                                localData.set("notifications", state.notificationEnabled);
                                d.feed("Notifications enabled", `wantNotificationFeedBack`);
                                d.feed(state.notificationEnabled, `wantNotification`);
                            } else {
                                d.feed("Notifications access denied", `wantNotificationFeedBack`);
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
            d.feed(feedBackText, `wantNotificationFeedBack`);
        };


        d.functions.useCustom = function (event) {
            /*USE custom index.js as the pseudo server*/

            const wantToUseCustom = d.variables.useCustom;

            if (wantToUseCustom) {
                browserServer.setBrowserServerCode(d.variables.userCode);
                browserServer.run().then(function () {
                    d.elements.parsingResult.classList.toggle("error", false);
                    d.feed("Successfully parsed", `parsingResult`);
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
            d.feed("", `input`);
            event.preventDefault();
        };

        d.functions.connectToUser = function (event) {
            const selectedUserId = d.variables[d.contextFromArray([d.contextFromEvent(event), "userDisplayName"])];
            markUserAsConnecting(selectedUserId);
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
            d.feed(a, `log`);
            console.log(a);
        };

        d.functions.idChangeRequest = function (event) {
            if (!ifEnter(event)) {
                return;
            }
            const PATTERN = /[a-zA-Z0-9]{4,25}/;
            const newId = d.variables.newId;
            const length = newId.length;
            if (!PATTERN.test(newId)) {
                d.feed(UISTRINGS.BAD_ID_FORMAT, `idChangeFeedback`);
                return;
            }
            sockets.requestIdChange(newId);
            d.feed(UISTRINGS.ID_CHANGE_REQUEST_SENT, `idChangeFeedback`);
            d.elements.idChangeRequestButton.disabled = true;
            d.elements.newId.disabled = true;
        };

        d.functions.changeLocalServerAvailability = function (event) {
        //todo needs server confirmation ? not important
            sockets.socket.emit(MESSAGES.LOCAL_SERVER_STATE, {
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
                    d.feed(false, `warnBeforeLeave`);
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
            newId: "",
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
        d.feed(text, `lastMessage`);
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

                state.localDisplayedName = newId;
                localData.set("state.localDisplayedName", newId);
                d.feed({
                    newId: "",
                    your_id: newId,
                    idChangeFeedback: UISTRINGS.ID_CHANGE_SUCCESS
                });

            } else if (message === MESSAGES.USER_ID_CHANGE) {
                if (wantToConnectTo === oldId) {
                    wantToConnectTo = newId;
                }
                if (state.selectedUserId === oldId) {
                    state.selectedUserId = newId;
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
            d.feed(UISTRINGS.BAD_ID_FORMAT, `idChangeFeedback`);
        } else if (message === MESSAGES.ALREADY_TAKEN_REJECTED) {
            d.feed(UISTRINGS.ALREADY_TAKEN_REJECTED, `idChangeFeedback`);
        }
        d.elements.idChangeRequestButton.disabled = false;
        d.elements.newId.disabled = false;
    };

    const lateReject = function (reason) {
        /*error in the worker, that handles requests, see browserserver.js
        browserServer has been  closed with browserServer.close() at this point*/
        d.elements.parsingResult.classList.toggle("error", true);
        d.feed(reason, `parsingResult`);
        d.feed(false, `useCustom`);
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
