/*declare.js
declares all modules, dependencies and globals

build :
 concat declare.js +
 all the declared modules +
 launcher
 then browserify it
 
why: have a flat dependecies graph where modules can reference each other in any order, using the advantage of single file without managing cyclical require dependencies*/

"use strict";
if (location.protocol === "http:" && location.href !== "http://localhost:8080/") {
/*should be useless , use server redirect
see  
http://stackoverflow.com/questions/7185074/heroku-nodejs-http-to-https-ssl-forced-redirect
*/
    location.href = "https" + location.href.slice(4);
}
const startErrorElement = document.getElementById("starterror");
(startErrorElement && startErrorElement.remove());

let ui;
let uiFiles;
let rtc;
let bytes;
let sockets;
let localData;
let serviceWorkerManager;  
let browserServer;
let localDisplayedName = "";
let isOnLine = true;
let notificationEnabled = false; 
/* true if supported;
    permission granted,
    and activated
    */
window.test = window.test || false;

const MAX_NOTIFICATION_TIME = 8000; // ms


const R = require("ramda");
const D = require("dom99");
const yesNoDialog = require("dom99/components/yesNoDialog/yesNoDialog.js").yesNoDialog;
const socketIo = require("socket.io-client");
require("webrtc-adapter");//require is enough

const keyFromObjectAndValue = function (anObject, AValue) {
    let resultKey;
    Object.entries(anObject).some(function ([key, value]) {
        if (value === AValue) {
            resultKey = key;
            return true;
        }
    });
    return resultKey;
};

class OutOfOrderError extends Error {
  
} 

const MESSAGES = {
    EXIT: "exit",                           // the user leaves
    LOADING_USER_LIST: "loading_user_list", // send the user list
    SEND_ICE_CANDIDATE: "send_ice_candidate",
    RECEIVE_ICE_CANDIDATE: "receive_ice_candidate",
    SEND_OFFER: "send_offer",
    SEND_DESCRIPTION: "send_description",
    RECEIVE_DESCRIPTION: "receive_description",
    RECEIVE_OFFER: "receive_offer",
    LOCAL_SERVER_STATE: "LOCAL_SERVER_STATE",
    WELCOME: "welcome",
    SERVERLOG:  "SERVERLOG",
    ID_CHANGE_REQUEST : "10",
    BAD_ID_FORMAT_REJECTED: "200",
    ALREADY_TAKEN_REJECTED: "201",
    CONFIRM_ID_CHANGE: "11",
    USER_ID_CHANGE: "12",
    CONDITION_ACCEPTED: "A"
};
