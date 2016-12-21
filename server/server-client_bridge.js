/*server-client_bridge.js */
/*global
    process, require, global, __dirname
*/
"use strict";



const socketio = require("socket.io");

let io;


let userId = 0;
let nextUserNumber = Number.MIN_SAFE_INTEGER;
let nextAutomatedUserNumberDisplayed = 0;

/*keys are unique user Numbers (IDentifiers)
values are objects defining an user, or sockets for user*/
const users = new Map();


const MESSAGES = {
    EXIT: "exit",
    LOADING_USER_LIST: "loading_user_list",
    SEND_ICE_CANDIDATE: "send_ice_candidate",
    RECEIVE_ICE_CANDIDATE: "receive_ice_candidate",
    SEND_DESCRIPTION: "send_description",
    RECEIVE_DESCRIPTION: "receive_description",
    LOCAL_SERVER_STATE: "LOCAL_SERVER_STATE",
    WELCOME: "welcome",
    SERVERLOG:  "SERVERLOG",
    ID_CHANGE_REQUEST : "10",
    BAD_ID_FORMAT_REJECTED: "200",
    ALREADY_TAKEN_REJECTED: "201",
    CONFIRM_ID_CHANGE: "11",
    USER_ID_CHANGE: "12"
};

const logAll = function (any) {
    io.emit(MESSAGES.SERVERLOG, any);
    console.log(any);
};

const refreshAllOtherClientUserList = (socket) => {
  socket.broadcast.emit(MESSAGES.LOADING_USER_LIST, {
    connectedUsers: getPublicUsersList()
  });
};

const refreshAllClientUserList = () => {
  io.emit(MESSAGES.LOADING_USER_LIST, {
    connectedUsers: getPublicUsersList()
  });
};

const registerNewUser = function (socket) {
    const displayedName = String(nextAutomatedUserNumberDisplayed)
    users.set(nextUserNumber, {
        displayedName,
        socket,
        isServer: false
    });
    //socketFromUserNumber.set(nextUserNumber, socket);
    
    nextUserNumber += 1;
    nextAutomatedUserNumberDisplayed += 1;
    return displayedName;
};

const userNumberFromAnything = function (fromWhat, value) {
    let userNumber;
    let user;
    for ([userNumber, user] of users) {
        if (user[fromWhat] === value) {
            return userNumber;
        }
    }
    return;
};

const userNumberFromSocket = function (socket) {
    return userNumberFromAnything("socket", socket);
};

const userNumberFromDisplayedName = function (displayedName) {
    return userNumberFromAnything("displayedName", displayedName);
};

const userFromSocket = function (socket) {
    return users.get(userNumberFromSocket(socket));
};

const removeUserWithSocket = function (socket) {
    /*remove socket connection ?*/
    const userNumber = userNumberFromSocket(socket);
    if (userNumber) {
        users.delete(userNumber);
    }
};

const getPublicUsersList = function () {
    let userList = [];
    let publicUserObject;
    let userNumber; // not used
    let user;
    for ([userNumber, user] of users) {
        publicUserObject = {
            displayedName : user.displayedName,
            isServer: user.isServer
        };
        //console.log(user.socket);
        userList.push(publicUserObject);
    }
    return userList;
    //return Array.from(users);
};






const start = function (server) {
    io = socketio(server);
    io.on("connection", socket => {

        const displayedName = registerNewUser(socket);
        console.log(`A new user connected: (${displayedName})`)
        refreshAllOtherClientUserList(socket); 

        const onDisconnect = function() {
            console.log("user has exit");
            removeUserWithSocket(socket);
            refreshAllOtherClientUserList(socket);
        };
        
        socket.on("disconnect", onDisconnect);

        socket.on(MESSAGES.EXIT, onDisconnect);
        
        socket.emit(MESSAGES.WELCOME, {
            displayedName,
            connectedUsers: getPublicUsersList()
        });

        socket.on(MESSAGES.LOCAL_SERVER_STATE, data => {
            const user = userFromSocket(socket);
            user.isServer = data.isServer;

            refreshAllOtherClientUserList(socket);
        });
        
        socket.on(MESSAGES.ID_CHANGE_REQUEST, data => {
            /*see ui.js*/
            const user = userFromSocket(socket);
            const oldId = user.displayedName;
            const {newId} = data; 
            
            const MIN = 4;
            const MAX = 25;
            const PATTERN = /[a-zA-Z0-9]{4,25}/;
            
            //check if in correct format
            if (typeof newId !== "string" || !PATTERN.test(newId)) {
                socket.emit(MESSAGES.BAD_ID_FORMAT_REJECTED, {});
                return;
            }
            
            //check if already taken
            if (getPublicUsersList().some(function (publicUserObject) {
                return publicUserObject.displayedName === newId;
            })) {
                socket.emit(MESSAGES.ALREADY_TAKEN_REJECTED, {});
                return;
            }
            
            //we confirm changes to clients and change the local state
            user.displayedName = newId;
            socket.emit(MESSAGES.CONFIRM_ID_CHANGE, {
                newId,
                oldId
            });
            
            socket.broadcast.emit(MESSAGES.USER_ID_CHANGE, {
                newId,
                oldId
            });
        });

        socket.on(MESSAGES.SEND_DESCRIPTION, data => {
            // This time, we will emit only to the recipient
            const targetDisplayedName = data.targetDisplayedName;
            const targetUserNumber = userNumberFromDisplayedName(targetDisplayedName);
            //logAll(["SEND DESCRIPTION",targetDisplayedName, data.from]);
            if (targetUserNumber) {
                users.get(targetUserNumber).socket.emit(MESSAGES.RECEIVE_DESCRIPTION, {
                    sdp: data.sdp,
                    from: data.from
                })
            }
        });

        socket.on(MESSAGES.SEND_ICE_CANDIDATE, data => {
            const targetDisplayedName = data.targetDisplayedName;
            const targetUserNumber = userNumberFromDisplayedName(targetDisplayedName);
            //logAll(["SEND_ICE_CANDIDATE",targetDisplayedName, data.from, data.ice]);
            if (targetUserNumber) {
                users.get(targetUserNumber).socket.emit(MESSAGES.RECEIVE_ICE_CANDIDATE, {
                    ice: data.ice,
                    from: data.from
                })
            }
        });

    });
};

module.exports = {
    start
};