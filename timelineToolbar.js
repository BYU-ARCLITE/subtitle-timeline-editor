function TimelineToolbar(tl) {
	this.buttons = [
		new Button("select", 0, buttonActions.selectAction),
		new Button("move", 1, buttonActions.moveAction),
		new Button("delete", 2, buttonActions.deleteAction)
	];
	this.tl = tl;
}

TimelineToolbar.prototype.render = function() {
    this.tl.ctx.fillStyle = this.tl.buttonColor;
    var top = this.tl.height - this.tl.toolbarHeight + this.tl.buttonSpacing;
    for(var i in this.buttons) {
        var left = i * (this.tl.buttonWidth + this.tl.buttonSpacing) + this.tl.buttonSpacing;
        this.tl.ctx.fillRect(left, top, this.tl.buttonWidth, this.tl.buttonHeight);
    }
};