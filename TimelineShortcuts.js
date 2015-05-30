(function(Timeline){
	"use strict";

	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}

	var toolKeys = {
		65	:	Timeline.CREATE, //a - Add
		83	:	Timeline.SELECT, //s - Select
		68	:	Timeline.DELETE, //d - Delete
		77	:	Timeline.MOVE,   //m - Move
		81	:	Timeline.SPLIT,  //q - Split
		79	:	Timeline.ORDER,  //o - Reorder
		70	:	Timeline.SHIFT,  //f - Time shift
		82	:	Timeline.REPEAT  //r - Set repeat tool
	};

	var toggleKeys = {
		69	:	'abRepeatEnabled', // e
		188	:	'autoCueRepeat', // , or <
		190	:	'automove', // . or >
		222	:	'trackSeeker' // ' or "
	};

	Timeline.bindKeys = function(timeline){
		document.addEventListener('keydown', function(e){
			var track, code = e.keyCode,
				inputFocused = ["TEXTAREA", "INPUT"]
					.indexOf(document.activeElement.nodeName) > -1;
			unmodified: if(!(inputFocused || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey)){
				if(toolKeys.hasOwnProperty(code)){ // Tool selection shortcuts
					timeline.currentTool = toolKeys[code];
				}else if(toggleKeys.hasOwnProperty(code)){ // Binary settings
					timeline[toggleKeys[code]] = !timeline[toggleKeys[code]];
				}else switch(e.keyCode){
				case 39: // right arrow - scroll right
					timeline.currentTime += timeline.view.zoom * 5;
					timeline.emit(new Timeline.Event('jump',{time:timeline.currentTime}));
					break;
				case 37: // left arrow - scroll left
					timeline.currentTime -= timeline.view.zoom * 5;
					timeline.emit(new Timeline.Event('jump',{time:timeline.currentTime}));
					break;
				case 38: // up arrow - zoom in
					timeline.view.startTime += (timeline.currentTime-timeline.view.startTime)/30;
					timeline.view.endTime += (timeline.currentTime-timeline.view.endTime)/30;
					timeline.render();
					break;
				case 40: // down arrow - zoom out
					timeline.view.startTime -= (timeline.currentTime-timeline.view.startTime)/30;
					timeline.view.endTime -= (timeline.currentTime-timeline.view.endTime)/30;
					timeline.render();
					break;
				case 46: // Del
					timeline.tracks.forEach(function(track){
						if(!track.locked){ track.deleteSelected(); }
					});
					break;
				case 220: // "\" or "|"
					timeline.breakPoint(); // Autocue breakpoint shortcut
					break;
				default:
					break unmodified;
				}
				e.preventDefault();
				return;
			}

			// Undo / Redo
			if(code === 89 && (e.ctrlKey || e.metaKey)){
				timeline.commandStack.redo();
			}else if(code === 90 && (e.ctrlKey || e.metaKey)){
				timeline.commandStack.undo();
			}else if(code > 47 && code < 58){
				// Track modes
				// map codes for number keys to range 0..9, where '1' is 0 and '0' is 9
				track = timeline.tracks[(code - 39)%10];
				if(track === void 0){ return; }
				if(e.altKey || e.metaKey){ track.autoFill = !track.autoFill; }
				else if(e.ctrlKey){ track.autoCue = !track.autoCue; }
				else if(e.shiftKey){ track.locked = !track.locked; }
				else{ return; }
			}else{ return; }
			e.preventDefault();
		},false);

		document.addEventListener('keydown', function(e){
			
		},false);
	};

}(Timeline));