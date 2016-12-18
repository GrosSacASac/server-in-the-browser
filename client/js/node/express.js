/*Response class already exists, could we use it need more research*/
module.exports = (function () {
    
    
    const middlewareusing = [];
    
    const use = function (middlewareFunction) {
        middlewareusing.push(middlewareFunction);
    };
    
    const get = function (route, getFunction) {
        const getMiddleWare = function (request, response, next) {
            //console.log(request.header.url, route, request.header.method);
            if ((request.header.url === route) && (request.header.method === "GET")) {
                getFunction(request, response);
            } else {
                next();
            }
        };
        middlewareusing.push(getMiddleWare);
    };
    
    const post = function (route, postFunction) {
        const getMiddleWare = function (request, response, next) {
            //console.log(request.header.url, route, request.header.method);
            if ((request.header.url === route) && (request.header.method === "POST")) {
                postFunction(request, response);
            } else {
                next();
            }
        };
        middlewareusing.push(getMiddleWare);
    };
    
    
    const handler = function (request, response) {
        let i;
        let middleware;
        let next;
        const length = middlewareusing.length;

        i = 0;
        next = function () {
            middleware = middlewareusing[i];
            if (!middleware) {
                //can happen if there is no middle ware at all
                return;
            }
            i += 1;
            if (i === length) {
                //there is no next
                middleware(request, response, function () {});
            } else {
                middleware(request, response, next);
            }
        };
        next();
    };
    const static = function (request, response, next) {
        //static middleware
    };
    
    
    const expressFunction = function () {
        return {
            use,
            get,
            post,
            handler
        };
    };
    
    expressFunction.static = static;//static is a middle ware
    
    return expressFunction;
}());
