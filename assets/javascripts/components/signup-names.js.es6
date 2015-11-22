export default Em.Component.extend({
  tagName: "p",
  names:  this.get("option.voters").map(
            user => "<span class=\"username\"><a data-user-card=\"" + user + "\" class=\"trigger-user-card\">" + user + "</a></span>"
          ).join(', ').property("option.voters"),

  render(buffer) {
    buffer.push(this.get("names"));
  }
});
