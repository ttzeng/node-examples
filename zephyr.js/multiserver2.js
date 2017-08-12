/*
 * Grove base shield configurations for the sensors supported by this script
 *     +--------------------------------------+------+
 *     | Sensor                               | Port |
 *     +--------------------------------------+------+
 *     | Actuator control board               |  D3  |
 *     | TH02 temperature & humidity sensor   | I2C  |
 *     +--------------------------------------+------+
 */
var gpio   = require('gpio');
var pwm    = require('pwm');
var i2c    = require('i2c');
var board  = require('arduino101_pins');
var ocf    = require('ocf');
var server = ocf.server;

console.log('Starting OCF servers...');

// Onboard LED
var led = gpio.open({ pin: 'LED2', mode: 'out', activeLow: false }),
    resPathLed = '/a/led',
    resTypeLed = 'oic.r.switch.binary',
    ledResource = null,
    ledProperties = {
        value: (led.read() != 0)? true : false
    },
    ledResourceInit = {
        resourcePath : '/a/led',
        resourceTypes: [ resPathLed ],
        interfaces   : [ resTypeLed ],
        discoverable : true,
        observable   : false,
        properties   : ledProperties
    };

function getLedOcRepresentation(request) {
    request.respond(ledProperties);
}

function setLedOcRepresentation(request) {
    if (request.data.properties) {
        var state = request.data.properties.value? true : false;
        console.log('Set LED state: ' + state);
        led.write((ledProperties.value = state)? 1 : 0);
    }
    request.respond(ledProperties);
}

server.register(ledResourceInit).then(function(resource) {
    console.log("LED registered");
    ledResource = resource;
}).catch(function(error) {
    console.log('Solar panel registration failure: ' + error.name);
});

// Solar panel driven by Actuonix linear actuator control board
// http://www.robotshop.com/media/files/pdf2/actuonix_lac_datasheet.pdf
var actuatorPwmPeriodInMsec = 20,
    actuatorPin = pwm.open({
        channel: board.IO3, period: actuatorPwmPeriodInMsec, pulseWidth: 1, polarity: 'normal'
    }),
    resPathSolar = '/a/solar',
    resTypeSolar = 'oic.r.solar',
    solarResource = null,
    solarProperties = {
        tiltPercentage: 0,
        simulationMode: false
    },
    solarResourceInit = {
        resourcePath : resPathSolar,
        resourceTypes: [ resTypeSolar ],
        interfaces   : [ 'oic.if.baseline' ],
        discoverable : true,
        observable   : false,
        properties   : solarProperties
    },
    simulationTiltStep,
    timerSolarSimulation = null;

function getSolarOcRepresentation(request) {
    request.respond(solarProperties);
}

function setActuatorTiltPosition(percentage) {
    var pulseWidthInMsec = 1 + percentage/100;
    actuatorPin.setMilliseconds(actuatorPwmPeriodInMsec, pulseWidthInMsec);
}

function setSolarOcRepresentation(request) {
    if (request.data.properties) {
        var simulationMode = request.data.properties.simulationMode? true : false;
        console.log('Solar panel simulation ' + (simulationMode? 'On' : 'Off'));
        solarProperties.simulationMode = simulationMode;
        if (simulationMode) {
            if (timerSolarSimulation == null) {
                solarProperties.tiltPercentage = 0;
                timerSolarSimulation = setInterval(function() {
                    /* start solar tilting simulation */
                    if (solarProperties.tiltPercentage <= 0) {
                        simulationTiltStep = 0.5;
                    } else if (solarProperties.tiltPercentage >= 100) {
                        simulationTiltStep = -0.5;
                    }
                    setActuatorTiltPosition(solarProperties.tiltPercentage += simulationTiltStep);
                }, 1000);
            }
        } else {
            if (timerSolarSimulation != null) {
                clearInterval(timerSolarSimulation);
                timerSolarSimulation = null;
            }
            setActuatorTiltPosition(solarProperties.tiltPercentage = request.data.properties.tiltPercentage);
        }
    }
    request.respond(solarProperties);
}

server.register(solarResourceInit).then(function(resource) {
    console.log("Solar panel registered");
    solarResource = resource;
}).catch(function(error) {
    console.log('Solar panel registration failure: ' + error.name);
});

// Grove Temperature & Humidity Sensor (High-Accuracy & Mini)
// http://www.hoperf.com/upload/sensor/TH02_V1.1.pdf
var TH02_I2C_ADDR = 0x40,       // TH02 I2C device address
    TH02_STATUS = 0,            // TH02 register addresses
    TH02_DATAh  = 1,
    TH02_DATAl  = 2,
    TH02_CONFIG = 3,
    TH02_ID     = 17,
    TH02_STATUS_RDY   = 0x01,   // Bit fields of TH02 registers
    TH02_CONFIG_START = 0x01,
    TH02_CONFIG_HEAT  = 0x02,
    TH02_CONFIG_TEMP  = 0x10,
    TH02_CONFIG_HUMI  = 0x00,
    TH02_CONFIG_FAST  = 0x20,
    TH02_ID_VAL       = 0x50;

var i2cBus = i2c.open({ bus: 0, speed: 100 });

var resPathTemperature = '/a/temperature',
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

var resPathHumidity = '/a/humidity',
    resTypeHumidity = 'oic.r.humidity',
    humidityResource = null,
    humidityProperties = {
        humidity: 80
    },
    humidityResourceInit = {
        resourcePath : resPathHumidity,
        resourceTypes: [ resTypeHumidity ],
        interfaces   : [ 'oic.if.baseline' ],
        discoverable : true,
        observable   : false,
        properties   : humidityProperties
    };

function writeRegister(reg, value) {
    i2cBus.write(TH02_I2C_ADDR, new Buffer([ reg, value ]));
}

function readRegister(reg) {
    return i2cBus.burstRead(TH02_I2C_ADDR, 1, reg);
}

function getId() {
    return readRegister(TH02_ID).readUInt8();
}

function getStatus() {
    return readRegister(TH02_STATUS).readUInt8();
}

function getConfig() {
    return readRegister(TH02_CONFIG).readUInt8();
}

function setConfig(config) {
    writeRegister(TH02_CONFIG, config);
}

function readTemperature(cb) {
    if ((getId() == TH02_ID_VAL) && !(getConfig() & TH02_CONFIG_START)) {
        setConfig(TH02_CONFIG_START | TH02_CONFIG_TEMP);
        var tid = setInterval(function() {
            if (!(getConfig() & TH02_CONFIG_START) && (getStatus() & TH02_STATUS_RDY)) {
                var data = i2cBus.burstRead(TH02_I2C_ADDR, 2, TH02_DATAh).readUInt16BE();
                data = (data >> 2) / 32 - 50;
                if (cb != null) cb(data);
                clearInterval(tid);
            }
        }, 50);
    }
}

function readHumidity(cb) {
    if ((getId() == TH02_ID_VAL) && !(getConfig() & TH02_CONFIG_START)) {
        setConfig(TH02_CONFIG_START);
        var tid = setInterval(function() {
            if (!(getConfig() & TH02_CONFIG_START) && (getStatus() & TH02_STATUS_RDY)) {
                var data = i2cBus.burstRead(TH02_I2C_ADDR, 2, TH02_DATAh).readUInt16BE();
                data = (data >> 4) / 16 - 24;
                if (cb != null) cb(data);
                clearInterval(tid);
            }
        }, 50);
    }
}

function getTemperatureOcRepresentation(request) {
    request.respond(temperatureProperties);
}

function getHumidityOcRepresentation(request) {
    request.respond(humidityProperties);
}

server.register(temperatureResourceInit).then(function(resource) {
    console.log("Temperature sensor registered");
    temperatureResource = resource;
}).catch(function(error) {
    console.log('Registration failure: ' + error.name);
});

server.register(humidityResourceInit).then(function(resource) {
    console.log("Humidity sensor registered");
    humidityResource = resource;
}).catch(function(error) {
    console.log('Registration failure: ' + error.name);
});

// Register Listeners
server.on('retrieve', function(request, observe) {
    if (request.target.resourcePath == resPathLed) {
        getLedOcRepresentation(request);
    } else if (request.target.resourcePath == resPathSolar) {
        getSolarOcRepresentation(request);
    } else if (request.target.resourcePath == resPathTemperature) {
        getTemperatureOcRepresentation(request);
    } else if (request.target.resourcePath == resPathHumidity) {
        getHumidityOcRepresentation(request);
    }
});

server.on('update', function(request) {
    if (request.target.resourcePath == resPathLed) {
        setLedOcRepresentation(request);
    } else if (request.target.resourcePath == resPathSolar) {
        setSolarOcRepresentation(request);
    }
});

// Periodically sense temperature & humidity
setInterval(function() {
    readTemperature(function(temperature) {
        console.log('temperature: ' + temperature);
        temperatureProperties.temperature = temperature;
    });
    setTimeout(readHumidity, 1000, function(humidity) {
        console.log('humidity: ' + humidity);
        humidityProperties.humidity = humidity;
    });
}, 2000);

/* Start the OCF stack */
ocf.start();
