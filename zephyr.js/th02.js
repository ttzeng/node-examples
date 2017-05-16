/*
 * Grove Temperature & Humidity Sensor (High-Accuracy & Mini)
 * http://wiki.seeed.cc/Grove-TemptureAndHumidity_Sensor-High-Accuracy_AndMini-v1.0/
 * Library   : https://github.com/hallard/TH02
 * Datasheet : http://www.hoperf.com/upload/sensor/TH02_V1.1.pdf
 */
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

var i2c = require('i2c'),
    i2cBus = i2c.open({ bus: 0, speed: 100 });

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

setInterval(function() {
    readTemperature(function(temperature) {
        console.log('temperature: ' + temperature);
    });
    setTimeout(readHumidity, 1000, function(humidity) {
        console.log('humidity: ' + humidity);
    });
}, 2000);
