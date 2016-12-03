var argv = process.argv,
    device = require('iotivity-node'),
    client = device('client');

var resourcesFound;

function observeResource(event) {
    if ('properties' in event.resource) {
        console.log('Update from ' + event.resource.id.deviceId + ":" + event.resource.id.path);
        console.log('Properties:' + JSON.stringify(event.resource.properties, null, 4));
    }
}

function deleteResource(event) {
    var id = this.id.deviceId + ":" + this.id.path;
    console.log('deleteResource(' + this.id.path + ')');

    var resource = resourceFound[id];
    if (resource) {
        resource.removeEventListener("change", observeResource);
        delete resourceFound[id];
    }
}

client.addEventListener('resourcefound', function(event) {
    console.log('Resource found:' + JSON.stringify(event.resource, null, 4));

    var id = event.resource.id.deviceId + ":" + event.resource.id.path,
        resource = resourceFound[id];
    if (!resource) {
        resource = event.resource;
        resourceFound[id] = resource;
        resource.addEventListener("change", observeResource);
        resource.addEventListener("delete", deleteResource);
    }
});

client.subscribe().then(
    function() {
        console.log('Discover resources...');
        client.findResources().then(
            function() {
                console.log('findResources() successful');
                resourceFound = {};
            },
            function(error) {
                console.log('findResources() failed with ' + error);
            });
    },
    function(error) {
        console.log('subscribe() failed with: ' + error);
    });

process.on('SIGINT', function() {
    console.log('SIGINT: Quit...');

    // Stop observing
    for (var id in resourceFound) {
        var resource = resourceFound[id];
        if (resource) {
            console.log('removeEventListener(' + resource.id.path + ')');
            resource.removeEventListener("change", observeResource);
            resource.removeEventListener("delete", deleteResource);
        }
    }

    process.exit(0);
});

