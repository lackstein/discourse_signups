import { ajax } from 'discourse/lib/ajax';
import computed from "ember-addons/ember-computed-decorators";

export default Ember.Controller.extend({
  needs: 'composer',

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
  hideResultsDisabled: Em.computed.or("isClosed", "post.topic.closed", "post.topic.archived"),

  @computed("model", "vote", "model.voters", "model.options", "model.status")
  signup(signup, vote) {
    if (signup) {
      const options = _.map(signup.get("options"), o => Em.Object.create(o));

      if (vote) {
        options.forEach(o => o.set("selected", vote.indexOf(o.get("id")) >= 0));
      }

      signup.set("options", options);
    }

    return signup;
  },

  attendees: function() {
    let list = [];
    this.get("signup.options").forEach(option =>
      option.get("voters").forEach(voter => list.push(voter))
    );
    return list.uniq();
  }.property("signup.options.@each.voters"),

  @computed("signup.options.@each.selected")
  selectedOptions() {
    return _.map(this.get("signup.options").filterBy("selected"), o => o.get("id"));
  },

  @computed("signup.min")
  min(min) {
    min = parseInt(min, 10);
    if (isNaN(min) || min < 1) { min = 1; }
    return min;
  },

  @computed("signup.max", "signup.options.length")
  max(max, options) {
    max = parseInt(max, 10);
    if (isNaN(max) || max > options) { max = options; }
    return max;
  },

  @computed("signup.voters")
  votersText(count) {
    return I18n.t("signup.voters", {
      count: count,
      one: Discourse.SiteSettings.signup_voters_text_one,
      other: Discourse.SiteSettings.signup_voters_text_other
    });
  },

  @computed("signup.options.@each.votes")
  totalVotes() {
    return _.reduce(this.get("signup.options"), function(total, o) {
      return total + parseInt(o.get("votes"), 10);
    }, 0);
  },

  @computed("totalVotes")
  totalVotesText(count) {
    return I18n.t("signup.total_votes", { count });
  },

  @computed("min", "max", "signup.options.length")
  multipleHelpText(min, max, options) {
    if (max > 0) {
      if (min === max) {
        if (min > 1) {
          return I18n.t("signup.multiple.help.x_options", { count: min });
        }
      } else if (min > 1) {
        if (max < options) {
          return I18n.t("signup.multiple.help.between_min_and_max_options", { min, max });
        } else {
          return I18n.t("signup.multiple.help.at_least_min_options", { count: min });
        }
      } else if (max <= options) {
        return I18n.t("signup.multiple.help.up_to_max_options", { count: max });
      }
    }
  },

  @computed("isClosed", "showResults", "loading", "isMultiple", "selectedOptions.length", "min", "max")
  canCastVotes(isClosed, showResults, loading, isMultiple, selectedOptionCount, min, max) {
    if (this.get("isClosed") || this.get("loading")) {
      return false;
    }

    if (isMultiple) {
      return selectedOptionCount >= min && selectedOptionCount <= max || selectedOptionCount == 0;;
    } else {
      return selectedOptionCount > 0;
    }
  },

  castVotesDisabled: Em.computed.not("canCastVotes"),

  @computed("loading", "post.user_id", "post.topic.closed", "post.topic.archived")
  canToggleStatus(loading, userId, topicClosed, topicArchived) {
    return this.currentUser &&
           (this.currentUser.get("id") === userId || this.currentUser.get("staff")) &&
           !loading &&
           !topicClosed &&
           !topicArchived;
  },

  actions: {

    composeMessage() {
      const Composer = require('discourse/models/composer').default;

      return controllers.composer.open({
        action: Composer.PRIVATE_MESSAGE,
        usernames: this.get("attendees").join(','),
        archetypeId: 'private_message',
        draftKey: 'new_private_message',
        reply: ''
      });
    },

    toggleOption(option) {
      if (this.get("isClosed")) { return; }
      if (!this.currentUser) { return this.send("showLogin"); }

      const wasSelected = option.get("selected");

      if (!this.get("isMultiple")) {
        this.get("signup.options").forEach(o => o.set("selected", false));
      }

      option.set("selected", !wasSelected);

      //if (!this.get("isMultiple") && !wasSelected) { this.send("castVotes"); }
    },

    castVotes() {
      if (!this.get("canCastVotes")) { return; }
      if (!this.currentUser) { return this.send("showLogin"); }

      this.set("loading", true);

      ajax("/signups/vote", {
        type: "PUT",
        data: {
          post_id: this.get("post.id"),
          signup_name: this.get("signup.name"),
          options: this.get("selectedOptions"),
        }
      }).then(results => {
        this.setProperties({ vote: results.vote });
        this.set("model", Em.Object.create(results.signup));
      }).catch(() => {
        bootbox.alert(I18n.t("signup.error_while_casting_votes"));
      }).finally(() => {
        this.set("loading", false);
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

            ajax("/signups/toggle_status", {
              type: "PUT",
              data: {
                post_id: self.get("post.id"),
                signup_name: self.get("signup.name"),
                status: self.get("isClosed") ? "open" : "closed",
              }
            }).then(results => {
              self.set("model", Em.Object.create(results.signup));
            }).catch(() => {
              bootbox.alert(I18n.t("signup.error_while_toggling_status"));
            }).finally(() => {
              self.set("loading", false);
            });
          }
        }
      );

    },
  }

});
