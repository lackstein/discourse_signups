import round from "discourse/lib/round";

export default Em.Component.extend({
  tagName: "span",

  totalScore: function() {
    return _.reduce(this.get("signup.options"), function(total, o) {
      const value = parseInt(o.get("html"), 10),
            votes = parseInt(o.get("votes"), 10);
      return total + value * votes;
    }, 0);
  }.property("signup.options.@each.{html,votes}"),

  average: function() {
    const voters = this.get("signup.voters");
    return voters === 0 ? 0 : round(this.get("totalScore") / voters, -2);
  }.property("totalScore", "signup.voters"),

  averageRating: function() {
    return I18n.t("signup.average_rating", { average: this.get("average") });
  }.property("average"),

});
