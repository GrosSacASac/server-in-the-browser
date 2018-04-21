//client
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white
*/
/*global
    navigator , state.localDisplayedName, io
*/

import {state} from "./state.js";
import {MESSAGES} from "./settings/messages.js";

import ui from "./ui.js";
import rtc from "./rtc.js";

export { sockets as default, start, socket, requestIdChange };

let open = false;
let socket;


const start = function () {
    const webSocketLocation = `ws://${location.hostname}:8081/`;
    socket = new WebSocket(webSocketLocation);

    const handlers = {};

    handlers[MESSAGES.WELCOME] = (data) => {
        //console.log("welcome received", data);
        state.localDisplayedName = data.displayedName;
        ui.displayOwnUserId(state.localDisplayedName);
        rtc.connectedUsers = data.connectedUsers;
        ui.updateUserList(data.connectedUsers);
    });

    handlers[MESSAGES.LOADING_USER_LIST] = (data) => {
        rtc.connectedUsers = data.connectedUsers;
        ui.updateUserList(data.connectedUsers);
    });

    handlers[MESSAGES.RECEIVE_DESCRIPTION] = (data) => {
        rtc.onReceiveRtcConnectionDescription(data);
    });

    handlers[MESSAGES.RECEIVE_ICE_CANDIDATE] = (data) => {
        rtc.onReceiveRtcIceCandidate(data);
    });

    handlers[MESSAGES.SERVERLOG] = (data) => {
        ui.serverLog(data);
    });

    handlers[MESSAGES.BAD_ID_FORMAT_REJECTED] = (data) => {
        ui.handleChangeIdResponse(MESSAGES.BAD_ID_FORMAT_REJECTED);
    });

    handlers[MESSAGES.ALREADY_TAKEN_REJECTED] = (data) => {
        ui.handleChangeIdResponse(MESSAGES.ALREADY_TAKEN_REJECTED);
    });

    handlers[MESSAGES.CONFIRM_ID_CHANGE] = (data) => {
        ui.handleChangeIdResponse(MESSAGES.CONFIRM_ID_CHANGE, data);
    });

    handlers[MESSAGES.USER_ID_CHANGE] = (data) => {
        ui.handleChangeIdResponse(MESSAGES.USER_ID_CHANGE, data);
    });

    socket.addEventListener(`message`, function (event) {
        const object = JSON.parse(event.data);
        if (object.action && handlers[object.action]) {
            handlers[object.action](object);
        }
    });
    
    socket.addEventListener(`error`, function (error) {
         console.log(`error`, error);
     });

     const socketSend = function (message) {
         socket.send(JSON.stringify(message));
     };

     socket.addEventListener(`open`, function (event) {
         open = true;
     });
};

const requestIdChange = function (newId) {

    socket.emit(MESSAGES.ID_CHANGE_REQUEST, {
        newId
    });
};
