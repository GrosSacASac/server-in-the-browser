/*index.js server*/
/*global
    process, require, global, __dirname
*/
"use strict";


const express = require("express");
const app = express();
const http = require("http");
const server = http.Server(app);

const serve = require("./server/serve.js");
const bridge = require("./server/server-client_bridge.js");


const PORT = process.env.PORT || 8080;
const WEBSOCKET_PORT = 8081;

bridge.start(WEBSOCKET_PORT);
serve.start(app, server, PORT);
