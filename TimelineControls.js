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
			cmap = Timeline.Controls;
		
		if(!(controls && typeof controls.forEach === 'function')){
			controls = ['undo','tracks','tools','settings','timestamp'];
		}
		controls.forEach(function(c){
			var constructor = cmap[c];
			if(typeof constructor === 'function'){
				node.appendChild(constructor(timeline));
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
	
	function Timestamp(tl){
		var node = parseNode('<div class="tl-timestamp">0:00:00</div>');
		tl.on('timeupdate',function(){ node.textContent = tl.timeCode; });
		return node;
	}
	
	function TrackControls(tl){
		var btn, node = parseNode('<div class="tl-toolbar"><strong>Tracks:&nbsp;</strong></div>'),
			group = parseNode('<div class="tl-btn-group"></div>');
		node.appendChild(group);
		if(!!tl.canGetFor('newtrack',[])){
			btn = parseNode('<button class="tl-btn" title="Create a new track"><i class="icon-file"></i></button>');
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
					tl.addTextTrack(track, values[3], values[4]);
					tl.commandStack.setFileUnsaved(name);
					values[5](Promise.resolve(track));
				});
			});
			group.appendChild(btn);
		}
		if(!!tl.canGetFor('edittrack',[])){
			btn = parseNode('<button class="tl-btn" title="Edit track metadata"><i class="icon-pencil"></i></button>');
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
			group.appendChild(btn);
		}
		if(!!tl.canGetFor('save',['saver'])){
			btn = parseNode('<button class="tl-btn" title="Save tracks"><i class="icon-save"></i></button>');
			setupButton(btn,'active',function(){
				tl.getFor('save',
					['saver','tidlist'],
					{tidlist: void 0}
				).then(function(values){
					var tidlist = values[1] && values[1].filter(function(trackName){
						return !tl.commandStack.isFileSaved(trackName);
					});
					values[0](Promise.resolve(tl.exportTracks(tidlist))).then(function(savedlist){
						savedlist.forEach(function(tid){
							tl.commandStack.setFileSaved(tid);
						});
						tl.render();
					});
				});
			});
			group.appendChild(btn);
		}
		if(!!tl.canGetFor('load',['tracksrc'])){
			btn = parseNode('<button class="tl-btn" title="Load track"><i class="icon-folder-open"></i></button>');
			setupButton(btn,'active',function(){
				tl.getFor('load',
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
			});
			group.appendChild(btn);
		}
		return node;
	}
	
	function Settings(tl){
		var node = parseNode('<div class="tl-toolbar"><strong>Settings:&nbsp;</strong></div>'),
			group = parseNode('<div class="tl-btn-group"></div>');
		//TODO: Handle enabled / disabled states
		node.appendChild(group);
		/*//move after add
		group.appendChild(function(){
			var set, btn;
			btn = parseNode('<button class="btn btn-small btn-inverse" title="Move After Add" data-toggle="button">\
								<i class="icon-plus"></i>\
								<i class="icon-angle-right"></i>\
								<i class="icon-move"></i>\
							</button>');
			set = setupToggle(btn,'active',
				function(){ tl.automove = true; },
				function(){ tl.automove = false; },
			);
			tl.on('automoveon',function(){ set(true); });
			tl.on('automoveoff',function(){ set(false); });
			return btn;
		}());*/
		//AB Repeat Enable
		group.appendChild(function(){
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
		}());
		//Clear Repeat
		group.appendChild(function(){
			var btn = parseNode('<button class="tl-btn" title="Clear Repeat"><i class="icon-ban-circle"></i></button>');
			setupButton(btn,'active',function(){ tl.clearRepeat(); });
			return btn;
		}());
		return node;
	}
	
	function UndoButtons(tl){
		var node = parseNode('<div class="tl-toolbar"></div>'),
			group = parseNode('<div class="tl-btn-group"></div>'),
			ubtn = parseNode('<button class="tl-btn" title="Undo"><i class="icon-undo"></i></button>'),
			rbtn = parseNode('<button class="tl-btn" title="Redo"><i class="icon-repeat"></i></button>'),
			stack = tl.commandStack;
		setupButton(ubtn,'active',stack.undo.bind(stack));
		setupButton(rbtn,'active',stack.redo.bind(stack));
		node.appendChild(group)
		group.appendChild(ubtn);
		group.appendChild(rbtn);
		return node;
	}
	
	function ToolSelector(tl){
		var node = parseNode('<div class="tl-toolbar"><strong>Tools:&nbsp;</strong></div>'),
			group = parseNode('<div class="tl-btn-group"></div>'),
			genbtn = parseNode('<button class="tl-btn"><i class="icon-ok"></i></button>'),
			tools = [
				{title:"Select Tool",icon:"icon-ok",value:Timeline.SELECT},
				{title:"Add Cue Tool",icon:"icon-plus",value:Timeline.CREATE},
				{title:"Move Tool",icon:"icon-move",value:Timeline.MOVE},
				{title:"Time Shift Tool",icon:"icon-resize-horizontal",value:Timeline.SHIFT},
				{title:"Split Tool",icon:"icon-cut",value:Timeline.SPLIT},
				{title:"Delete Tool",icon:"icon-trash",value:Timeline.DELETE},
				{title:"Set Repeat Tool",icon:"icon-repeat",value:Timeline.REPEAT},
				{title:"Scroll Tool",icon:"icon-ellipsis-horizontal",value:Timeline.SCROLL},
				{title:"Reorder Tool",icon:"icon-reorder",value:Timeline.ORDER},
			], rgroup;
		
		rgroup = makeRadioGroup(tools,'active',function(tool){
			return parseNode('<button class="tl-btn" title="'+tool.title+'"><i class="'+tool.icon+'"></i></button>');
		},function(value){ tl.currentTool = value; });
		
		node.appendChild(group);
		group.appendChild(rgroup.buttons);
		rgroup.set(tl.currentTool);
		tl.on('toolchange',function(event){ rgroup.set(event.newtool); });
		
		return node;
	}
	
	Object.defineProperty(Timeline,'Controls',{
		value: {
			'tools': ToolSelector,
			'undo': UndoButtons,
			'settings': Settings,
			'tracks': TrackControls,
			'timestamp': Timestamp
		}
	});
	
}(Timeline));