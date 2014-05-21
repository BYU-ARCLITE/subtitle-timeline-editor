(function(Timeline,global){
	"use strict";
	
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	Timeline.Menu = [
		{name: "Editor",
			submenu:[
				{name:"Undo",
					condition:function(){return this.timeline.commandStack.undoDepth > 0; },
					action:function(){ this.timeline.commandStack.undo(); }},
				{name:"Redo",
					condition:function(){return this.timeline.commandStack.redoDepth > 0; },
					action:function(){ this.timeline.commandStack.redo(); }},
				{name:"Anchor View",
					label:function(){ return this.timeline.trackSeeker?"Ignore Seeker":"Anchor View to Seeker"; },
					action:function(){ this.timeline.trackSeeker = !this.timeline.trackSeeker; }},
				{name:"Tools",submenu:[
					{name:"Select",action:function(){ this.timeline.currentTool = Timeline.SELECT; }},
					{name:"Move",action:function(){ this.timeline.currentTool = Timeline.MOVE; }},
					{name:"Add",action:function(){ this.timeline.currentTool = Timeline.CREATE; }},
					{name:"Split",action:function(){ this.timeline.currentTool = Timeline.SPLIT; }},
					{name:"Delete",action:function(){ this.timeline.currentTool = Timeline.DELETE; }},
					{name:"Shift",action:function(){ this.timeline.currentTool = Timeline.SHIFT; }},
					{name:"Copy",action:function(){ this.timeline.currentTool = Timeline.COPY; }},
					{name:"Set Repeat",action:function(){ this.timeline.currentTool = Timeline.REPEAT; }}
				]},
				{name:"New Track",
					condition:function(){return !!this.timeline.canGetFor('newtrack',[]); },
					action:function(){
						var tl = this.timeline;
						tl.getFor('newtrack',
							['kind','name','lang','mime','overwrite'],
							{
								kind: 'subtitles',
								name: 'untitled',
								lang: 'zxx',
								mime: 'text/vtt',
								overwrite: false
							}
						).then(function(values){
							var track = new TextTrack(values[0], values[1], values[2]); //kind, name, lang
							tl.addTextTrack(track, values[3], values[4]);
							tl.commandStack.setFileUnsaved(name);
						});
					}
				},
				{name:"Load Track",
					condition:function(){return !!this.timeline.canGetFor('loadtrack',['tracksrc']); },
					action:function(){
						var tl = this.timeline;
						tl.getFor('loadtrack',
							['tracksrc','kind','lang','name','overwrite','handler'],
							{
								handler: function(){},
								kind: void 0,
								lang: void 0,
								name: void 0,
								overwrite: false
							}
						).then(function(values){
							values[5](tl.loadTextTrack.apply(tl,values));
						});
					}
				}
			]},
		{name:"Track",
			condition:function(){return !!this.track; },
			vars: {
				numSelected: function(pos,vars){
					var track = this.track;
					return this.timeline.selectedSegments.reduce(function(c,seg){ return seg.track == track?c+1:c; },0);
				}
			},
			submenu:[
				{name:"Lock",
					label:function(){ return this.track.locked?"Unlock":"Lock"; },
					action:function(){ this.track.locked = !this.track.locked; }},
				{name:"Auto Settings",
					submenu:[
						{name:"Auto Cue",
							label:function(){ return this.track.autoCue?"Stop AutoCue":"Start AutoCue"; },
							condition:function(){ return !this.track.locked; },
							action:function(pos){ this.track.autoCue = !this.track.autoCue; }},
						{name:"Auto Fill",
							label:function(){ return this.track.autoFill?"Stop AutoFill":"Start AutoFill"; },
							condition:function(){ return !this.track.locked && this.track.linebuffer.length; },
							action:function(pos){ this.track.autoFill = !this.track.autoFill; }},
						{name:"Clear Buffer",
							condition:function(){ return !this.track.locked && this.track.linebuffer.length; },
							action:function(pos){ this.track.linebuffer = []; }},
						{name:"Add to Line Buffer",
							condition:function(){ return !this.track.locked && !!this.timeline.canGetFor('loadlines',['linesrc']); },
							action:function(pos){
								var tl = this.timeline,
									tid = this.track.id;
								tl.getFor('loadlines',['linesrc'],{}).then(function(values){
									tl.loadLineBuffer(tid,values[0]);
								});
							}}
					]},
				{name:"Audio Settings",
					condition: function(){
						return global.Reader && global.WaveForm && global.Resampler && !this.track.locked
							&& (Object.keys(this.timeline.audio).length || this.timeline.canGetFor('loadaudio',['audiosrc','name']));
					},
					submenu:[
						{name: "Load New Audio",
							condition: function(){ return !!this.timeline.canGetFor('loadaudio',['audiosrc','name']); },
							action: function(){
								var tl = this.timeline,
									track = this.track;
								tl.getFor('loadaudio',
									['audiosrc','name'],
									{name: void 0}
								).then(function(values){
									var name = values[1];
									tl.loadAudioTrack(values[0],name);
									tl.setAudioTrack(track.id,name);
								});
							}
						},{name: "Clear Audio",
							condition: function(){ return !!this.track.audioId; },
							action: function(){ this.timeline.unsetAudioTrack(this.track.id); }
						}
					],
					calc: function(f){
						Object.keys(this.timeline.audio).forEach(function(key){
							f(this.track.audioId === key?
								{name: "<i>"+key+"</i>"}:
								{name: key,
									action: function(){ this.timeline.setAudioTrack(this.track.id,key); }});
						},this);
					}},
				{name:"Paste",
					condition:function(){
						var copy = this.timeline.toCopy,
							track = this.track;
						return !track.locked && copy.length && copy[0].track !== track;
					},
					action:function(){ this.track.paste(this.timeline.toCopy); }},
				{name:"Copy Selected",
					condition:function(pos,vars){ return !this.track.locked && vars.numSelected > 0; },
					action:function(){ this.track.copySelected(); }},
				{name:"Merge Selected",
					condition:function(pos,vars){ return !this.track.locked && vars.numSelected > 1; },
					action:function(){ this.track.mergeSelected(); }},
				{name:"Delete Selected",
					condition:function(pos,vars){ return !this.track.locked && vars.numSelected > 0; },
					action:function(){ this.track.deleteSelected(); }},
				{name:"Clone",
					condition:function(){return !!this.timeline.canGetFor('newtrack',['name']); },
					submenu:[
						{name:"Clone Track",
							action:function(){
								var tl = this.timeline,
									tid = this.track.id;
								tl.getFor('newtrack',
									['kind','lang','name','mime','overwrite'],
									{
										kind: void 0,
										lang: void 0,
										mime: void 0,
										overwrite: false
									}
								).then(function(values){
									tl.cloneTrack(tid, values[0], values[1], values[2], values[3], values[4]);
								});
							}},
						{name:"Clone Timecodes",
							action:function(){
								var tl = this.timeline,
									tid = this.track.id;
								tl.getFor('newtrack',
									['kind','lang','name','mime','overwrite'],
									{
										kind: void 0,
										lang: void 0,
										mime: void 0,
										overwrite: false
									}
								).then(function(values){
									tl.cloneTimeCodes(tid, values[0], values[1], values[2], values[3], values[4]);
								});
							}}
					]},
				{name:"Convert Type",
					condition: function(){ return !this.track.locked && TimedText.getRegisteredTypes().length > 1; },
					calc: function(f){
						TimedText.getRegisteredTypes().forEach(function(mime){
							var track = this.track; 
							f(track.mime === mime?
								{name: "<i>"+TimedText.getTypeName(mime)+"</i>"}:
								{name: TimedText.getTypeName(mime),
									action: function(){
										this.timeline.confirm("Converting File Types May Cause Loss of Formatting.\nAre you sure you want to continue?")
										.then(function(b){ if(b){ track.mime = mime; } });
									}
								}
							);
						},this);
					}},
				{name:"Remove",
					condition:function(){ return !this.track.locked; },
					action:function(){
						var track = this.track;
						this.timeline.confirm(
							this.timeline.commandStack.isFileSaved(track.id)
							?"Are You Sure You Want To Remove "+track.id+"?"
							:track.id+" has unsaved changes. Are you sure you want to remove it?")
						.then(function(b){
							if(b){ this.timeline.removeTextTrack(track.id); }
						});
					}}
			]
		},
		{name:"Segment",
			condition: function(){return !!this.segment; },
			submenu:[
				{name:"Select",
					label:function(){ return this.segment.selected?"Unselect":"Select"; },
					action:function(){ this.segment.toggle(); }},
				{name:"Split", action:function(pos){ this.segment.split(pos); }},
				{name:"Merge With Selected",
					condition:function(){
						var track = this.track;
						return	!track.locked &&
								!this.segment.selected &&
								this.timeline.selectedSegments.some(function(seg){ return seg.track === track; });
					},
					action:function(){ this.segment.mergeWithSelected(); }},
				{name:"Copy", action:function(){ this.segment.copy(); }},
				{name:"Delete", action:function(){ this.segment.del(); }},
				{name:"Match Repeat",
					condition:function(pos){ return this.timeline.abRepeatSet; },
					action:function(pos){
						var tl = this.timeline;
						this.segment.move(tl.repeatA,tl.repeatB);
					}},
				{name:"Set Repeat",
					action:function(pos){
						var seg = this.segment;
						this.timeline.setRepeat(seg.startTime,seg.endTime);
					}}
			]
		},
		{name:"Navigation",submenu:[
			{name:"Order Tool",action:function(){ this.timeline.currentTool = Timeline.ORDER; }},
			{name:"Zoom To Repeat",
				condition:function(){ return this.timeline.abRepeatSet; },
				action:function(pos){
					var tl = this.timeline,
						view = tl.view;
					view.startTime = tl.repeatA;
					view.endTime = tl.repeatB;
					this.timeline.render();
				}},
			{name:"Zoom In",
				condition:function(){ return this.timeline.view.zoom > 0.0011; },
				action:function(pos){
					var view = this.timeline.view;
					view.startTime += (view.pixelToTime(pos.x)-view.startTime)/2;
					view.endTime += (view.pixelToTime(pos.x)-view.endTime)/2;
					this.timeline.render();
				}},
			{name:"Zoom Out",
				condition:function(){ return this.timeline.view.length < this.timeline.length; },
				action:function(pos){
					var view = this.timeline.view;
					view.startTime -= (view.pixelToTime(pos.x)-view.startTime)/2;
					view.endTime -= (view.pixelToTime(pos.x)-view.endTime)/2;
					this.timeline.render();
				}}
		]},
		{name:"AB Repeat",submenu:[
			{name:"Repeat Tool",action:function(){ this.timeline.currentTool = Timeline.REPEAT; }},
			{name:"Enable",
				label:function(){ return this.timeline.abRepeatOn?"Disable AB Repeat":"Enable AB Repeat"; },
				condition:function(){ return this.timeline.abRepeatSet; },
				action:function(){ this.timeline.abRepeatOn = !this.timeline.abRepeatOn; }},
			{name:"Clear",
				condition:function(){return this.timeline.abRepeatSet; },
				action:function(){ this.timeline.clearRepeat(); }},
			{name:"AutoCue Repeat",
				label:function(){ return this.timeline.autoCueRepeat?"Disable AutoCue Repeat":"Enable AutoCue Repeat"; },
				action:function(){ this.timeline.autoCueRepeat = !this.timeline.autoCueRepeat; }},
			{name:"Set Repeat Point",action:function(pos){
				(this.timeline.abRepeatSet?updateABPoints:resetABPoints).call(this.timeline,pos);
			}}
		]}
	];
	
}(Timeline,window));