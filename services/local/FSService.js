var fs = require('fs');
var path = require('path');

var tmp = require('tmp');
var request = require('request');

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

exports.createStreamToFileSystem = function (callback) {
	tmp.file(function (err, filepath) {
		if (err) {
			return callback(err);
		}

		callback(null, filepath, fs.createWriteStream(filepath));
	});
};

exports.getFileFromUrl = function (url, callback) {
	exports.createStreamToFileSystem(function (err, filepath, stream) {
		if (err) {
			return callback(err);
		}

		request(url, function (err, response, body) {
			if (err) {
				return callback(err);
			}

			var filename;
			try {
				filename = _getFilename(response);
			} catch (e) {
				return callback(e);
			}

			console.log("filename:", filename);

			stream.on('finish', function () {
				console.log('file downloaded');

				callback(null, filepath, filename);
			});
		}).pipe(stream);
	});
};

function _getFilename(response) {
	console.log("headers:", response.headers);

	// TODO sanitize inputs

	if (response.headers['content-type'] && !!~response.headers['content-type'].indexOf('name')) {
		return _extractFilenameFromHeaders(response.headers['content-type'], 'name');
	} else if (response.headers['content-disposition'] && !!~response.headers['content-disposition'].indexOf('filename')) {
		return _extractFilenameFromHeaders(response.headers['content-disposition'], 'filename');
	} else {
		////////////////////////////////////////////////////////////////
		// TODO https://app.asana.com/0/11244390559721/14733882770247 //
		////////////////////////////////////////////////////////////////

		throw new Error('NO_FILENAME_FOUND');
	}
}

function _extractFilenameFromHeaders(header, key) {
	var item = header.slice(header.indexOf(key));
	return item.slice(item.indexOf('"') + 1, -1) || item.slice(item.indexOf('\'') + 1, -1);
}