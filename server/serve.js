/*serve.js*/
/*global
    process, require, global, __dirname
*/
"use strict";


const environment = process.env.NODE_ENV || "local";
const thisFolderLength = 6; // "server".length
const absoluteLength = __dirname.length
const root = `${__dirname}/`.substr(0, absoluteLength - thisFolderLength);

let APP_PATH = `${root}/client/js/built/all.min.js`;
if (environment === "production") {
    APP_PATH = `${root}/client/js/built/all.min.js`
}
/*make sure no duplicate keys*/
const staticFileFromUrl = {
    "/": `${root}/client/html/built/index.min.html`,
    "/favicon.png": `${root}/client/images/icons/16.png`,
    "/app": APP_PATH,
    "/css": `${root}/client/css/built/all.css`,
    "/doc.css": `${root}/client/css/built/documentation.css`,
    "/example.zip": `${root}/client/temp.zip`,
    "/about": `${root}/client/html/built/about.min.html`,
    "/help": `${root}/client/html/built/help.min.html`,
    "/open_source": `${root}/client/html/built/open_source.min.html`,
    "/offline": `${root}/client/html/built/offline.min.html`,
    "/quit": `${root}/client/html/built/quit.min.html`,
    "/service_worker": `${root}/client/js/built/service_worker_with_version.js`,
    "/all-external.js": `${root}/client/js/built/all-external.js`,
    "/z-worker.js": `${root}/client/js/external_dependencies/zip/z-worker.js`,
    "/inflate.js": `${root}/client/js/external_dependencies/zip/inflate.js`,
    /*experimental, could also put that into service worker or already include it in the inject ready worker*/
    "/http": `${root}/client/js/node/http.js`,
    "/express": `${root}/client/js/node/express.js`,
    "/body-parser": `${root}/client/js/node/body-parser.js`
};


const start = function (app, server, port) {

    if (environment === "production") {
        /* force https on heroku */
        app.use(function (request, response, next) {
            if (request.headers["x-forwarded-proto"] !== "https") {
                const newURL = ["https://", request.get("Host"), request.url].join("");
                return response.redirect(newURL);
            }
            return next();
        });
    }

    Object.entries(staticFileFromUrl).forEach(function ([urlPattern, staticFile]) {
        app.get(urlPattern, function (request, response) {
            response.sendFile(staticFile, {
                lastModified: false,
                cacheControl: false,
                etag: false
            });
        });
    });

    server.listen(port);

    console.log(`Server running at http://localhost:${port}/`);
};


module.exports = {
    start
};
