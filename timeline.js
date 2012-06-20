var timelineGlobal = null;
/**
 * Timeline class
 * By: Joshua Monson
 * Date: October 2011
 *
 * The timeline class renders a Final Cut Pro-like timeline onto the browser window. It was designed with the purpose of creating and editing
 * subtitles but it can be used for other purposes too.
 **/
function Timeline() {
	/**
	 * Timeline Properties
	 *
	 * These properties control everything about the timeline. They are divied into four (4) major sections:
	 *  1. Functional - These deal with how it functions, the objects it contains, its size, etc.
	 *  2. Sizing - These deal with the sizes of the elements. Customization can start here.
	 *  3. Coloring - These deal with the colors of the timeline.
	 *  4. Images - These are the images used in rendering.
	 *
	 * Author: Joshua Monson
	 **/
	this.length = 30000; // In ms
	this.view = {
		width: 0,
		start: 0,
		length: 5000,
		getEnd: function() {
			return this.width + this.start;
		},
		zoom: 1 // (ms per pixel)
	};
	this.elements = new Array();
	this.trackIds = new Array();
	this.trackLangs = new Array();
        this.trackKaraoke = new Array();
	this.activeElement = null;
	this.selectedSegment = null;
	this.slider = null;
	this.sliderActive = false;
	this.toolbar = null;
	this.tracks = 0;
        this.kTracks = 0;
	this.segmentPlaceholder = null;
	this.tracker = null;
	this.timeMarkerPos = 0;
        this.direction = "ltr";
        this.repeatA = null;
        this.repeatB = null;
        this.abRepeatOn = false;
  
	// Sizing
	this.height = 200; // Will change
	// this.segmentTop = 50;
	this.segmentTrackHeight = 50;
	this.segmentFontSize = "20px";
	this.segmentFontPadding = 5;
	this.segmentTrackPadding = 10;
	this.sliderHeight = 25;
	this.sliderHandleWidth = 15;
	this.keyTop = 0;
	this.keyHeight = 25;
	this.toolbarHeight = 0;
	this.keyFontSize = "14px";

	// Coloring
	this.backgroundColor = "rgba(64, 66, 69, 1)";
        this.backgroundColorTop = "#3e3f43";
        this.backgroundColorBottom = "#292a2d";
	this.trackColor = "rgba(75, 75, 255, 0.1)";
	this.segmentColor = "rgba(98, 129, 194, 0.3)";//"#6281c2";
	this.secondarySegmentColor = "rgba(142, 148, 160, 0.3)";//"#6281c2";
	this.placeholderColor = "rgba(255, 255, 160, 0.5)";
	this.highlightedColor = "#134dc8";
	this.segmentTextColor = "#000";
	this.keyTextColor = "#fff";
	this.sliderColor = "#134dc8";
	this.sliderHandleColor = "#008";
	this.timeMarkerColor = "rgba(255, 255, 160, 0.5)";
        this.trackColorTop = "#292a2d";
        this.trackColorBottom = "#55585c";
        this.abRepeatColor = "rgba(255, 0, 0, 0.4)";
        this.abRepeatColorLight = "rgba(255, 0, 0, 0.25)";
	
	// Images
	this.segmentLeft = null;
	this.segmentLeftSrc = "./images/event_left.png";
	this.segmentRight = null;
	this.segmentRightSrc = "./images/event_right.png";
	this.segmentMid = null;
	this.segmentMidSrc = "./images/event_mid.png";
	this.segmentLeftSel = null;
	this.segmentLeftSelSrc = "./images/event_left_sel.png";
	this.segmentRightSel = null;
	this.segmentRightSelSrc = "./images/event_right_sel.png";
	this.segmentMidSel = null;
	this.segmentMidSelSrc = "./images/event_mid_sel.png";
	this.segmentLeftDark = null;
	this.segmentLeftDarkSrc = "./images/event_left_dark.png";
	this.segmentRightDark = null;
	this.segmentRightDarkSrc = "./images/event_right_dark.png";
	this.segmentMidDark = null;
	this.segmentMidDarkSrc = "./images/event_mid_dark.png";
	this.sliderLeft = null;
	this.sliderLeftSrc = "./images/slider_left.png";
	this.sliderRight = null;
	this.sliderRightSrc = "./images/slider_right.png";
	this.sliderMid = null;
	this.sliderMidSrc = "./images/slider_mid.png";
        this.trackBg = null;
        this.trackBgSrc = "./images/track_bg.png";
  
	// Canvas
	this.canvasContext = null;
        
	// Functions to be defined externally
	this.getTextCallback = function(text) {};
	this.unselectCallback = function() {};
	this.jump = function(time) {}
	this.abRepeatEnabled = function() {}
	this.update = function() {}
  
	/**
	 * Event Listeners and Callbacks
	 *
	 * These listeners include mouseMove, mouseUp, and mouseDown.
	 * They check the mouse location and active elements and call their mouse listener function.
	 *
	 * The callbacks are to be defined by the implementer in order to facilitate insertion.
	 * 
	 * Author: Joshua Monson
	 **/
	this.mouseMove = function(ev) {
		var canvasTop = $("#canvas").offset().top;
		// var pos = {x: ev.layerX, y: ev.layerY-canvasTop};
		var pos = {x: ev.pageX, y: ev.pageY-canvasTop};

                timelineGlobal.updateCursor(pos);

		if(timelineGlobal.sliderActive == true)
			timelineGlobal.slider.mouseMove(pos);

		if(timelineGlobal.activeElement != null)
			timelineGlobal.activeElement.mouseMove(pos);

		if(timelineGlobal.segmentPlaceholder != null)
			timelineGlobal.segmentPlaceholder.mouseMove(pos);

                if(buttonController.currentTool == 6 && timelineGlobal.repeatA != null && timelineGlobal.abRepeatOn == false)
                    timelineGlobal.updateB(pos);
                
	}
  
	this.mouseUp = function(ev) {
		var canvasTop = $("#canvas").offset().top;
		// var pos = {x: ev.layerX, y: ev.layerY - canvasTop};
		var pos = {x: ev.pageX, y: ev.pageY-canvasTop};
    
		if(timelineGlobal.sliderActive == true) {
			timelineGlobal.slider.mouseUp(pos);
			timelineGlobal.sliderActive = false;
			return;
		}
		
		if(timelineGlobal.activeElement != null) {
    	timelineGlobal.activeElement.mouseUp(pos);
			timelineGlobal.activeElement = null;
		}
    
		if(timelineGlobal.segmentPlaceholder != null) {
			timelineGlobal.segmentPlaceholder.mouseUp(pos);
			timelineGlobal.segmentPlaceholder = null;
		}
                
                // Are we create a repeat?
                if(buttonController.currentTool == 6 && timelineGlobal.abRepeatOn == false && timelineGlobal.repeatA != timelineGlobal.repeatB) {
                    timelineGlobal.setB(pos);
                    timelineGlobal.updateCursor(pos)
                }
	}
  
	this.mouseDown = function(ev) {
		var canvasTop = $("#canvas").offset().top;
		// var pos = {x: ev.layerX, y: ev.layerY - canvasTop};
		var pos = {x: ev.pageX, y: ev.pageY-canvasTop};
                var clickUsed = false;
    
		// Check all the elements
		for(var i in timelineGlobal.elements) {
			for(var j in timelineGlobal.elements[i]) {
				var element = timelineGlobal.elements[i][j];
				if(element.containsPoint(pos)) {
					timelineGlobal.activeElement = element;
					element.mouseDown(pos);
				}
			}
		}
    
		// Check the slider
		if(timelineGlobal.slider.containsPoint(pos)) {
			timelineGlobal.slider.mouseDown(pos);
			timelineGlobal.sliderActive = true;
                        clickUsed = true;
		}
		
		// Check the key
		if(pos.y < timelineGlobal.keyHeight) {
			var time = timeFunctions.pixelToTime(pos.x);
			timelineGlobal.jump(time);
                        clickUsed = true;
		}
    
		// Are we creating a segment?
		if(buttonController.currentTool == 3) {
			var track = timelineGlobal.getTrack(pos);
			if(track > -1) {
				timelineGlobal.createSegment(pos, track);
                                clickUsed = true;
                        }
		}
                
                // Are we create a repeat?
                if(buttonController.currentTool == 6 && clickUsed == false) {
                    if(timelineGlobal.abRepeatOn == true)
                        timelineGlobal.clearRepeat();
                    if(timelineGlobal.repeatA == null)
                        timelineGlobal.setA(pos);
                    else if(timelineGlobal.abRepeatOn == false)
                        timelineGlobal.setB(pos);
                    timelineGlobal.updateCursor(pos)
                }
	}
	this.updateCursor = function(pos) {
            if(pos == undefined)
                return;
            var cursor = "";
            // Check the slider
            if(timelineGlobal.slider.containsPoint({x: timelineGlobal.slider.x, y: pos.y})) {
                cursor = "url(\"./images/cursors/cursor.png\"), auto";
            }

            // Check the key
            if(pos.y < timelineGlobal.keyHeight) {
                cursor = "url(\"./images/cursors/skip.png\"), auto";
            }
            
            // Are we on a subtitle
            for(var i in timelineGlobal.elements) {
                for(var j in timelineGlobal.elements[i]) {
                    var element = timelineGlobal.elements[i][j];
                    if(element.containsPoint(pos) && !element.deleted) {
                        var shape = element.getShape();
                        if(buttonController.currentTool == 1) // Select
                            cursor = "url(\"./images/cursors/cursor-highlight.png\"), auto";
                        
                        if(buttonController.currentTool == 2) // Move
                            //cursor = "url(\"./images/cursors/move.png\"), auto";
                            cursor = "move";
                        
                        if(buttonController.currentTool == 3) // Move
                            cursor = "url(\"./images/cursors/cursor.png\"), auto";
                        
                        if(buttonController.currentTool == 4) // delete
                            //cursor = "url(\"./images/cursors/delete.png\"), auto";
                            cursor = "pointer";
                        
                        if(buttonController.currentTool == 5) { // Resize
                            if(pos.x < shape.x + shape.width/2)
                                //cursor = "url(\"./images/cursors/resize-left.png\"), auto";
                                cursor = "w-resize";
                            else
                                //cursor = "url(\"./images/cursors/resize-right.png\"), auto";
                                cursor = "e-resize";
                        }
                        
                        
                    }
                }
            }
            
            if(cursor == "" && buttonController.currentTool == 3) // add
                    cursor = "url(\"./images/cursors/add.png\"), auto";
            if(cursor == "" && buttonController.currentTool == 6) {
                if(this.repeatA != null && timelineGlobal.abRepeatOn == false)
                    cursor = "url(\"./images/cursors/repeat-b.png\"), auto";
                else
                    cursor = "url(\"./images/cursors/repeat-a.png\"), auto";
            }
            
            if(cursor == "")
                cursor = "url(\"./images/cursors/cursor.png\"), auto";
            
            $("#canvas").css("cursor", cursor);
        }
        
	/**
	 * Helper Functions
	 * 
	 * These functions deal with maniuplating the data
	 * 
	 * Author: Joshua Monson
	 **/
	this.getCurrentSegments = function(track, time) {
		var orderedSegments = this.getOrderedElements(track);
		var currentSegs = new Array();
		for(var i in orderedSegments) {
			var s = orderedSegments[i];
			if(s.startTime <= time && s.endTime >= time)
				currentSegs.push(i);
		}
		return currentSegs;
	}
	
	this.setText = function(text) {
		if(this.selectedSegment != null) {
			// Save the event
			var e = new TimelineEvent("update");
			e.attributes.id = this.selectedSegment.id;
			e.attributes.track = this.selectedSegment.track;
			e.attributes.initialText = this.selectedSegment.text;
			e.attributes.finalText = text;
			timelineGlobal.tracker.addEvent(e);
		
			this.selectedSegment.text = text;
			this.render();
			
			this.update();
		}
	}
	
	/**
	 * Returns the elements ordered by startTime
	**/
	this.getOrderedElements = function(track) {
		var elements = this.elements[track].slice(0);
		elements.sort(this.compareByStartTime);
		return elements;
	}
	this.compareByStartTime = function(a, b) {
		return a.startTime - b.startTime;
	}
	
  
  // Helper functions
	this.getTrackTop = function(track) {
		return this.keyHeight + this.segmentTrackPadding + (track * (this.segmentTrackHeight + this.segmentTrackPadding));
	}
  
	this.getTrack = function(pos) {
		for(var i=0; i < this.tracks; i++) {
			var top = this.getTrackTop(i);
			var bottom = top + this.segmentTrackHeight;
			if(pos.y >= top & pos.y <= bottom)
				return i;
		}
		return -1;
	}
  
  // Creation functions
	this.createSegment = function(pos, track) {
		// TODO: Don't create if the track is locked/disabled

		var seg = new SegmentPlaceholder();
		seg.track = track;
		seg.startX = pos.x;
		seg.elementTrack = this.elements.length;
		this.segmentPlaceholder = seg;

		// Add the placeholder to the render elements
		this.elements.push(new Array(this.segmentPlaceholder));
	}
	
	// Initiatory functions
	this.init = function(context, length) {
		// Load the images
		this.loadImages();
		
		timelineGlobal = this;
		this.length = length;
        this.view.length = Math.round(this.length * 0.02);
        this.direction = $("#canvas").css("direction");

		this.canvasContext = context;
		this.canvasContext.canvas.addEventListener('mousemove', this.mouseMove, false);
		this.canvasContext.canvas.addEventListener('mouseup', this.mouseUp, false);
		this.canvasContext.canvas.addEventListener('mousedown', this.mouseDown, false);

		// resize to fit the window
		this.view.width = window.innerWidth;
		this.canvasContext.canvas.width = this.view.width;
		this.canvasContext.canvas.height = this.height;

		this.view.zoom = timeFunctions.computeZoom(this.view.length, this.view.width);
		this.slider = new Slider();

		this.slider.init();
		
		this.tracker = new TimelineTracker();
		
		$(window).resize(this.windowResize);
	}
	
	this.loadImages = function() {
		// Load the normal images
		this.segmentLeft = new Image();
		this.segmentLeft.src = this.segmentLeftSrc;
		this.segmentRight = new Image();
		this.segmentRight.src = this.segmentRightSrc;
		this.segmentMid = new Image();
		this.segmentMid.src = this.segmentMidSrc;
		
		// Load the selected images
		this.segmentLeftSel = new Image();
		this.segmentLeftSel.src = this.segmentLeftSelSrc;
		this.segmentRightSel = new Image();
		this.segmentRightSel.src = this.segmentRightSelSrc;
		this.segmentMidSel = new Image();
		this.segmentMidSel.src = this.segmentMidSelSrc;
		
		// Load the dark images
		this.segmentLeftDark = new Image();
		this.segmentLeftDark.src = this.segmentLeftDarkSrc;
		this.segmentRightDark = new Image();
		this.segmentRightDark.src = this.segmentRightDarkSrc;
		this.segmentMidDark = new Image();
		this.segmentMidDark.src = this.segmentMidDarkSrc;
		
		// Load the slider images
		this.sliderLeft = new Image();
		this.sliderLeft.src = this.sliderLeftSrc;
		this.sliderRight = new Image();
		this.sliderRight.src = this.sliderRightSrc;
		this.sliderMid = new Image();
		this.sliderMid.src = this.sliderMidSrc;
                
                // Load the track
                this.trackBg = new Image();
                this.trackBg.src = this.trackBgSrc;
	}
	
	this.windowResize = function() {
		// Adjust the width
		timelineGlobal.view.width = window.innerWidth;
		timelineGlobal.canvasContext.canvas.width = window.innerWidth;
		
		// Adjust the view slider
		timelineGlobal.slider.updateLength();

		// Re-render the timeline
		timelineGlobal.render();		
	}
  
	this.addSegmentTrack = function(segments, id, language, karaoke) {
		this.elements.push(segments);
		this.trackIds.push(id);
		this.trackLangs.push(language);
		this.tracks++;

		// Adjust the height
		this.height = this.keyHeight + (this.tracks * (this.segmentTrackHeight + this.segmentTrackPadding)) + this.segmentTrackPadding + this.sliderHeight;
		this.canvasContext.canvas.height = this.height;
                
                if(karaoke == true) {
                    this.trackKaraoke.push(true);
                    this.kTracks++;
//                    alert(this.kTracks);
                } else
                    this.trackKaraoke.push(false);
	}
        this.removeSegmentTrack = function() {
		this.tracks--;
                this.elements.splice(this.tracks, 1);
		this.trackIds.pop();
		this.trackLangs.pop();
		
		// Adjust the height
		this.height = this.keyHeight + (this.tracks * (this.segmentTrackHeight + this.segmentTrackPadding)) + this.segmentTrackPadding + this.sliderHeight;
		this.canvasContext.canvas.height = this.height;
	}
	
	// Drawing functions
	this.renderKey = function() {
		this.canvasContext.font         = 'italic '+this.keyFontSize+' sans-serif';
		this.canvasContext.textBaseline = 'top';
		this.canvasContext.fillStyle    = this.keyTextColor;
		this.canvasContext.strokeStyle    = this.keyTextColor;

		// Adjust the time increment so we don't get numbers on top of numbers
		var increment = 1000;
		while(timeFunctions.timeToPixel(increment) - timeFunctions.timeToPixel(0) < 60)
			increment *= 2;
		
		for (var i=0; i < this.length; i += increment) {
			var second = i / 1000;
			var position = timeFunctions.timeToPixel(i);

			if(position >= this.view.start && position <= this.view.getEnd()) {
				// Draw the tick
				this.canvasContext.beginPath();
				this.canvasContext.moveTo(position, this.keyTop);
				this.canvasContext.lineTo(position, this.keyTop + this.keyHeight);
				this.canvasContext.stroke();

				// Now put the number on
				var hours = Math.floor(second / 3600);
				var mins = Math.floor(second / 60) - (60 * hours);
				second -= (60 * mins) + (3600 * hours);
				if(mins < 10)
					mins = "0" + mins;
				if(second < 10)
					second = "0" + second;
				var time = hours + ":" + mins + ":" + second;
                                if(this.direction == "ltr")
                                    this.canvasContext.fillText(time, position + 2, this.keyTop + 2);
                                else
                                    this.canvasContext.fillText(time, position - 2, this.keyTop + 2);
			}
		}
	}
  	
	this.renderBackground = function() {
		// Erase everything
		this.canvasContext.clearRect(0, 0, this.view.width, this.height);

		// Draw the backround color
                var grd = this.canvasContext.createLinearGradient(0,0,0,this.height);
                grd.addColorStop(0,this.backgroundColorBottom);
                grd.addColorStop(0.5,this.backgroundColorTop);
                grd.addColorStop(1,this.backgroundColorBottom);
                this.canvasContext.fillStyle = grd;
		this.canvasContext.fillRect(0, 0, this.view.width, this.height);

		// Draw the tracks
		//this.canvasContext.fillStyle = this.trackColor;
//                var grd = this.canvasContext.createLinearGradient(0,0,0,this.segmentTrackHeight);
//                grd.addColorStop(0,this.trackColorTop);
//                grd.addColorStop(1,this.trackColorBottom);
//                this.canvasContext.fillStyle = grd;
		
		for(var i = 0; i < this.tracks; i++) {
			// var trackTop = this.keyHeight + this.segmentTrackPadding + (i * (this.segmentTrackHeight + this.segmentTrackPadding));
			var trackTop = this.getTrackTop(i);
                        
//			this.canvasContext.fillRect(0, trackTop, this.view.width, this.segmentTrackHeight);
                        this.canvasContext.drawImage(this.trackBg, 0, trackTop, this.view.width, this.segmentTrackHeight);
		}
	}
	
	this.renderTimeMarker = function() {
		var markerX = timeFunctions.timeToPixel(this.timeMarkerPos);
		this.canvasContext.fillStyle = this.timeMarkerColor;
                var height = this.height - this.sliderHeight - this.kTracks * (this.segmentTrackHeight + this.segmentTrackPadding);
		this.canvasContext.fillRect(markerX, 0, 2, height);
	}
        
        this.renderABRepeat = function() {
            if(this.repeatA != null) {
                var left = timeFunctions.timeToPixel(this.repeatA);
                var right = timeFunctions.timeToPixel(this.repeatB);
                if(this.abRepeatOn == true)
                    this.canvasContext.fillStyle = this.abRepeatColor;
                else
                    this.canvasContext.fillStyle = this.abRepeatColorLight;
                this.canvasContext.fillRect(left, 0, right-left, this.height - this.sliderHeight);
            }
        }
    
	this.render = function() {
		this.renderBackground();

		// For each element list
                var sx = this.slider.x;
                var sw = this.slider.width;
                var z = this.view.zoom;
		for(var i in this.elements) {
                    // Make some adjustments before rendering if the track is a karaoke one
                    
                    this.slider.x = sx;
                    this.slider.width = sw;
                    this.view.zoom = z;
            
                    if(this.trackKaraoke[i]) {
                        if(this.selectedSegment == null || this.trackKaraoke[this.selectedSegment.track])
                            continue;
                        else {
            
                            //alert(this.trackKaraoke[this.selectedSegment.track]);
                            //alert("Rendering a karaoke tag: " + this.selectedSegment.text);

                            var start = this.selectedSegment.startTime/this.length;
                            var end = this.selectedSegment.endTime/this.length;
                            
                            start = Math.round(this.view.width * start);
                            end = Math.round(this.view.width * end) - start;
                            
                            this.slider.x = start - 0.5;
                            this.slider.width = end;
                            this.view.zoom = timeFunctions.computeZoom(this.selectedSegment.endTime - this.selectedSegment.startTime, this.view.width - this.slider.width);

                        }
                    }
                    // Draw the elements
                    for(var j in this.elements[i]) {
                        var element = this.elements[i][j];
                        element.render();
                    }
		}
                
                this.slider.x = sx;
                this.slider.width = sw;
                this.view.zoom = z;

		// Draw the slider
		this.slider.render();

		// Draw the key
		this.renderKey();
		
		// Draw the time marker
		this.renderTimeMarker();
                
                // Draw the AB repeat markers
                this.renderABRepeat();
	}
	
	this.updateTimeMarker = function(time) {
		this.timeMarkerPos = time;
                
                // Check the repeat
                if(this.abRepeatOn == true && time > this.repeatB) {
                    this.jump(this.repeatA);
                }

        /*if(this.timeMarkerPos > timeFunctions.pixelToTime(this.view.width))
            this.moveTimeMarkerIntoView(time);
        else*/
		    this.render();
	}
        
        this.setA = function(pos) {
            this.repeatA = timeFunctions.pixelToTime(pos.x);
            this.repeatB = timeFunctions.pixelToTime(pos.x);
        }
        
        this.setB = function(pos) {
            this.repeatB = timeFunctions.pixelToTime(pos.x);
            if(this.repeatB < this.repeatA) {
                var t = this.repeatB;
                this.repeatB = this.repeatA;
                this.repeatA = t;
            }
            this.abRepeatOn = true;
            this.render();
            this.abRepeatEnabled();
        }
        
        this.updateB = function(pos) {
            this.repeatB = timeFunctions.pixelToTime(pos.x);
            this.render();
        }
        
        this.clearRepeat = function() {
            this.repeatA = null;
            this.repeatB = null;
            this.abRepeatOn = false;
            this.render();
        }
        
        this.moveTimeMarkerIntoView = function(time) {
            var leftTime = timeFunctions.pixelToTime(0);
            var rightTime = timeFunctions.pixelToTime(this.view.width);
            
            if(time < leftTime || time > rightTime) {
                // Move the view
                var p = time/this.length;
                var w = Math.round((this.view.width - this.slider.width)*p);
                //alert(w);
                this.slider.x = w;
                this.render();
            }
        }
}