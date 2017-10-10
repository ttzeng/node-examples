var debuglog = require('util').debuglog('opencv');
var cv = require('opencv');

var camera, window;
try {
    camera = new cv.VideoCapture(0);
    window = new cv.NamedWindow('Video', 0);
} catch (e){
    console.log("Couldn't start camera:", e);
    process.exit(-1);
}

function processFrame(err, im) {
    if (err) throw(err);
    debuglog(im.size());
    if (im.size()[0] > 0 && im.size()[1] > 0) {
        // detect faces only on valid frames
        im.detectObject(cv.FACE_CASCADE, {}, function(err, faces) {
            if (err) throw err;
            debuglog(faces.length + ' faces detected');
            faces.forEach(function(face) {
                im.rectangle([face.x, face.y], [face.width, face.height], [0, 0, 255], 2);
            });
            window.show(im);
        });
        // wait a key event for given milliseconds
        window.blockingWaitKey(0, 50);
    }
    camera.read(processFrame);
}

camera.read(processFrame);
