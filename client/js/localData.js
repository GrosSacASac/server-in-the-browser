/*localData.js
manages data stored in the client*/
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white
*/
/*global
    localStorage, localData
*/

/*todo:
maybe add support for other data types not just String
maybe use localForage library
*/

localData = (function () {


    const get = function (itemName) {
        return localStorage.getItem(itemName);
    };
    
    const getElseDefault = function (itemName, defaultValue) {
        return get(itemName) || defaultValue;
    };
    
    const set = function (itemName, stringValue) {
        return localStorage.setItem(itemName, stringValue);
    };
    
    const clearAll = function () {
        localStorage.clear();
    };
    
    return {
        get,
        getElseDefault,
        set,
        clearAll
    };

}());
