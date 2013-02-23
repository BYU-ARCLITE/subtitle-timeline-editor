var CaptionEditor = (function(){
	var editCapTemplate = '<table style="text-align:center;border: 1px solid black;">\
		<tr><td><label>Alignment:</label></td><td/><td><label>Positioning:</label></td></tr>\
		<tr><td>\
			<select data-template-key="cue_align">\
				<option value="start">Start</option><option value="middle" selected>Middle</option><option value="end">End</option>\
			</select>\
		</td><td>\
			<button data-template-key="fbtn">Flip</button>\
		</td><td>\
			<select data-template-key="cue_snap">\
				<option value="auto">Auto</option>\
				<option value="snap">Snap-to-Lines</option>\
				<option value="percent">Percent</option>\
			</select>\
		</td></tr>\
		<tr data-template-key="line_form">\
			<td colspan=3>\
				<label>Line Position</label>\
				<input data-template-key="cue_line" type="range" value=0/>\
			</td>\
		</tr>\
		<tr><td><label>Indentation</label></td><td/><td><label>Caption Size</label></td></tr>\
		<tr><td><input data-template-key="cue_pos" type="range" value=50/></td><td/><td><input data-template-key="cue_size" type="range" value=100 min=0 max=100 /></td></tr>\
	</table>';	

	function HTML2VTT(nodeList,sanitize) {
		return [].map.call(nodeList,function(node){
			var tag;
			if(node.nodeType === Node.TEXT_NODE){ return node.nodeValue.replace(/[\r\n]+/g,' '); }
			if(node.nodeType !== Node.ELEMENT_NODE){ return ""; }
			tag = node.nodeName.toLowerCase();
			switch(tag){
			case "br": return "\r\n";
			case "div": return sanitize
								?("\r\n"+HTML2VTT(node.childNodes))
								:("<div>"+HTML2VTT(node.childNodes)+"</div>");
			case "i":
				return (node["data-target"] === "timestamp")
						?node["data-timestamp"]
						:("<i>"+HTML2VTT(node.childNodes)+"</i>");
			default:
				if(sanitize){ return HTML2VTT(node.childNodes,sanitize); }
			case "u":
			case "b":
			case "ruby":
			case "rt":
				return "<"+tag+">"+HTML2VTT(node.childNodes)+"</"+tag+">";
			case "span":
				switch(node['data-cuetag']){
				case "V": return "<v "+node['data-voice']+">"+HTML2VTT(node.childNodes,sanitize)+"</v>";
				case "C": return "<c."+node.className.replace(/ /g,'.')+">"+HTML2VTT(node.childNodes,sanitize)+"</c>";
				case "LANG": return "<lang "+node.lang+">"+HTML2VTT(node.childNodes,sanitize)+"</lang>";
				default: return "";
				}
			}
		}).join('');
	}

	function genTextChange(text, editor){
		return function(){
			this.text = text;
			//can't just refresh layout 'cause it won't update text
			//can't update texts ourselves 'cause we'll leak nodes
			editor.rebuild(this);
		};
	}

	function CaptionEditor(params){
		if(!(this instanceof CaptionEditor)){ return new CaptionEditor(params); }
		var kinds = Object.create(CaptionEditor.kinds,{});
		this.timeline = params.timeline||null;
		this.renderer = params.renderer||null;
		this.cstack = timeline?timeline.cstack:params.stack||null;
		Object.keys(params.kinds||{}).forEach(function(key){
			kind = params.kinds[key];
			if(typeof kind === 'function'){ kinds[key] = kind; }
		});
		this.kinds = kinds;
	}
	
	CaptionEditor.prototype.refresh = function(cue){
		if(this.renderer){ this.renderer.refreshLayout(); }
		if(this.timeline){ this.timeline.render(); }
	};
	
	CaptionEditor.prototype.rebuild = function(cue){
		if(this.renderer && cue.active){ this.renderer.rebuildCaptions(); }
		if(this.timeline && this.timeline.spanInView(cue.startTime, cue.endTime)){ this.timeline.render(); }
	};
	
	function updateLineEditor(line_form,cue_line,value){
		switch(value){
		case "auto":
			line_form.style.display = "none";
			break;
		case "percent":
			cue_line.type = "range";
			cue_line.max = 100;
			cue_line.min = 0;
			line_form.style.display = "table-row";
			break;
		case "snap":
			cue_line.type = "number"
			cue_line.max = null;
			cue_line.min = null;
			line_form.style.display = "table-row";
			break;
		}
	}
	
	function makeCapDialog(cue,editor){
		return EditorWidgets.Template.Dialog("Edit Caption",editCapTemplate,{
			cue_line: function(root){
				this.value = parseInt(cue.line,10);
				this.addEventListener('change',function(){
					cue.line = cue.snapToLines?this.valueAsNumber:this.value+"%";
					editor.renderer &&  editor.renderer.refreshLayout();
				},false);
			},cue_pos: function(root){
				this.value = parseInt(cue.position,10);
				this.addEventListener('change',function(){
					cue.position = this.value+"%";
					editor.renderer && editor.renderer.refreshLayout();
				},false);
			},cue_size: function(root){
				this.value = parseInt(cue.size,10);
				this.addEventListener('change',function(){
					cue.size = this.value+"%";
					editor.renderer && editor.renderer.refreshLayout();
				},false);
			},cue_align: function(root){
				this.value = cue.align;
				this.addEventListener('change',function(){
					cue.align = this.value;
					editor.renderer && editor.renderer.refreshLayout();
				},false);
			}
		},function(root, attrs){
			var snapval = cue.snapToLines?(cue.line==='auto'?'auto':'snap'):'percent',
				line_form = attrs.line_form,
				cue_line = attrs.cue_line;
			updateLineEditor(line_form,cue_line,snapval);
			attrs.cue_snap.value = snapval;
			attrs.cue_snap.addEventListener('change',function(){
				switch(this.value){
				case "auto":
					cue.line = "auto";
					break;
				case "percent":
					cue.line = cue.line==='auto'?"100%":"0%";
					break;
				case "snap":
					cue.line = cue.line==='auto'?-1:0;
					break;
				}
				updateLineEditor(line_form,cue_line,this.value);
			},false);
		});
	}
	
	CaptionEditor.kinds = {
		subtitles: function(cue){
			var node = document.createElement('div'),
				editor = this, cstack = this.cstack;
			
			//THIS IS WHERE TO STICK IN CK EDITOR OR WHATEVER
			
			node.contentEditable = 'true'; 
			node.style.border = "1px solid silver";
			node.appendChild(cue.getCueAsHTML(true));
			node.addEventListener('keydown',function(e){
				e = e||window.event;
				switch(e.keyCode){
					case 13: e.preventDefault(); //enter key, which must be dealt with safely for contenteditable does terrible default things
					default: e.stopPropagation(); //space key, and any other keys that might be hot-keys for other stuff
					break;
					case 89: //undo and redo keys
					case 90:
						if(e.ctrlKey){ e.preventDefault(); }
				}
			},false);
			if(cstack instanceof EditorWidgets.CommandStack){
				node.addEventListener('input',function(){
					var newtext = HTML2VTT(node.childNodes,true);
					cstack.push({
						context: cue,
						file: cue.track.label,
						redo: genTextChange(newtext,editor),
						undo: genTextChange(cue.text,editor)
					});
					cue.text = newtext;
					editor.refresh(cue); //refresh, don't rebuild, 'cause we'd lose the cursor context
				},false);
			}
			return node;
		},
		captions: function(cue){
			var node = document.createElement('div'),
				editor = this, cstack = this.cstack,
				dialog = null;
			
			node.contentEditable = 'true'; 
			node.style.border = "1px solid silver";
			node.appendChild(cue.getCueAsHTML(true));
			node.addEventListener('keydown',function(e){
				e = e||window.event;
				switch(e.keyCode){
					case 13: e.preventDefault(); //enter key, which must be dealt with safely for contenteditable does terrible default things
					default: e.stopPropagation(); //space key, and any other keys that might be hot-keys for other stuff
					break;
					case 89: //undo and redo keys
					case 90:
						if(e.ctrlKey){ e.preventDefault(); }
				}
			},false);
			node.addEventListener("focus",function(){
				if(dialog){ return; }
				dialog = makeCapDialog(cue,editor);
			},false);
			if(cstack instanceof EditorWidgets.CommandStack){
				node.addEventListener('input',function(){
					var newtext = HTML2VTT(node.childNodes,true);
					cstack.push({
						context: cue,
						file: cue.track.label,
						redo: genTextChange(newtext,editor),
						undo: genTextChange(cue.text,editor)
					});
					cue.text = newtext;
					editor.refresh(cue); //refresh, don't rebuild, 'cause we'd lose the cursor context
				},false);
			}
			return node;
		}
	};
	
	CaptionEditor.prototype.make = function(cue){
		try { return this.kinds[cue.track.kind].call(this,cue); }
		catch(e){ return CaptionEditor.kinds.subtitles.call(this,cue); }
	};
	
	return CaptionEditor;
}());