(function(Timeline,global){
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
	
	function buildSection(timeline,section){
		var node = document.createElement('div');
		node.className = 'tl-toolbar';
		if(section.title){ node.innerHTML = "<strong>"+section.title+"</strong>"; }
		section.groups.forEach(function(group){
			var gnode = document.createElement('div'),
				activebtn = null;
			gnode.className = 'btn-group';
			if(group.radio){
				group.buttons.forEach(function(button){
					var bnode, down = false,
						aclass = button.activeClass;
						
					if((typeof button.condition === 'function')
						&& !button.condition(timeline)){ return; }
					bnode = parseNode(button.html);
					gnode.appendChild(bnode);
					
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
							button.activate(timeline);
						}
					});
				});
			}else{
				group.buttons.forEach(function(button){
					var bnode, active,
						aclass = button.activeClass,
						down = false;
					if((typeof button.condition === 'function')
						&& !button.condition(timeline)){ return; }
					bnode = parseNode(button.html);
					gnode.appendChild(bnode);
					
					if(button.toggle){
						active = bnode.classList.contains(aclass);
						bnode.addEventListener('mousedown',function(){
							this.classList.add(aclass);
							down = true;
						});
						bnode.addEventListener('mouseout',function(){
							if(!active){ this.classList.remove(aclass); }
							down = false;
						});
						bnode.addEventListener('mouseup',function(){
							if(!down){ return; }
							down = false;
							if(active){
								active = false;
								this.classList.remove(aclass)
								if(typeof button.deactivate === 'function'){
									button.deactivate(timeline);
								}else if(typeof button.activate === 'function'){
									button.activate(timeline);
								}
							}else{
								active = true;
								if(typeof button.activate === 'function'){
									button.activate(timeline);
								}
							}
						});
					}else{
						bnode.classList.remove(aclass);
						bnode.addEventListener('mousedown',function(){
							this.classList.add(aclass);
							down = true;
						});
						bnode.addEventListener('mouseout',function(){
							this.classList.remove(aclass);
							down = false;
						});
						bnode.addEventListener('mouseup',function(){
							if(!down){ return; }
							this.classList.remove(aclass);
							if(typeof button.activate === 'function'){
								button.activate(timeline);
							}
						});		
					}
				});
			}
			node.appendChild(gnode);
		});
		return node;
	}
	
	Timeline.ControlBar = function(timeline,controls){
		var node = document.createElement('div'),
			tnode = document.createElement('div');
		
		controls.forEach(function(section){
			node.appendChild(buildSection(timeline,section));
		});
		
		node.className = 'tl-toolbar-holder';
		
		tnode.textContent = "0:00:00";
		tnode.className = 'tl-timestamp';
		node.appendChild(tnode);
		
		Object.defineProperties(this,{
			node: {value: node},
			timestamp: {
				set: function(val){
					tnode.textContent = val;
					return tnode.textContent;
				},
				get: function(){ return tnode.textContent; }
			}
		});
	};
	
	Timeline.Controls = [
		{
			groups: [
				{
					buttons: [
						{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Undo"><i class="icon-undo"></i></button>',
							activate: function(tl){ tl.commandStack.undo(); }
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Redo"><i class="icon-repeat"></i></button>',
							activate: function(tl){ tl.commandStack.redo(); }
						}
					]
				}
			]
		},{
			title: "Tracks:",
			groups: [
				{
					buttons: [
						{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Create a new track"><i class="icon-file"></i></button>',
							condition:function(tl){ return !!tl.canGetFor('newtrack',[]); },
							activate:function(tl){
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
							}
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Edit track metadata"><i class="icon-pencil"></i></button>',
							condition:function(tl){ return !!tl.canGetFor('edittrack',[]); },
							activate:function(tl){
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
							}
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Save tracks"><i class="icon-save"></i></button>',
							condition:function(tl){ return !!tl.canGetFor('save',['saver']); },
							activate:function(tl){
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
							}
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Load track"><i class="icon-folder-open"></i></button>',
							condition:function(tl){ return !!tl.canGetFor('load',['tracksrc']); },
							activate:function(tl){
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
							}
						}/*,{
							html: '<button class="btn btn-small btn-inverse" title="Add track"><i class="icon-folder-open"></i></button>',
							condition:function(tl){ return !!tl.canGetFor('add',['texttrack']); },
						}*/
					]
				}
			]
		},{
			title: "Tools:",
			groups: [
				{
					radio: true,
					buttons: [
						{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Select Tool"><i class="icon-ok"></i></button>',
							activate: function(tl){ tl.currentTool = Timeline.SELECT; }
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Add Cue Tool"><i class="icon-plus"></i></button>',
							activate: function(tl){ tl.currentTool = Timeline.CREATE; }
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Move Tool"><i class="icon-move"></i></button>',
							activate: function(tl){ tl.currentTool = Timeline.MOVE; }
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Time Shift Tool"><i class="icon-resize-horizontal"></i></button>',
							activate: function(tl){ tl.currentTool = Timeline.SHIFT; }
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Split Tool"><i class="icon-cut"></i></button>',
							activate: function(tl){ tl.currentTool = Timeline.SPLIT; }
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Delete Tool"><i class="icon-trash"></i></button>',
							activate: function(tl){ tl.currentTool = Timeline.DELETE; }
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Set Repeat Tool"><i class="icon-repeat"></i></button>',
							activate: function(tl){ tl.currentTool = Timeline.REPEAT; }
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Scroll Tool"><i class="icon-ellipsis-horizontal"></i></button>',
							activate: function(tl){ tl.currentTool = Timeline.SCROLL; }
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Reorder Tool"><i class="icon-reorder"></i></button>',
							activate: function(tl){ tl.currentTool = Timeline.ORDER; }
						}
					]
				}
			]
		},{
			title: "Settings:",
			groups: [
				{
					radio: false,
					buttons: [
						/*{
							html: '<button class="btn btn-small btn-inverse" title="Move After Add" data-toggle="button">\
								<i class="icon-plus"></i>\
								<i class="icon-angle-right"></i>\
								<i class="icon-move"></i>\
							</button>'
						},*/{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Enable Repeat"><i class="icon-circle-blank"></i></button>',
							activate: function(tl){
								tl.abRepeatOn = true;
								this.title = "Disable Repeat";
								this.firstChild.className = "icon-circle";
							},
							deactivate: function(tl){
								tl.abRepeatOn = false;
								this.title = "Enable Repeat";
								this.firstChild.className = "icon-circle-blank";
							}
						},{
							activeClass: 'active',
							html: '<button class="btn btn-small btn-inverse" title="Clear Repeat"><i class="icon-ban-circle"></i></button>',
							activate: function(tl){ tl.clearRepeat(); }
						}
					]
				}
			]
		}
	];
	
}(Timeline,window));