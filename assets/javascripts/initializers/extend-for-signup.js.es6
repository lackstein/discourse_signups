import PostView from "discourse/views/post";
import { onToolbarCreate } from 'discourse/components/d-editor';

function createSignupView(container, post, signup, vote) {
  const controller = container.lookup("controller:signup", { singleton: false }),
        view = container.lookup("view:signup");

  controller.set("vote", vote);
  controller.setProperties({ model: Em.Object.create(signup), post });
  view.set("controller", controller);

  return view;
}

export default {
  name: "extend-for-signup",

  initialize(container) {
    // Add button to markdown editor
    const composer = container.lookup("controller:composer");
    onToolbarCreate(toolbar => {
      toolbar.addButton({
        id: 'wmd-signup-button',
        group: "extras",
        description: 'Add a signup form to your post',
        execute: function() {
          return composer.appendTextAtCursor("\n[signup type=multiple]\n- option 1\n- option 2\n[/signup]\n");
        }
      });
    });

    const messageBus = container.lookup("message-bus:main");

    // listen for back-end to tell us when a post has a signup
    messageBus.subscribe("/signups", data => {
      const post = container.lookup("controller:topic").get('model.postStream').findLoadedPost(data.post_id);
      // HACK to trigger the "postViewUpdated" event
      Em.run.next(_ => post.set("cooked", post.get("cooked") + " "));
    });

    // overwrite signups
    PostView.reopen({
      _createSignupViews: function($post) {
        const post = this.get("post"),
              signups = post.get("signups"),
              votes = post.get("signups_votes") || {};

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
          Em.run.next(_ => signupView.renderer.replaceIn(signupView, $div[0]));
          signupViews[signupName] = signupView;
        });

        messageBus.subscribe("/signups/" + this.get("post.id"), results => {
          if (results && results.signups) {
            _.forEach(results.signups, signup => {
              if (signupViews[signup.name]) {
                signupViews[signup.name].get("controller").set("model", Em.Object.create(signup));
              }
            });
          }
        });

        this.set("signupViews", signupViews);
      }.on("postViewInserted", "postViewUpdated"),

      _cleanUpSignupViews: function() {
        messageBus.unsubscribe("/signups/" + this.get("post.id"));

        if (this.get("signupViews")) {
          _.forEach(this.get("signupViews"), v => v.destroy());
        }
      }.on("willClearRender")
    });
  }
};
