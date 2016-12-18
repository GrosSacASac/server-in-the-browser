/*localData.js
manages data stored in the client*/
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white, node,eval
*/
/*global
    localStorage, 
*/

/*todo 
*/

localData = (function () {
    const API = {
    };

    const get = function (itemName) {
        return localStorage.getItem(itemName);
    };
    
    const set = function (itemName, stringValue) {
        return localStorage.setItem(itemName, stringValue);
    };
    
    const clearAll = function (itemName) {
        localStorage.clear();
    };
    
    Object.assign(API, {
        get,
        set,
        clearAll
    });
    
    return API;
}());
