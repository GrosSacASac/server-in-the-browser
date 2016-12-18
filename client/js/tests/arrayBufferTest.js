/*disovery exercices*/

const stringRepresentationFromArrayBuffer = function (arrayBuffer) {
    const arrayBufferUint8View = new Uint8Array(arrayBuffer);
    const stringifiedArrayBuffer = arrayBufferUint8View.map(function (int8) {
        return String(int8);
    }).join("");
    return stringifiedArrayBuffer;
};

const test1 = function () {
        /**/
        const initialBody = new ArrayBuffer(20);
        const target = new ArrayBuffer(24);
        const initialBodyUint8View = new Uint8Array(initialBody);
        initialBodyUint8View[0] = 5;
        initialBodyUint8View[1] = 3;
        initialBodyUint8View[2] = 6;
        initialBodyUint8View[3] = 7;

        copyArrayBufferIntoBiggerArrayBuffer(initialBody, target, 4);
        console.log(stringRepresentationFromArrayBuffer(initialBody));
        console.log(stringRepresentationFromArrayBuffer(target));
    };

    const test2 = function () {
        /**/
        const initialBody = new ArrayBuffer(20);
        const initialBodyUint8View = new Uint8Array(initialBody);
        initialBodyUint8View[0] = 10;
        initialBodyUint8View[1] = 3;
        const initialHeaderBodyObject = {
            header: {
                a: 5,
                b: 9,
                z:12
            },
            body: initialBody
        };
        
        let fail = false;
        
        const checkIfTrue = function (maybe) {
            if (!maybe) {
                fail = true;
            }

        };
        
        const isSameAsInitial = function (headerBodyObject) {
            checkIfTrue(headerBodyObject.header.a === initialHeaderBodyObject.header.a);
            checkIfTrue(headerBodyObject.header.b === 9);
            const finalBody = headerBodyObject.body;
            const finalBodyUint8View = new Uint8Array(finalBody);
            checkIfTrue(finalBodyUint8View[0] === 10);
            checkIfTrue(finalBodyUint8View[1] === 3);
        }
        const tempArrayBuffer = arrayBufferFromHeaderBodyObject(initialHeaderBodyObject);
        const finalHeaderBodyObject = headerBodyObjectFromArrayBuffer(tempArrayBuffer);
        isSameAsInitial(finalHeaderBodyObject);


        if (fail) {
            throw new Error("not same as initial");
        }
    };