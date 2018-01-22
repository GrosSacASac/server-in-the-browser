/*localData.js
manages data stored in the client*/
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white
*/
/*global
    localStorage, localData
*/

/* to do:
consider use localForage library
decide if this place should be full of try catch of emptied of it
*/

export { localData as default };

const localData = (function () {

    const get = function (itemName) {
        let returnValue;
        try {
            returnValue = JSON.parse(localStorage.getItem(itemName));
        } catch (e) {
            /* maybe there was data stored differently before so it breaks JSON.parse
            clear all data and returns undefined */
            try {
                /* this looks ugly but maybe the localStorage is not available and
                always throws */
                clearAll();
            } catch (e2) {
                ;
            }
            returnValue = undefined;
        }
        return returnValue;
    };

    const getElseDefault = function (itemName, defaultValue) {
        const value = get(itemName);
        if (value === null) {
            return defaultValue;
        }
        return value;
    };

    const set = function (itemName, value) {
        return localStorage.setItem(itemName, JSON.stringify(value));
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
