/*declare.js
declares all modules, dependencies and globals

build :
 concat declare.js +
 all the declared modules +
 launcher
 then browserify it
 
why: have a flat dependecies graph where modules can reference each other in any order, using the advantage of single file without managing cyclical require dependencies*/

"use strict";
if (location.protocol === "http:" && location.href !== "http://localhost:8080/") {
/*should be useless , use server redirect
see  
http://stackoverflow.com/questions/7185074/heroku-nodejs-http-to-https-ssl-forced-redirect
*/
    location.href = "https" + location.href.slice(4);
}
const startErrorElement = document.getElementById("starterror");
(startErrorElement && startErrorElement.remove());

let ui;
let uiFiles;
let rtc;
let bytes;
let sockets;
let localData;
let serviceWorkerManager;  
let browserServer;
let localDisplayedName = "";
let isOnLine = true;
let notificationEnabled = false; 
/* true if supported;
    permission granted,
    and activated
    */
window.test = window.test || false;

const MAX_NOTIFICATION_TIME = 8000; // ms


const R = require("ramda");
const D = require("dom99");
const { yesNoDialog } = require("dom99/components/yesNoDialog/yesNoDialog.js");
const socketIo = require("socket.io-client");
require("webrtc-adapter");//require is enough

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

const MESSAGES = {
    EXIT: "exit",                           // the user leaves
    LOADING_USER_LIST: "loading_user_list", // send the user list
    SEND_ICE_CANDIDATE: "send_ice_candidate",
    RECEIVE_ICE_CANDIDATE: "receive_ice_candidate",
    SEND_OFFER: "send_offer",
    SEND_DESCRIPTION: "send_description",
    RECEIVE_DESCRIPTION: "receive_description",
    RECEIVE_OFFER: "receive_offer",
    LOCAL_SERVER_STATE: "LOCAL_SERVER_STATE",
    WELCOME: "welcome",
    SERVERLOG:  "SERVERLOG",
    ID_CHANGE_REQUEST : "10",
    BAD_ID_FORMAT_REJECTED: "200",
    ALREADY_TAKEN_REJECTED: "201",
    CONFIRM_ID_CHANGE: "11",
    USER_ID_CHANGE: "12",
    CONDITION_ACCEPTED: "A"
};
//zip.js + zip-ext.js concatenation
/*
 Copyright (c) 2013 Gildas Lormeau. All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice,
 this list of conditions and the following disclaimer.

 2. Redistributions in binary form must reproduce the above copyright
 notice, this list of conditions and the following disclaimer in
 the documentation and/or other materials provided with the distribution.

 3. The names of the authors may not be used to endorse or promote products
 derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
 INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
 INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
 INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
 OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

(function(obj) {
	"use strict";

	var ERR_BAD_FORMAT = "File format is not recognized.";
	var ERR_CRC = "CRC failed.";
	var ERR_ENCRYPTED = "File contains encrypted entry.";
	var ERR_ZIP64 = "File is using Zip64 (4gb+ file size).";
	var ERR_READ = "Error while reading zip file.";
	var ERR_WRITE = "Error while writing zip file.";
	var ERR_WRITE_DATA = "Error while writing file data.";
	var ERR_READ_DATA = "Error while reading file data.";
	var ERR_DUPLICATED_NAME = "File already exists.";
	var CHUNK_SIZE = 512 * 1024;
	
	var TEXT_PLAIN = "text/plain";

	var appendABViewSupported;
	try {
		appendABViewSupported = new Blob([ new DataView(new ArrayBuffer(0)) ]).size === 0;
	} catch (e) {
	}

	function Crc32() {
		this.crc = -1;
	}
	Crc32.prototype.append = function append(data) {
		var crc = this.crc | 0, table = this.table;
		for (var offset = 0, len = data.length | 0; offset < len; offset++)
			crc = (crc >>> 8) ^ table[(crc ^ data[offset]) & 0xFF];
		this.crc = crc;
	};
	Crc32.prototype.get = function get() {
		return ~this.crc;
	};
	Crc32.prototype.table = (function() {
		var i, j, t, table = []; // Uint32Array is actually slower than []
		for (i = 0; i < 256; i++) {
			t = i;
			for (j = 0; j < 8; j++)
				if (t & 1)
					t = (t >>> 1) ^ 0xEDB88320;
				else
					t = t >>> 1;
			table[i] = t;
		}
		return table;
	})();
	
	// "no-op" codec
	function NOOP() {}
	NOOP.prototype.append = function append(bytes, onprogress) {
		return bytes;
	};
	NOOP.prototype.flush = function flush() {};

	function blobSlice(blob, index, length) {
		if (index < 0 || length < 0 || index + length > blob.size)
			throw new RangeError('offset:' + index + ', length:' + length + ', size:' + blob.size);
		if (blob.slice)
			return blob.slice(index, index + length);
		else if (blob.webkitSlice)
			return blob.webkitSlice(index, index + length);
		else if (blob.mozSlice)
			return blob.mozSlice(index, index + length);
		else if (blob.msSlice)
			return blob.msSlice(index, index + length);
	}

	function getDataHelper(byteLength, bytes) {
		var dataBuffer, dataArray;
		dataBuffer = new ArrayBuffer(byteLength);
		dataArray = new Uint8Array(dataBuffer);
		if (bytes)
			dataArray.set(bytes, 0);
		return {
			buffer : dataBuffer,
			array : dataArray,
			view : new DataView(dataBuffer)
		};
	}

	// Readers
	function Reader() {
	}

	function TextReader(text) {
		var that = this, blobReader;

		function init(callback, onerror) {
			var blob = new Blob([ text ], {
				type : TEXT_PLAIN
			});
			blobReader = new BlobReader(blob);
			blobReader.init(function() {
				that.size = blobReader.size;
				callback();
			}, onerror);
		}

		function readUint8Array(index, length, callback, onerror) {
			blobReader.readUint8Array(index, length, callback, onerror);
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	TextReader.prototype = new Reader();
	TextReader.prototype.constructor = TextReader;

	function Data64URIReader(dataURI) {
		var that = this, dataStart;

		function init(callback) {
			var dataEnd = dataURI.length;
			while (dataURI.charAt(dataEnd - 1) == "=")
				dataEnd--;
			dataStart = dataURI.indexOf(",") + 1;
			that.size = Math.floor((dataEnd - dataStart) * 0.75);
			callback();
		}

		function readUint8Array(index, length, callback) {
			var i, data = getDataHelper(length);
			var start = Math.floor(index / 3) * 4;
			var end = Math.ceil((index + length) / 3) * 4;
			var bytes = obj.atob(dataURI.substring(start + dataStart, end + dataStart));
			var delta = index - Math.floor(start / 4) * 3;
			for (i = delta; i < delta + length; i++)
				data.array[i - delta] = bytes.charCodeAt(i);
			callback(data.array);
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	Data64URIReader.prototype = new Reader();
	Data64URIReader.prototype.constructor = Data64URIReader;

	function BlobReader(blob) {
		var that = this;

		function init(callback) {
			that.size = blob.size;
			callback();
		}

		function readUint8Array(index, length, callback, onerror) {
			var reader = new FileReader();
			reader.onload = function(e) {
				callback(new Uint8Array(e.target.result));
			};
			reader.onerror = onerror;
			try {
				reader.readAsArrayBuffer(blobSlice(blob, index, length));
			} catch (e) {
				onerror(e);
			}
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	BlobReader.prototype = new Reader();
	BlobReader.prototype.constructor = BlobReader;

	// Writers

	function Writer() {
	}
	Writer.prototype.getData = function(callback) {
		callback(this.data);
	};

	function TextWriter(encoding) {
		var that = this, blob;

		function init(callback) {
			blob = new Blob([], {
				type : TEXT_PLAIN
			});
			callback();
		}

		function writeUint8Array(array, callback) {
			blob = new Blob([ blob, appendABViewSupported ? array : array.buffer ], {
				type : TEXT_PLAIN
			});
			callback();
		}

		function getData(callback, onerror) {
			var reader = new FileReader();
			reader.onload = function(e) {
				callback(e.target.result);
			};
			reader.onerror = onerror;
			reader.readAsText(blob, encoding);
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	TextWriter.prototype = new Writer();
	TextWriter.prototype.constructor = TextWriter;

	function Data64URIWriter(contentType) {
		var that = this, data = "", pending = "";

		function init(callback) {
			data += "data:" + (contentType || "") + ";base64,";
			callback();
		}

		function writeUint8Array(array, callback) {
			var i, delta = pending.length, dataString = pending;
			pending = "";
			for (i = 0; i < (Math.floor((delta + array.length) / 3) * 3) - delta; i++)
				dataString += String.fromCharCode(array[i]);
			for (; i < array.length; i++)
				pending += String.fromCharCode(array[i]);
			if (dataString.length > 2)
				data += obj.btoa(dataString);
			else
				pending = dataString;
			callback();
		}

		function getData(callback) {
			callback(data + obj.btoa(pending));
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	Data64URIWriter.prototype = new Writer();
	Data64URIWriter.prototype.constructor = Data64URIWriter;

	function BlobWriter(contentType) {
		var blob, that = this;

		function init(callback) {
			blob = new Blob([], {
				type : contentType
			});
			callback();
		}

		function writeUint8Array(array, callback) {
			blob = new Blob([ blob, appendABViewSupported ? array : array.buffer ], {
				type : contentType
			});
			callback();
		}

		function getData(callback) {
			callback(blob);
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	BlobWriter.prototype = new Writer();
	BlobWriter.prototype.constructor = BlobWriter;

	/** 
	 * inflate/deflate core functions
	 * @param worker {Worker} web worker for the task.
	 * @param initialMessage {Object} initial message to be sent to the worker. should contain
	 *   sn(serial number for distinguishing multiple tasks sent to the worker), and codecClass.
	 *   This function may add more properties before sending.
	 */
	function launchWorkerProcess(worker, initialMessage, reader, writer, offset, size, onprogress, onend, onreaderror, onwriteerror) {
		var chunkIndex = 0, index, outputSize, sn = initialMessage.sn, crc;

		function onflush() {
			worker.removeEventListener('message', onmessage, false);
			onend(outputSize, crc);
		}

		function onmessage(event) {
			var message = event.data, data = message.data, err = message.error;
			if (err) {
				err.toString = function () { return 'Error: ' + this.message; };
				onreaderror(err);
				return;
			}
			if (message.sn !== sn)
				return;
			if (typeof message.codecTime === 'number')
				worker.codecTime += message.codecTime; // should be before onflush()
			if (typeof message.crcTime === 'number')
				worker.crcTime += message.crcTime;

			switch (message.type) {
				case 'append':
					if (data) {
						outputSize += data.length;
						writer.writeUint8Array(data, function() {
							step();
						}, onwriteerror);
					} else
						step();
					break;
				case 'flush':
					crc = message.crc;
					if (data) {
						outputSize += data.length;
						writer.writeUint8Array(data, function() {
							onflush();
						}, onwriteerror);
					} else
						onflush();
					break;
				case 'progress':
					if (onprogress)
						onprogress(index + message.loaded, size);
					break;
				case 'importScripts': //no need to handle here
				case 'newTask':
				case 'echo':
					break;
				default:
					console.warn('zip.js:launchWorkerProcess: unknown message: ', message);
			}
		}

		function step() {
			index = chunkIndex * CHUNK_SIZE;
			// use `<=` instead of `<`, because `size` may be 0.
			if (index <= size) {
				reader.readUint8Array(offset + index, Math.min(CHUNK_SIZE, size - index), function(array) {
					if (onprogress)
						onprogress(index, size);
					var msg = index === 0 ? initialMessage : {sn : sn};
					msg.type = 'append';
					msg.data = array;
					
					// posting a message with transferables will fail on IE10
					try {
						worker.postMessage(msg, [array.buffer]);
					} catch(ex) {
						worker.postMessage(msg); // retry without transferables
					}
					chunkIndex++;
				}, onreaderror);
			} else {
				worker.postMessage({
					sn: sn,
					type: 'flush'
				});
			}
		}

		outputSize = 0;
		worker.addEventListener('message', onmessage, false);
		step();
	}

	function launchProcess(process, reader, writer, offset, size, crcType, onprogress, onend, onreaderror, onwriteerror) {
		var chunkIndex = 0, index, outputSize = 0,
			crcInput = crcType === 'input',
			crcOutput = crcType === 'output',
			crc = new Crc32();
		function step() {
			var outputData;
			index = chunkIndex * CHUNK_SIZE;
			if (index < size)
				reader.readUint8Array(offset + index, Math.min(CHUNK_SIZE, size - index), function(inputData) {
					var outputData;
					try {
						outputData = process.append(inputData, function(loaded) {
							if (onprogress)
								onprogress(index + loaded, size);
						});
					} catch (e) {
						onreaderror(e);
						return;
					}
					if (outputData) {
						outputSize += outputData.length;
						writer.writeUint8Array(outputData, function() {
							chunkIndex++;
							setTimeout(step, 1);
						}, onwriteerror);
						if (crcOutput)
							crc.append(outputData);
					} else {
						chunkIndex++;
						setTimeout(step, 1);
					}
					if (crcInput)
						crc.append(inputData);
					if (onprogress)
						onprogress(index, size);
				}, onreaderror);
			else {
				try {
					outputData = process.flush();
				} catch (e) {
					onreaderror(e);
					return;
				}
				if (outputData) {
					if (crcOutput)
						crc.append(outputData);
					outputSize += outputData.length;
					writer.writeUint8Array(outputData, function() {
						onend(outputSize, crc.get());
					}, onwriteerror);
				} else
					onend(outputSize, crc.get());
			}
		}

		step();
	}

	function inflate(worker, sn, reader, writer, offset, size, computeCrc32, onend, onprogress, onreaderror, onwriteerror) {
		var crcType = computeCrc32 ? 'output' : 'none';
		if (obj.zip.useWebWorkers) {
			var initialMessage = {
				sn: sn,
				codecClass: 'Inflater',
				crcType: crcType,
			};
			launchWorkerProcess(worker, initialMessage, reader, writer, offset, size, onprogress, onend, onreaderror, onwriteerror);
		} else
			launchProcess(new obj.zip.Inflater(), reader, writer, offset, size, crcType, onprogress, onend, onreaderror, onwriteerror);
	}

	function deflate(worker, sn, reader, writer, level, onend, onprogress, onreaderror, onwriteerror) {
		var crcType = 'input';
		if (obj.zip.useWebWorkers) {
			var initialMessage = {
				sn: sn,
				options: {level: level},
				codecClass: 'Deflater',
				crcType: crcType,
			};
			launchWorkerProcess(worker, initialMessage, reader, writer, 0, reader.size, onprogress, onend, onreaderror, onwriteerror);
		} else
			launchProcess(new obj.zip.Deflater(), reader, writer, 0, reader.size, crcType, onprogress, onend, onreaderror, onwriteerror);
	}

	function copy(worker, sn, reader, writer, offset, size, computeCrc32, onend, onprogress, onreaderror, onwriteerror) {
		var crcType = 'input';
		if (obj.zip.useWebWorkers && computeCrc32) {
			var initialMessage = {
				sn: sn,
				codecClass: 'NOOP',
				crcType: crcType,
			};
			launchWorkerProcess(worker, initialMessage, reader, writer, offset, size, onprogress, onend, onreaderror, onwriteerror);
		} else
			launchProcess(new NOOP(), reader, writer, offset, size, crcType, onprogress, onend, onreaderror, onwriteerror);
	}

	// ZipReader

	function decodeASCII(str) {
		var i, out = "", charCode, extendedASCII = [ '\u00C7', '\u00FC', '\u00E9', '\u00E2', '\u00E4', '\u00E0', '\u00E5', '\u00E7', '\u00EA', '\u00EB',
				'\u00E8', '\u00EF', '\u00EE', '\u00EC', '\u00C4', '\u00C5', '\u00C9', '\u00E6', '\u00C6', '\u00F4', '\u00F6', '\u00F2', '\u00FB', '\u00F9',
				'\u00FF', '\u00D6', '\u00DC', '\u00F8', '\u00A3', '\u00D8', '\u00D7', '\u0192', '\u00E1', '\u00ED', '\u00F3', '\u00FA', '\u00F1', '\u00D1',
				'\u00AA', '\u00BA', '\u00BF', '\u00AE', '\u00AC', '\u00BD', '\u00BC', '\u00A1', '\u00AB', '\u00BB', '_', '_', '_', '\u00A6', '\u00A6',
				'\u00C1', '\u00C2', '\u00C0', '\u00A9', '\u00A6', '\u00A6', '+', '+', '\u00A2', '\u00A5', '+', '+', '-', '-', '+', '-', '+', '\u00E3',
				'\u00C3', '+', '+', '-', '-', '\u00A6', '-', '+', '\u00A4', '\u00F0', '\u00D0', '\u00CA', '\u00CB', '\u00C8', 'i', '\u00CD', '\u00CE',
				'\u00CF', '+', '+', '_', '_', '\u00A6', '\u00CC', '_', '\u00D3', '\u00DF', '\u00D4', '\u00D2', '\u00F5', '\u00D5', '\u00B5', '\u00FE',
				'\u00DE', '\u00DA', '\u00DB', '\u00D9', '\u00FD', '\u00DD', '\u00AF', '\u00B4', '\u00AD', '\u00B1', '_', '\u00BE', '\u00B6', '\u00A7',
				'\u00F7', '\u00B8', '\u00B0', '\u00A8', '\u00B7', '\u00B9', '\u00B3', '\u00B2', '_', ' ' ];
		for (i = 0; i < str.length; i++) {
			charCode = str.charCodeAt(i) & 0xFF;
			if (charCode > 127)
				out += extendedASCII[charCode - 128];
			else
				out += String.fromCharCode(charCode);
		}
		return out;
	}

	function decodeUTF8(string) {
		return decodeURIComponent(escape(string));
	}

	function getString(bytes) {
		var i, str = "";
		for (i = 0; i < bytes.length; i++)
			str += String.fromCharCode(bytes[i]);
		return str;
	}

	function getDate(timeRaw) {
		var date = (timeRaw & 0xffff0000) >> 16, time = timeRaw & 0x0000ffff;
		try {
			return new Date(1980 + ((date & 0xFE00) >> 9), ((date & 0x01E0) >> 5) - 1, date & 0x001F, (time & 0xF800) >> 11, (time & 0x07E0) >> 5,
					(time & 0x001F) * 2, 0);
		} catch (e) {
		}
	}

	function readCommonHeader(entry, data, index, centralDirectory, onerror) {
		entry.version = data.view.getUint16(index, true);
		entry.bitFlag = data.view.getUint16(index + 2, true);
		entry.compressionMethod = data.view.getUint16(index + 4, true);
		entry.lastModDateRaw = data.view.getUint32(index + 6, true);
		entry.lastModDate = getDate(entry.lastModDateRaw);
		if ((entry.bitFlag & 0x01) === 0x01) {
			onerror(ERR_ENCRYPTED);
			return;
		}
		if (centralDirectory || (entry.bitFlag & 0x0008) != 0x0008) {
			entry.crc32 = data.view.getUint32(index + 10, true);
			entry.compressedSize = data.view.getUint32(index + 14, true);
			entry.uncompressedSize = data.view.getUint32(index + 18, true);
		}
		if (entry.compressedSize === 0xFFFFFFFF || entry.uncompressedSize === 0xFFFFFFFF) {
			onerror(ERR_ZIP64);
			return;
		}
		entry.filenameLength = data.view.getUint16(index + 22, true);
		entry.extraFieldLength = data.view.getUint16(index + 24, true);
	}

	function createZipReader(reader, callback, onerror) {
		var inflateSN = 0;

		function Entry() {
		}

		Entry.prototype.getData = function(writer, onend, onprogress, checkCrc32) {
			var that = this;

			function testCrc32(crc32) {
				var dataCrc32 = getDataHelper(4);
				dataCrc32.view.setUint32(0, crc32);
				return that.crc32 == dataCrc32.view.getUint32(0);
			}

			function getWriterData(uncompressedSize, crc32) {
				if (checkCrc32 && !testCrc32(crc32))
					onerror(ERR_CRC);
				else
					writer.getData(function(data) {
						onend(data);
					});
			}

			function onreaderror(err) {
				onerror(err || ERR_READ_DATA);
			}

			function onwriteerror(err) {
				onerror(err || ERR_WRITE_DATA);
			}

			reader.readUint8Array(that.offset, 30, function(bytes) {
				var data = getDataHelper(bytes.length, bytes), dataOffset;
				if (data.view.getUint32(0) != 0x504b0304) {
					onerror(ERR_BAD_FORMAT);
					return;
				}
				readCommonHeader(that, data, 4, false, onerror);
				dataOffset = that.offset + 30 + that.filenameLength + that.extraFieldLength;
				writer.init(function() {
					if (that.compressionMethod === 0)
						copy(that._worker, inflateSN++, reader, writer, dataOffset, that.compressedSize, checkCrc32, getWriterData, onprogress, onreaderror, onwriteerror);
					else
						inflate(that._worker, inflateSN++, reader, writer, dataOffset, that.compressedSize, checkCrc32, getWriterData, onprogress, onreaderror, onwriteerror);
				}, onwriteerror);
			}, onreaderror);
		};

		function seekEOCDR(eocdrCallback) {
			// "End of central directory record" is the last part of a zip archive, and is at least 22 bytes long.
			// Zip file comment is the last part of EOCDR and has max length of 64KB,
			// so we only have to search the last 64K + 22 bytes of a archive for EOCDR signature (0x06054b50).
			var EOCDR_MIN = 22;
			if (reader.size < EOCDR_MIN) {
				onerror(ERR_BAD_FORMAT);
				return;
			}
			var ZIP_COMMENT_MAX = 256 * 256, EOCDR_MAX = EOCDR_MIN + ZIP_COMMENT_MAX;

			// In most cases, the EOCDR is EOCDR_MIN bytes long
			doSeek(EOCDR_MIN, function() {
				// If not found, try within EOCDR_MAX bytes
				doSeek(Math.min(EOCDR_MAX, reader.size), function() {
					onerror(ERR_BAD_FORMAT);
				});
			});

			// seek last length bytes of file for EOCDR
			function doSeek(length, eocdrNotFoundCallback) {
				reader.readUint8Array(reader.size - length, length, function(bytes) {
					for (var i = bytes.length - EOCDR_MIN; i >= 0; i--) {
						if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
							eocdrCallback(new DataView(bytes.buffer, i, EOCDR_MIN));
							return;
						}
					}
					eocdrNotFoundCallback();
				}, function() {
					onerror(ERR_READ);
				});
			}
		}

		var zipReader = {
			getEntries : function(callback) {
				var worker = this._worker;
				// look for End of central directory record
				seekEOCDR(function(dataView) {
					var datalength, fileslength;
					datalength = dataView.getUint32(16, true);
					fileslength = dataView.getUint16(8, true);
					if (datalength < 0 || datalength >= reader.size) {
						onerror(ERR_BAD_FORMAT);
						return;
					}
					reader.readUint8Array(datalength, reader.size - datalength, function(bytes) {
						var i, index = 0, entries = [], entry, filename, comment, data = getDataHelper(bytes.length, bytes);
						for (i = 0; i < fileslength; i++) {
							entry = new Entry();
							entry._worker = worker;
							if (data.view.getUint32(index) != 0x504b0102) {
								onerror(ERR_BAD_FORMAT);
								return;
							}
							readCommonHeader(entry, data, index + 6, true, onerror);
							entry.commentLength = data.view.getUint16(index + 32, true);
							entry.directory = ((data.view.getUint8(index + 38) & 0x10) == 0x10);
							entry.offset = data.view.getUint32(index + 42, true);
							filename = getString(data.array.subarray(index + 46, index + 46 + entry.filenameLength));
							entry.filename = ((entry.bitFlag & 0x0800) === 0x0800) ? decodeUTF8(filename) : decodeASCII(filename);
							if (!entry.directory && entry.filename.charAt(entry.filename.length - 1) == "/")
								entry.directory = true;
							comment = getString(data.array.subarray(index + 46 + entry.filenameLength + entry.extraFieldLength, index + 46
									+ entry.filenameLength + entry.extraFieldLength + entry.commentLength));
							entry.comment = ((entry.bitFlag & 0x0800) === 0x0800) ? decodeUTF8(comment) : decodeASCII(comment);
							entries.push(entry);
							index += 46 + entry.filenameLength + entry.extraFieldLength + entry.commentLength;
						}
						callback(entries);
					}, function() {
						onerror(ERR_READ);
					});
				});
			},
			close : function(callback) {
				if (this._worker) {
					this._worker.terminate();
					this._worker = null;
				}
				if (callback)
					callback();
			},
			_worker: null
		};

		if (!obj.zip.useWebWorkers)
			callback(zipReader);
		else {
			createWorker('inflater',
				function(worker) {
					zipReader._worker = worker;
					callback(zipReader);
				},
				function(err) {
					onerror(err);
				}
			);
		}
	}

	// ZipWriter

	function encodeUTF8(string) {
		return unescape(encodeURIComponent(string));
	}

	function getBytes(str) {
		var i, array = [];
		for (i = 0; i < str.length; i++)
			array.push(str.charCodeAt(i));
		return array;
	}

	function createZipWriter(writer, callback, onerror, dontDeflate) {
		var files = {}, filenames = [], datalength = 0;
		var deflateSN = 0;

		function onwriteerror(err) {
			onerror(err || ERR_WRITE);
		}

		function onreaderror(err) {
			onerror(err || ERR_READ_DATA);
		}

		var zipWriter = {
			add : function(name, reader, onend, onprogress, options) {
				var header, filename, date;
				var worker = this._worker;

				function writeHeader(callback) {
					var data;
					date = options.lastModDate || new Date();
					header = getDataHelper(26);
					files[name] = {
						headerArray : header.array,
						directory : options.directory,
						filename : filename,
						offset : datalength,
						comment : getBytes(encodeUTF8(options.comment || ""))
					};
					header.view.setUint32(0, 0x14000808);
					if (options.version)
						header.view.setUint8(0, options.version);
					if (!dontDeflate && options.level !== 0 && !options.directory)
						header.view.setUint16(4, 0x0800);
					header.view.setUint16(6, (((date.getHours() << 6) | date.getMinutes()) << 5) | date.getSeconds() / 2, true);
					header.view.setUint16(8, ((((date.getFullYear() - 1980) << 4) | (date.getMonth() + 1)) << 5) | date.getDate(), true);
					header.view.setUint16(22, filename.length, true);
					data = getDataHelper(30 + filename.length);
					data.view.setUint32(0, 0x504b0304);
					data.array.set(header.array, 4);
					data.array.set(filename, 30);
					datalength += data.array.length;
					writer.writeUint8Array(data.array, callback, onwriteerror);
				}

				function writeFooter(compressedLength, crc32) {
					var footer = getDataHelper(16);
					datalength += compressedLength || 0;
					footer.view.setUint32(0, 0x504b0708);
					if (typeof crc32 != "undefined") {
						header.view.setUint32(10, crc32, true);
						footer.view.setUint32(4, crc32, true);
					}
					if (reader) {
						footer.view.setUint32(8, compressedLength, true);
						header.view.setUint32(14, compressedLength, true);
						footer.view.setUint32(12, reader.size, true);
						header.view.setUint32(18, reader.size, true);
					}
					writer.writeUint8Array(footer.array, function() {
						datalength += 16;
						onend();
					}, onwriteerror);
				}

				function writeFile() {
					options = options || {};
					name = name.trim();
					if (options.directory && name.charAt(name.length - 1) != "/")
						name += "/";
					if (files.hasOwnProperty(name)) {
						onerror(ERR_DUPLICATED_NAME);
						return;
					}
					filename = getBytes(encodeUTF8(name));
					filenames.push(name);
					writeHeader(function() {
						if (reader)
							if (dontDeflate || options.level === 0)
								copy(worker, deflateSN++, reader, writer, 0, reader.size, true, writeFooter, onprogress, onreaderror, onwriteerror);
							else
								deflate(worker, deflateSN++, reader, writer, options.level, writeFooter, onprogress, onreaderror, onwriteerror);
						else
							writeFooter();
					}, onwriteerror);
				}

				if (reader)
					reader.init(writeFile, onreaderror);
				else
					writeFile();
			},
			close : function(callback) {
				if (this._worker) {
					this._worker.terminate();
					this._worker = null;
				}

				var data, length = 0, index = 0, indexFilename, file;
				for (indexFilename = 0; indexFilename < filenames.length; indexFilename++) {
					file = files[filenames[indexFilename]];
					length += 46 + file.filename.length + file.comment.length;
				}
				data = getDataHelper(length + 22);
				for (indexFilename = 0; indexFilename < filenames.length; indexFilename++) {
					file = files[filenames[indexFilename]];
					data.view.setUint32(index, 0x504b0102);
					data.view.setUint16(index + 4, 0x1400);
					data.array.set(file.headerArray, index + 6);
					data.view.setUint16(index + 32, file.comment.length, true);
					if (file.directory)
						data.view.setUint8(index + 38, 0x10);
					data.view.setUint32(index + 42, file.offset, true);
					data.array.set(file.filename, index + 46);
					data.array.set(file.comment, index + 46 + file.filename.length);
					index += 46 + file.filename.length + file.comment.length;
				}
				data.view.setUint32(index, 0x504b0506);
				data.view.setUint16(index + 8, filenames.length, true);
				data.view.setUint16(index + 10, filenames.length, true);
				data.view.setUint32(index + 12, length, true);
				data.view.setUint32(index + 16, datalength, true);
				writer.writeUint8Array(data.array, function() {
					writer.getData(callback);
				}, onwriteerror);
			},
			_worker: null
		};

		if (!obj.zip.useWebWorkers)
			callback(zipWriter);
		else {
			createWorker('deflater',
				function(worker) {
					zipWriter._worker = worker;
					callback(zipWriter);
				},
				function(err) {
					onerror(err);
				}
			);
		}
	}

	function resolveURLs(urls) {
		var a = document.createElement('a');
		return urls.map(function(url) {
			a.href = url;
			return a.href;
		});
	}

	var DEFAULT_WORKER_SCRIPTS = {
		deflater: ['z-worker.js', 'deflate.js'],
		inflater: ['z-worker.js', 'inflate.js']
	};
	function createWorker(type, callback, onerror) {
		if (obj.zip.workerScripts !== null && obj.zip.workerScriptsPath !== null) {
			onerror(new Error('Either zip.workerScripts or zip.workerScriptsPath may be set, not both.'));
			return;
		}
		var scripts;
		if (obj.zip.workerScripts) {
			scripts = obj.zip.workerScripts[type];
			if (!Array.isArray(scripts)) {
				onerror(new Error('zip.workerScripts.' + type + ' is not an array!'));
				return;
			}
			scripts = resolveURLs(scripts);
		} else {
			scripts = DEFAULT_WORKER_SCRIPTS[type].slice(0);
			scripts[0] = (obj.zip.workerScriptsPath || '') + scripts[0];
		}
		var worker = new Worker(scripts[0]);
		// record total consumed time by inflater/deflater/crc32 in this worker
		worker.codecTime = worker.crcTime = 0;
		worker.postMessage({ type: 'importScripts', scripts: scripts.slice(1) });
		worker.addEventListener('message', onmessage);
		function onmessage(ev) {
			var msg = ev.data;
			if (msg.error) {
				worker.terminate(); // should before onerror(), because onerror() may throw.
				onerror(msg.error);
				return;
			}
			if (msg.type === 'importScripts') {
				worker.removeEventListener('message', onmessage);
				worker.removeEventListener('error', errorHandler);
				callback(worker);
			}
		}
		// catch entry script loading error and other unhandled errors
		worker.addEventListener('error', errorHandler);
		function errorHandler(err) {
			worker.terminate();
			onerror(err);
		}
	}

	function onerror_default(error) {
		console.error(error);
	}
	obj.zip = {
		Reader : Reader,
		Writer : Writer,
		BlobReader : BlobReader,
		Data64URIReader : Data64URIReader,
		TextReader : TextReader,
		BlobWriter : BlobWriter,
		Data64URIWriter : Data64URIWriter,
		TextWriter : TextWriter,
		createReader : function(reader, callback, onerror) {
			onerror = onerror || onerror_default;

			reader.init(function() {
				createZipReader(reader, callback, onerror);
			}, onerror);
		},
		createWriter : function(writer, callback, onerror, dontDeflate) {
			onerror = onerror || onerror_default;
			dontDeflate = !!dontDeflate;

			writer.init(function() {
				createZipWriter(writer, callback, onerror, dontDeflate);
			}, onerror);
		},
		useWebWorkers : true,
		/**
		 * Directory containing the default worker scripts (z-worker.js, deflate.js, and inflate.js), relative to current base url.
		 * E.g.: zip.workerScripts = './';
		 */
		workerScriptsPath : null,
		/**
		 * Advanced option to control which scripts are loaded in the Web worker. If this option is specified, then workerScriptsPath must not be set.
		 * workerScripts.deflater/workerScripts.inflater should be arrays of urls to scripts for deflater/inflater, respectively.
		 * Scripts in the array are executed in order, and the first one should be z-worker.js, which is used to start the worker.
		 * All urls are relative to current base url.
		 * E.g.:
		 * zip.workerScripts = {
		 *   deflater: ['z-worker.js', 'deflate.js'],
		 *   inflater: ['z-worker.js', 'inflate.js']
		 * };
		 */
		workerScripts : null,
	};

})(this);
/*
 Copyright (c) 2013 Gildas Lormeau. All rights reserved.

 Redistribution and use in source and binary forms, with or without
 modification, are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice,
 this list of conditions and the following disclaimer.

 2. Redistributions in binary form must reproduce the above copyright
 notice, this list of conditions and the following disclaimer in
 the documentation and/or other materials provided with the distribution.

 3. The names of the authors may not be used to endorse or promote products
 derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES,
 INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT,
 INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT,
 INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA,
 OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

(function() {
	"use strict";

	var ERR_HTTP_RANGE = "HTTP Range not supported.";

	var Reader = zip.Reader;
	var Writer = zip.Writer;
	
	var ZipDirectoryEntry;

	var appendABViewSupported;
	try {
		appendABViewSupported = new Blob([ new DataView(new ArrayBuffer(0)) ]).size === 0;
	} catch (e) {
	}

	function HttpReader(url) {
		var that = this;

		function getData(callback, onerror) {
			var request;
			if (!that.data) {
				request = new XMLHttpRequest();
				request.addEventListener("load", function() {
					if (!that.size)
						that.size = Number(request.getResponseHeader("Content-Length"));
					that.data = new Uint8Array(request.response);
					callback();
				}, false);
				request.addEventListener("error", onerror, false);
				request.open("GET", url);
				request.responseType = "arraybuffer";
				request.send();
			} else
				callback();
		}

		function init(callback, onerror) {
			var request = new XMLHttpRequest();
			request.addEventListener("load", function() {
				that.size = Number(request.getResponseHeader("Content-Length"));
				callback();
			}, false);
			request.addEventListener("error", onerror, false);
			request.open("HEAD", url);
			request.send();
		}

		function readUint8Array(index, length, callback, onerror) {
			getData(function() {
				callback(new Uint8Array(that.data.subarray(index, index + length)));
			}, onerror);
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	HttpReader.prototype = new Reader();
	HttpReader.prototype.constructor = HttpReader;

	function HttpRangeReader(url) {
		var that = this;

		function init(callback, onerror) {
			var request = new XMLHttpRequest();
			request.addEventListener("load", function() {
				that.size = Number(request.getResponseHeader("Content-Length"));
				if (request.getResponseHeader("Accept-Ranges") == "bytes")
					callback();
				else
					onerror(ERR_HTTP_RANGE);
			}, false);
			request.addEventListener("error", onerror, false);
			request.open("HEAD", url);
			request.send();
		}

		function readArrayBuffer(index, length, callback, onerror) {
			var request = new XMLHttpRequest();
			request.open("GET", url);
			request.responseType = "arraybuffer";
			request.setRequestHeader("Range", "bytes=" + index + "-" + (index + length - 1));
			request.addEventListener("load", function() {
				callback(request.response);
			}, false);
			request.addEventListener("error", onerror, false);
			request.send();
		}

		function readUint8Array(index, length, callback, onerror) {
			readArrayBuffer(index, length, function(arraybuffer) {
				callback(new Uint8Array(arraybuffer));
			}, onerror);
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	HttpRangeReader.prototype = new Reader();
	HttpRangeReader.prototype.constructor = HttpRangeReader;

	function ArrayBufferReader(arrayBuffer) {
		var that = this;

		function init(callback, onerror) {
			that.size = arrayBuffer.byteLength;
			callback();
		}

		function readUint8Array(index, length, callback, onerror) {
			callback(new Uint8Array(arrayBuffer.slice(index, index + length)));
		}

		that.size = 0;
		that.init = init;
		that.readUint8Array = readUint8Array;
	}
	ArrayBufferReader.prototype = new Reader();
	ArrayBufferReader.prototype.constructor = ArrayBufferReader;

	function ArrayBufferWriter() {
		var array, that = this;

		function init(callback, onerror) {
			array = new Uint8Array();
			callback();
		}

		function writeUint8Array(arr, callback, onerror) {
			var tmpArray = new Uint8Array(array.length + arr.length);
			tmpArray.set(array);
			tmpArray.set(arr, array.length);
			array = tmpArray;
			callback();
		}

		function getData(callback) {
			callback(array.buffer);
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	ArrayBufferWriter.prototype = new Writer();
	ArrayBufferWriter.prototype.constructor = ArrayBufferWriter;

	function FileWriter(fileEntry, contentType) {
		var writer, that = this;

		function init(callback, onerror) {
			fileEntry.createWriter(function(fileWriter) {
				writer = fileWriter;
				callback();
			}, onerror);
		}

		function writeUint8Array(array, callback, onerror) {
			var blob = new Blob([ appendABViewSupported ? array : array.buffer ], {
				type : contentType
			});
			writer.onwrite = function() {
				writer.onwrite = null;
				callback();
			};
			writer.onerror = onerror;
			writer.write(blob);
		}

		function getData(callback) {
			fileEntry.file(callback);
		}

		that.init = init;
		that.writeUint8Array = writeUint8Array;
		that.getData = getData;
	}
	FileWriter.prototype = new Writer();
	FileWriter.prototype.constructor = FileWriter;

	zip.FileWriter = FileWriter;
	zip.HttpReader = HttpReader;
	zip.HttpRangeReader = HttpRangeReader;
	zip.ArrayBufferReader = ArrayBufferReader;
	zip.ArrayBufferWriter = ArrayBufferWriter;

	if (zip.fs) {
		ZipDirectoryEntry = zip.fs.ZipDirectoryEntry;
		ZipDirectoryEntry.prototype.addHttpContent = function(name, URL, useRangeHeader) {
			function addChild(parent, name, params, directory) {
				if (parent.directory)
					return directory ? new ZipDirectoryEntry(parent.fs, name, params, parent) : new zip.fs.ZipFileEntry(parent.fs, name, params, parent);
				else
					throw "Parent entry is not a directory.";
			}

			return addChild(this, name, {
				data : URL,
				Reader : useRangeHeader ? HttpRangeReader : HttpReader
			});
		};
		ZipDirectoryEntry.prototype.importHttpContent = function(URL, useRangeHeader, onend, onerror) {
			this.importZip(useRangeHeader ? new HttpRangeReader(URL) : new HttpReader(URL), onend, onerror);
		};
		zip.fs.FS.prototype.importHttpContent = function(URL, useRangeHeader, onend, onerror) {
			this.entries = [];
			this.root = new ZipDirectoryEntry(this);
			this.root.importHttpContent(URL, useRangeHeader, onend, onerror);
		};
	}

})();
//real time communication
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white, node, eval
*/
/*global
    ui, D, R, rtc, sockets, MESSAGES, localDisplayedName, caches
*/
/*could add close connection button*/
ui = (function () {
    const API = {
        selectedUserId : ""
    };
    const MAX_MESSAGES = 50;
    const UISTRINGS = {
        CONNECTING: "Connecting",
        CONNECTED: "Connected",
        SELECT: "Select",
        SELECTED: "Selected",
        CONNECT_SELECT: "Connect and select",
        BAD_ID_FORMAT: "The ID didn't match the following requirement. An ID is 4 to 25 characters long, and only etters from a to Z and digits from 0 to 9  are allowed.",
        ALREADY_TAKEN_REJECTED: "The ID is already taken. Chose another ID.",
        ID_CHANGE_REQUEST_SENT: "The request to change the ID has been sent. Waiting for an answer.",
        ID_CHANGE_SUCCESS: "Your ID has been successfully changed."
    };
    
    const ifEnter = function (event) {
        /*returns true if it was not keydown event or enter pressed and shift not pressed*/
        return (!event ||
            !(event.type === "keydown") ||
            ((event.keyCode === 13) && (!event.shiftKey))
        );
    };
    
    let acceptConditionResolve = function () {};
    let wantToConnectTo = "";
    let uiIdStrings = [];
    const uiUserRelationState = {}; // 0: None 1 Connecting 2 Connected
    
    
    const markUserAsConnecting = function (selectedUserId) {   
        const uiIdString = "user_" + selectedUserId;     
        if (selectedUserId && D.el[uiIdString]) {
            D.el[uiIdString].connectButton.disabled = true;
            D.vr[uiIdString].connectButton = UISTRINGS.CONNECTING;
            uiUserRelationState[selectedUserId] = 1;
        }
    };
    
    const markUserAsConnected = function (selectedUserId, connected = true) {
    /*multiple connections can be open at once.
    It is only possible to select an user if it is connected, we need to reflect that*/
        const uiIdString = "user_" + selectedUserId;
        if (selectedUserId && D.el[uiIdString]) {
            D.el[uiIdString].connectButton.disabled = connected;
            D.el[uiIdString].selectButton.disabled = !connected;
            D.el[uiIdString].selectButton.hidden = !connected;
            if (connected) {
                D.vr[uiIdString].connectButton = UISTRINGS.CONNECTED;
                D.vr[uiIdString].selectButton = UISTRINGS.SELECT;
                uiUserRelationState[selectedUserId] = 2;
            } else {
                D.el[uiIdString].connectButton.disabled = false;
                D.el[uiIdString].selectButton.disabled = true;
                D.el[uiIdString].selectButton.hidden = true;
                D.vr[uiIdString].connectButton = UISTRINGS.CONNECT_SELECT;
                uiUserRelationState[selectedUserId] = 0;
            
            }
        }
    };
    
    const markUserAsSelected = function (selectedUserId, selected = true) {
        /*only 1 can be selected at a time*/
        if (uiUserRelationState[selectedUserId] !== 2) {
            //non connected, means we cannot select it
            selected = false;
        }
        const uiIdString = "user_" + selectedUserId;
        const uiIdStringLastSelected = "user_" + API.selectedUserId;

        if (selected) {
            if (API.selectedUserId && D.el[uiIdStringLastSelected]) {
                D.el[uiIdStringLastSelected].selectButton.disabled = false;
                D.vr[uiIdStringLastSelected].selectButton = UISTRINGS.SELECT;
                D.el[uiIdStringLastSelected + "host"].className = "";
            }
            
            if (selectedUserId && D.el[uiIdString]) {
                D.el[uiIdString].selectButton.disabled = true;
                D.vr[uiIdString].selectButton = UISTRINGS.SELECTED;
                D.el[uiIdString + "host"].className = "active";
            }
            
            API.selectedUserId = selectedUserId;
            toggleCommunicationControls(selectedUserId);
        } else {
            if (selectedUserId && D.el[uiIdString]) {
                D.el[uiIdString].selectButton.disabled = false;
                D.vr[uiIdString].selectButton = UISTRINGS.SELECT;
                D.el[uiIdString + "host"].className = "";
            }
        }
    };
    
    const selectAfterConnected = function (selectedUserId) {
        if (wantToConnectTo === selectedUserId) {
            markUserAsSelected(selectedUserId);
        }
    };
    
    const updateUserList = function (list) {
        /*we might need to see what connection we already have*/
        const removeSelf = R.filter((displayedName) => displayedName !== localDisplayedName);
        const format = R.map(function (user) {
            return user.displayedName;
        });
        
        //console.log(format, removeSelf, list);
        const connected_users = R.pipe(format , removeSelf)(list);
        
        //console.log(connected_users);
        D.el.connected_users.innerHTML = "";
        uiIdStrings.forEach(function (uiIdString) {
            D.forgetKey(uiIdString);
        });
        uiIdStrings = [];
        connected_users.map(function (displayedName) {
            const uiIdString = "user_" + displayedName;
            uiIdStrings.push(uiIdString);
            
            const userItemElement = D.createElement2({
                "tagName": "li",
                "is": "user-item",
                "data-in": uiIdString,
                "data-el": uiIdString + "host"
            });
            /*D.vr = {
                [uiIdString]: {
                    userDisplayName : displayedName
                }
            };*/
            D.vr[uiIdString] = {
                userDisplayName : displayedName
            };
            D.linkJsAndDom(userItemElement);
            
            if (rtc.rtcPeerConnectionFromId.has(displayedName) && rtc.isOpenFromDisplayName(displayedName)) {
                D.el[uiIdString + "host"].className = "";
                D.el[uiIdString].connectButton.disabled = true;
                D.vr[uiIdString].connectButton = "Connected";
                D.el[uiIdString].selectButton.disabled = false;
                D.el[uiIdString].selectButton.hidden = false;
                
            }
            if (uiUserRelationState[displayedName] === 1) {
                markUserAsConnecting(displayedName);
            }
            
            if (uiUserRelationState[displayedName] === 2) {
                markUserAsConnected(displayedName);
            }
            D.el.connected_users.appendChild(userItemElement);
        });
        
        //cleanup disconnected users from uiUserRelationState
        Object.keys(uiUserRelationState).forEach(function (userId) {
            if (!connected_users.includes(userId)) {
                delete uiUserRelationState[userId];
            }
        });
        if (API.selectedUserId) {
            markUserAsSelected(API.selectedUserId);
        }
        
    };

    const toggleCommunicationControls = function (displayName) {        
        const able = rtc.isOpenFromDisplayName(displayName);
        const hasIndex = rtc.connectedUsers.some(function (connectedUser) {
            return (connectedUser.displayedName === displayName && connectedUser.isServer);
        });
        const notAble = !able;
        D.el.send_button.disabled = notAble;
        D.el.input.disabled = notAble;
        D.el.indexLink.classList.toggle("disabled", !hasIndex);
    };
          
    const displayOwnUserId = function () {
        D.vr.your_id = localDisplayedName;
    };
    
    const displayFatalError = function (error, ...more) {
        D.vr.log = error;
        console.log(error);
        if (more && more.length > 0) {
            console.log(...more);
        }
    };
    
    const display = function (wantToDisplay) {
        displayLandingPage(!wantToDisplay);
        D.el.main.hidden = !wantToDisplay;
        const previous = localData.get("localDisplayedName");
        if (previous) {
            D.vr.newId = previous;
            D.fx.idChangeRequest();
        }
        D.vr.log = "";
        
    };
    
    const displayLandingPage = function (wantToDisplay = true) {
        D.el.landingPage.hidden = !wantToDisplay;
        D.vr.log = "";
        return new Promise(function (resolve, reject) {
            acceptConditionResolve = resolve;
        });
    };
    
    const serverLog = function (any) {
        D.vr.serverLog += "\n" + JSON.stringify(any);
        console.log(any);
    };
    
    let displayNonMetRequirement = function (nonMetRequirement) {
        D.linkJsAndDom();
        let i = 0;
        const splitTextContentHref = function (link) {
            return {innerHTML: `<a href="${link}" target="_blank" rel="noopener noreferrer">${link}</a>`};
        };
        Object.keys(nonMetRequirement).forEach(function (technicalName) {
            i += 1;
            const iString = "i" + String(i);
            const requirementI = nonMetRequirement[technicalName]
            
            const missingFeatureElement = D.createElement2({
                "tagName": "missing-feature",
                "data-in": iString
            });

            D.vr = {
                [iString]: {
                    title : technicalName,
                    text : requirementI.text,
                    links: requirementI.links.map(splitTextContentHref)
                }
            };
            D.linkJsAndDom(missingFeatureElement);
            D.el.missingFeatures.appendChild(missingFeatureElement);
        });
    };
    
    const start = function () {
        uiFiles.start();
        D.fx.acceptAndStart = function (event) {
            acceptConditionResolve();
            display(true);
            localData.set(MESSAGES.CONDITION_ACCEPTED, "true");

        };
        
        D.fx.changeCustom = function (event) {
                    
            const wantedToUseCustom = D.vr.useCustom;
            
            if (wantedToUseCustom) {
                D.vr.useCustom = false;
                D.vr.parsingResult = "Stopped while editing !";
                rtc.useHandleRequestCustom(false);
                browserServer.close();
            }
        };

        D.fx.warnBeforeLeaveChange = function (event) {
            localData.set("warnBeforeLeave", D.vr.warnBeforeLeave);
            //todo display change saved
        };
        
        D.fx.wantNotificationChange = function (event) {
            // notificationEnabled = false
            const wantNotification = D.vr.wantNotification;
            let feedBackText;
            
            if (wantNotification) {
                if (!("Notification" in window)) {
                    feedBackText = "This browser does not support desktop notification, or this option has been disabled";
                    notificationEnabled = false;
                    localData.set("notifications", notificationEnabled);
                    D.vr.wantNotification = notificationEnabled;
                } else {
                
                    if (Notification.permission === "granted") {
                        feedBackText = "Notifications enabled";
                        notificationEnabled = true;
                        localData.set("notifications", notificationEnabled);
                    } else {
                        feedBackText = "Waiting for autorization";
                        D.vr.wantNotification = false;
                        Notification.requestPermission(function (permission) {
                            if (permission === "granted") {
                                D.vr.wantNotificationFeedBack = "Notifications enabled";
                                notificationEnabled = true;
                                localData.set("notifications", notificationEnabled);
                                D.vr.wantNotification = notificationEnabled;
                            } else {
                                D.vr.wantNotificationFeedBack = "Notifications access denied";
                                notificationEnabled = false;
                                localData.set("notifications", notificationEnabled);
                            }
                        });
                    }                
                }
            } else {
                feedBackText = "Notifications disabled";
                notificationEnabled = false;
                localData.set("notifications", notificationEnabled);
            }
            D.vr.wantNotificationFeedBack = feedBackText;
        };
          
        
        D.fx.useCustom = function (event) {
            /*USE custom index.js as the pseudo server*/
            
            const wantToUseCustom = D.vr.useCustom;
            
            if (wantToUseCustom) {
                browserServer.setBrowserServerCode(D.vr.userCode);
                browserServer.run().then(function () {
                    D.el.parsingResult.classList.toggle("error", false);
                    D.vr.parsingResult = "Successfully parsed";
                    rtc.useHandleRequestCustom(true);
                }).catch(lateReject);
            } else {
                browserServer.close();
                rtc.useHandleRequestCustom(false);
            }
            
        };

        D.fx.sendMessage = function (event) {
            if (!ifEnter(event)) {
                return;
            }
            rtc.sendRtcMessage(API.selectedUserId, D.vr.input);
            displayMessage(`You to ${API.selectedUserId}:  ${D.vr.input}`);
            D.vr.input = "";
            event.preventDefault();
        };

        D.fx.connectToUser = function (event) {
            const selectedUserUiPiece = D.getParentContext(event.target);
            const selectedUserId = selectedUserUiPiece.vr.userDisplayName;
            markUserAsConnecting(selectedUserId);
            wantToConnectTo = selectedUserId;
            rtc.startConnectionWith(true, selectedUserId);
            //when connected will call markUserAsSelected   
        };

        D.fx.selectUser = function (event) {
            const selectedUserUiPiece = D.getParentContext(event.target);
            const selectedUserId = selectedUserUiPiece.vr.userDisplayName;
            //wantToConnectTo = selectedUserId;
            markUserAsSelected(selectedUserId);
        };

        D.fx.debug = function (event) {
            const a = 5;
            D.vr.log = a;
            console.log(a);
        };
        
        D.fx.idChangeRequest = function (event) {
            if (!ifEnter(event)) {
                return;
            }
            const PATTERN = /[a-zA-Z0-9]{4,25}/;
            const newId = D.vr.newId;
            const length = newId.length;
            if (!PATTERN.test(newId)) {
                D.vr.idChangeFeedback = UISTRINGS.BAD_ID_FORMAT;
                return;
            }
            sockets.requestIdChange(newId);
            D.vr.idChangeFeedback = UISTRINGS.ID_CHANGE_REQUEST_SENT;
            D.el.idChangeRequestButton.disabled = true;
            D.el.newId.disabled = true;
        };
    
        D.fx.changeLocalServerAvailability = function (event) {
        //todo needs server confirmation ? not important
            sockets.socket.emit(MESSAGES.LOCAL_SERVER_STATE, {
                displayedName: localDisplayedName,
                isServer: D.vr.localServerAvailability
            });
        };

        D.fx.deleteAll = function (event) {
            yesNoDialog(`Delete all local data and quit ?`, "Yes", "No, Cancel").then(function (answer) {
                if (answer) {
                    localData.clearAll();
                    serviceWorkerManager.deleteServiceWorker();
                    /*also
                    close all webrtc connection 
                    close websocket
                    */
                    D.vr.warnBeforeLeave = false; // don't ask twice
                    caches.keys().then(function (cacheVersions) {
                        return Promise.all(
                            cacheVersions.map(function (cacheVersion) {
                                return caches.delete(cacheVersion);
                            })
                        );
                    }).then(function (notUsed) {
                        location.href = location.href + "quit";
                    });
                }
            });
        };
        const removeAndForget = function (elementName) {
            D.el[elementName].remove();
            D.forgetKey(elementName);
        };
        displayNonMetRequirement = undefined;

        D.vr.log = "Starting ...";
        D.vr.input = "";
        D.vr.output = "";
        D.vr.newId = "";
        D.vr.warnBeforeLeave = localData.getElseDefault("warnBeforeLeave", "false");
        D.vr.wantNotification = localData.getElseDefault("notifications", notificationEnabled);
        D.fx.wantNotificationChange();
        D.vr.useCustom = false;
        D.vr.your_id = "not yet connected";
        D.vr.localServerAvailability = false;
        //needs to be same as handleRequestDefault
        D.vr.userCode = `const http = require("http");
const hostname = "127.0.0.1";
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("Hello World\\n");
});

server.listen(port, hostname, () => {
  console.log(\`Server running at http://\${hostname}:\${port}/\`);
});
`;

        

        D.linkJsAndDom();
        removeAndForget("missingFeatures");
        removeAndForget("missingFeatureTemplate");
        
    };
    
    const messageElementList = [];
    const displayMessage = function (text) {
        const beforeLastMessageCopyElement = document.createElement("p");
        beforeLastMessageCopyElement.textContent = D.vr.lastMessage;
        D.el.allButLastMessages.appendChild(beforeLastMessageCopyElement);
        messageElementList.push(beforeLastMessageCopyElement);
        D.vr.lastMessage = text;
        if (messageElementList.length > MAX_MESSAGES) {
            messageElementList.shift().remove();
        }
    };
    
    const handleMessage = function (headerBodyObject, fromId) {
        displayMessage(`From ${fromId}:  ${headerBodyObject.body}`);
        return; // undefined
    };
    
    const handleChangeIdResponse = function (message, data) {
        if (message === MESSAGES.USER_ID_CHANGE || message === MESSAGES.CONFIRM_ID_CHANGE) {
            const {newId, oldId} = data;
            rtc.connectedUsers.some(function (userObject) {
                if (userObject.displayedName === oldId) {
                    userObject.displayedName = newId;
                    return true;
                }
            });
            if (message === MESSAGES.CONFIRM_ID_CHANGE) {
            
                D.vr.newId = "";
                D.vr.your_id = newId;
                localDisplayedName = newId;
                D.vr.idChangeFeedback = UISTRINGS.ID_CHANGE_SUCCESS;
                localData.set("localDisplayedName", newId);
                
            } else if (message === MESSAGES.USER_ID_CHANGE) {
                if (wantToConnectTo === oldId) {
                    wantToConnectTo = newId;
                }
                if (API.selectedUserId === oldId) {
                    API.selectedUserId = newId;
                }
                if (uiUserRelationState[oldId]) {
                    uiUserRelationState[newId] = uiUserRelationState[oldId];
                    delete uiUserRelationState[oldId];
                }
                rtc.userIdChange(oldId, newId);
                updateUserList(rtc.connectedUsers);
                return;
                
            }
        } else if (message === MESSAGES.BAD_ID_FORMAT_REJECTED) {
            D.vr.idChangeFeedback = UISTRINGS.BAD_ID_FORMAT;
        } else if (message === MESSAGES.ALREADY_TAKEN_REJECTED) {
            D.vr.idChangeFeedback = UISTRINGS.ALREADY_TAKEN_REJECTED;
        }
        D.el.idChangeRequestButton.disabled = false;
        D.el.newId.disabled = false;
    };
    
    const lateReject = function (reason) {
        /*error in the worker, that handles requests, see browserserver.js
        browserServer has been  closed with browserServer.close() at this point*/
        D.vr.useCustom = false;
        D.el.parsingResult.classList.toggle("error", true);
        D.vr.parsingResult = reason;
        rtc.useHandleRequestCustom(false);

    };
    
    Object.assign(API, {
        start,
        updateUserList,
        displayOwnUserId,
        displayFatalError,
        display,
        displayLandingPage,
        markUserAsConnected,
        markUserAsSelected,
        selectAfterConnected,
        serverLog,
        handleMessage,
        handleChangeIdResponse,
        displayNonMetRequirement,
        lateReject
    });
    
    return API;
}());
/*uiFiles.js*/
/*jslint
    es6, maxerr: 15, browser, devel, fudge, maxlen: 100
*/
/*global
    FileReader, Promise, D
*/
/*we can then send data as arrayBuffer 
*/
uiFiles = (function () {

    const ressourceContentFromElement = new WeakMap();
    const fileNameFromKey = {}; 
    
    const FILE_INPUT_PREFIX = "FI";
    
    const STRINGS = {
        CANNOT_LOAD_ZIP: "Could not load zip: ",
        FILE_LOADED: "file loaded"
    };
    
    const fileInputDescription = {
        "tagName": "input",
        "type": "file",
        "data-fx": "xReadFileStart",
        "multiple": "multiple"
    };

    const detectCommonPrefix = function (fileInformations) {
        return fileInformations.map(function (fileInformation) {
            return fileInformation.name;
        }).reduce(function (previousPrefix, name, index) {
            const splitName = name.split("/");
            if (splitName.length > 1) {
                const currentPrefix = splitName[0] + "/";
                if (currentPrefix === previousPrefix || index === 0) {
                    return currentPrefix;
                }
            }
            return "";
        }, "");
    };
    
    const removeCommonPrefix = function (fileInformations, commonPrefix) {
        if (!commonPrefix) {
            return;
        }
        const prefixLength = commonPrefix.length;
        fileInformations.forEach(function (fileInformation) {
            fileInformation.name = fileInformation.name.substr(prefixLength);
        });
    };

    
    const readerOnLoadPrepare = function (inputElement, length) {
        let loaded = 0;
        let maybePackageObject;
        let maybePackageString;
        let all = [];
        D.el.fileProgress.hidden = false;
        D.el.fileProgress.max = length;
        D.el.fileProgress.value = 0;
        
        const tryResolve = function () {
            if (loaded < length) {
                D.el.fileProgress.value = loaded;
                return;
            }
            D.el.fileProgress.hidden = true;
            
            //all loaded
            all = all.filter(function (fileInformation) {//remove empty things
                return fileInformation.arrayBuffer.byteLength !== 0;
            });
            removeCommonPrefix(all, detectCommonPrefix(all));
            
            const files = {
                files: all                    
            };
            if (maybePackageObject) {
                files.package = {
                    packageString: maybePackageString,
                    packageObject: maybePackageObject
                };
            }
            inputElement.readFileResolve(files);
            inputElement.remove();
        };
        
        return {
            add : function (arrayBuffer, mime, name) {
                all.push({arrayBuffer, mime, name});
                loaded += 1;
                tryResolve();
            },
            addPackage: function (JSONstring, packageObject) {
                maybePackageString = JSONstring;
                maybePackageObject = packageObject;
                loaded += 1;
                tryResolve();
            }
        };
        
    };
    
    const addBlob = function (addBuffer, blob, mime, name) {
        /*addBuffer is from readerOnLoadPrepare*/
        if (isPackageDotJsonFromFileName(name)) {
            bytes.stringPromiseFromBlob(blob).then(function (string) {
                let packageObject;
                try {
                    packageObject = JSON.parse(string);
                } catch (error) {
                    packageObject = {};
                }
                addBuffer.addPackage(string, packageObject);
            });
        } else {
            bytes.arrayBufferPromiseFromBlob(blob).then(
                function (arrayBuffer) {
                addBuffer.add(arrayBuffer, mime, name);
            });
        }
    };

    const isZipFromFileName = function (fileName) {
        /* "*.zip" */
        if (fileName.length < 4) {
            return false;
        }
        const split = fileName.split(".");
        return (split[1] && split[1] === "zip");
    };

    const isPackageDotJsonFromFileName = function (fileName) {
        return fileName.includes("package.json");
    };

    const readFiles = function () {
        return new Promise(function (resolve, reject) {
            const fileInput = D.createElement2(fileInputDescription);
            fileInput.readFileResolve = resolve;
            fileInput.readFileReject = reject;
            D.linkJsAndDom(fileInput);
            D.el.readFilesContainer.appendChild(fileInput);
            fileInput.click();
        });
    };

    const zipEntriesFromFileObject = function(fileObject) {
        return new Promise(function (resolve, reject) {
            zip.createReader(new zip.BlobReader(fileObject), function(zipReader) {
                zipReader.getEntries(resolve);
            }, reject);
        });
    };

    const keyFromFileName = function (fileName) {
        return keyFromObjectAndValue(fileNameFromKey, fileName);
    };

    const getFileNameList = function () {
        return Object.values(fileNameFromKey);
    };

    const ressourceFromRessourceName = function (fileName) {
        // console.log(fileName);
        const key = keyFromFileName(fileName)
        if (!D.vr.hasOwnProperty(key)) {
            return; // undefined
        }

        return {
            header: {
                "Content-Type": D.vr[key].fileMime
            },
            body: ressourceContentFromElement.get(D.el[key].fileBody) ||
                    D.vr[key].fileBody
        };
    };


    const start = function () {

        D.fx.xReadFileStart = function (event) {
            const fileList = event.target.files; // FileList object
            let onLoadBuffer = readerOnLoadPrepare(event.target, fileList.length);
            let fileObject;
            
            for (fileObject of fileList) {
                const mime = fileObject.type || "";
                const name = fileObject.name;
                //fileObject.size
                if (isZipFromFileName(name)) {
                    /*we assume there is only 1 zip uploaded at once*/
                    zipEntriesFromFileObject(fileObject).then(function(entries) {
                        onLoadBuffer = readerOnLoadPrepare(event.target, entries.length);
                        entries.forEach(function(entry) {
                            entry.getData(new zip.BlobWriter(), function (blob) {
                                addBlob(onLoadBuffer, blob, "", entry.filename);
                            });
                        });
                    }).catch(function (error) {
                        console.log(STRINGS.CANNOT_LOAD_ZIP + error, error);
                    });
                    return;
                }
                addBlob(onLoadBuffer, fileObject, mime, name);
            }
        };

        D.fx.removeRessource = function (event) {
            const key = event.dKeys[0];
            yesNoDialog(`Remove "${fileNameFromKey[key]}" ressource ?`, "Yes", "No, Cancel").then(function (answer) {
                if (answer) {
                    event.dHost.remove();
                    delete fileNameFromKey[key];
                    D.forgetKey(event.dKeys);
                }
            });
        };

        D.fx.rememberFileName = function (event) {
            const key = event.dKeys[0];
            fileNameFromKey[key] =  D.followPath(D.vr, event.dKeys).fileName;
        };

        let ressourceUiId = 0;
        D.fx.addRessource = function (event) {
            readFiles().then(function (files) {
                /*files = {
                    files: [array],
                    ?package: {object}
                }*/
                const oldFileNames = getFileNameList();
                const dialogs = [];
                files.files.forEach(function (fileObject) {
                    const {arrayBuffer, mime, name} = fileObject;
                    if (oldFileNames.includes(name)) {
                        /*todo add more options see FileSystem.md
                        do not process package.json before this is finished*/
                        dialogs.push(yesNoDialog(
                        `A ressource named "${name}" is already loaded. Overwrite old ressource with the new one ?`, "Yes, overwrite", "No, keep old"
                            ).then(function (answer) {
                            if (answer === true) {
                                const key = keyFromFileName(name)
                                D.vr[key].fileBody = STRINGS.FILE_LOADED;
                                D.el[key].fileBody.disabled = true;
                                ressourceContentFromElement.set(D.el[key].fileBody, arrayBuffer);
                                D.vr[key].fileMime = mime;
                            } else if (answer === false) {
                                ;//do nothing
                            }
                        }));
                        return;
                    }
                    const ressourceUiIdString = FILE_INPUT_PREFIX + String(ressourceUiId);
                    ressourceUiId += 1;
                    //todo remove duplicate code
                    
                    const fileInputElement = D.createElement2({
                        tagName: "file-input",
                        "data-in": ressourceUiIdString
                    });
                    D.vr = {
                        [ressourceUiIdString]: {
                            fileName: name,
                            fileBody: STRINGS.FILE_LOADED,
                            fileMime: mime
                        }
                    };
                    D.linkJsAndDom(fileInputElement);
                    D.el[ressourceUiIdString].fileBody.disabled = true;
                    //D.el[ressourceUiIdString].fileBody.classList.toggle("hiddenvalue", true);
                    ressourceContentFromElement.set(
                        D.el[ressourceUiIdString].fileBody,
                        arrayBuffer
                    );
                    D.el.ressourcesContainer.appendChild(fileInputElement);
                    D.fx.rememberFileName({dKeys:[ressourceUiIdString]});
                });

                Promise.all(dialogs).then(function (notUsedValues) {
                    //console.log("package.json", files.package, (!files.package || !files.package.packageObject.serverinthebrowser));
                    if (!files.package || !files.package.packageObject.serverinthebrowser) {
                        return;
                    }
                    const serverinthebrowser = files.package.packageObject.serverinthebrowser;
                    
                    console.log("serverinthebrowser field detected",                    serverinthebrowser);
                    const server = serverinthebrowser.server;
                    if (server) {
                        const serverArrayBuffer = ressourceFromRessourceName(server).body;
                        //console.log("serverArrayBuffer", serverArrayBuffer);
                        if (serverArrayBuffer) {
                            const serverString = bytes.stringFromArrayBuffer(serverArrayBuffer);
                            //console.log("serverString",serverString);
                            D.vr.userCode = serverString;
                            // console.log("D.vr.userCode",D.vr.userCode);
                        }
                    }
                });
            }).catch(function (reason) {
                D.vr.log = "Could not load file: " + reason;
            });
        };
        
        D.fx.addRessourceEmpty = function (event) {
        
            const ressourceUiIdString = FILE_INPUT_PREFIX + String(ressourceUiId);
            ressourceUiId += 1;
            
            const fileInputElement = D.createElement2({
                "tagName": "file-input",
                "data-in": ressourceUiIdString
            });
            D.vr = {
                [ressourceUiIdString]: {
                    "fileName" : "",
                    "fileBody" : "",
                    fileMime: ""
                }
            };
            D.linkJsAndDom(fileInputElement);
            D.el.ressourcesContainer.appendChild(fileInputElement);
        };
        
        
        D.fx.generateIndex = function (event) {
            const name = "index.html";
            const mime = "text/html";
            const fileNameList = getFileNameList();
            const indexHtmlString = generateIndex(fileNameList);
            
            if (ressourceFromRessourceName(name)) {
                yesNoDialog(`"${name}" already exists. Overwrite it ?`, "Yes", "No, Cancel").then(function (answer) {
                    if (answer) {
                        const key = keyFromFileName(name)
                        D.vr[key].fileBody = indexHtmlString;
                        D.el[key].fileBody.disabled = false;
                        D.vr[key].fileMime = mime;
                        ressourceContentFromElement.delete(D.el[key].fileBody);
                    }
                });
            } else {
                const ressourceUiIdString = FILE_INPUT_PREFIX + String(ressourceUiId);
                ressourceUiId += 1;
                
                const fileInputElement = D.createElement2({
                    "tagName": "file-input",
                    "data-in": ressourceUiIdString
                });
                D.vr = {
                    [ressourceUiIdString]: {
                        "fileName" : name,
                        "fileBody" : indexHtmlString,
                        fileMime: mime
                    }
                };
                D.linkJsAndDom(fileInputElement);
                D.el.ressourcesContainer.appendChild(fileInputElement);
                D.fx.rememberFileName({dKeys:[ressourceUiIdString]});
            }
        };
    };
    
    const generateIndex = function (ressourceList) {
        const htmlLinks = ressourceList.filter(function (ressource) {
            return ressource !== "index.html";
        }).map(function (ressource) {
            return `<li><a href="${encodeURI(ressource)}">${ressource}</a></li>`;
        }).join("");
        const indexHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <title>Index</title>
  </head>
  <body>
  <h1><a href="">Index</a></h1>
  <ul>
  ${htmlLinks}
  </ul>
  </body>
</html>`;
        return indexHtml;
    };
    
     const contentTypeFromFileExtension = {
        "": "text/html",
        "html": "text/html",
        "css": "text/css",
        "js": "application/javascript",
        "json": "application/json"
    };
    
    const contentTypeFromRessourceName = function (ressourceName) {
        const parts = ressourceName.split(".");
        const lastPart = parts[parts.length - 1];
        return contentTypeFromFileExtension[lastPart.toLowerCase()] || "octet/stream";
    };

    return {
        ressourceFromRessourceName,
        start,
        contentTypeFromRessourceName
    };
}());
/*rtc.js
real time communication uses WebRTC, see https://en.wikipedia.org/wiki/WebRTC*/
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white, node, eval
*/
/*global
    RTCPeerConnection, RTCSessionDescription, RTCIceCandidate
*/

/*todo check with wireshark

include local identifier  ? for a request response pair

catch thrown errors https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/send
try solve problem where one user can send infinite request, by changing answer into request
carefull with `` syntax, properly escape with \
use navigator.onLine and others (rtc requires connection) to not run into 
InvalidStateError: Can't create RTCPeerConnections when the network is down

use http://danml.com/download.html to download files on single page
*/

rtc = (function () {
    const API = {
    };

    let useCustom = false;
    let audioContext;
    try {
        audioContext = new AudioContext();//http://stackoverflow.com/questions/40363606/how-to-keep-webrtc-datachannel-open-in-phone-browser-inactive-tab/40563729
    } catch (notUsed) {
        ;//not important
    }
    const SEND_BUFFERED_AMOUNT_LOW_THRESHOLD = 2000; // Bytes
    const MAX_MESSAGE_SIZE = 798; //Bytes some say it should be 800
    const PREFIX_MAX_SIZE = 10; //Bytes
    const MAX_PACKET_LIFETIME = 3000; //ms
                               
    const ORDERED = true;
    
    const rtcPeerConnectionFromId = new Map();
    const applicationLevelSendBufferFromDataChannel = new WeakMap();
    const applicationLevelReceivePartsBufferFromDataChannel = new WeakMap();
    const rtcSendDataChannelFromRtcPeerConnection = new WeakMap();
    const rtcSendDataChannelFromId = {//PROXY
        get: function (id) {
            return rtcSendDataChannelFromRtcPeerConnection.get(rtcPeerConnectionFromId.get(id));
        },
        has: function (id) {
            return rtcSendDataChannelFromRtcPeerConnection.has(rtcPeerConnectionFromId.get(id));
        },
        set: function (id, dataChannel) {
            rtcSendDataChannelFromRtcPeerConnection.set(rtcPeerConnectionFromId.get(id), dataChannel);
            return dataChannel;
        }
    };
    const resolveFromRessource = {};
    let resendAllRtcRequestsCount = 0;

    /* RTCConfiguration Dictionary see
    https://www.w3.org/TR/webrtc/#rtcconfiguration-dictionary*/
    const RTC_CONFIGURATION = {
        iceServers: [
            { urls: "stun:stun.services.mozilla.com" },
            { urls: "stun:stun.l.google.com:19302" }
        ]
    };
    
    const M = {
        ANSWER: "answer",
        REQUEST: "request",
        GET: "GET"
    };
    

    
    
    
//make connected list reappear with the map
    const handleRequestDefault = function (headerBodyObject, fromId) {
        //console.log("headerBodyObject:", headerBodyObject);
        let ressourceName = headerBodyObject.header.ressource;
        if (ressourceName === "") {
            ressourceName = "index.html";
        } 
        let answer = uiFiles.ressourceFromRessourceName(ressourceName);
        if (answer) {
            return {
                header: {
                    "Content-Type": answer.header["Content-Type"] ||
                                    uiFiles.contentTypeFromRessourceName(ressourceName)
                },
                body: answer.body
            };
        }
        return {
            header: {
                "Content-Type": "text/html",
                status: 404,
                statusText : "NOT FOUND"
            },
            body: `<html><p>Connection Successful ! But /${headerBodyObject.header.ressource} Not found (404)</p></html>`
        };
    };

    const useHandleRequestCustom = function (use) {
        useCustom = use;
    };

    
    const sendOrPutIntoSendBuffer = function (rtcSendDataChannel,
            data, forcePutIntoSendBuffer = false) {
        /*console.log("sendOrPutIntoSendBuffer", (!forcePutIntoSendBuffer &&  
        (rtcSendDataChannel.bufferedAmount <       
        rtcSendDataChannel.bufferedAmountLowThreshold)));*/
        if (!forcePutIntoSendBuffer && 
            (rtcSendDataChannel.bufferedAmount <
            rtcSendDataChannel.bufferedAmountLowThreshold)) {
            rtcSendDataChannel.send(data);
            return false;
        } else {
            //console.log(`delayed .send() data.byteLength: ${data.byteLength}`);
            const applicationLevelSendBuffer = 
                applicationLevelSendBufferFromDataChannel.get(rtcSendDataChannel);
            applicationLevelSendBuffer.push(data);
            return true;
        }
    };
    
    const sendDataOverRTC = function (rtcSendDataChannel, data) {
        if (!rtcSendDataChannel || !isOpenFromDataChannel(rtcSendDataChannel)) {
            ui.displayFatalError("The connection is not open");
            return;
        }
        
        const byteLength = data.byteLength;
        if (typeof data === "string" || byteLength < MAX_MESSAGE_SIZE + PREFIX_MAX_SIZE) {
            // no need to split data we can send all at once
            if (typeof data !== "string") {
                data = bytes.addInternalMessagePrefixToArrayBuffer(data);
            }
            sendOrPutIntoSendBuffer(rtcSendDataChannel, data);
            return;
        }
        // need to split before send
        // todo future split up data when strings if too big if still relevant
        
        const splitData = bytes.splitArrayBuffer(data, MAX_MESSAGE_SIZE);
        let forcePutIntoSendBuffer = false;
        //https://bugs.chromium.org/p/webrtc/issues/detail?id=6628
        splitData.forEach(function (dataPart) {
            forcePutIntoSendBuffer = 
                sendOrPutIntoSendBuffer(rtcSendDataChannel,
                    dataPart,
                    forcePutIntoSendBuffer);
        });
        
    };

    
    const prepareSendRtcData = function (targetId, headerBodyObject) {
        //console.log("prepareSendRtcData", headerBodyObject);
        let data;
        if (typeof headerBodyObject.body === "string") {
            /*can be sent as a string without data loss*/
            data = JSON.stringify(headerBodyObject);
        } else {
            /*the body is an arrayBuffer, convert everything into an arrayBuffer*/
            data = bytes.arrayBufferFromHeaderBodyObject(headerBodyObject);
        }
        // data can be DOMString, Blob, ArrayBuffer, ArrayBufferView But NOT Object
        const rtcSendDataChannel = rtcSendDataChannelFromId.get(targetId);
        sendDataOverRTC(rtcSendDataChannel, data);
    };
    
    const buildTrySendRemaining = function (targetId) {
        //close over targetId
        let trySendRemaining =  function (event) { //TrySendRemaining
            /*gets called when the send buffer is low, see
https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/onbufferedamountlow*/
            const rtcSendDataChannel = rtcSendDataChannelFromId.get(targetId);
            if (rtcSendDataChannel.bufferedAmount 
                < rtcSendDataChannel.bufferedAmountLowThreshold) {
                const applicationLevelSendBuffer = 
                    applicationLevelSendBufferFromDataChannel.get(rtcSendDataChannel);
                if (applicationLevelSendBuffer.length === 0) {
                    //nothing to send
                    return;
                }
                const data = applicationLevelSendBuffer.shift();
                if (isOpenFromDisplayName(targetId)) {
//console.log(`TrySendRemaining  : ${data.byteLength}`);
                    rtcSendDataChannel.send(data);    
                    trySendRemaining();

    //todo recall itself                
                } else {
                    ui.displayFatalError("The connection is not open");
                }  
            }
        };
        return trySendRemaining;
    };
    
    
    const receiveRtcData = function (event, from) {
        let data = event.data || event;
        //console.log("receiveRtcData", event, from);
        /*also see prepareSendRtcData*/
        let headerBodyObject;
        let canceled;
        if (typeof data === "string") {
            /*has been sent as a string*/
            headerBodyObject = JSON.parse(data);
        } else {
            /*as arrayBuffer*/
            
            if (data.size) { //Blob
            /* or blob, if data arrives as blob 
            this block should never run*/
                bytes.arrayBufferPromiseFromBlob(data).then(
                function (arrayBuffer) {
                    receiveRtcData(arrayBuffer, from);
                }).catch(function (error) {
                    ui.displayFatalError("bytes.arrayBufferPromiseFromBlob" +
                        error.toString(), error);
                });
                return;
            }
            const prefix = bytes.internalMessagePrefixFromArrayBuffer(data);
            data = bytes.removeInternalMessagePrefixFromArrayBuffer(data);
            
            /*see bytes.js PREFIX_DICTIONARY*/
            if (prefix !== "standalone") { // part
                const rtcSendDataChannel = rtcSendDataChannelFromId.get(from);
                const applicationLevelReceivePartsBuffer =  
                    applicationLevelReceivePartsBufferFromDataChannel.get(
                        rtcSendDataChannel
                    );
                applicationLevelReceivePartsBuffer.push([prefix, data]);
                if (prefix !== "endpart") { // not last part
                    return;
                } else if (prefix === "endpart") { // last part
                    applicationLevelReceivePartsBufferFromDataChannel.set(rtcSendDataChannel, []);
                    try {
                        data = bytes.assembleArrayBuffer(applicationLevelReceivePartsBuffer);
                    } catch (error) {
                        if (error instanceof OutOfOrderError) {
                            resendAllRtcRequests();
                            canceled = true;
                        } else {
                            throw error;
                        }
                    }
                }
            }
            if (canceled) {
                return;
            }
            headerBodyObject = bytes.headerBodyObjectFromArrayBuffer(data);
        }
        //console.log(headerBodyObject);
        if (headerBodyObject.header.is === M.REQUEST) {
            const originalRessourceName = headerBodyObject.header.ressource;
            if (headerBodyObject.header.method === "MESSAGE") {
                ui.handleMessage(headerBodyObject, from);
            } else if (!(D.vr.localServerAvailability)) {
                ;//do nothing
            } else {
                headerBodyObject.header.ressource = decodeURI(headerBodyObject.header.ressource);
                //console.log("browserServer.answerObjectPromiseFromRequest");
                const sendAnswerObject = function (answerObject) {
                    //console.log("sendAnswerObject", answerObject);
                    if (answerObject) {
                        answerObject.header.is = M.ANSWER;
                        answerObject.header.ressource = originalRessourceName;
                        prepareSendRtcData(from, answerObject);
                    }
                };
                if (!useCustom) {
                    /*use default request handler*/
                    sendAnswerObject(handleRequestDefault(headerBodyObject, from));
                } else {
                    const answerObjectPromise = browserServer.
                    answerObjectPromiseFromRequest(headerBodyObject, from);
                    //console.log(answerObjectPromise);
                    answerObjectPromise.then(sendAnswerObject).catch(function (reason) {
                        console.log(reason);
                    });
                }
            }
            
        } else if (headerBodyObject.header.is === M.ANSWER) {
            const ressourceName = headerBodyObject.header.ressource;
            if (resolveFromRessource.hasOwnProperty(ressourceName)) {
                resolveFromRessource[ressourceName](headerBodyObject);
                delete resolveFromRessource[ressourceName];
            }
        }
    };

    const sendRtcMessage = function (targetId, text) {
        prepareSendRtcData(targetId, {
            header: {
                "is": M.REQUEST,
                "method": "MESSAGE",
                "Content-Type": "text/plain"
            },
            body: text
        });
    };

    const createdDescription = function (description, to) {
        if (!rtcPeerConnectionFromId.has(to)) {
            return;
        }
        const rtcPeerConnection = rtcPeerConnectionFromId.get(to);
        rtcPeerConnection.setLocalDescription(description).then(function () {
            sockets.socket.emit(MESSAGES.SEND_DESCRIPTION, {
                sdp: rtcPeerConnection.localDescription,
                displayedName : localDisplayedName,
                from: localDisplayedName,
                targetDisplayedName: to
            });
        }).catch(function (error) {
                console.log("An error occured", error)
        });
        
    };

    const startConnectionWith = function (isCaller, to) {
        let rtcPeerConnection;
        let rtcSendDataChannel;
        if (!rtcPeerConnectionFromId.has(to)) {
            try {
                rtcPeerConnection = new RTCPeerConnection(RTC_CONFIGURATION);
            } catch (error) {
                console.log(error);
                if (error instanceof DOMException && error.name === "InvalidStateError") {
                    rtcPeerConnection = null;
                    ui.markUserAsConnected(to, false);
                    ui.displayFatalError("Network is down, reconnect to the internet and try again.");
                } else {
                    throw error;
                }
            }
            if (!rtcPeerConnection) {
                return;
            }
            rtcPeerConnection.onicecandidate = function (event) {
                if (event.candidate) {
                    //console.log("On ICE 2");
                    sockets.socket.emit(MESSAGES.SEND_ICE_CANDIDATE, {
                        ice: event.candidate,
                        from: localDisplayedName,
                        targetDisplayedName: to
                    });
                }
            };

            rtcSendDataChannel = rtcPeerConnection.createDataChannel("app", {
                ordered: ORDERED,
                maxPacketLifeTime: MAX_PACKET_LIFETIME
            });
            rtcSendDataChannel.bufferedAmountLowThreshold = SEND_BUFFERED_AMOUNT_LOW_THRESHOLD;
            rtcSendDataChannel.binaryType = "arraybuffer";
            applicationLevelSendBufferFromDataChannel.set(rtcSendDataChannel, []);
            applicationLevelReceivePartsBufferFromDataChannel.set(rtcSendDataChannel, [])
            rtcSendDataChannel.onbufferedamountlow = buildTrySendRemaining(to);
            
            const sendChannelStateChangeHandler = sendChannelStateChange(to);
            
            rtcSendDataChannel.onopen = sendChannelStateChangeHandler;
            rtcSendDataChannel.onclose = sendChannelStateChangeHandler;

            rtcPeerConnection.ondatachannel = function (event) {
                const receiveChannel = event.channel;
                receiveChannel.onmessage = function (event) {
                    receiveRtcData(event, to);
                };
            };

            rtcSendDataChannel.onmessage = function (event) {
                //never triggers ?
                console.log("Receive data from rtcSendDataChannel", event.data);
            };

            rtcPeerConnectionFromId.set(to, rtcPeerConnection);
            rtcSendDataChannelFromId.set(to, rtcSendDataChannel);
        } else {
            rtcPeerConnection = rtcPeerConnectionFromId.get(to);
        }

        if (isCaller) {
            rtcPeerConnection.createOffer()
            .then(function (description) {
                createdDescription(description, to);
                //console.log("Description created 1");
            })
            .catch(function (error) {
                console.log("An error occured", error)
            });
        }

    }



    const sendChannelStateChange = function (peerDisplayedName) {
        return () => {
            //console.log(`Send channel state is open: ${open}`);
            ui.markUserAsConnected(peerDisplayedName, isOpenFromDisplayName(peerDisplayedName));
            ui.selectAfterConnected(peerDisplayedName);
        };
    };

    const onReceiveRtcConnectionDescription = function (data) {
        if (!rtcPeerConnectionFromId.has(data.from)) {
            startConnectionWith(false, data.from);
        }

        const rtcPeerConnection = rtcPeerConnectionFromId.get(data.from);
        if (rtcPeerConnection) {
            rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
            .then(function () {
                // Only create answers in response to offers
                if (data.sdp.type === "offer") {
                    rtcPeerConnection.createAnswer()
                    .then(description => {
                        // Receive description
                        //console.log("onReceiveRtcConnectionDescription, data: ", data);
                        createdDescription(description, data.from);
                    })
                    .catch(function (error) {
                        console.log("An error occured", error)
                    });
                }
            }).catch(function (error) {
                console.log("An error occured", error)
            });
        }
    };

    const onReceiveRtcIceCandidate = function (data) {
        if (data.from === localDisplayedName) {
            return;
        }
        let rtcPeerConnection = rtcPeerConnectionFromId.get(data.from);
        if (rtcPeerConnection) {
            rtcPeerConnection.addIceCandidate(new RTCIceCandidate(data.ice))
            .then(function (x) {
                //console.log("Added ICE 3");
            }).catch(function (error) {
                console.log("An error occured", error)
            });
        }
    };

    const resendAllRtcRequests = function () {
        resendAllRtcRequestsCount += 1;
        console.log("resendAllRtcRequests:", resendAllRtcRequestsCount);
        console.log("BUG, this function is only called if the parts arrive out of order:");
        if (resendAllRtcRequestsCount > 10) {
            console.log("resendAllRtcRequests too high, canceling and resetting count", resendAllRtcRequestsCount);
            resendAllRtcRequestsCount = 0;
            return;
        }
        Object.keys(resolveFromRessource).forEach(function (ressource) {
            prepareSendRtcData(resolveFromRessource[ressource].target, resolveFromRessource[ressource].message);
        });
    };
    
    const rtcRequest = function (requestObject) {
        return new Promise(function (resolve, reject) {
            const ressource = requestObject.header.ressource;
            resolveFromRessource[ressource] = resolve;
            const message = {
                header: {
                    is: M.REQUEST,
                    method: requestObject.header.method || M.GET,
                    "Content-Type": "",
                    ressource
                },
                body: requestObject.body || ""
            };
            //requestObject has more info in requestObject.header we could Object.assign to get it all
            resolveFromRessource[ressource].message = message; // resendAllRtcRequests
            resolveFromRessource[ressource].target = ui.selectedUserId;
            prepareSendRtcData(ui.selectedUserId, message);
        });
    };
    
    const isOpenFromDataChannel = function (dataChannel) {
        return "open" === dataChannel.readyState;
    };    
    
    const isOpenFromDisplayName = function (displayName) {
        return isOpenFromDataChannel(rtcSendDataChannelFromId.get(displayName));
    };
    
    const userIdChange = function (oldId, newId) {
        if (rtcPeerConnectionFromId.has(oldId)) {
            const rtcSendDataChannel = rtcSendDataChannelFromId.get(oldId);
            const sendChannelStateChangeHandler = sendChannelStateChange(newId);
            
            rtcSendDataChannel.onopen = sendChannelStateChangeHandler;
            rtcSendDataChannel.onclose = sendChannelStateChangeHandler;
            rtcPeerConnectionFromId.set(newId, rtcPeerConnectionFromId.get(oldId));
            rtcPeerConnectionFromId.delete(oldId);
            //rtcSendDataChannelFromId uses rtcPeerConnectionFromId so it is also updated
        }
    };

    Object.assign(API, {
        useHandleRequestCustom,
        sendRtcMessage,
        startConnectionWith,
        rtcRequest,
        onReceiveRtcConnectionDescription,
        onReceiveRtcIceCandidate,
        rtcPeerConnectionFromId,
        isOpenFromDisplayName,
        userIdChange
    });
    
    return API;
}());
/*bytes.js*/
/*jslint
    es6, maxerr: 15, browser, devel, fudge, maxlen: 100
*/
/*global
    FileReader, Promise, Uint8Array, ArrayBuffer, OutOfOrderError, TextDecoder, DataView
*/
/* warning some methods on typed arrays look similar to Array method but do slightly different things
about new FileReader();
use instance properties, whenever possible
*/
bytes = (function () {
    
    const PREFIX_DICTIONARY = {
        standalone: 0,
        begin: 1,
        part: 2,
        endpart: 3
    };
    
    const PREFIX_LENGTH = 1;
    
    const copyArrayBufferIntoBiggerArrayBuffer = function (original, target, byteOffset) {
        /*console.log(`
        original ${original}, ${original.byteLength}
        target ${target}, ${target.byteLength}
        byteOffset ${byteOffset}`);*/
        new Uint8Array(target).set(new Uint8Array(original), byteOffset);
    };
    
    const stringFromArrayBuffer = function (arrayBuffer, encoding = "utf-8") {
        return (new TextDecoder(encoding)).decode(new DataView(arrayBuffer));
    };
    
    const addInternalMessagePrefixToArrayBuffer = function (arrayBuffer, what = "standalone") {
        /* see PREFIX_DICTIONARY
        */
        //console.log(what,  PREFIX_DICTIONARY[what]);
        const originalLength = arrayBuffer.byteLength;
        const targetLength = originalLength + PREFIX_LENGTH;
        const target = new ArrayBuffer(targetLength);
        copyArrayBufferIntoBiggerArrayBuffer(arrayBuffer, target, PREFIX_LENGTH);
        const targetUint8View = new Uint8Array(target);
        targetUint8View[0] = PREFIX_DICTIONARY[what];
        return target;
    };   
    

    
    const internalMessagePrefixFromArrayBuffer = function (arrayBuffer) {
        /*returns prefix string from arrayBuffer*/
        const arrayBufferUint8View = new Uint8Array(arrayBuffer);
        return keyFromObjectAndValue(PREFIX_DICTIONARY, arrayBufferUint8View[0]);
    };
    
    const removeInternalMessagePrefixFromArrayBuffer = function (arrayBuffer) {
        return arrayBuffer.slice(PREFIX_LENGTH);
    };
    
    const splitArrayBuffer = function (arrayBuffer, maxSize) {
        /*also adds prefixes*/
        const splitData = [];
        const splitDataLength = Math.ceil(arrayBuffer.byteLength / maxSize);
        let i = 0;
        let part;
        while (i < splitDataLength) {
            part = arrayBuffer.slice(i * maxSize, (i + 1) * maxSize);
            if (i === 0) { // begin
                part = addInternalMessagePrefixToArrayBuffer(part, "begin") 
            } else if (i + 1 < splitDataLength) { // part
                part = addInternalMessagePrefixToArrayBuffer(part, "part") 
            } else { // end
                part = addInternalMessagePrefixToArrayBuffer(part, "endpart") 
            }
            splitData.push(part);
            i += 1;
        }
        //console.log("arrayBuffer split!", splitData, arrayBuffer);
        return splitData;
    };
    
    const assembleArrayBuffer = function (splitData) {
        //todo put back in correct order, see if sent in correct order
        /* there is no prefix left
        splitData = [[prefix, data], ...]*/
        let notOrdered = false;
        if (splitData[0][0] !== "begin") {
            notOrdered = true;
        }
        if (splitData[splitData.length - 1][0] !== "endpart") {
            notOrdered = true;
        }
        if (notOrdered) {
            throw new OutOfOrderError("splitData is in the wrong order");
            /*try to put in correct order, impossible because no  way to differtiate between parts
            what to do when mutiple splitData overlap each other because sent after 
            each other and received, 
            example: [begin1 part1 begin2 part2 part1 end1 part2 end2]
            let problem = false; 
            let first;
            let last;
            splitData.forEach(function ([prefix, arrayBuffer]) {
                if (prefix === "begin") {

                }
                if (prefix === "endpart") {

                }

            });*/
            
        }
        const assembledArrayBufferLength = splitData.reduce(function (currentTotal, [prefix, arrayBuffer]) {
            return currentTotal + arrayBuffer.byteLength;
        }, 0);
        const assembledArrayBuffer = new ArrayBuffer(assembledArrayBufferLength);
        let offset = 0;
        splitData.forEach(function ([prefix, arrayBuffer]) {
            const arrayBufferLength = arrayBuffer.byteLength;
            copyArrayBufferIntoBiggerArrayBuffer(arrayBuffer, assembledArrayBuffer, offset);
            offset += arrayBufferLength;
        });
        //console.log("arrayBuffer assembled!", splitData, assembledArrayBuffer);
        return assembledArrayBuffer;
    };

    const arrayBufferPromiseFromBlob = function (blob) {
        //argument must be blob or file Object
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function (event) {
                resolve(reader.result);
            };
            reader.onerror = function (error) {
                reject(error);
            };
            reader.readAsArrayBuffer(blob);
        });
    };
    
    const stringPromiseFromBlob = function (blob) {
        //argument must be blob or file Object
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function (event) {
                resolve(reader.result);
            };
            reader.onerror = function (error) {
                reject(error);
            };
            reader.readAsText(blob);
        });
    };

        
    const arrayBufferFromHeaderBodyObject = function (headerBodyObject) {
        /*header is an object, body is an arrayBuffer
        uses TextDecoder?, ArrayBuffer, Uint8Array
        optimization ideas: use less bytes for the strings
        
        returns arrayBufferWithEverything with
        [length+header+body]*/
        const stringCharacterInBytes = Uint8Array.BYTES_PER_ELEMENT;
        const {header, body} = headerBodyObject;
        
        const stringifiedHeader = JSON.stringify(header);
        const headerLength = stringifiedHeader.length; // Number
        
        const stringifiedHeaderLength = String(headerLength);
        const stringifiedHeaderLengthLength = stringifiedHeaderLength.length;
        
        const bodyByteLength = body.byteLength;
        
        const arrayBufferWithEverythingByteLength = (
                (stringCharacterInBytes * stringifiedHeaderLengthLength) +
                (stringCharacterInBytes * headerLength) +
                bodyByteLength);

                
        const arrayBufferWithEverything = new ArrayBuffer(arrayBufferWithEverythingByteLength);
        let offset = 0;
        const arrayBufferWithEverythingUint8View = new Uint8Array(arrayBufferWithEverything);
        
        stringifiedHeaderLength.split("").forEach(function (digitString) {
            arrayBufferWithEverythingUint8View[offset] = digitString.charCodeAt(0);
            offset += 1;
        });
        
        stringifiedHeader.split("").forEach(function (anyCharacterString) {
            arrayBufferWithEverythingUint8View[offset] = anyCharacterString.charCodeAt(0);
            offset += 1;
        });
        
        /*is there a better way to add the body at the end of offset in arrayBufferWithEverything*/
        copyArrayBufferIntoBiggerArrayBuffer(body, arrayBufferWithEverything, offset * stringCharacterInBytes);
        return arrayBufferWithEverything;
    };

    const headerBodyObjectFromArrayBuffer = function (arrayBufferWithEverything) {
        /*see arrayBufferFromHeaderBodyObject for more info
        returns an object
        {header: header(Object),
         body: body(ArrayBuffer)} */
        
        const stringCharacterInBytes = Uint8Array.BYTES_PER_ELEMENT;
            
        let offset = 0;
        let isNumber = true;
        let stringifiedHeaderLength = "";
        let character = "";
        const arrayBufferWithEverythingUint8View = new Uint8Array(arrayBufferWithEverything);
        
        while (isNumber) {
            stringifiedHeaderLength += character;
            character = String.fromCharCode(arrayBufferWithEverythingUint8View[offset]);
            offset += 1;
            isNumber = !isNaN(Number(character));
        }
        
        offset -= 1;
        const headerLength = Number(stringifiedHeaderLength);
        const headerArrayBuffer = arrayBufferWithEverything.slice(
                offset * stringCharacterInBytes,
                (offset + headerLength) * stringCharacterInBytes);
                
        const body = arrayBufferWithEverything.slice(
                (offset + headerLength) * stringCharacterInBytes);//rest
                
        const headerArrayBufferUint8View = new Uint8Array(headerArrayBuffer);
        const tempStringifiedHeaderArray = [];
        
        headerArrayBufferUint8View.forEach(function (characterCode) {
            tempStringifiedHeaderArray.push(String.fromCharCode(characterCode));
        });
        
        const stringifiedHeader = tempStringifiedHeaderArray.join("");
        let header;
        try {
            header = JSON.parse(stringifiedHeader);
        } catch (error) {
            console.log(error);
            if (error instanceof SyntaxError) {
                console.log(`invalid JSON string: ${stringifiedHeader} END of JSON string`);
                header = {};
            }
        }
        
        
        return {
            header,
            body
        };
    };

    return {
        headerBodyObjectFromArrayBuffer,
        arrayBufferFromHeaderBodyObject,
        arrayBufferPromiseFromBlob,
        stringPromiseFromBlob,
        stringFromArrayBuffer,
        addInternalMessagePrefixToArrayBuffer,
        internalMessagePrefixFromArrayBuffer,
        removeInternalMessagePrefixFromArrayBuffer,
        splitArrayBuffer,
        assembleArrayBuffer
    };

}());
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
//client
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white
*/
/*global
    navigator , localDisplayedName
*/


sockets = (function () {

    const API = {
        socket : undefined
    };


    const start = function () {
        API.socket = socketIo();
        const socket = API.socket;
        socket.on(MESSAGES.WELCOME, (data) => {
            //console.log("welcome received", data);
            localDisplayedName = data.displayedName;
            ui.displayOwnUserId(localDisplayedName);
            rtc.connectedUsers = data.connectedUsers;
            ui.updateUserList(data.connectedUsers);            
        });

        socket.on(MESSAGES.LOADING_USER_LIST, function (data) {
            rtc.connectedUsers = data.connectedUsers;
            ui.updateUserList(data.connectedUsers);
        });

        socket.on(MESSAGES.RECEIVE_DESCRIPTION, data => {
            rtc.onReceiveRtcConnectionDescription(data);
        })

        socket.on(MESSAGES.RECEIVE_ICE_CANDIDATE, data => {
            rtc.onReceiveRtcIceCandidate(data);
        })
        
        socket.on(MESSAGES.SERVERLOG, data => {
            ui.serverLog(data);
        })
        
        socket.on(MESSAGES.BAD_ID_FORMAT_REJECTED, data => {
            ui.handleChangeIdResponse(MESSAGES.BAD_ID_FORMAT_REJECTED);
        })
        
        socket.on(MESSAGES.ALREADY_TAKEN_REJECTED, data => {
            ui.handleChangeIdResponse(MESSAGES.ALREADY_TAKEN_REJECTED);
        })
        
        socket.on(MESSAGES.CONFIRM_ID_CHANGE, data => {
            ui.handleChangeIdResponse(MESSAGES.CONFIRM_ID_CHANGE, data);
        });
        
        socket.on(MESSAGES.USER_ID_CHANGE, data => {
            ui.handleChangeIdResponse(MESSAGES.USER_ID_CHANGE, data);
        });
        
        
    };
    
    const requestIdChange = function (newId) {
        
        API.socket.emit(MESSAGES.ID_CHANGE_REQUEST, {
            newId
        });
    };
    
    Object.assign(API, {
        start,
        requestIdChange
    });
    
    return API;
}());
/*browserserver.js

how to RUN LIKE NODE JS
challenges
 * make require() work
 * make command line with something similar to npm run start, npm run build etc
 * clean environement after each run start no variables left
 * refuse variable access
 * similar all around
 * reuqire(http) and require express does same thing
 
 * USE browserify
 * close worker
 * use web worker with messaging system
*/
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white, node, eval
*/
/*global
    window, URL, Blob, Worker
*/


browserServer = (function () {

    const states = {
        DISABLED: 0,
        RUNNING: 1
    };
    const COMMANDS = {
        START: "START",
        CLOSE: "CLOSE",
        COMMAND: "COMMAND",
        URLSTART: "URLSTART",
        URLSTARTVALUE: String(location)
    };
    const workerStartTimeLimit = 1000; // ms
    const workerStartTimeLimitSeconds = workerStartTimeLimit / 1000;
    let worker;
    let workerState = states.DISABLED;
    let browserServerCode = "";
    let timeoutId;
    
    const LENGTHBEFORE = 140;
     
    const setBrowserServerCode = function (readyCodeText) {
        /*a web worker needs direct source code becuase it has a new separate
        execution context. Below gets injected readyCodeText*/
        browserServerCode = `/*node_emulator_for_worker.js
*/
/*jslint
es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white: true, node, eval
*/
/*global
URL, Blob, Worker, self, importScripts
*/
"use strict";
/*need to manually escape some template strings*/
let module;
let exports;
let require;
let listenForRequest;
let respondToRequest;
let readStaticFile;
let process;
let __dirname;
//let _emptyFunction = function () {};
let _customFunction;
//let cleanUp;
(function () {
/*store local reference*/
const postMessage = self.postMessage;
const addEventListener = self.addEventListener;


const listeners = [];
const staticFilesResolves = {};
const COMMANDS = {
START: "START",
CLOSE: "CLOSE",
COMMAND: "COMMAND",
URLSTART: "URLSTART"
};

let state = 0;
let urlStart = "";

const tryCatchUserCode = function (tryFunction) {
try {
tryFunction();
} catch (error) {
let line;
if (error.lineNumber) {
line = Number(error.lineNumber) - ${LENGTHBEFORE};
} else {
line = "?";
}
postMessage({"ERROR": {
line: line,
name: error.name,
message: error.message
}});
}
};

addEventListener("message", function(event) {
const message = event.data;
if (message[COMMANDS.COMMAND] === COMMANDS.START) {
state = 1;
urlStart = message[COMMANDS.URLSTART];
postMessage({"STARTSUCCES": "STARTSUCCES"});
tryCatchUserCode(_customFunction);
} else if (message[COMMANDS.COMMAND] === COMMANDS.CLOSE) {
state = 0;
self.close();
} else if (state) {

if (message.hasOwnProperty("headerBodyObject")) {
const headerBodyObject = message.headerBodyObject;//it s a copy
headerBodyObject.header.url = "/" + headerBodyObject.header.ressource;

tryCatchUserCode(function () {
listeners.forEach(function (listener) {

listener(headerBodyObject);
});
});
} else if (message.hasOwnProperty("staticFile")) {
const staticFileName = message.staticFile;
const body = message.body;
if (!staticFilesResolves.hasOwnProperty(staticFileName)) {
//why are we here? At this point we are not listening for the file body
return;
}
if (body === undefined) {
const errorMessage = message.error;
staticFilesResolves[staticFileName].reject.forEach(function (
rejectFunction) {
rejectFunction(errorMessage);
});

} else {
staticFilesResolves[staticFileName].resolve.forEach(function (
resolveFunction) {
resolveFunction(message);
});
}
delete staticFilesResolves[staticFileName];
}
}
}, false);

//remove access for the rest
const removeAccess = function (anObject, propertyName) {
Object.defineProperty(anObject, propertyName, {
value: undefined,
writable: false,
configurable: false,
enumerable: false
});
};
const hiddenAccessList = ["postMessage", "addEventListener", "onmessage", "close"];
hiddenAccessList.forEach(function (propertyName) {
removeAccess(self, propertyName);
});



/*cleanUp = function () {
;
};*/


(function () {
/* emulates nodes let module, exports, require
what should happen with exports = x ?
maybe change Object.defineProperty(self,"exports",
 setter: use single value= true, and store ... low prio
todo make overwriting the global module and export immpossible ?
limitation everything is public by default
it means that to port code from node you have to put everything in an IFFE and use module.export ... for the things to export
 */
const exportsObject = {};
const moduleObject = {};
const EXPORT = "exports";

let currentExportObject;// = {};
let currentExportSingleValue;// = undefined
let currentModuleObject;// = {};
let currentExportSingleValueUsed;// = false;

const exportsTraps = {
get: function (target, name) {
/*return the current local exports*/
return currentExportObject[name];
},
set: function (target, name, value) {
currentExportObject[name] = value;
}
};

const moduleTraps = {
/*todo add more traps*/
get: function (target, name) {
/*return the current local exports*/
if (name === EXPORT) {
if (currentExportSingleValueUsed) {
return currentExportSingleValue;
}
return exports;
}
return currentModuleObject[name];
},
set: function (target, name, value) {
currentModuleObject[name] = value;
if (name === EXPORT) {
currentExportSingleValue = value;
currentExportSingleValueUsed = true;
}
}
};

exports = new Proxy(exportsObject, exportsTraps);

module = new Proxy(moduleObject, moduleTraps);
const requireCache = {};
require = function(requiredName) {
if (requireCache.hasOwnProperty(requiredName)) {
/*if something is required twice do not execute the code again*/
return requireCache[requiredName];
}
currentExportObject = {};
currentExportSingleValue = undefined;
currentModuleObject = {};
currentExportSingleValueUsed = false;

const requiredUrl = urlStart + requiredName;
importScripts(requiredUrl); //downloads and execute

let returnValue; 
if (currentExportSingleValueUsed) {
returnValue = currentExportSingleValue;
} else {
returnValue = currentExportObject;
}
requireCache[requiredName] = returnValue;
return returnValue;
};


}());
process = {
env: {}
};

__dirname = "";

listenForRequest = function (afunction) {
listeners.push(afunction);
};

respondToRequest = function (headerBodyObject) {
//console.log("the worker is responding to a request with", headerBodyObject);
postMessage({headerBodyObject});
};

readStaticFile = function (staticFileName) {
/*reads a static file from the main thread
returns a promise that resolves with an Object
{staticFile: staticFileName,
body: *the body*,
"Content-Type": "string"}
or 
(reject)
{staticFile: staticFileName,
body: undefined,
error: errorString}
*/
return new Promise(function (resolve, reject) {
const stillWaiting = staticFilesResolves[staticFileName];
if (stillWaiting) {
/*already listeners*/
staticFilesResolves[staticFileName].resolve.push(resolve);
staticFilesResolves[staticFileName].reject.push(reject);
} else {
staticFilesResolves[staticFileName] = {};
staticFilesResolves[staticFileName].resolve = [resolve];
staticFilesResolves[staticFileName].reject= [reject];
}
postMessage({staticFile: staticFileName});
});
};

/*could still access hiddenAccessList with trow catch error.trace.object*/
//self = undefined;//cannot assign to self
}());

//have access to self [object DedicatedWorkerGlobalScope]
//const self = self;
const window = self; // to emulate
const global = self;
//cleanUp();
_customFunction = function () {
/*variables:require, listenForRequest, respondToRequest*/
${readyCodeText};

};
`;//see buildbrowserserverwithemulator.js
    };


    const run = function () {
        /*uses worker, browserServerCode*/
        if (!browserServerCode) {
            return;
        }
        close();
        
        if (timeoutId) {
            window.clearTimeout(timeoutId);
        }
        let resolved = false;
        return new Promise(function (resolve, reject) {
            timeoutId = setTimeout(function () {
                if (!resolved) {
                    //this timeout should not reject except if it took too long
                    reject(`Long startup time. More than ${workerStartTimeLimitSeconds}s. This happens when an error is found.`);
                    resolved = true;
                    timeoutId = undefined;
                }
            }, workerStartTimeLimit);
            const wokerJsBlob = new Blob([browserServerCode], { type: "text/javascript" });
            const wokerJsObjectURL = URL.createObjectURL(wokerJsBlob);
            try {
                worker = new Worker(wokerJsObjectURL); // eval called
            } catch (error) {
                close();
                resolved = true;
                reject(
`${error.name}: "${error.message}" at line ${Number(error.lineNumber) - LENGTHBEFORE}`);
            }
            worker.addEventListener("error", function (event) {
                /*this is the only good way to catch syntax errors*/
                close();
                resolved = true;
                reject(`${event.message}`);
                event.stopPropagation();
                event.preventDefault();
            }, false);
            URL.revokeObjectURL(wokerJsObjectURL); // clean space
            workerState = states.RUNNING;
            worker.addEventListener("message", function(event) {
                const message = event.data;
                //console.log(message);
                if (message.hasOwnProperty("STARTSUCCES")) {
                    resolve();
                    resolved = true;
                } else if (message.hasOwnProperty("headerBodyObject")) {
                    const headerBodyObject = message.headerBodyObject;
                    //console.log("worker.onmessage 1 ", headerBodyObject, resolveFromPromiseId);
                    if (headerBodyObject.hasOwnProperty("internalId")) {
                        const internalId = headerBodyObject.internalId;
                        delete headerBodyObject.internalId;//cleanup
                        //console.log("worker.onmessage 2 ", headerBodyObject, internalId);
                        if (resolveFromPromiseId.hasOwnProperty(internalId)) {
                            //console.log("worker.onmessage 3", resolveFromPromiseId[internalId]);
                            resolveFromPromiseId[internalId](headerBodyObject);
                            delete resolveFromPromiseId[internalId];//cleanup
                        }
                    }
                } else if (message.hasOwnProperty("staticFile")) {
                    /*            */
                    const staticFileName = message.staticFile;
                    //console.log();
                    let answer = uiFiles.ressourceFromRessourceName(staticFileName);
                    let staticFileObject = {
                        body: undefined,
                        staticFile: staticFileName
                    };
                    if (answer) {
                        staticFileObject.body = answer.body
                        staticFileObject["Content-Type"] = answer.header["Content-Type"] ||
                            uiFiles.contentTypeFromRessourceName(staticFileName);

                    } else {
                        staticFileObject.error = "No file";
                    }
                    worker.postMessage(staticFileObject);
                    
                } else if (message.hasOwnProperty("ERROR")) {
                    const errorInformation = message.ERROR;
                    const errorString = `${errorInformation.name}: "${errorInformation.message}" at line ${errorInformation.line}`;
                    close();
                    if (!resolved) {
                        reject(errorString);
                        resolved = true;
                    } else {
                        ui.lateReject(errorString);
                    }
                }
            }, false);
            //the worker starts with the first postMessage
            worker.postMessage({ 
                [COMMANDS.COMMAND]: COMMANDS.START,
                [COMMANDS.URLSTART]: COMMANDS.URLSTARTVALUE
            });
        });
    };
    
    const resultFromRequest = function (headerBodyObject) {
        if (!worker) {
            return;
        }        
        worker.postMessage(headerBodyObject);
    };    
    
    let promiseId = 1;
    const resolveFromPromiseId = {};
    const answerObjectPromiseFromRequest = function (headerBodyObject) {
        return new Promise(function (resolve, reject) {
            if (!worker) {
                reject("No worker existing");
                return;
            }
            const internalId = String(promiseId);
            promiseId += 1;
            resolveFromPromiseId[internalId] = resolve;
            headerBodyObject.internalId = internalId,
            worker.postMessage({headerBodyObject});
        });
    };
    
    const close = function () {
        if (!worker) {
            return;
        }
        workerState = states.DISABLED;
        //worker.postMessage(COMMANDS.CLOSE); // soft close let finish last task
        worker.terminate(); // forced close don t let finish last task
        worker = undefined;
    };
    
    return {
        setBrowserServerCode,
        resultFromRequest,
        answerObjectPromiseFromRequest,
        run,
        close
    };
}());


/*serviceWorkerManager.js
lives on the main thread
registers service_worker.js
todo listen to the events and make the app active/not active accordingly
*/
/*jslint
    es6, maxerr: 100, browser, devel, fudge, maxlen: 120, white
*/
/*global
    navigator
*/


serviceWorkerManager = (function () {
    let serviceWorkerRegistration;
    const register = function () {
        if (!navigator.serviceWorker) {
            return false;
        }
        //const options = {scope: "./"};
        navigator.serviceWorker.register("/service_worker").then(
            function(registrationObject) {
                serviceWorkerRegistration = registrationObject;
                //console.log("service worker installed success!", registration);
        }).catch(
            function(reason) {
                console.error("service worker could not install:", reason);
            }
        );

        navigator.serviceWorker.addEventListener("message", function(event) {
            const message = event.data;
            
            if (message.hasOwnProperty("LOG")) {
                ui.serverLog(message.LOG);
                return;
            }
            
            const requestObject = message;
            const ressource = requestObject.header.ressource;
            rtc.rtcRequest(requestObject).then(function (answer) {
                //console.log("We have answer for", ressource, " answer", answer);
                navigator.serviceWorker.controller.postMessage({
                    ressource, //is the key, todo change and give internal id
                    answer
                });
            });
        });
        
        navigator.serviceWorker.addEventListener("activate", function(event) {
            console.log("serviceWorker: activate", location.origin);
        });
        
        navigator.serviceWorker.addEventListener("controllerchange", function(event) {
            console.log("serviceWorker: controllerchange");
        });
        return true;//success
    };

    const deleteServiceWorker = function () {
        if (!serviceWorkerRegistration) {
            return;
        }
        serviceWorkerRegistration.unregister().then(function(hasBeenUnregistered) {
            ;//
        });
    };
    
    
    const start = function () {
        if (!register()) {
            ui.displayFatalError("Service worker must be enabled");
        }
    };
    
    return {
        start,
        deleteServiceWorker
    };
}());
//launcher.js
(function () {
    if (window.test) {
        //console.log("test");
        return;
    }
    /*API evaluation to detect missing features, 
    use window. to use the wanted Error flow
    See RTCPeerConnection*/
    const minimumRequirement = {
        "Service Worker": {
            API: navigator.serviceWorker,
            text: "Service Worker must be enabled. Service Worker cannot be used in private browsing mode.",
            links: ["https://duckduckgo.com/?q=how+to+enable+service+worker"]
        },
        WebRTC: {
            API: window.RTCPeerConnection,
            text: "WebRTC must be enabled.",
            links: ["https://duckduckgo.com/?q=how+to+enable+webrtc"]
        }
    };

    

    const checkRequirements = function (requirement) {
        /**/
        let nonMet = false;
        const nonMetRequirement = {};
        Object.keys(requirement).forEach(function (technicalName) {
            if (!requirement[technicalName].API) {
                nonMet = true;
                nonMetRequirement[technicalName] = requirement[technicalName];
            }
        });
        if (nonMet) {
            return nonMetRequirement;
        }
        return false;
    };
    
    const nonMetRequirement = checkRequirements(minimumRequirement);
    if (nonMetRequirement) {
        ui.displayNonMetRequirement(nonMetRequirement);
        return; // cannot start
    }
    ui.start();

    const accepted = true; //localData.get(MESSAGES.CONDITION_ACCEPTED);
    
    const startServiceWorkerAndSockets = function () {
        serviceWorkerManager.start();
        sockets.start();
        window.addEventListener("beforeunload", function (event) {
            /*https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload
            if the setting warnBeforeLeave is true
            then we prompt user if really want to leave
            https://html.spec.whatwg.org/#the-beforeunloadevent-interface says to use
            preventDefault but it does not work in a test*/
            if (D.vr.warnBeforeLeave) {
                const message = "Are you sure you want to leave ?";
                /*if (event.preventDefault) {
                    const answer = prompt("Are you sure you want to leave ?");
                    if (answer) {
                        event.preventDefault();
                    }
                } else {*/
                    event.returnValue = message;
                    return message;
                /*}*/
            } else {
                ; // do not warn before leaving
            }
        }, false);
        window.addEventListener("unload", function (event) {
            /*not necessary but better*/
            sockets.socket.emit(MESSAGES.EXIT, 
                {}
            );
        }, false);
        window.addEventListener("error", function (event) {
            console.log(event);
            if (event.stopPropagation) {
                event.stopPropagation();
            }
            if (event.preventDefault) {
                event.preventDefault();
            }
        }, false);
        
        const updateOnLineState = function (event) {
            if (!notificationEnabled) {
                return;
            }
            isOnLine = navigator.onLine;
            let text;
            if (isOnLine) {
                text = "Connected to the network";
            } else {
                text = "Not connected to the network";
            }
            const onLineNotification = new Notification("Online Status", {
                body: text,
                tag: "onLine",
                noscreen: true /* don't force turn on screen*/
            });
            setTimeout(onLineNotification.close.bind(onLineNotification), MAX_NOTIFICATION_TIME); 
        };
        window.addEventListener("online", updateOnLineState);
        window.addEventListener("offline", updateOnLineState);
    };
    if (accepted) {
        startServiceWorkerAndSockets();
        ui.display(true);
    } else {
        ui.displayLandingPage(true).then(startServiceWorkerAndSockets);
    }
}());
