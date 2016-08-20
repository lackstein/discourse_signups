import { ajax } from 'discourse/lib/ajax';
export default Ember.Component.extend({
  layoutName: "components/signup-voters",
  tagName: 'ul',
  classNames: ["signup-voters-list"],
  isExpanded: false,
  numOfVotersToShow: 0,
  offset: 0,
  loading: false,
  signupsVoters: null,

  init() {
    this._super();
    this.set("signupsVoters", []);
  },

  _fetchUsers() {
    this.set("loading", true);

    ajax("/signups/voters.json", {
      type: "get",
      data: { usernames: this.get("usernames") }
    }).then(result => {
      if (this.isDestroyed) return;
      this.set("signupsVoters", this.get("signupsVoters").concat(result.users));
      this.incrementProperty("offset");
      this.set("loading", false);
    }).catch((error) => {
      Ember.logger.log(error);
      bootbox.alert(I18n.t('signup.error_while_fetching_voters'));
    });
  },

  _getIds(ids) {
    const numOfVotersToShow = this.get("numOfVotersToShow");
    const offset = this.get("offset");
    return ids.slice(numOfVotersToShow * offset, numOfVotersToShow * (offset + 1));
  },

  didInsertElement() {
    this._super();

    this.set("numOfVotersToShow", Math.round(this.$().width() / 25) * 2);
    if (this.get("usernames").length > 0) this._fetchUsers();
  },

  actions: {
    loadMore() {
      this._fetchUsers();
    }
  }
});
