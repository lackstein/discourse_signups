import PostView from "discourse/views/post";
import TopicController from "discourse/controllers/topic";
import Post from "discourse/models/post";

import { on } from "ember-addons/ember-computed-decorators";
import { onToolbarCreate } from 'discourse/components/d-editor';

function createSignupView(container, post, signup, vote) {
  const controller = container.lookup("controller:signup", { singleton: false }),
        view = container.lookup("view:signup");

  controller.set("vote", vote);
  controller.setProperties({ model: signup, post });
  view.set("controller", controller);

  return view;
}

export default {
  name: "extend-for-signup",

  initialize(container) {
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

    Post.reopen({
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

    // overwrite signups
    PostView.reopen({
      @on("postViewInserted", "postViewUpdated")
      _createSignupViews($post) {
        const post = this.get("post"),
              votes = post.get("signups_votes") || {};

        post.signupsChanged();
        const signups = post.get("signupsObject");

        // don't even bother when there's no signup
        if (!signups) { return; }

        // clean-up if needed
        this._cleanUpSignupViews();

        const signupViews = {};

        // iterate over all signups
        $(".signup", $post).each(function() {
          const $div = $("<div>"),
                $signup = $(this),
                signupName = $signup.data("signup-name"),
                signupView = createSignupView(container, post, signups[signupName], votes[signupName]);

          $signup.replaceWith($div);
          Em.run.next(() => signupView.renderer.replaceIn(signupView, $div[0]));
          signupViews[signupName] = signupView;
        });

        this.set("signupViews", signupViews);
      },

      @on("willClearRender")
      _cleanUpSignupViews: function() {
        if (this.get("signupViews")) {
          _.forEach(this.get("signupViews"), v => v.destroy());
        }
      }
    });
  }
};
