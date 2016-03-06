import { withPluginApi } from 'discourse/lib/plugin-api';
import { onToolbarCreate } from 'discourse/components/d-editor';

function createSignupView(container, post, signup, vote) {
  const controller = container.lookup("controller:signup", { singleton: false });
  const view = container.lookup("view:signup");

  controller.set("vote", vote);
  controller.setProperties({ model: signup, post });
  view.set("controller", controller);

  return view;
}

let _signupViews;

function initializeSignups(api) {

  const TopicController = api.container.lookupFactory('controller:topic');
  TopicController.reopen({
    subscribe(){
        this._super();
        this.messageBus.subscribe("/signups/" + this.get("model.id"), msg => {
          const post = this.get('model.postStream').findLoadedPost(msg.post_id);
          if (post) {
            post.set('signups', msg.signups);
          }
      });
    },
    unsubscribe(){
      this.messageBus.unsubscribe('/signups/*');
      this._super();
    }
  });

  const Post = api.container.lookupFactory('model:post');
  Post.reopen({
    _signups: null,
    signupsObject: null,

    // we need a proper ember object so it is bindable
    signupsChanged: function(){
      const signups  = this.get("signups");
      if (signups) {
        this._signups = this._signups || {};
        _.map(signups, (v,k) => {
          const existing = this._signups[k];
          if (existing) {
            this._signups[k].setProperties(v);
          } else {
            this._signups[k] = Em.Object.create(v);
          }
        });
        this.set("signupsObject", this._signups);
      }
    }.observes("signups")
  });

  function cleanUpSignupViews() {
    if (_signupViews) {
      Object.keys(_signupViews).forEach(signupName => _signupViews[signupName].destroy());
    }
    _signupViews = null;
  }

  function createSignupViews($elem, helper) {
    const $signups = $('.signup', $elem);
    if (!$signups.length) { return; }

    const post = helper.getModel();
    const votes = post.get('signups_votes') || {};

    post.signupsChanged();

    const signups = post.get("signupsObject");
    if (!signups) { return; }

    cleanUpSignupViews();
    const postSignupViews = {};

    $signups.each((idx, signupElem) => {
      const $div = $("<div>");
      const $signup = $(signupElem);

      const signupName = $signup.data("signup-name");
      const signupView = createSignupView(helper.container, post, signups[signupName], votes[signupName]);

      $signup.replaceWith($div);
      Em.run.next(() => signupView.renderer.replaceIn(signupView, $div[0]));
      postSignupViews[signupName] = signupView;
    });

    _signupViews = postSignupViews;
  }

  api.decorateCooked(createSignupViews, { onlyStream: true });
  api.cleanupStream(cleanUpSignupViews);
}

export default {
  name: "extend-for-signup",

  initialize() {
    withPluginApi('0.1', initializeSignups);

    // Add button to markdown editor
    onToolbarCreate(toolbar => {
      toolbar.addButton({
        id: 'signup-button',
        group: "extras",
        icon: "calendar-o",
        description: 'Add a signup form to your post',
        perform: e => e.addText("\n[signup type=multiple]\n- option 1\n- option 2\n[/signup]\n")
      });
    });
  }
};
