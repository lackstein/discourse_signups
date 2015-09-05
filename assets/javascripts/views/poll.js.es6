export default Em.View.extend({
  templateName: "poll",
  classNames: ["poll"],
  attributeBindings: ["data-signup-type", "data-signup-name", "data-signup-status"],

  poll: Em.computed.alias("controller.poll"),

  "data-signup-type": Em.computed.alias("poll.type"),
  "data-signup-name": Em.computed.alias("poll.name"),
  "data-signup-status": Em.computed.alias("poll.status"),

  _fixPollContainerHeight: function() {
    const pollContainer = this.$(".poll-container");
    pollContainer.height(pollContainer.height());
  }.on("didInsertElement")
});
