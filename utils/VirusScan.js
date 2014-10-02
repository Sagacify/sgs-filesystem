// Node.js core module
var exec = require('child_process').exec,
	child;

/** Usage
 *	launchFileScan(filepath, function(err, msg) {
 *		console.log(err);
 *		console.log(msg);
 *	});
 **/
exports.launchFileScan = function (absFilePath, callback) {
	_isAntivirusRUnning(function (yes) {
		if (yes) {
			_scanFile(absFilePath, callback);
		} else {
			_startAntivirusService(function (isStarted) {
				if (isStarted) {
					_scanFile(absFilePath, callback);
				} else {
					callback(null, "Anti-Virus Not Started");
				}
			});
		}
	});
};

// Check if Antivirus service is started
function _isAntivirusRUnning(callback) {
	child = exec('ps ax | grep [c]lamd', function (error, stdout, stderr) {
		if (error) {
			callback(false);
		} else if (stderr === '') {
			callback(true);
		} else {
			//start service
			callback(false);
		}
	});
}

// Start the antivirus service on the linux instance
function _startAntivirusService(callback) {
	child = exec('service clamav-daemon start', function (err, stdout, stderr) {
		if (err) {
			callback(false);
		} else if (stderr === '') {
			if (stdout.indexOf("[ OK ]") != -1) {
				callback(true);
			} else {
				callback(false);
			}
		} else {
			callback(false);
		}
	});
}

// Scan a file located at absFilePath
function _scanFile(absFilePath, callback) {
	child = exec('clamdscan --no-summary ' + absFilePath, function (error, stdout, stderr) {
		if (error !== null) {
			if (error.code == 1) {
				callback(null, "A Virus has been found!");
			} else {
				callback(null, "An error occurd during file scanning");
			}
		} else {
			callback(null);
		}
	});
}