/*state.js*/
export { state };

const state = {

    /* true if supported;
        permission granted,
        and activated
        */
    notificationEnabled: false,
    localDisplayedName: "",
    isOnLine: true,
    selectedUserId : "",
    lastSelectedUserId: "",
    uiIdStringLastSelected: "", // same with "_user"
    files: [/*
        {
            name,
            body,
            mime,
            uiLink
    }*/]
};

window.state = state;
