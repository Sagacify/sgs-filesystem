var path = require('path');
var uuid = require('node-uuid');

exports.randomRenameFile = function (filepath, extension, callback) {
	return path.join(path.dirname(filepath), uuid.v4() + extension ? '.' + extension : '');
};