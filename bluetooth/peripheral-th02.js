var argv = process.argv,
    debuglog = require('util').debuglog('peripheral-th02'),
    bleno = require('bleno');

var name = 'bleno-th02',
    uuidServiceEnvironmentalSensing = '181a',
    uuidCharacteristicTemperature   = '2a6e',
    uuidCharacteristicHumidity      = '2a6f',
    updateIntervalTemperatureInMsec = 300000,  // 5 minutes
    updateIntervalHumidityInMsec    = 300000;  // 5 minutes

if (argv.length > 2)
    name = argv[2];

var jsupm_th02, th02 = null;
try {
    require('mraa');
    jsupm_th02 = require('jsupm_th02');
    th02 = new jsupm_th02.TH02();
} catch (e) {
    console.log('TH02 initialization failure: ', e.message);
    process.exit(-1);
}

// must be in 'poweredOn' state before starting advertising
bleno.on('stateChange', function(state) {
    debuglog('State change: ' + state);
    if (state === 'poweredOn') {
        bleno.startAdvertising(name, [ uuidServiceEnvironmentalSensing ], function(error) {
            if (error) {
                console.log('Advertising error: ' + error);
            } else {
                debuglog('Advertising start success');
                bleno.setServices(primaryServices);
            }
        });
    } else {
        bleno.stopAdvertising();
    }
});

bleno.on('accept', function(clientAddress) {
    debuglog('Accepted connection from ' + clientAddress);
});

bleno.on('disconnect', function(clientAddress) {
    debuglog('Disconnected from ' + clientAddress);
});

var primaryServices = [
    new bleno.PrimaryService({
        // Environmental Sensing Service (ESS)
        uuid: uuidServiceEnvironmentalSensing,
        characteristics: [
            new bleno.Characteristic({
                // org.bluetooth.characteristic.temperature
                uuid: uuidCharacteristicTemperature,
                properties: [ 'notify', 'read' ],
                onReadRequest: function (offset, callback) {
                        // in Celsius degrees with a resolution of 0.01 degrees
                        var temperature = getTemperature();
                        debuglog('Temperature: ' + temperature + '°C');
                        callback(bleno.Characteristic.RESULT_SUCCESS,
                                 toBuffer(temperature * 100, true));
                    },
                onSubscribe : function(maxValueSize, updateValueCallback) {
                        debuglog('Temperature updates subscribed');
                        this.intervalId = setInterval(function() {
                            updateValueCallback(toBuffer(getTemperature() * 100, true));
                        }, updateIntervalTemperatureInMsec);
                    },
                onUnsubscribe : function() {
                        debuglog('Temperature updates unsubscribed');
                        clearInterval(this.intervalId);
                    },
            }),
            new bleno.Characteristic({
                // org.bluetooth.characteristic.humidity
                uuid: uuidCharacteristicHumidity,
                properties: [ 'notify', 'read' ],
                onReadRequest: function (offset, callback) {
                        // in percent with a resolution of 0.01 percent
                        var humidity = getHumidity();
                        debuglog('Humidity: ' + humidity + '%');
                        callback(bleno.Characteristic.RESULT_SUCCESS,
                                 toBuffer(humidity * 100, false));
                    },
                onSubscribe : function(maxValueSize, updateValueCallback) {
                        debuglog('Humidity updates subscribed');
                        this.intervalId = setInterval(function() {
                            updateValueCallback(toBuffer(getHumidity() * 100, false));
                        }, updateIntervalHumidityInMsec);
                    },
                onUnsubscribe : function() {
                        debuglog('Humidity updates unsubscribed');
                        clearInterval(this.intervalId);
                    },
            })
        ]
    })
];

function toBuffer(value, sign) {
    var buffer = new Buffer(2);
    if (sign == true)
        buffer.writeInt16LE(value, 0);
    else
        buffer.writeUInt16LE(value, 0);
    return buffer;
}

var lcd = null;
try {
    var jsupm_i2clcd = require('jsupm_i2clcd');
    lcd = new jsupm_i2clcd.Jhd1313m1(6, 0x3E, 0x62);
    lcd.clear();
    lcd.setColor(128, 128, 128);
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
        lcd.write('T: ' + temperature.toFixed(1) + ' C');
    }
    return temperature;
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
        lcd.write('H: ' + humidity.toFixed(1) + ' %');
    }
    return humidity;
}

