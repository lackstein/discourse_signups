export default Ember.Controller.extend({
  isMultiple: Ember.computed.equal("signup.type", "multiple"),
  isNumber: Ember.computed.equal("signup.type", "number"),
  isRandom : Ember.computed.equal("signup.order", "random"),
  isClosed: Ember.computed.equal("signup.status", "closed"),

  // shows the results when
  //   - signup is closed
  //   - topic is archived/closed
  //   - user wants to see the results
  showingResults: Em.computed.or("isClosed", "post.topic.closed", "post.topic.archived", "showResults"),

  showResultsDisabled: Em.computed.equal("signup.voters", 0),
  hideResultsDisabled: Em.computed.alias("isClosed"),

  signup: function() {
    const signup = this.get("model"),
          vote = this.get("vote");

    if (signup) {
      const options = _.map(signup.get("options"), o => Em.Object.create(o));

      if (vote) {
        options.forEach(o => o.set("selected", vote.indexOf(o.get("id")) >= 0));
      }

      signup.set("options", options);
    }

    return signup;
  }.property("model"),

  selectedOptions: function() {
    return _.map(this.get("signup.options").filterBy("selected"), o => o.get("id"));
  }.property("signup.options.@each.selected"),

  min: function() {
    let min = parseInt(this.get("signup.min"), 10);
    if (isNaN(min) || min < 1) { min = 1; }
    return min;
  }.property("signup.min"),

  max: function() {
    let options = this.get("signup.options.length"),
        max = parseInt(this.get("signup.max"), 10);
    if (isNaN(max) || max > options) { max = options; }
    return max;
  }.property("signup.max", "signup.options.length"),

  votersText: function() {
    return I18n.t("signup.voters", { count: this.get("signup.voters") });
  }.property("signup.voters"),

  totalVotes: function() {
    return _.reduce(this.get("signup.options"), function(total, o) {
      return total + parseInt(o.get("votes"), 10);
    }, 0);
  }.property("signup.options.@each.votes"),

  totalVotesText: function() {
    return I18n.t("signup.total_votes", { count: this.get("totalVotes") });
  }.property("totalVotes"),

  multipleHelpText: function() {
    const options = this.get("signup.options.length"),
          min = this.get("min"),
          max = this.get("max");

    if (max > 0) {
      if (min === max) {
        if (min > 1) {
          return I18n.t("signup.multiple.help.x_options", { count: min });
        }
      } else if (min > 1) {
        if (max < options) {
          return I18n.t("signup.multiple.help.between_min_and_max_options", { min: min, max: max });
        } else {
          return I18n.t("signup.multiple.help.at_least_min_options", { count: min });
        }
      } else if (max <= options) {
        return I18n.t("signup.multiple.help.up_to_max_options", { count: max });
      }
    }
  }.property("min", "max", "signup.options.length"),

  canCastVotes: function() {
    if (this.get("isClosed") || this.get("loading")) {
      return false;
    }

    const selectedOptionCount = this.get("selectedOptions.length");

    if (this.get("isMultiple")) {
      return (selectedOptionCount >= this.get("min") && selectedOptionCount <= this.get("max")) || selectedOptionCount == 0;
    } else {
      return selectedOptionCount > 0;
    }
  }.property("isClosed", "showingResults", "loading",
             "selectedOptions.length",
             "isMultiple", "min", "max"),

  castVotesDisabled: Em.computed.not("canCastVotes"),

  canToggleStatus: function() {
    return this.currentUser &&
           (this.currentUser.get("id") === this.get("post.user_id") || this.currentUser.get("staff")) &&
           !this.get("loading") &&
           !this.get("post.topic.closed") &&
           !this.get("post.topic.archived");
  }.property("loading", "post.user_id", "post.topic.{closed,archived}"),

  actions: {

    toggleOption(option) {
      if (this.get("isClosed")) { return; }
      if (!this.currentUser) { return this.send("showLogin"); }

      const wasSelected = option.get("selected");

      if (!this.get("isMultiple")) {
        this.get("signup.options").forEach(o => o.set("selected", false));
      }

      option.toggleProperty("selected");

      //if (!this.get("isMultiple") && !wasSelected) { this.send("castVotes"); }
    },

    castVotes() {
      if (!this.get("canCastVotes")) { return; }
      if (!this.currentUser) { return this.send("showLogin"); }

      const self = this;

      this.set("loading", true);
      
      Discourse.ajax("/signups/vote", {
        type: "PUT",
        data: {
          post_id: this.get("post.id"),
          signup_name: this.get("signup.name"),
          options: this.get("selectedOptions"),
        }
      }).then(function(results) {
        self.setProperties({ vote: results.vote });
        self.set("model", Em.Object.create(results.signup));
      }).catch(function() {
        bootbox.alert(I18n.t("signup.error_while_casting_votes"));
      }).finally(function() {
        self.set("loading", false);
      });
    },

    toggleResults() {
      this.toggleProperty("showResults");
    },

    toggleStatus() {
      if (!this.get("canToggleStatus")) { return; }

      const self = this,
            confirm = this.get("isClosed") ? "signup.open.confirm" : "signup.close.confirm";

      bootbox.confirm(
        I18n.t(confirm),
        I18n.t("no_value"),
        I18n.t("yes_value"),
        function(confirmed) {
          if (confirmed) {
            self.set("loading", true);

            Discourse.ajax("/signups/toggle_status", {
              type: "PUT",
              data: {
                post_id: self.get("post.id"),
                signup_name: self.get("signup.name"),
                status: self.get("isClosed") ? "open" : "closed",
              }
            }).then(function(results) {
              self.set("model", Em.Object.create(results.signup));
            }).catch(function() {
              bootbox.alert(I18n.t("signup.error_while_toggling_status"));
            }).finally(function() {
              self.set("loading", false);
            });
          }
        }
      );

    },
  }

});
