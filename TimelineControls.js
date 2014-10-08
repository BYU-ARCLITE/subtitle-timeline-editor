(function(Timeline){
	"use strict";

	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}

	var parseNode = (function(){
		var node = document.createElement('div');
		return function(text){
			node.innerHTML = text;
			return node.firstChild;
		};
	})();

	Timeline.ControlBar = function(timeline,controls){
		var node = document.createElement('div'),
			cmap = Timeline.Controls.Groups;

		if(!(controls && typeof controls.forEach === 'function')){
			controls = ['actions','tracks','tools','settings','location','timestamp'];
		}
		controls.forEach(function(c){
			var control, constructor = cmap[c];
			if(typeof constructor === 'function'){
				control = constructor(timeline);
				if(control){ node.appendChild(control); }
			}
		});

		node.className = 'tl-toolbar-holder';
		return node;
	};

	function setupToggle(btn,aclass,activate,deactivate){
		var down = false,
			active = btn.classList.contains(aclass);
		btn.addEventListener('mousedown',function(){
			this.classList.add(aclass);
			down = true;
		});
		btn.addEventListener('mouseout',function(){
			if(!active){ this.classList.remove(aclass); }
			down = false;
		});
		btn.addEventListener('mouseup',function(){
			if(!down){ return; }
			down = false;
			toggle();
		});

		return function(val){
			if(!!val === active){ return; }
			toggle();
		};

		function toggle(){
			if(active){
				active = false;
				btn.classList.remove(aclass);
				if(typeof deactivate === 'function'){
					deactivate.call(btn);
				}
			}else{
				active = true;
				btn.classList.add(aclass);
				if(typeof activate === 'function'){
					activate.call(btn);
				}
			}
		}
	}

	function setupButton(btn,aclass,activate){
		var down = false;
		btn.classList.remove(aclass);
		btn.addEventListener('mousedown',function(){
			this.classList.add(aclass);
			down = true;
		});
		btn.addEventListener('mouseout',function(){
			this.classList.remove(aclass);
			down = false;
		});
		btn.addEventListener('mouseup',function(){
			if(!down){ return; }
			this.classList.remove(aclass);
			if(typeof activate === 'function'){
				activate.call(btn);
			}
		});
	}

	function makeRadioGroup(buttons,aclass,mkNode,cb){
		var activebtn,
			values = {},
			frag = document.createDocumentFragment();
		buttons.forEach(function(button){
			var bnode = mkNode(button),
				value = button.value,
				down = false;

			values[value] = bnode;
			frag.appendChild(bnode);

			bnode.classList.remove(aclass);
			bnode.addEventListener('mousedown',function(){
				this.classList.add(aclass);
				down = true;
			});
			bnode.addEventListener('mouseout',function(){
				if(activebtn !== this){ this.classList.remove(aclass); }
				down = false;
			});
			bnode.addEventListener('mouseup',function(){
				if(!down){ return; }
				down = false;
				if(activebtn !== this){
					activebtn && activebtn.classList.remove(aclass);
					this.classList.add(aclass);
					activebtn = this;
					cb(button.value);
				}
			});
		});
		return {
			buttons: frag,
			set: function(val){
				var nbtn = values[val];
				if(nbtn && (nbtn !== activebtn)){
					activebtn && activebtn.classList.remove(aclass);
					nbtn.classList.add(aclass);
					activebtn = nbtn;
				}
			}
		};
	}

	function BuildSection(tl,title,groups){
		var node = parseNode('<div class="tl-toolbar"></div>'),
			cmap = Timeline.Controls.Elements;
		if(title){ node.innerHTML = "<strong>"+title+":&nbsp;</strong>"; }
		groups.forEach(function(group){
			var gnode = parseNode('<div class="tl-btn-group"></div>');
			group.forEach(function(element){
				var constructor = cmap[element];
				if(typeof constructor === 'function'){
					gnode.appendChild(constructor(tl));
				}
			});
			node.appendChild(gnode);
		});
		return node;
	}

	function Timestamp(tl){
		var node = parseNode('<div class="tl-timestamp">0:00:00</div>');
		tl.on('timeupdate',function(){ node.textContent = tl.timeCode; });
		return node;
	}

	function LocationBtn(tl){
		var nameMap = {},
			btn = parseNode('<button class="tl-btn" title="Select Save Location"></button>');
		if(tl.saveLocation === void 0){ btn.textContent = "Default"; }
		tl.getFor('locationNames',['names']).then(function(values){
			nameMap = values[0];
			btn.textContent = tl.saveLocation === void 0?"Default":(nameMap[tl.saveLocation] || tl.saveLocation);
		});
		setupButton(btn,'active',function(){
			tl.getFor('location',['location']).then(function(values){
				var location = values[0];
				tl.saveLocation = location;
				btn.textContent = location === void 0?"Default":(nameMap[location] || location);
			});
		});
		return btn;
	}

	function Location(tl){
		var node, group;
		if(!tl.canGetFor('location',['location'])){ return null; }
		node = parseNode('<div class="tl-toolbar"><strong>Location:&nbsp;</strong></div>');
		group = parseNode('<div class="tl-btn-group"></div>');

		group.appendChild(LocationBtn(tl));
		node.appendChild(group);
		return node;
	}

	function NewTrackBtn(tl){
		var btn = parseNode('<button class="tl-btn" title="Create a new track"><i class="icon-file"></i></button>');
		setupButton(btn,'active',function(){
			tl.getFor('newtrack',
				['kind','name','lang','mime','overwrite','handler'],
				{
					kind: 'subtitles',
					name: 'untitled',
					lang: 'zxx',
					mime: 'text/vtt',
					overwrite: false,
					handler: function(){}
				}
			).then(function(values){
				var track = new TextTrack(values[0], values[1], values[2]); //kind, name, lang
				track.readyState = TextTrack.LOADED;
				tl.addTextTrack(track, values[3], void 0, values[4]);
				tl.commandStack.setFileUnsaved(name);
				values[5](Promise.resolve(track));
			});
		});
		return btn;
	}

	function EditTrackBtn(tl){
		var btn = parseNode('<button class="tl-btn" title="Edit track metadata"><i class="icon-pencil"></i></button>');
		setupButton(btn,'active',function(){
			tl.getFor('edittrack',
				['tid','kind','lang','name','overwrite'],
				{
					name: void 0,
					kind: void 0,
					lang: void 0,
					overwrite: false
				}
			).then(function(values){
				tl.alterTextTrack.apply(tl,values);
			});
		});
		return btn;
	}

	function SaveTrackBtn(tl){
		var btn = parseNode('<button class="tl-btn" title="Save tracks"><i class="icon-save"></i></button>');
		setupButton(btn,'active',function(){
			tl.getFor('savetrack',
				['saver','location','tidlist'],
				{location: void 0, tidlist: void 0}
			).then(function(values){
				var loc = values[1],
					tidlist = values[2] && values[2].filter(function(trackName){
						return !tl.commandStack.isFileSaved(trackName, loc);
					});
				values[0](Promise.resolve(tl.exportTracks(tidlist))).then(function(savedlist){
					savedlist.forEach(function(tid){
						tl.commandStack.setFileSaved(tid, loc);
					});
					tl.render();
				});
			});
		});
		return btn;
	}

	function LoadTrackBtn(tl){
		var btn = parseNode('<button class="tl-btn" title="Load track"><i class="icon-folder-open"></i></button>');
		setupButton(btn,'active',function(){
			tl.getFor('loadtrack',
				['tracksrc','kind','lang','name','location','overwrite','handler'],
				{
					handler: function(){},
					kind: void 0,
					lang: void 0,
					name: void 0,
					location: void 0,
					overwrite: false
				}
			).then(function(values){
				values[5](tl.loadTextTrack.apply(tl,values));
			});
		});
		return btn;
	}

	function TrackControls(tl){
		var btn, node = parseNode('<div class="tl-toolbar"><strong>Tracks:&nbsp;</strong></div>'),
			group = parseNode('<div class="tl-btn-group"></div>');
		node.appendChild(group);
		if(tl.canGetFor('newtrack',[])){ group.appendChild(NewTrackBtn(tl)); }
		if(tl.canGetFor('edittrack',[])){ group.appendChild(EditTrackBtn(tl)); }
		if(tl.canGetFor('savetrack',['saver'])){ group.appendChild(SaveTrackBtn(tl)); }
		if(tl.canGetFor('loadtrack',['tracksrc'])){ group.appendChild(LoadTrackBtn(tl)); }
		return group.childNodes.length?node:null;
	}

	function ABRepeatBtn(tl){
		var set, btn;
		btn = parseNode('<button class="tl-btn" title="Enable Repeat"><i class="icon-circle-blank"></i></button>');
		set = setupToggle(btn,'active',function(){
			tl.abRepeatOn = true;
			this.title = "Disable Repeat";
			this.firstChild.className = "icon-circle";
		},function(){
			tl.abRepeatOn = false;
			this.title = "Enable Repeat";
			this.firstChild.className = "icon-circle-blank";
		});
		set(tl.abRepeatOn);
		tl.on('abrepeatenabled',function(){ set(true); });
		tl.on('abrepeatdisabled',function(){ set(false); });
		return btn;
	}

	function AnchorViewBtn(tl){
		var set, btn;
		btn = parseNode('<button class="tl-btn" title="Anchor View to Seeker"><i class="icon-anchor"></i></button>');
		set = setupToggle(btn,'active',
			function(){ tl.trackSeeker = true; },
			function(){ tl.trackSeeker = false; }
		);
		set(tl.trackSeeker);
		tl.on('trackseekeron',function(){ set(true); });
		tl.on('trackseekeroff',function(){ set(false); });
		return btn;
	}

	function AutoCueRepeatBtn(tl){
		var set, btn;
		btn = parseNode('<button class="tl-btn" title="Auto Repeat">Auto<i class="icon-refresh"></i></button>');
		set = setupToggle(btn,'active',
			function(){ tl.autoCueRepeat = true; },
			function(){ tl.autoCueRepeat = false; }
		);
		set(tl.autoCueRepeat);
		tl.on('cuerepeaton',function(){ set(true); });
		tl.on('cuerepeatoff',function(){ set(false); });
		return btn;
	}

	function MoveAfterAddBtn(tl){
		var set, btn;
		btn = parseNode('<button class="tl-btn" title="Move After Add">\
							<i class="icon-plus"></i>\
							<i class="icon-angle-right"></i>\
							<i class="icon-move"></i>\
						</button>');
		set = setupToggle(btn,'active',
			function(){ tl.automove = true; },
			function(){ tl.automove = false; }
		);
		set(tl.automove);
		tl.on('automoveon',function(){ set(true); });
		tl.on('automoveoff',function(){ set(false); });
		return btn;
	}

	function Settings(tl){
		var node = parseNode('<div class="tl-toolbar"><strong>Settings:&nbsp;</strong></div>'),
			group = parseNode('<div class="tl-btn-group"></div>');

		group.appendChild(ABRepeatBtn(tl));
		group.appendChild(AnchorViewBtn(tl));
		group.appendChild(AutoCueRepeatBtn(tl));
		group.appendChild(MoveAfterAddBtn(tl));

		node.appendChild(group);
		return node;
	}

	function UndoBtn(tl){
		var btn = parseNode('<button class="tl-btn" title="Undo"><i class="icon-undo"></i></button>');
		setupButton(btn,'active',tl.commandStack.undo.bind(tl.commandStack));
		return btn;
	}

	function RedoBtn(tl){
		var btn = parseNode('<button class="tl-btn" title="Redo"><i class="icon-repeat"></i></button>');
		setupButton(btn,'active',tl.commandStack.redo.bind(tl.commandStack));
		return btn;
	}

	function ClearRepBtn(tl){
		var btn = parseNode('<button class="tl-btn" title="Clear Repeat"><i class="icon-ban-circle"></i></button>');
		setupButton(btn,'active',function(){ tl.clearRepeat(); });
		return btn;
	}

	function BreakPntBtn(tl){
		var btn = parseNode('<button class="tl-btn" title="AutoCue Breakpoint"><b>||</b></button>');
		setupButton(btn,'active',function(){ tl.breakPoint(); });
		return btn;
	}

	function Actions(tl){
		var btn, node = parseNode('<div class="tl-toolbar"><strong>Actions:&nbsp</strong></div>'),
			group = parseNode('<div class="tl-btn-group"></div>'),
			stack = tl.commandStack;

		group.appendChild(UndoBtn(tl));
		group.appendChild(RedoBtn(tl));
		group.appendChild(ClearRepBtn(tl));
		group.appendChild(BreakPntBtn(tl));

		node.appendChild(group)
		return node;
	}

	function ToolBtns(tl){
		var rgroup = makeRadioGroup([
				{title:"Select Tool",icon:"icon-ok",value:Timeline.SELECT},
				{title:"Add Cue Tool",icon:"icon-plus",value:Timeline.CREATE},
				{title:"Move Tool",icon:"icon-move",value:Timeline.MOVE},
				{title:"Time Shift Tool",icon:"icon-resize-horizontal",value:Timeline.SHIFT},
				{title:"Split Tool",icon:"icon-cut",value:Timeline.SPLIT},
				{title:"Delete Tool",icon:"icon-trash",value:Timeline.DELETE},
				{title:"Set Repeat Tool",icon:"icon-refresh",value:Timeline.REPEAT},
				{title:"Reorder Tool",icon:"icon-random",value:Timeline.ORDER},
			],'active',function(tool){
			return parseNode('<button class="tl-btn" title="'+tool.title+'"><i class="'+tool.icon+'"></i></button>');
		},function(value){ tl.currentTool = value; });

		rgroup.set(tl.currentTool);
		tl.on('toolchange',function(event){ rgroup.set(event.newtool); });

		return rgroup.buttons;
	}

	function ToolSelector(tl){
		var node = parseNode('<div class="tl-toolbar"><strong>Tools:&nbsp;</strong></div>'),
			group = parseNode('<div class="tl-btn-group"></div>');

		group.appendChild(ToolBtns(tl));
		node.appendChild(group);
		return node;
	}

	Timeline.Controls = {
		MakeGroup: function(title, groups){
			return function(tl){ return BuildSection(tl,title,groups); };
		},
		Groups: {
			tools: ToolSelector,
			actions: Actions,
			settings: Settings,
			tracks: TrackControls,
			location: Location,
			timestamp: Timestamp
		},
		Elements: {
			newtrackbtn: NewTrackBtn,
			edittrackbtn: EditTrackBtn,
			savetrackbtn: SaveTrackBtn,
			loadtrackbtn: LoadTrackBtn,
			abrepeatbtn: ABRepeatBtn,
			trackseekerbtn: AnchorViewBtn,
			cuerepeatbtn: AutoCueRepeatBtn,
			automovebtn: MoveAfterAddBtn,
			undobtn: UndoBtn,
			redobtn: RedoBtn,
			clearrepeatbtn: ClearRepBtn,
			breakpointbtn: BreakPntBtn,
			toolbtns: ToolBtns
		}
	};

}(Timeline));