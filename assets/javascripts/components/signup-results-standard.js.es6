export default Em.Component.extend({
  tagName: "ul",
  classNames: ["results"],

  options: function() {
    const voters = this.get("signup.voters");

    this.get("signup.options").forEach(option => {
      const percentage = voters === 0 ? 0 : Math.floor(100 * option.get("votes") / voters),
            style = "width: " + percentage + "%".htmlSafe();
            
      const names = [for (name of option.get("voters")) "<a href=\"/users/${name}\" data-auto-route=\"true\" data-user-card=\"${name}\">${name}</a>"].join(', ');

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
