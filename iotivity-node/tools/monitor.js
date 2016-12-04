var argv = process.argv,
    device = require('iotivity-node'),
    client = device.client;

var resourcesFound;

function observeResource(resource) {
    if ('properties' in resource) {
        console.log('Update from ' + resource.deviceId + ":" + resource.resourcePath);
        console.log('Properties:' + JSON.stringify(resource.properties, null, 4));
    }
}

function deleteResource() {
    var id = this.deviceId + ":" + this.resourcePath;
    console.log('deleteResource(' + this.resourcePath + ')');

    var resource = resourceFound[id];
    if (resource) {
        resource.removeListener('update', observeResource);
        resource.removeListener('delete', deleteResource);
        delete resourceFound[id];
    }
}

function foundResource(resource) {
    console.log('Resource found:' + JSON.stringify(resource, null, 4));

    var id = resource.deviceId + ":" + resource.resourcePath;
    if (!resourceFound[id]) {
        resourceFound[id] = resource;
        if (resource.observable) {
            resource.addListener('update', observeResource);
            resource.addListener('delete', deleteResource);
        }
    }
}

function discoverResource() {
    console.log('Discover resources...');
    client.findResources(foundResource).then(
        function() {
            console.log('findResources() successful');
            resourceFound = {};
        },
        function(error) {
            console.log('findResources() failed with ' + error);
        });
}

discoverResource();

process.on('SIGINT', function() {
    console.log('SIGINT: Quit...');

    // Stop observing
    for (var id in resourceFound) {
        var resource = resourceFound[id];
        if (resource) {
            console.log('removeListener(' + resource.resourcePath + ')');
            if (resource.observable) {
                resource.removeListener('update', observeResource);
                resource.removeListener('delete', deleteResource);
            }
        }
    }

    setTimeout(function() { process.exit(0) }, 1000);
});

