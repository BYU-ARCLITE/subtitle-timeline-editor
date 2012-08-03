Setup
=====

1.  Create a target element on the page  
	`<div id="timeline"></div>`  
	`var target = document.getElementById("timeline");`

2.  Create a timeline  
	`var timeline = new Timeline(target, {});`  
    The arguments are
    *   A DOM node into which to insert the timeline.
    *   A map of optional parameters, including:
        *   width: the width of the timeline display in pixels (defaults
            to the offsetWidth of the target).
        *   length: the length of the timeline in seconds.
        *   start: the initial starting time of the viewing window.
        *   end: the initial ending time of the viewing window.

    
3.  Create the cues and add them to the timeline  
	`timeline.addTextTrack(TimedText.WebVTT.parse(vttdata), "track-id", "en");`  
    The arguments are
    *   An array of Cue objects or a TextTrack object
    *   A track name
    *   Language
    
4.  Add event handlers
	
		// addtrack is fired whenever a text track is added to the timeline
		// and passes the added track object to the listener
		timeline.on('addtrack',function(track) {});

		// removetrack is fired whenever a text track is removed from the
		// timeline and passes the removed track object to the listener
		timeline.on('removetrack',function(track) {});

		// select is fired whenever a segment is selected and passes the
		// segment object (which includes the backing cue object) to the listener
		timeline.on('select',function(seg) {
			var cue = seg.cue;
			....
		});

		// unselect is fired when the selection is terminated
		timeline.on('unselect',function(seg) {});

		// jump is fired whenever the timeline alters its current time internally;  
		// e.g., when a repeat point is hit or when the time marker is moved manually.
		timeline.on('jump', function(time) {
			controls.currentTime = time/1000;
		});

		// timeupdate is fired whenever the timeline's time marker is moved;  
		// e.g., when timeline.currentTime is set by external code
		timeline.on('timeupdate', function(time) {});

		// abRepeatEnabled is fired whenever the AB repeat functionality is turned on
		timeline.on('abRepeatEnabled',function() {});

		// update is fired whenever the contents of a segment change
		timeline.on('update', function(seg) {});