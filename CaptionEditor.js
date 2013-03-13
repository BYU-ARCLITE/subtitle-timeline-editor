var CaptionEditor = (function(){
	var getSelection = (window.getSelection || document.getSelection || document.selection.createRange),
		editCapTemplate = '<table style="text-align:center;border: 1px solid black;">\
		<tr><td><label>Alignment:</label></td><td><label>Positioning:</label></td></tr>\
		<tr><td>\
			<select data-template-key="cue_align">\
				<option value="start">Start</option><option value="middle" selected>Middle</option><option value="end">End</option>\
			</select>\
		</td><td>\
			<select data-template-key="cue_snap">\
				<option value="auto">Auto</option>\
				<option value="snap">Snap-to-Lines</option>\
				<option value="percent">Percent</option>\
			</select>\
		</td></tr>\
		<tr data-template-key="line_form">\
			<td colspan=2>\
				<label>Line Position</label>\
				<input data-template-key="cue_line" type="range" value=0/>\
			</td>\
		</tr>\
		<tr><td><label>Indentation</label></td><td><label>Caption Size</label></td></tr>\
		<tr><td><input data-template-key="cue_pos" type="range" value=50/></td><td><input data-template-key="cue_size" type="range" value=100 min=0 max=100 /></td></tr>\
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
	
	function updateLineEditor(cue,line_form,cue_line){
		if(cue.line === "auto"){
			line_form.style.display = "none";
		}else{
			if(cue.snapToLines){
				cue_line.type = "number"
				cue_line.max = null;
				cue_line.min = null;
			}else{
				cue_line.type = "range";
				cue_line.max = 100;
				cue_line.min = 0;
			}
			cue_line.value = parseInt(cue.line,10);
			line_form.style.display = "table-row";
		}
	}
	
	function makeCapDialog(cue,editor){
		var latch = {
			line: cue.line,
			position: cue.position,
			size: cue.size,
			align: cue.align
		};
		return EditorWidgets.Template.Dialog("Edit Caption Position",editCapTemplate,{
			root: {
				finalize: function(root, attrs){
					var line_form = attrs.line_form,
						cue_line = attrs.cue_line;
					updateLineEditor(cue,line_form,cue_line);
					attrs.cue_snap.value = cue.snapToLines?(cue.line==='auto'?'auto':'snap'):'percent';
					attrs.cue_snap.addEventListener('change',function(){
						cue.line =	(this.value === "percent")?"100%":
									(this.value === "snap")?"-1":"auto";
						updateLineEditor(cue,line_form,cue_line);
						editor.renderer &&  editor.renderer.refreshLayout();
					},false);
				}
			},
			elements: {
				cue_line: {
					init: function(root){ this.value = parseInt(cue.line,10); },
					events: {
						change: function(){
							changeAttribute(cue,'line',cue.snapToLines?(this.valueAsNumber+""):(this.value+"%"),editor,latch);
						}
					}
				},cue_pos: {
					init: function(root){ this.value = parseInt(cue.position,10); },
					events: {
						change: function(){
							changeAttribute(cue,'position',this.value+"%",editor,latch);
						}
					}
				},cue_size: {
					init: function(root){ this.value = parseInt(cue.size,10); },
					events: {
						change: function(){
							changeAttribute(cue,'size',this.value+"%",editor,latch);
						}
					}
				},cue_align: {
					init: function(root){ this.value = cue.align; },
					events: {
						change: function(){
							changeAttribute(cue,'align',this.value,editor,latch);
						}
					}
				}
			}
		});
	}
	
	function attrChange(attr, nval, editor, latch){
		var oval = this[attr];
		this[attr] = nval;
		latch[attr] = nval;
		if(editor.renderer && this.active){ editor.renderer.rebuildCaptions(); }
		if(editor.timeline){ editor.timeline.emit("cuechange",{cue:this,attr:attr,oldval:oval,newval:nval}); }
	}
	
	var pushAction = debounce(function(cue, attr, nval, editor, latch){
		var oval = latch[attr];
		latch[attr] = nval;
		editor.cstack.push({
			context: cue,
			file: cue.track.label,
			redo: attrChange.bind(cue,attr,nval,editor,latch),
			undo: attrChange.bind(cue,attr,oval,editor,latch)
		});
	});
	
	function changeAttribute(cue, attr, nval, editor, latch){
		var oval = cue[attr];
		cue[attr] = nval;
		if(editor.renderer && cue.active){ editor.renderer.refreshLayout(); }
		if(editor.cstack){
			pushAction(cue,attr,nval,editor,latch);
		}
		if(editor.timeline){
			editor.timeline.emit("cuechange",{cue:this,attr:attr,oldval:oval,newval:nval});
		}
	}
	
	function debounce(f, res) {
		var timeout;
		return function(){
			var that = this, args = arguments;
			if(timeout){ clearTimeout(timeout); }
			timeout = setTimeout(function(){
				f.apply(that, args);
				timeout = null; 
			}, res || 100); 
		};
	}
	
	function editorInput(cue,editor,cstack){
		var newtext = HTML2VTT(this.childNodes,true);
		if(cstack){
			cstack.push({
				context: cue,
				file: cue.track.label,
				redo: genTextChange(newtext,editor),
				undo: genTextChange(cue.text,editor)
			});
		}
		cue.text = newtext;
		editor.refresh(cue); //refresh, don't rebuild, 'cause we'd lose the cursor context
	}
	
	function editorKeyDown(cue,editor,cstack,e){
		var selection, range, anchor, text, focusNode, offset, frag;
		e = e||window.event;
		switch(e.keyCode){
			case 13: //enter key, which must be dealt with safely for contenteditable does terrible default things
				selection = getSelection();
				if(!selection.isCollapsed){ selection.getRangeAt(0).deleteContents(); }
				anchor = selection.anchorNode;
				text = anchor.nodeValue;
				offset = selection.anchorOffset;
				
				//edit the caption contents
				frag = document.createDocumentFragment();
				if(offset > 0){ frag.appendChild(document.createTextNode(text.substr(0,offset))); }
				frag.appendChild(document.createElement('br'));
				focusNode = document.createTextNode(text.substr(offset));
				frag.appendChild(focusNode);
				anchor.parentNode.replaceChild(frag,anchor);
				
				//refresh the display
				editorInput.call(this,cue,editor,cstack);
				
				//reset the caret
				range = document.createRange();
				range.setStart(focusNode,0);
				range.setEnd(focusNode,0);
				selection.removeAllRanges();
				selection.addRange(range);
				
				e.preventDefault();
				e.stopPropagation();
				break;
			case 89: //undo and redo keys
			case 90:
				if(e.ctrlKey){ e.preventDefault(); }
				break;
			default: e.stopPropagation(); //space key, and any other keys that might be hot-keys for other stuff
				break;
		}
	}
	
	CaptionEditor.kinds = {
		subtitles: function(cue){
			var node = document.createElement('div'),
				editor = this, cstack = this.cstack;
			
			//THIS IS WHERE TO STICK IN CK EDITOR OR WHATEVER
			
			node.contentEditable = 'true'; 
			node.style.border = "1px solid silver";
			node.appendChild(cue.getCueAsHTML(true));
			node.addEventListener('keydown',editorKeyDown.bind(node,cue,editor,cstack),false);
			node.addEventListener('input',editorInput.bind(node,cue,editor,cstack),false);
			return {node:node};
		},
		captions: function(cue){
			var outernode = document.createElement('div'),
				node = document.createElement('div'),
				editor = this, cstack = this.cstack,
				dialog = makeCapDialog(cue,this);
			
			node.contentEditable = 'true'; 
			node.style.height = "100%";
			node.style.width = "100%";
			node.style.border = "1px solid silver";
			node.appendChild(cue.getCueAsHTML(true));
			node.addEventListener('keydown',editorKeyDown.bind(node,cue,editor,cstack),false);
			node.addEventListener('input',editorInput.bind(node,cue,editor,cstack),false);
			node.addEventListener("focus", dialog.show.bind(dialog), false);
			
			return {node:node,cleanup:dialog.close.bind(dialog)};
		}
	};
	
	CaptionEditor.prototype.make = function(cue){
		try { return this.kinds[cue.track.kind].call(this,cue); }
		catch(e){ return CaptionEditor.kinds.subtitles.call(this,cue); }
	};
	
	return CaptionEditor;
}());