export {keyFromObjectAndValue, OutOfOrderError};

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
