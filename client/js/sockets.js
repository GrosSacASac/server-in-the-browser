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

export {start, socketSendAction};

let open = false;
let queue = [];
let socket;


const start = function () {
    const webSocketLocation = `ws://${location.hostname}:8081/`;
    socket = new WebSocket(webSocketLocation);

    const handlers = {};

    handlers[MESSAGES.WELCOME] = (data) => {
        //console.log("welcome received", data);
        state.localDisplayedName = data.displayedName;
        state.id = data.id;
        ui.displayOwnUserId(state.localDisplayedName);
        state.connectedUsers = data.connectedUsers;
        ui.updateUserList(state.connectedUsers);
    };

    handlers[MESSAGES.LOADING_USER_LIST] = (data) => {
        state.connectedUsers = data.connectedUsers;
        ui.updateUserList(state.connectedUsers);
    };

    handlers[MESSAGES.RECEIVE_DESCRIPTION] = (data) => {
        rtc.onReceiveRtcConnectionDescription(data);
    };

    handlers[MESSAGES.RECEIVE_ICE_CANDIDATE] = (data) => {
        rtc.onReceiveRtcIceCandidate(data);
    };

    handlers[MESSAGES.SERVERLOG] = (data) => {
        ui.serverLog(data);
    };

    handlers[MESSAGES.BAD_ID_FORMAT_REJECTED] = (data) => {
        ui.handleChangeIdResponse(MESSAGES.BAD_ID_FORMAT_REJECTED);
    };

    handlers[MESSAGES.ALREADY_TAKEN_REJECTED] = (data) => {
        ui.handleChangeIdResponse(MESSAGES.ALREADY_TAKEN_REJECTED);
    };

    handlers[MESSAGES.CONFIRM_ID_CHANGE] = (data) => {
        ui.handleChangeIdResponse(MESSAGES.CONFIRM_ID_CHANGE, data);
    };

    handlers[MESSAGES.NAME_CHANGE_REQUEST] = (data) => {
        ui.handleChangeIdResponse(MESSAGES.NAME_CHANGE_REQUEST, data);
    };

    handlers[MESSAGES.NAME_CHANGE] = (data) => {
        ui.handleChangeIdResponse(MESSAGES.NAME_CHANGE, data);
    };

    socket.addEventListener(`message`, function (event) {
        const object = JSON.parse(event.data);
        if (object.action) {
            if (handlers[object.action]) {
                handlers[object.action](object.data);
            } else {
                console.warn(`action "${object.action}" not implemented yet`);
            }
        } else {
            console.error(`message from socket does not have action property`);
        }
    });

    socket.addEventListener(`error`, function (error) {
         console.log(`error`, error);
     });

    socket.addEventListener(`open`, function (event) {
        open = true;
        queue.forEach(function (toSend) {
          socketSend(toSend);
        });
        queue = undefined;
    });




};

const socketSend = function (toSend) {
    socket.send(toSend);
};

const socketSendAction = function (action, message) {
    const stringMessage = JSON.stringify({
        action,
        data: message
    });
    if (!open) {
        queue.push(stringMessage)
    } else {
        socketSend(stringMessage);
    }
};
