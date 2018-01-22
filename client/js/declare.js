/*declare.js
declares all modules, dependencies and globals

build :
 concat declare.js +
 all the declared modules +
 launcher
 then browserify it

why: have a flat dependecies graph where modules can reference each other in any order, using the advantage of single file without managing cyclical require dependencies*/


import ui from "./ui.js";
import uiFiles from "./uiFiles.js";
import rtc from "./rtc.js";
import bytes from "./bytes.js";
import sockets from "./sockets.js";
import localData from "./localData.js";
import serviceWorkerManager from "./serviceWorkerManager.js";
import browserServer from "./built/browserserver_with_node_emulator_for_worker.js";
import launcher from "./launcher.js";




/* true if supported;
    permission granted,
    and activated
    */
if (location.protocol === "http:" && location.href !== "http://localhost:8080/") {
/*should be useless , use server redirect
see
http://stackoverflow.com/questions/7185074/heroku-nodejs-http-to-https-ssl-forced-redirect
*/
    location.href = "https" + location.href.slice(4);
}
const startErrorElement = document.getElementById("starterror");
(startErrorElement && startErrorElement.remove());

window.test = window.test || false;



requestAnimationFrame(launcher);
