import computed from 'ember-addons/ember-computed-decorators';
import SignupVoters from 'discourse/plugins/signup/components/signup-voters';

export default SignupVoters.extend({
  @computed("option.votes", "signupsVoters")
  canLoadMore(voters, signupsVoters) {
    return signupsVoters.length < voters;
  },

  @computed("option.usernames", "offset")
  voterIds(usernames) {
    return this._getIds(usernames);
  }
});
