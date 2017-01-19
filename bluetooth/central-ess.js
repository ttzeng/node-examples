var argv = process.argv,
    debuglog = require('util').debuglog('central-ess'),
    noble = require('noble');

var uuidServiceEnvironmentalSensing = '181a',
    uuidCharacteristicTemperature   = '2a6e',
    uuidCharacteristicHumidity      = '2a6f';

var scanPeripheralInMsec,               // delay before next scan
    tailingDisconnectInMsec = 500;      // delay before disconnect the link
if (argv.length <= 2 || isNaN(scanPeripheralInMsec = parseInt(argv[2])))
    scanPeripheralInMsec = 10000;       // default 10 sec between scans

// must be in 'poweredOn' state before scanning
noble.on('stateChange', function(state) {
    debuglog('State change: ' + state);
    if (state === 'poweredOn') {
        // scan any services
        noble.startScanning([], true, function(error) {
            if (error) {
                console.log('Scanning error: ' + error);
            }
        });
    } else {
        noble.stopScanning();
    }
});

var idTimerNextScan = null,
    idTimerDisconnect = null;

noble.on('discover', function(peripheral) {
    debuglog('\'' + peripheral.advertisement.localName + '\'' +
             ' (' + peripheral.address + ')' +
             ', RSSI= ' + peripheral.rssi +
             ' discovered');
    if (peripheral.advertisement.serviceUuids.indexOf(uuidServiceEnvironmentalSensing) > -1) {
        noble.stopScanning();
        debuglog('\tEnvironmental Sensing Service available');
        peripheral.once('connect', function() {
            debuglog('Connected');
            this.discoverSomeServicesAndCharacteristics(
                [ uuidServiceEnvironmentalSensing ],
                [ uuidCharacteristicTemperature, uuidCharacteristicHumidity ],
                function(error, services, characteristics) {
                    if (!error) {
                        for (var i = 0; i < characteristics.length; i++)
                            processCharacteristic(characteristics[i]);
                        idTimerDisconnect = setTimeout(function() {
                            idTimerDisconnect = null;
                            peripheral.disconnect();
                        }, tailingDisconnectInMsec);
                    }
                });
        });
        peripheral.once('disconnect', function() {
            debuglog('Disconnected');
            idTimerNextScan = setTimeout(function() {
                idTimerNextScan = null;
                noble.startScanning([], true);
            }, scanPeripheralInMsec);
        });
        peripheral.connect(function(error) {
            if (error) {
                console.log('Connection error: ' + error);
            }
        });
    }
});

function processCharacteristic(characteristic) {
    switch (characteristic.uuid) {
        case uuidCharacteristicTemperature:
             characteristic.read(function(error, data) {
                 if (!error && data.length == 2) {
                     debuglog('Temperature: ' + (data.readInt8(0) + data.readInt8(1)*256)/100 + ' °C');
                 }
             });
             break;
        case uuidCharacteristicHumidity:
             characteristic.read(function(error, data) {
                 if (!error && data.length == 2) {
                     debuglog('Humidity: ' + (data.readUInt8(0) + data.readUInt8(1)*256)/100 + '%');
                 }
             });
             break;
    }
}

process.on('SIGINT', function() {
    console.log('SIGINT: Cleanup...');

    noble.stopScanning();

    if (idTimerNextScan)
        clearTimeout(idTimerNextScan);
    if (idTimerDisconnect)
        clearTimeout(idTimerDisconnect);

    setTimeout(function() { process.exit(0) }, 1000);
});

