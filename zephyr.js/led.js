var ocf = require('ocf');
var server = ocf.server;

var gpio  = require('gpio'),
    led   = gpio.open({ pin: 'LED2', mode: 'out', activeLow: false });

var ledResource,
    ledProperties = {
        value: (led.read() != 0)? true : false
    },
    ledResourceInit = {
        resourcePath : '/a/led',
        resourceTypes: [ 'oic.r.switch.binary' ],
        interfaces   : [ 'oic.if.baseline' ],
        discoverable : true,
        observable   : false,
        properties   : ledProperties
    };

console.log('Starting OCF LED server...');

function getOcRepresentation(request, observe) {
    request.respond(ledProperties).then(function() {
        console.log('\trespond success');
    }).catch(function(error) {
        console.log('\trespond failure: ' + error.name);
    });
}

function setOcRepresentation(request) {
    if (request.data.properties) {
        var state = request.data.properties.value? true : false;
        console.log('Set LED state: ' + state);
        led.write((ledProperties.value = state)? 1 : 0);
    }
    request.respond(ledProperties);
}

server.register(ledResourceInit).then(function(resource) {
    console.log("Resource registered");
    ledResource = resource;
    server.on('retrieve', getOcRepresentation);
    server.on('update'  , setOcRepresentation);
}).catch(function(error) {
    console.log('Registration failure: ' + error.name);
});

ocf.start();
