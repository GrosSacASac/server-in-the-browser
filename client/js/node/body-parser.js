


/*body-parser.js*/
module.exports = (function () {

    const stringFromArrayBuffer = function (arrayBuffer, encoding = "utf-8") {
        /*copy pasted from bytes todo import it at run time*/
        return (new TextDecoder(encoding)).decode(new DataView(arrayBuffer));
    };
    
    const text = function (request, response, next) {
        if (!request.body) {
            return next();
        }
        request.body = stringFromArrayBuffer(request.body);
        return next();
    };
    
    
    return {
        text
    };
}());
