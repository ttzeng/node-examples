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
    device = require('iotivity-node'),
    server = device.server,
    debuglog = require('util').debuglog('th02');

// Parse parameters from command line
// Usage: node th02.js [<id>]
var resourceId = (argv.length > 2)? argv[2] : 'th02';

var ocResource,
    resourceInterfaceName   = '/a/' + resourceId,
    resourceTypeTemperature = 'oic.r.temperature',
    desiredTemperature      = 25.0,
    resourceTypeHumidity    = 'oic.r.humidity',
    desiredHumidity         = 75;

var th02 = null;
try {
    require('mraa');
    var jsupm_th02 = require('jsupm_th02');
    th02 = new jsupm_th02.TH02();
} catch (e) {
    console.log('TH02 initialization failure: ', e.message);
    process.exit(-1);
}

var lcd = null;
try {
    var jsupm_i2clcd = require('jsupm_i2clcd');
    lcd = new jsupm_i2clcd.Jhd1313m1(6, 0x3E, 0x62);
    lcd.clear();
} catch (e) {
    debuglog('LCD display unavailable');
}

function getTemperature() {
    var temperature;
    try {
        temperature = th02.getTemperature();
    } catch (e) {
        debuglog('TH02 access failure: ' + e.message);
        temperature = 25.0;
    }
    if (lcd) {
        lcd.setCursor(0, 0);
        lcd.write('                ');
        lcd.setCursor(0, 0);
        lcd.write('T: ' + temperature + ' C');
    }
    return Math.round(temperature * 10) / 10;
}

function getHumidity() {
    var humidity;
    try {
        humidity = th02.getHumidity();
    } catch (e) {
        debuglog('TH02 access failure: ' + e.message);
        humidity = 75;
    }
    if (lcd) {
        lcd.setCursor(1, 0);
        lcd.write('                ');
        lcd.setCursor(1, 0);
        lcd.write('H: ' + humidity + ' %');
    }
    return Math.round(humidity);
}

function getProperties() {
    var properties = {
        rt: [ resourceTypeTemperature, resourceTypeHumidity ],
        id: resourceId,
        temperature: getTemperature(),
        units: 'C',
        range: [ 0.0, 70.0 ],	// Ref: http://www.hoperf.com/upload/sensor/TH02_V1.1.pdf
        humidity: getHumidity(),
        desiredHumidity: desiredHumidity
    };
    return properties;
}

function setProperties(properties) {
    if ('temperature' in properties) {
        desiredTemperature = properties.temperature;
        debuglog('Desired temperature: ', desiredTemperature);
    }
    if ('desiredHumidity' in properties) {
        desiredHumidity = properties.desiredHumidity;
        debuglog('Desired humidity: ', desiredHumidity);
    }
}

function getRepresentation(request) {
    ocResource.properties = getProperties();
    debuglog('getRepresentation: ', ocResource.properties);
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
    debuglog('Fail to send response with error: ', error);
}

// Register the resource
server.register({
    resourcePath: resourceInterfaceName,
    resourceTypes: [ resourceTypeTemperature, resourceTypeHumidity ],
    interfaces: [ 'oic.if.baseline' ],
    discoverable: true,
    observable: true,
    properties: getProperties()
}).then(
    function(resource) {
        debuglog('register() resource successful');
        ocResource = resource;
        // Register callback handlers
        ocResource.onretrieve(getRepresentation)
                  .onupdate(setRepresentation);
    },
    function(error) {
        debuglog('register() resource failed with: ', error);
    });

function exitHandler() {
    debuglog('Delete resource...');

    // Unregister the resource
    ocResource.unregister().then(
        function() {
            debuglog('unregister() resource successful');
        },
        function(error) {
            debuglog('unregister() resource failed with: ', error);
        });

    setTimeout(function() { process.exit(0) }, 1000);
}

// Exit gracefully
process.on('SIGINT', exitHandler);
process.on('SIGTERM', exitHandler);

