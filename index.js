/*index.js server*/
/*global
    process, require, global, __dirname
*/
"use strict";


const express = require("express");
const app = express();
const http = require("http");
const server = http.Server(app);
const socketio = require("socket.io")(server);

const serve = require("./server/serve.js");
const bridge = require("./server/server-client_bridge.js");


const PORT = process.env.PORT || 8080;


bridge.start(server);
serve.start(app, server, PORT);
