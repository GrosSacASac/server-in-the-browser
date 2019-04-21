/*server-client_bridge.js */
/*todo make sure socket or socket.socket is used correctly*/
/*global
    process, require, global
*/
"use strict";
const WebSocket = require("ws");

const MESSAGES = {
    EXIT: "exit",
    LOADING_USER_LIST: "loading_user_list",
    SEND_ICE_CANDIDATE: "send_ice_candidate",
    RECEIVE_ICE_CANDIDATE: "receive_ice_candidate",
    SEND_DESCRIPTION: "send_description",
    RECEIVE_DESCRIPTION: "receive_description",
    LOCAL_SERVER_STATE: "LOCAL_SERVER_STATE",
    WELCOME: "welcome",
    SERVERLOG: "SERVERLOG",
    NAME_CHANGE_REQUEST: "10",
    BAD_ID_FORMAT_REJECTED: "200",
    ALREADY_TAKEN_REJECTED: "201",
    CONFIRM_ID_CHANGE: "11",
    NAME_CHANGE: "12",
    CANNOT_SEND_DESCRIPTION: "100",
    CANNOT_SEND_ICE_CANDIDATE: "101"
};

const socketSend = function (socket, toSend) {
    socket.send(toSend);
};

const userIdFromAnything = function (fromWhat, value) {
};

const userNumberFromSocket = function (socket) {
};

const userNumberFromDisplayedName = function (displayedName) {
};

let nextUserNumber = Number.MIN_SAFE_INTEGER;
let nextAutomatedUserNumberDisplayed = 0;
const users = {};

const formatData = function (action, message) {
    let stringMessage = JSON.stringify({
        action,
        data: message
    });
    return stringMessage;
};


const socketSendAction = function (socket, action, message) {
    socket.send(formatData(action, message));
};

const userSendAction = function (user, action, message) {
    socketSendAction(user.socket, action, message);
};

const socketSendAll = function (action, message) {
    const stringMessage = formatData(action, message);
    Object.values(users).forEach(function (user) {
        user.socket.send(stringMessage);
    });
};

const socketBroadcast = function (userIdToExclude, action, message) {
    const stringMessage = formatData(action, message);
    Object.entries(users).forEach(function ([id, user]) {
        if (id === userIdToExclude) {
            return;
        }
        user.socket.send(stringMessage);
    });
};

const refreshAllOtherClientsWithNewList = (userIdToExclude) => {
    socketBroadcast(userIdToExclude, MESSAGES.LOADING_USER_LIST, {
        connectedUsers: getPublicUsersList()
    });
};

const logAll = function (any) {
    socketSendAll(MESSAGES.SERVERLOG, any);
    console.log(any);
};




const refreshAllClientUserList = () => {
    socketSendAll(MESSAGES.LOADING_USER_LIST, {
        connectedUsers: getPublicUsersList()
    });
};

const registerNewUser = function (socket) {
    const displayedName = String(nextAutomatedUserNumberDisplayed);
    const nextUserId = String(nextUserNumber)
    users[nextUserId] = {
        id: nextUserId,
        displayedName,
        socket,
        isServer: false
    };


    nextUserNumber += 1;
    nextAutomatedUserNumberDisplayed += 1;
    return nextUserId;
};

const removeUser = function (id) {
    // todo also ensure connection is closed
    delete users[id];
};

const getPublicUsersList = function () {
    return Object.values(users).map(function (user) {
        return {
            displayedName: user.displayedName,
            id: user.id,
            isServer: user.isServer
        };
    });
};


const start = function (WEBSOCKET_PORT) {

    console.log(`WebSocket.Server on PORT ${WEBSOCKET_PORT}`);
    const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
    wss.on(`connection`, function (socket) {

        const id = registerNewUser(socket);
        console.log(`A new user connected, id: (${id})`);
        refreshAllOtherClientsWithNewList(id);

        socketSendAction(socket, MESSAGES.WELCOME, {
            displayedName: users[id].displayedName,
            id,
            connectedUsers: getPublicUsersList()
        });

        socket.on(`message`, function (message) {
            const parsedMessage = JSON.parse(message);
            parsedMessage.data = parsedMessage.data || {};
            parsedMessage.data.id = id;
            if (messageHandlers[parsedMessage.action]) {
                messageHandlers[parsedMessage.action](parsedMessage.data);
            }
        });

        socket.on(`close`, function (event) {
            console.log("user has exit");
            removeUser(id);
            refreshAllOtherClientsWithNewList(socket);
        });
    });

};

const messageHandlers = {
    [MESSAGES.EXIT]: function ({ id }) {
        console.log("user has exit");
        removeUser(id);
        refreshAllOtherClientsWithNewList(id);
    },
    [MESSAGES.LOCAL_SERVER_STATE]: data => {
        const user = users[data.id];
        user.isServer = Boolean(data.isServer);

        refreshAllOtherClientsWithNewList(data.id);
    },
    [MESSAGES.NAME_CHANGE_REQUEST]: ({ newName, id }) => {
        /*see ui.js*/
        const user = users[id];
        const oldId = user.displayedName;

        const MIN = 4;
        const MAX = 25;
        const PATTERN = /[a-zA-Z0-9]{4,25}/;

        //check if in correct format
        if (typeof newName !== "string" || !PATTERN.test(newName)) {
            socketSendAction(user.socket, MESSAGES.BAD_ID_FORMAT_REJECTED, {});
            return;
        }

        //check if already taken
        if (Object.values(users).some(function (user) {
            return user.displayedName === newName;
        })) {
            socketSendAction(user.socket, MESSAGES.ALREADY_TAKEN_REJECTED, {});
            return;
        }

        //we confirm changes to clients and change the local state
        user.displayedName = newName;
        socketSendAction(user.socket, MESSAGES.CONFIRM_ID_CHANGE, {
            newId: newName,
            oldId
        });

        socketBroadcast(user.id, MESSAGES.NAME_CHANGE, {
            newId: newName,
            oldId
        });
    },
    [MESSAGES.SEND_DESCRIPTION]: data => {
        // This time, we will emit only to the recipient
        const targetId = data.targetId;
        //logAll(["SEND DESCRIPTION",targetDisplayedName, data.from]);
        if (users[targetId]) {
            socketSend(users[targetId].socket, MESSAGES.RECEIVE_DESCRIPTION, {
                sdp: data.sdp,
                from: data.from
            });
        } else {
            socketSend(users[data.id].socket, MESSAGES.CANNOT_SEND_DESCRIPTION, {

            });
        }
    },

    [MESSAGES.SEND_ICE_CANDIDATE]: data => {
        const targetId = data.targetId;

        if (users[targetId]) {
            socketSend(users[targetId], MESSAGES.RECEIVE_ICE_CANDIDATE, {
                ice: data.ice,
                from: data.id
            });
        } else {
            socketSend(users[data.id], MESSAGES.CANNOT_SEND_ICE_CANDIDATE, {

            });
        }
    }
};


module.exports = {
    start
};
