var fs = require('fs');
var tmp = require('tmp');

exports.readThenDeleteLocalFile = function (filepath, callback) {
	fs.readFile(filepath, function (err, data) {
		fs.unlink(filepath, function (err) {
			if (!err) {
				console.log("successfully deleted " + filepath);
			}
		});
		callback(err, data ? data : null);
	});
};

exports.getSize = function (filepath, callback) {
	fs.stat(filepath, function (err, stats) {
		callback(err, stats ? stats.size : 0);
	});
};

exports.writeDataToFileSystem = function (filename, data, callback) {
	tmp.dir(function (err, directoryPath) {
		if (err) {
			console.log("err: ");
			console.log(err);
			return callback(err);
		}

		var filepath = directoryPath + "/" + filename;
		fs.writeFile(filepath, data, function (err) {
			callback(err, filepath);
		});
	});
};

exports.createStreamToFileSystem = function (filename, callback) {
	tmp.dir(function (err, directoryPath) {
		if (err) {
			return callback(err);
		}

		var filepath = directoryPath + "/" + (filename ? filename : "no-name");
		callback(null, filepath, fs.createWriteStream(filepath));
	});
};