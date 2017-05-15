/*
 * Grove base shield configurations for the sensors supported by this script
 *     +-----------------------------------+
 *     | Sensor                     | Port |
 *     +----------------------------+------+
 *     | Onchip BMI160 temperature  |  --  |
 *     | Grove PIR motion sensor    |  D2  |
 *     | Grove button               |  D4  |
 *     | Grove buzzer               |  D7  |
 *     +----------------------------+------+
 */
var gpio   = require('gpio');
var ocf    = require('ocf');
var server = ocf.server;

var updateTemperatureFrequency = 1;  /* desire frequency in Hz */

// BMI160 Temperature Sensor
// http://www.mouser.com/ds/2/783/BST-BMI160-DS000-07-786474.pdf
var temperatureSensor = new TemperatureSensor({
        controller: 'bmi160',
        frequency : updateTemperatureFrequency
    }),
    resPathTemperature = '/a/temperature',
    resTypeTemperature = 'oic.r.temperature',
    temperatureResource = null,
    temperatureProperties = {
        temperature: 25.0,
        units: 'C'
    },
    temperatureResourceInit = {
        resourcePath : resPathTemperature,
        resourceTypes: [ resTypeTemperature ],
        interfaces   : [ 'oic.if.baseline' ],
        discoverable : true,
        observable   : false,
        properties   : temperatureProperties
    };

// PIR Motion Sensor
var PIR = gpio.open({ pin: 2, mode: 'in', edge: 'any' }),
    resPathMotion = '/a/pir',
    resTypeMotion = 'oic.r.sensor.motion',
    motionResource = null,
    motionProperties = {
        value: PIR.read()
    },
    motionResourceInit = {
        resourcePath : resPathMotion,
        resourceTypes: [ resTypeMotion ],
        interfaces   : [ 'oic.if.baseline' ],
        discoverable : true,
        observable   : true,
        properties   : motionProperties
    };

// Button
var button = gpio.open({ pin: 4, mode: 'in', edge: 'any' }),
    resPathButton = '/a/button',
    resTypeButton = 'oic.r.button',
    buttonResource = null,
    buttonProperties = {
        value: button.read()
    },
    buttonResourceInit = {
        resourcePath : resPathButton,
        resourceTypes: [ resTypeButton ],
        interfaces   : [ 'oic.if.baseline' ],
        discoverable : true,
        observable   : true,
        properties   : buttonProperties
    };

// Buzzer
var buzzer = gpio.open({ pin: 7, mode: 'out', activeLow: false }),
    resPathBuzzer = '/a/buzzer',
    resTypeBuzzer = 'oic.r.buzzer',
    buzzerResource = null,
    buzzerProperties = {
        value: buzzer.read()
    },
    buzzerResourceInit = {
        resourcePath : resPathBuzzer,
        resourceTypes: [ resTypeBuzzer ],
        interfaces   : [ 'oic.if.baseline' ],
        discoverable : true,
        observable   : true,
        properties   : buzzerProperties
    };

console.log('Starting Multiple OCF servers...');

// Event Handlers
temperatureSensor.onchange = function() {
    var temperature = temperatureSensor.celsius;
    console.log('temperature: ' + temperature + '°C');
    temperatureProperties.temperature = temperature;
};

temperatureSensor.onactivate = function() {
    console.log('temperature sensor activated');
};

temperatureSensor.onerror = function(event) {
    console.log('exception occurs: ' + event.error.name + ' - ' + event.error.message);
};

PIR.onchange = function(event) {
    var state = PIR.read();
    console.log('motion: ' + state);
    motionProperties.value = state;
};

button.onchange = function(event) {
    console.log('button: ' + event.value);
    buttonProperties.value = event.value;
};

function getTemperatureRepresentation(request) {
    request.respond(temperatureProperties);
}

function getMotionOcRepresentation(request) {
    request.respond(motionProperties);
}

function getButtonOcRepresentation(request) {
    request.respond(buttonProperties);
}

function getBuzzerOcRepresentation(request) {
    request.respond(buzzerProperties);
}

function setBuzzerOcRepresentation(request) {
    if (request.resource.properties) {
        var state = request.resource.properties.value? true : false;
        console.log('Set buzzer ' + (state? 'On' : 'Off'));
        buzzer.write(buzzerProperties.value = state);
    }
    request.respond(buzzerProperties);
}

// Resource Registration
server.register(temperatureResourceInit).then(function(resource) {
    console.log("Temperature sensor registered");
    temperatureResource = resource;
}).catch(function(error) {
    console.log('Registration failure: ' + error.name);
});

server.register(motionResourceInit).then(function(resource) {
    console.log("Motion sensor registered");
    motionResource = resource;
}).catch(function(error) {
    console.log('Motion sensor registration failure: ' + error.name);
});

server.register(buttonResourceInit).then(function(resource) {
    console.log("Button registered");
    buttonResource = resource;
}).catch(function(error) {
    console.log('Button registration failure: ' + error.name);
});

server.register(buzzerResourceInit).then(function(resource) {
    console.log("Buzzer registered");
    buzzerResource = resource;
}).catch(function(error) {
    console.log('Buzzer registration failure: ' + error.name);
});

// Register Listeners
server.on('retrieve', function(request, observe) {
    if (request.target.resourcePath == resPathMotion) {
        getMotionOcRepresentation(request);
    } else if (request.target.resourcePath == resPathButton) {
        getButtonOcRepresentation(request);
    } else if (request.target.resourcePath == resPathBuzzer) {
        getBuzzerOcRepresentation(request);
    } else if (request.target.resourcePath == resPathTemperature) {
        getTemperatureRepresentation(request);
    }
});

server.on('update', function(request) {
    if (request.target.resourcePath == resPathBuzzer) {
        setBuzzerOcRepresentation(request);
    }
});

/* Start the sensor instance and emit events */
temperatureSensor.start();

/* Start the OCF stack */
ocf.start();
