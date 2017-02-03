var argv = process.argv,
    device = require('iotivity-node'),
    server = device.server,
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
        rt: [ resourceTypeName ],
        id: resourceId,
        value: ledValue
    };
    return properties;
}

function setProperties(properties) {
    var ledValue = properties.value? true : false;
    if (led)
        led.write(ledValue? 1 : 0);
    debuglog('Set LED state: ', ledValue, '(', properties.value, ')');
}

function getRepresentation(request) {
    ocResource.properties = getProperties();
    request.respond(ocResource).catch(handleError);
}

function setRepresentation(request) {
    setProperties(request.data);

    ocResource.properties = getProperties();
    request.respond(ocResource).catch(handleError);

    ocResource.notify().catch(
        function(error) {
            debuglog('Notify failed with error: ', error);
        });
}

function handleError(error) {
    debuglog('LED: Fail to send response with error: ', error);
}

function enablePresence() {
        server.register({
            resourcePath: resourceInterfaceName,
            resourceTypes: [ resourceTypeName ],
            interfaces: [ 'oic.if.baseline' ],
            discoverable: true,
            observable: true,
            properties: getProperties()
        }).then(
            function(resource) {
                debuglog('register() resource successful');
                ocResource = resource;
                ocResource.onretrieve(getRepresentation)
                          .onupdate(setRepresentation);
            },
            function(error) {
                debuglog('register() resource failed with: ', error);
            });
}

enablePresence();

process.on('SIGINT', function() {

    ocResource.unregister().then(
        function() {
            debuglog('unregister() resource successful');
        },
        function(error) {
            debuglog('unregister() resource failed with: ', error);
        });

    setTimeout(function() { process.exit(0) }, 1000);
});

