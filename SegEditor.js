(function(Timeline){
	"use strict";
	if(!Timeline){
		throw new Error("Timeline Uninitialized");
	}
	
	var defaultTemplates = {
		subtitles: {
			title: 'Edit Subtitle',
			text: '<div style="padding: 0;">\
					<b>Title:&nbsp;</b>\
					<input data-template-key="title" type="text"/><br/>\
					<b>Text:&nbsp;</b>\
					<textarea data-template-key="text"/></textarea>\
				</div>',
			config: {minLeft: 0, minTop: 0},
			cb: function(seg,root,nodes){
				nodes.title.value = seg.id;
				nodes.text.value = seg.text;
				nodes.title.addEventListener('change',function(){ seg.id = this.value; },false);
				nodes.text.addEventListener('change',function(){ seg.text = this.value; },false);
			}
		}
	};
	
	function SegEditor(templates){
		var key;
		if(typeof templates !== 'object'){ templates = {}; }
		for(key in defaultTemplates){
			if(typeof templates[key] !== 'object'){ templates[key] = defaultTemplates[key]; }
		}
		this.templates = templates;
	}
	
	SegEditor.prototype.open = function(seg){
		var kind = seg.track.kind,
			template = this.templates[(this.templates.hasOwnProperty(kind))?kind:'subtitles'];
		return EditorWidgets.Template.Dialog(template.title, template.text, template.config, template.cb.bind(null,seg));
	};
	
	Timeline.SegEditor = SegEditor;
}(Timeline));
	