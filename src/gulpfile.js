'use strict';

var gulp = require('gulp');
var browserSync = require('browser-sync');
var nodemon = require('gulp-nodemon');

gulp.task('default', ['browser-sync'], function () {
});

// https://medium.com/unchainedstudio/setting-up-nodemon-browsersync-and-gulp-to-work-together-d66ed6c6969a
gulp.task('browser-sync', ['nodemon'], function() {
	browserSync.init(null, {
		host: '127.0.0.1',		
		open: 'external',
		proxy: "http://127.0.0.1:3000",		
        files: ["views/**/*.*", "sass/**/*.*","public/**/*.*"],
        port: 7000,
        browser: "chrome"
	});
});


gulp.task('nodemon', function (cb) {
	var started = false;
	return nodemon({
		script: 'index.js'
	}).on('start', function () {
		// to avoid nodemon being started multiple times
		// thanks @matthisk
		if (!started) {
			cb();
			started = true; 
		} 
	});
});