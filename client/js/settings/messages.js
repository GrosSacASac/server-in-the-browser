export {MESSAGES};

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
    NAME_CHANGE_REQUEST : "10",
    BAD_ID_FORMAT_REJECTED: "200",
    ALREADY_TAKEN_REJECTED: "201",
    CONFIRM_ID_CHANGE: "11",
    NAME_CHANGE: "12",
    CANNOT_SEND_DESCRIPTION: "100",
    CANNOT_SEND_ICE_CANDIDATE: "101"
};

const extensions = {
    SEND_OFFER: "send_offer",
    RECEIVE_OFFER: "receive_offer",
    CONDITION_ACCEPTED: "A"
};

Object.assign(MESSAGES, extensions);
