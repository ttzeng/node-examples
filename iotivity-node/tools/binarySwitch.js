var argv = process.argv,
    device = require('iotivity-node'),
    server = device('server');

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
    request.sendResponse(ocResource).catch(handleError);
}

function setRepresentation(request) {
    console.log('setRepresentation');
    setProperties(request.res);

    ocResource.properties = getProperties();
    request.sendResponse(ocResource).catch(handleError);

    // Notify observers
    server.notify(ocResource).catch(
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
            id: { path: resourceInterfaceName },
            resourceTypes: [ resourceTypeName ],
            interfaces: [ 'oic.if.baseline' ],
            discoverable: true,
            observable: true,
            properties: getProperties()
        }).then(
            function(resource) {
                console.log('register() resource successful');
                ocResource = resource;
                // Add event handlers
                server.addEventListener('observerequest', getRepresentation);
                server.addEventListener('retrieverequest', getRepresentation);
                server.addEventListener('changerequest', setRepresentation);
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

    // Remove event listeners
    server.removeEventListener('observerequest', getRepresentation);
    server.removeEventListener('retrieverequest', getRepresentation);
    server.removeEventListener('changerequest', setRepresentation);

    // Unregister the resource
    server.unregister(ocResource).then(
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

    process.exit(0);
});

