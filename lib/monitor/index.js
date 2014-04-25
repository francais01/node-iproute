var events = require('events');
var spawn = require('child_process').spawn;

var monitor = new events.EventEmitter();
var mon;

/*
 * Load supported parse functions.
 */
var parse_links = require('../link/utils').parse_links;

// Supported parsing of monitored objects.
exports.objects = {
	LINK: 'LINK'
};

/**
 * Start the monitor on the specified objects or all of them.
 *
 */
module.exports.start = function () {
	/*
	 * Process options.
	 */
	mon = spawn('ip', ['monitor', 'all']);

	mon.stdout.setEncoding('utf8');
	mon.stdout.on('data', function (data) {
		var output = data.split('\n');

		for (var line = 0, output_length = output.length - 1;
		     line < output_length;
		     line++) {

			// Check if it is an object head line by cheking for [XXX] tag.
			// Sometimes "ip monitor all" lists multiple IDs ([ROUTE][LINK]2: eth0...)
			// Pattern makes sure we get the last ID and saves object ID and data lines.
			var pattern = /\[([A-Z]+)\](?!\[)(.*)/;
			var matches = pattern.exec(output[line]);
			if (matches) {
				var object_id = matches[1];
				var object_data_lines = [ matches[2] ];

				// Check for more data spanned below.
				for (var line2 = line + 1;
				     line2 < output_length;
				     line2++) {

					// Check if is an object head line by cheking for [XXX] tag.
					if (output[line2].search(/\[[A-Z]+\]/) != -1) {
						break; // End the for since we already matched a different object.
					}
					else {
						// This line is related to current object so push it.
						object_data_lines.push(output[line2]);
					}
				}

				var data_to_emit = {};

				if (object_id == exports.objects.LINK) {
					try {
						data_to_emit = {
							object: 'link',
							data  : parse_links(object_data_lines.join('\n'))
						};

						monitor.emit('link', data_to_emit);
						monitor.emit('all', data_to_emit);
					}
					catch (error) {
						monitor.emit('error', new Error('Error parsing link output.'));

						return;
					}
				}
			}
		}
	});

	mon.stderr.setEncoding('utf8');
	mon.stderr.on('data', function (data) {
		monitor.emit('error', data);
	});

	/*
	 * And the last step and the most important, return the real event emitter.
	 */
	return monitor;
};

module.exports.stop = function () {
	mon.kill();
};
