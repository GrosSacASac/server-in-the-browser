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
export { bytes as default };
import {keyFromObjectAndValue, OutOfOrderError} from "./utilities/utilities.js";

 const bytes = (function () {

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
