var contentType = require('node-lib').content_type.ext;
var VirusScan = require('../../utils/VirusScan');
var FSService = require('../local/FSService');

var async = require('async');
var AWS = require('aws-sdk');
var uuid = require('node-uuid');
var fs = require('fs');
var tmp = require('tmp');

var writeQueue = async.queue(function (task, callback) {
	task(callback);
}, 3);

var readQueue = async.queue(function (task, callback) {
	task(callback);
}, 3);

var removeQueue = async.queue(function (task, callback) {
	task(callback);
}, 3);

var deleteQueue = async.queue(function (task, callback) {
	task(callback);
}, 3);

function S3Service(config) {
	this.getConfig = function () {
		return config;
	};
	AWS.config.update({
		region: config.region,
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey
	});
	var s3 = new AWS.S3();
	this.getS3 = function () {
		return s3;
	};
}

S3Service.prototype.addToWriteQueue = function (params, callback) {
	writeQueue.push(function (callback) {
		this.getS3().client.putObject(params, callback);
	}, callback);
};

S3Service.prototype.addToReadQueue = function (params, callback) {
	readQueue.push(function (callback) {
		this.getS3().client.getObject(params, callback);
	}, callback);
};

S3Service.prototype.addToRemoveQueue = function (params, callback) {
	removeQueue.push(function (callback) {
		this.getS3().client.deleteObject(params, callback);
	}, callback);
};

S3Service.prototype.addToDeleteQueue = function (params, callback) {
	deleteQueue.push(function (callback) {
		this.getS3().client.deleteObjects(params, callback);
	}, callback);
};

S3Service.prototype.bucketInitialization = function () {
	var self = this;
	var bucketNames = [];
	if (this.getConfig().s3BucketName) bucketNames.push(this.getConfig().s3BucketName);
	if (this.getConfig().s3SecuredBucketName) bucketNames.push(this.getConfig().s3SecuredBucketName);

	this.getS3().client.listBuckets(function (err, data) {
		if (err) {
			console.log(err);
		} else {
			bucketNames.forEach(function (bucketName) {
				if (data.Buckets.filter(function (bucket) {
					return bucket.Name == bucketName;
				}).length === 0) {
					self.getS3().client.createBucket({
						Bucket: bucketName
					}, function (err, data) {
						if (err) {
							console.log(err);
						} else console.log("Successfully created S3 " + bucketName + " bucket");
					});
				} else {
					console.log("S3 bucket " + bucketName + " connected...");
				}
			});
		}
	});
};

S3Service.prototype.writeFileToS3 = function (base64data, originalFilename, extension, secure, callback) {
	var name = uuid.v4();
	var filename = extension ? name + "." + extension : name;

	console.log("write file to S3: ", originalFilename);

	this.addToWriteQueue({
		Bucket: secure ? this.getConfig().s3SecuredBucketName : this.getConfig().s3BucketName,
		Key: filename,
		Body: new Buffer(base64data, 'base64'),
		ContentType: contentType.getContentType(extension),
		ContentDisposition: 'attachment; filename="' + originalFilename || filename + '"'
	}, function (err) {
		callback(err, filename);
	});
};

S3Service.prototype.readFileFromS3 = function (filename, secureOrBucket, callback) {
	var bucket;
	if (typeof secureOrBucket == "string") {
		bucket = secureOrBucket;
	} else {
		bucket = secureOrBucket ? this.getConfig().s3SecuredBucketName : this.getConfig().s3BucketName;
	}

	this.addToReadQueue({
		Bucket: bucket,
		Key: filename
	}, callback);
};

S3Service.prototype.removeFileFromS3 = function (filename, secure, callback) {
	this.addToRemoveQueue({
		Bucket: secure ? this.getConfig().s3SecuredBucketName : this.getConfig().s3BucketName,
		Key: filename
	}, callback);
};

S3Service.prototype.removeFilesFromS3 = function (filenames, secure, callback) {
	if (!filenames.length) {
		return callback(new SGError('NO_FILENAMES'));
	}
	var objects = [];
	filenames.forEach(function (filename) {
		objects.push({
			Key: filename
		});
	});

	this.addToDeleteQueue({
		Bucket: secure ? this.getConfig().s3SecuredBucketName : this.getConfig().s3BucketName,
		Delete: {
			Objects: objects
		}
	}, callback);
};

S3Service.prototype.uploadThenDeleteLocalFile = function (filepath, originalFilename, extension, secure, callback) {
	var self = this;
	//Scan for viruses
	VirusScan.launchFileScan(filepath, function (err, msg) {
		if (err) {
			//An error occured (might be a virus)
			console.log(msg);
			fs.unlink(filepath);
			return callback(err);
		}
		//No virus detected
		FSService.readThenDeleteLocalFile(filepath, function (err, data) {
			if (err) {
				return callback(err);
			}
			self.writeFileToS3(new Buffer(data, 'binary').toString('base64'), originalFilename, extension, secure, function (err, filename) {
				if (err) {
					return callback(err);
				}

				callback(err, self.getConfig().s3StaticURL + "/" + (secure ? self.getConfig().s3SecuredBucketName : self.getConfig().s3BucketName) + "/" + filename);
			});
		});
	});
};

S3Service.prototype.getFileFromS3AndWriteItToFileSystem = function (filename, bucket, callback) {
	this.readFileFromS3(filename, bucket, function (err, data) {
		if (err) {
			return callback(err);
		}

		FSService.writeDataToFileSystem(filename, data.Body, function (err, filepath) {
			if (err) {
				return callback(err);
			}

			console.log("filepath", filepath);

			VirusScan.launchFileScan(filepath, function (err, msg) {
				if (err) {
					//An error occured (might be a virus)
					console.log(msg);
					// TODO delete file on S3
					fs.unlink(filepath);
					return callback(err);
				}

				callback(null, filepath);
			});
		});
	});
};

exports.getConfig = function () {
	// TODO for each attr in AWS
	return {
		region: config.AWS.region,
		accessKeyId: config.AWS.accessKeyId,
		secretAccessKey: config.AWS.secretAccessKey,
		s3StaticURL: config.AWS.s3StaticURL,
		s3BucketName: config.AWS.s3BucketName,
		s3SecuredBucketName: config.AWS.s3SecuredBucketName,
		sesFromEmail: config.AWS.sesFromEmail,
		sesSender: config.AWS.sesSender
	};
};

exports.getSecuredFilepath = function (filename, config) {
	var knox = require('knox');
	var s3Client = knox.createClient({
		key: config.accessKeyId,
		secret: config.secretAccessKey,
		bucket: config.s3SecuredBucketName
	});

	var expires = new Date();
	expires.setMinutes(expires.getMinutes() + 30);
	return s3Client.signedUrl(filename, expires);
};

exports.S3Service = S3Service;