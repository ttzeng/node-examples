var argv = process.argv,
    device = require('iotivity-node'),
    server = device.server;

// Parse parameters from the command line
var resourceId = 'switch';
if (argv.length > 2)
    resourceId = argv[2];

var ocResource,
    resourceTypeName = 'oic.r.switch.binary',
    resourceInterfaceName = '/a/' + resourceId,
    resourceState = false;

function getProperties() {
    var properties = {
        rt: [ resourceTypeName ],
        id: resourceId,
        value: resourceState
    };
    return properties;
}

function setProperties(properties) {
    resourceState = properties.value? true : false;
    console.log('Set value: ', resourceState);
}

function getRepresentation(request) {
    console.log('getRepresentation');
    ocResource.properties = getProperties();
    request.respond(ocResource).catch(handleError);
}

function setRepresentation(request) {
    console.log('setRepresentation');
    setProperties(request.data);

    ocResource.properties = getProperties();
    request.respond(ocResource).catch(handleError);

    // Notify observers
    ocResource.notify().catch(
        function(error) {
            console.log('Failed to notify observers: ', error);
        });
}

function handleError(error) {
    console.log('Fail to send response with error: ', error);
}

server.enablePresence().then(
    function() {
        // Register the resource
        server.register({
            resourcePath: resourceInterfaceName,
            resourceTypes: [ resourceTypeName ],
            interfaces: [ 'oic.if.baseline' ],
            discoverable: true,
            observable: true,
            properties: getProperties()
        }).then(
            function(resource) {
                console.log('register() resource successful');
                ocResource = resource;
                // Register callback handlers
                ocResource.onretrieve(getRepresentation)
                          .onupdate(setRepresentation);
            },
            function(error) {
                console.log('register() resource failed with: ', error);
            });
    },
    function(error) {
        console.log('enablePresence() failed with: ', error);
    });

process.on('SIGINT', function() {
    console.log('SIGINT: Delete resource...');

    // Unregister the resource
    ocResource.unregister().then(
        function() {
            console.log('unregister() resource successful');
        },
        function(error) {
            console.log('unregister() resource failed with: ', error);
        });
    // Disable presence
    server.disablePresence().then(
        function() {
            console.log('disablePresence() successful');
        },
        function(error) {
            console.log('disablePresence() failed with: ', error);
        });

    setTimeout(function() { process.exit(0) }, 1000);
});

