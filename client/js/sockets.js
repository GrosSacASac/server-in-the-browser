//client
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white
*/
/*global
    navigator , localDisplayedName
*/


sockets = (function () {

    const API = {
        socket : undefined
    };


    const start = function () {
        API.socket = socketIo();
        const socket = API.socket;
        socket.on(MESSAGES.WELCOME, (data) => {
            //console.log("welcome received", data);
            localDisplayedName = data.displayedName;
            ui.displayOwnUserId(localDisplayedName);
            rtc.connectedUsers = data.connectedUsers;
            ui.updateUserList(data.connectedUsers);            
        });

        socket.on(MESSAGES.LOADING_USER_LIST, function (data) {
            rtc.connectedUsers = data.connectedUsers;
            ui.updateUserList(data.connectedUsers);
        });

        socket.on(MESSAGES.RECEIVE_DESCRIPTION, data => {
            rtc.onReceiveRtcConnectionDescription(data);
        })

        socket.on(MESSAGES.RECEIVE_ICE_CANDIDATE, data => {
            rtc.onReceiveRtcIceCandidate(data);
        })
        
        socket.on(MESSAGES.SERVERLOG, data => {
            ui.serverLog(data);
        })
        
        socket.on(MESSAGES.BAD_ID_FORMAT_REJECTED, data => {
            ui.handleChangeIdResponse(MESSAGES.BAD_ID_FORMAT_REJECTED);
        })
        
        socket.on(MESSAGES.ALREADY_TAKEN_REJECTED, data => {
            ui.handleChangeIdResponse(MESSAGES.ALREADY_TAKEN_REJECTED);
        })
        
        socket.on(MESSAGES.CONFIRM_ID_CHANGE, data => {
            ui.handleChangeIdResponse(MESSAGES.CONFIRM_ID_CHANGE, data);
        });
        
        socket.on(MESSAGES.USER_ID_CHANGE, data => {
            ui.handleChangeIdResponse(MESSAGES.USER_ID_CHANGE, data);
        });
        
        
    };
    
    const requestIdChange = function (newId) {
        
        API.socket.emit(MESSAGES.ID_CHANGE_REQUEST, {
            newId
        });
    };
    
    Object.assign(API, {
        start,
        requestIdChange
    });
    
    return API;
}());
