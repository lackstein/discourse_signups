export default Em.View.extend({
  templateName: "signup",
  classNames: ["signup"],
  attributeBindings: ["data-signup-type", "data-signup-name", "data-signup-status"],

  signup: Em.computed.alias("controller.signup"),

  "data-signup-type": Em.computed.alias("signup.type"),
  "data-signup-name": Em.computed.alias("signup.name"),
  "data-signup-status": Em.computed.alias("signup.status"),

  _fixPollContainerHeight: function() {
    const signupContainer = this.$(".signup-container");
    signupContainer.height(signupContainer.height());
  }.on("didInsertElement")
});
