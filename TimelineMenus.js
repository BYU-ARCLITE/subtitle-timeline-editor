(function(Timeline,global){
	"use strict";
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	Timeline.Menu = [
		{label:"Track",
			condition:function(){return !!this.track; },
			vars: {
				numSelected: function(pos,vars){
					var track = this.track;
					return this.timeline.selectedSegments.reduce(function(c,seg){ return seg.track == track?c+1:c; },0);
				}
			},
			submenu:[
				{label:"Merge Selected",
					condition:function(pos,vars){ return !this.track.locked && vars.numSelected > 1 },
					action:function(){ this.track.mergeSelected(); }},
				{label:"Copy Selected",
					condition:function(pos,vars){ return !this.track.locked && vars.numSelected > 0 },
					action:function(){ this.track.copySelected(); }},
				{label:"Delete Selected",
					condition:function(pos,vars){ return !this.track.locked && vars.numSelected > 0 },
					action:function(){ this.track.deleteSelected(); }},
				{label:"Paste",
					condition:function(){
						var copy = this.timeline.toCopy,
							track = this.track;
						return !track.locked && copy.length && copy[0].track !== track;
					},
					action:function(){ this.track.paste(this.timeline.toCopy); }},
				{label:"Lock",
					condition:function(){ return !this.track.locked; },
					action:function(){ this.track.locked = true; }},
				{label:"Unlock",
					condition:function(){ return this.track.locked; },
					action:function(){ this.track.locked = false; }},
				{label:"Remove",
					action:function(){
						var track = this.track;
						if(!confirm("Are You Sure You Want To Remove "+track.id+"?")){ return; }
						this.timeline.removeTextTrack(track.id);
					}},
				{label:"Set Audio",
					condition: function(){ return global.Reader && global.WaveForm && global.Resampler && !this.track.locked; },
					submenu: {
						forEach: function(f,that){
							[{label: "From Disk",
								action: function(){
									var tl = this.timeline,
										track = this.track,
										f = document.createElement('input');
									f.type = "file";
									f.addEventListener('change',function(evt){
										tl.loadAudioTrack(evt.target.files[0],file.name);
										tl.setAudioTrack(track.id,file.name);
									});
									f.click();	
								}
							},{label: "From URL",
								action: function(){
									var tl = this.timeline, name,
										url = prompt("URL of Audio File:","http://");
									if(!url){ return; }
									name = /([^\/]+)\/?$/g.exec(url)[1];
									tl.loadAudioTrack(url,name);
									tl.setAudioTrack(this.track.id,name);
								}
							},{label: "None",
								condition: function(){ return !!this.track.audioId; },
								action: function(){ this.timeline.unsetAudioTrack(this.track.id); }
							}].forEach(f,that);
							Object.keys(that.timeline.audio).forEach(function(key){
								f.call(that,(that.track.audioId === key?
									{label: "<i>"+key+"</i>"}:
									{label: key,
										action: function(){ this.timeline.setAudioTrack(this.track.id,key); }}));
							});
						}
					}},
				{label:"Convert File Type",
					condition: function(){ return !this.track.locked; },
					submenu: {
						forEach: function(f,that){
							TimedText.getRegisteredTypes().forEach(function(mime){
								f.call(that,(that.track.mime === mime?
									{label: "<i>"+TimedText.getTypeName(mime)+"</i>"}:
									{	label: TimedText.getTypeName(mime),
										action: function(){
											if(confirm("Converting File Types May Cause Loss of Formatting.\nAre you sure you want to continue?")){
												this.track.mime = mime;
											}
										}
									}
								));
							});
						}
					}}
			]
		},
		{label:"Segment",
			condition: function(){return !!this.segment; },
			submenu:[
				{label:"Select",
					condition:function(){ return !this.segment.selected; },
					action:function(){ this.segment.select(); }},
				{label:"Unselect",
					condition:function(){ return this.segment.selected; },
					action:function(){ this.segment.unselect(); }},
				{label:"Split", action:function(pos){ this.segment.split(pos); }},
				{label:"Merge With Selected",
					condition:function(){
						var track = this.track;
						return	!track.locked &&
								!this.segment.selected &&
								this.timeline.selectedSegments.some(function(seg){ return seg.track === track; });
					},
					action:function(){ this.segment.mergeWithSelected(); }},
				{label:"Copy", action:function(){ this.segment.copy(); }},
				{label:"Delete", action:function(){ this.segment.del(); }},
				{label:"Match Repeat",
					condition:function(pos){ return this.timeline.abRepeatSet; },
					action:function(pos){
						var tl = this.timeline;
						this.segment.move(tl.repeatA,tl.repeatB);
					}},
				{label:"Set Repeat",
					action:function(pos){
						var seg = this.segment;
						this.timeline.setRepeat(seg.startTime,seg.endTime);
					}}
			]
		},
		{label:"Editing",submenu:[
			{label:"Undo",
				condition:function(){return this.timeline.cstack.undoDepth > 0; },
				action:function(){ this.timeline.cstack.undo(); }},
			{label:"Redo",
				condition:function(){return this.timeline.cstack.redoDepth > 0; },
				action:function(){ this.timeline.cstack.redo(); }},
			{label:"Tools",submenu:[
				{label:"Select",action:function(){ this.timeline.currentTool = Timeline.SELECT; }},
				{label:"Move",action:function(){ this.timeline.currentTool = Timeline.MOVE; }},
				{label:"Add",action:function(){ this.timeline.currentTool = Timeline.CREATE; }},
				{label:"Split",action:function(){ this.timeline.currentTool = Timeline.SPLIT; }},
				{label:"Delete",action:function(){ this.timeline.currentTool = Timeline.DELETE; }},
				{label:"Shift",action:function(){ this.timeline.currentTool = Timeline.SHIFT; }},
				{label:"Copy",action:function(){ this.timeline.currentTool = Timeline.COPY; }}
			]}
		]},
		{label:"Navigation",submenu:[
			{label:"Repeat Tool",action:function(){ this.timeline.currentTool = Timeline.REPEAT; }},
			{label:"Scroll Tool",action:function(){ this.timeline.currentTool = Timeline.ORDER; }},
			{label:"Order Tool",action:function(){ this.timeline.currentTool = Timeline.ORDER; }},
			{label:"Zoom In",
				condition:function(){ return this.timeline.view.zoom > .0011; },
				action:function(pos){
					var view = this.timeline.view;
					view.startTime += (view.pixelToTime(pos.x)-view.startTime)/2;
					view.endTime += (view.pixelToTime(pos.x)-view.endTime)/2;
					this.timeline.render();
				}},
			{label:"Zoom Out",
				condition:function(){ return this.timeline.view.length < this.timeline.length; },
				action:function(pos){
					var view = this.timeline.view;
					view.startTime -= (view.pixelToTime(pos.x)-view.startTime)/2;
					view.endTime -= (view.pixelToTime(pos.x)-view.endTime)/2;
					this.timeline.render();
				}}
		]},
		{label:"AB Repeat",submenu:[
			{label:"Enable",
				condition:function(){return this.timeline.abRepeatSet && !this.timeline.abRepeatOn; },
				action:function(){ this.timeline.abRepeatOn = true; }},
			{label:"Disable",
				condition:function(){return this.timeline.abRepeatOn; },
				action:function(){ this.timeline.abRepeatOn = false; }},
			{label:"Clear",
				condition:function(){return this.timeline.abRepeatSet; },
				action:function(){ this.timeline.clearRepeat(); }},
			{label:"Set Repeat Point",action:function(pos){
				(this.timeline.abRepeatSet?updateABPoints:resetABPoints).call(this.timeline,pos);
			}}
		]}
	];
	
}(Timeline,window));