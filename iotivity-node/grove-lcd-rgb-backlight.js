// Copyright 2016 Intel Corporation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var argv = process.argv,
    device = require('iotivity-node')('server'),
    debuglog = require('util').debuglog('rgblcd');

// Parse parameters from command line
// Usage: node lcd.js [<id>]
var resourceId = 'rgblcd';
if (argv.length > 2) {
    resourceId = argv[2];
}

var ocResource,
    resourceTypeName = 'oic.r.colour.rgb',
    resourceInterfaceName = '/a/' + resourceId,
    range = [0, 255],
    rgbValue = [0, 0, 0];

var upm_i2clcd;
try {
    upm_i2clcd = require('jsupm_i2clcd');
}
catch (e) {
    debuglog('No jsupm_i2clcd module: ', e.message);
}

var lcd = null;
if (upm_i2clcd) {
    lcd = new upm_i2clcd.Jhd1313m1(6, 0x3E, 0x62);
    if (lcd) {
        lcd.clear();
        setLcdBacklight();
    }
}
    
function checkColour(colour) {
    var min = range[0];
    var max = range[1];

    return (colour >= min && colour <= max)? true : false;
}

function setLcdBacklight() {
    if (lcd) {
        var red = rgbValue[0], green = rgbValue[1], blue = rgbValue[2];
        lcd.setColor(red, green, blue);
    }
}

device.device = Object.assign(device.device, {
    name: 'Grove LCD Backlight',
    coreSpecVersion: "1.0.0",
    dataModels: [ "v1.1.0-20160519" ]
});

device.platform = Object.assign(device.platform, {
    manufacturerName: 'Intel',
    manufactureDate: new Date('Fri Oct 14 17:13:48 CST 2016'),
    platformVersion: '1.1.0',
    firmwareVersion: '0.0.1'
});

function getProperties() {
    var properties = {
        rt: resourceTypeName,
        id: resourceId,
        rgbValue: rgbValue,
        range: range
    };
    return properties;
}

function setProperties(properties) {
    var v = properties.rgbValue;
    if (!v)
        return;

    var r = v[0], g = v[1], b = v[2];
    if (!checkColour(r) || !checkColour(g) || !checkColour(b))
        return;

    rgbValue = v;
    setLcdBacklight();

    debuglog('Set RGB backlight value: ', rgbValue);
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
    debuglog('Failed to send response with error: ', error);
}

// Enable presence
device.enablePresence().then(
    function() {
        debuglog('Create RGB LCD resource.');

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

// Cleanup on SIGINT
process.on('SIGINT', function() {
    // Turn off led before tearing down the resource
    if (lcd)
        lcd.setColor(0, 0, 0);

    // Remove event listeners
    device.removeEventListener('observerequest', getRepresentation);
    device.removeEventListener('retrieverequest', getRepresentation);
    device.removeEventListener('changerequest', setRepresentation);

    // Unregister resource
    device.unregister(ocResource).then(
        function() {
            debuglog('unregister() resource successful');
        },
        function(error) {
            debuglog('unregister() resource failed with: ', error);
        });

    // Disable presence
    device.disablePresence().then(
        function() {
            debuglog('device.disablePresence() successful');
        },
        function(error) {
            debuglog('device.disablePresence() failed with: ', error);
        });

    // Exit
    process.exit(0);
});

