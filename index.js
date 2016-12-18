/*index.js server*/
/*global
    process, require, global, __dirname
*/
"use strict";
//server

/*todo stop trust what is outside control*/
const PORT = process.env.PORT || 8080;


const express = require("express");
const app = express();

/*force https on heroku*/

const environment = process.env.NODE_ENV || "local";
/*make sure no duplicate keys*/
const staticFileFromUrl = {
    "/": `${__dirname}/client/html/built/index.min.html`,
    "/favicon.png": `${__dirname}/client/images/icons/16.png`,
    "/app": `${__dirname}/client/js/built/all.min.js`,    
    "/css": `${__dirname}/client/css/built/all.min.css`,     
    "/example.zip": `${__dirname}/client/temp.zip`,    
    "/about": `${__dirname}/client/html/built/about.min.html`,
    "/help": `${__dirname}/client/html/built/help.min.html`,
    "/open_source": `${__dirname}/client/html/built/open_source.min.html`,
    "/offline": `${__dirname}/client/html/built/offline.min.html`,
    "/quit": `${__dirname}/client/html/built/quit.min.html`,    
    //todo remove
    "/quitt": `${__dirname}/client/html/quitt.html`,
    "/service_worker": `${__dirname}/client/js/built/service_worker.min.js`,
    "/z-worker.js": `${__dirname}/client/js/external_dependencies/zip/z-worker.js`,    
    "/inflate.js": `${__dirname}/client/js/external_dependencies/zip/inflate.js`,
    /*experimental, could also put that into service worker or already include it in the inject ready worker*/
    "/http": `${__dirname}/client/js/node/http.js`,
    "/express": `${__dirname}/client/js/node/express.js`,
    "/body-parser": `${__dirname}/client/js/node/body-parser.js`, 
    "/socket.io": `${__dirname}/client/js/node/socket.io.js`, 
};


if (environment === "production") {
    app.use(function (request, response, next) {
        if (request.headers["x-forwarded-proto"] !== "https") {
            const newURL = ["https://", request.get("Host"), request.url].join("");
            return response.redirect(newURL);
        }
        return next();
    });
}

const server = require("http").Server(app);
const io = require("socket.io")(server);


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



const start = function (port) {

    Object.entries(staticFileFromUrl).forEach(function ([urlPattern, staticFile]) {
        app.get(urlPattern, function (request, response) {
            response.sendFile(staticFile);
        });
    });
    
    server.listen(port);

    console.log(`Server running at http://127.0.0.1:${port}/`);
};


start(PORT);
