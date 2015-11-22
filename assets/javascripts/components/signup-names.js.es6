export default Em.Component.extend({
  tagName: "p",
  
  render(buffer) {
    buffer.push(this.get("option.voters").map(
                  user => "<span class=\"username\"><a data-user-card=\"" + user + "\" class=\"trigger-user-card\">" + user + "</a></span>"
                ).join(', ')
    );
  }
});
