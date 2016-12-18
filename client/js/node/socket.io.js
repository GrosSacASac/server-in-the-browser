//socket.io.js

module.exports = (function () {
    
    
    const socketIoFunction = function (server) {
        return {
            on : function () {
                console.log("on not implemented yet");//not implemented yet
            },
            emit: function () {
                console.log("emit not implemented yet");//not implemented yet
            }
        };
    };

    
    return socketIoFunction;
}());
