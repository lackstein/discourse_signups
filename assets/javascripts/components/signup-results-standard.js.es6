export default Em.Component.extend({
  tagName: "ul",
  classNames: ["results"],

  options: function() {
    const voters = this.get("signup.voters");

    this.get("signup.options").forEach(option => {
      const percentage = voters === 0 ? 0 : Math.floor(100 * option.get("votes") / voters),
            style = "width: " + percentage + "%".htmlSafe();
            
      const names = option.get("voters").map(
          user => "<a href=\"/users/" + user + "\" data-auto-route=\"true\" data-user-card=\"" + user + "\" class=\"username trigger-user-card\">" + user + "</a>"
      ).join(', ');

      option.setProperties({
        percentage,
        style,
        names,
        title: I18n.t("signup.option_title", { count: option.get("votes") })
      });
    });

    return this.get("signup.options");
  }.property("signup.voters", "signup.options.[]")

});
