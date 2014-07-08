exports.File = function (filepath) {
	this.filepath = filepath;
};

exports.FileBuilder = function (file) {
	this.file = file;

	this.series = [];
	this.parallel = [];
	this.waterfall = [];

	this.then = function (callback) {
		this.series.push(function (callback) { callback(); });
	};

	this.add = function (callback) {
		this.parallel.push(callback);
	};

	this.to = function (callback) {
		this.waterfall.push(callback);
	};

	this.build = function (callback) {
		if (!this.parallel.isEmpty() || !this.waterfall.isEmpty()) {
			return new SGError('NOT_YET_IMPLEMENTED');
		}
		var self = this;
		async.series(this.series, function (err, results) {
			callback(err);
		});
	};
};

exports.getBuilder = function (filepath) {
	return FileBuilder(new File('filepath'));
};