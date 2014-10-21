// Node.js core module
var fs = require('fs');
var path = require('path');

// NPM modules
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
				filename = _getFilename(response, url);
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

function _getFilename(response, url) {
	console.log("headers:", response.headers);

	////////////////////
	// TODO sanitize  //
	////////////////////

	if (response.headers['content-type'] && !! ~response.headers['content-type'].indexOf('name')) {
		return _extractFilenameFromHeaders(response.headers['content-type'], 'name');
	} else if (response.headers['content-disposition'] && !! ~response.headers['content-disposition'].indexOf('filename')) {
		return _extractFilenameFromHeaders(response.headers['content-disposition'], 'filename');
	} else {
		return _getFileName(url);

	}
}

function _extractFilenameFromHeaders(header, key) {
	var item = header.slice(header.indexOf(key));
	return item.slice(item.indexOf('"') + 1, -1) || item.slice(item.indexOf('\'') + 1, -1);
}

function _getFileName(url) {
	var anchor = url.indexOf('#');
	var query = url.indexOf('?');
	var end = Math.min(
		anchor > 0 ? anchor : url.length,
		query > 0 ? query : url.length);
	return url.substring(url.lastIndexOf('/', end) + 1, end);
}

function _getPDFFileNameFromURL(url) {
	var reURI = /^(?:([^:]+:)?\/\/[^\/]+)?([^?#]*)(\?[^#]*)?(#.*)?$/;
	//            SCHEME      HOST         1.PATH  2.QUERY   3.REF
	// Pattern to get last matching NAME.ext
	var reFilename = /[^\/?#=]+\.pdf\b(?!.*\.pdf\b)/i;
	var splitURI = reURI.exec(url);
	var suggestedFilename = reFilename.exec(splitURI[1]) ||
		reFilename.exec(splitURI[2]) ||
		reFilename.exec(splitURI[3]);
	if (suggestedFilename) {
		suggestedFilename = suggestedFilename[0];
		if (suggestedFilename.indexOf('%') !== -1) {
			// URL-encoded %2Fpath%2Fto%2Ffile.pdf should be file.pdf
			try {
				suggestedFilename =
					reFilename.exec(decodeURIComponent(suggestedFilename))[0];
			} catch (e) { // Possible (extremely rare) errors:
				// URIError "Malformed URI", e.g. for "%AA.pdf"
				// TypeError "null has no properties", e.g. for "%2F.pdf"
			}
		}
	}
	return suggestedFilename || 'document.pdf';
}