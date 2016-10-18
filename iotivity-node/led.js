var argv = process.argv,
    device = require('iotivity-node')('server'),
    debuglog = require('util').debuglog('led');

// Parse parameters from command line
// Usage: node led.js [[<pin>] <id>]
var pin,
    resourceId = 'led';
if (argv.length <= 2 || isNaN(pin = parseInt(argv[2])))
    pin = 13;
if (argv.length > 3)
    resourceId = argv[3];

var ocResource,
    resourceTypeName = 'oic.r.switch.binary',
    resourceInterfaceName = '/a/' + resourceId;

var mraa;
try {
    mraa = require('mraa');
}
catch (e) {
    debuglog('No mraa module: ', e.message);
}

var led = null;
if (mraa) {
    led = new mraa.Gpio(pin);
    led.dir(mraa.DIR_OUT);
}

function getProperties() {
    var ledValue = (led && led.read() != 0);
    var properties = {
        rt: resourceTypeName,
        id: resourceId,
        value: ledValue
    };
    return properties;
}

function setProperties(properties) {
    var ledValue = properties.value;
    if (led)
        led.write(ledValue? 1 : 0);
    debuglog('Set LED state: ', ledValue);
}

function getRepresentation(request) {
    ocResource.properties = getProperties();
    request.sendResponse(ocResource).catch(handleError);
}

function setRepresentation(request) {
    setProperties(request.res);

    ocResource.properties = getProperties();
    request.sendResponse(ocResource).catch(handleError);

    device.notify(ocResource).then(
        function() {
            debuglog('Successfully notified observers.');
        },
        function(error) {
            debuglog('Notify failed with error: ', error);
        });
}

function handleError(error) {
    debuglog('LED: Fail to send response with error: ', error);
}

device.enablePresence().then(
    function() {
        device.register({
            id: { path: resourceInterfaceName },
            resourceTypes: [ resourceTypeName ],
            interfaces: [ 'oic.if.baseline' ],
            discoverable: true,
            observable: true,
            properties: getProperties()
        }).then(
            function(resource) {
                debuglog('register() resource successful');
                ocResource = resource;
                device.addEventListener('observerequest', getRepresentation);
                device.addEventListener('retrieverequest', getRepresentation);
                device.addEventListener('changerequest', setRepresentation);
            },
            function(error) {
                debuglog('register() resource failed with: ', error);
            });
    },
    function(error) {
        debuglog('device.enablePresence() failed with: ', error);
    });

process.on('SIGINT', function() {
    device.removeEventListener('observerequest', getRepresentation);
    device.removeEventListener('retrieverequest', getRepresentation);
    device.removeEventListener('changerequest', setRepresentation);
    device.unregister(ocResource).then(
        function() {
            debuglog('unregister() resource successful');
        },
        function(error) {
            debuglog('unregister() resource failed with: ', error);
        });
    device.disablePresence().then(
        function() {
            debuglog('device.disablePresence() successful');
        },
        function(error) {
            debuglog('device.disablePresence() failed with: ', error);
        });

    process.exit(0);
});

