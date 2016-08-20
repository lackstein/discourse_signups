/*global md5 */

(function() {

  var DATA_PREFIX = "data-signup-";
  var DEFAULT_SIGNUP_NAME = "signup";

  var WHITELISTED_ATTRIBUTES = ["type", "name", "min", "max", "step", "order", "status"];

  var ATTRIBUTES_REGEX = new RegExp("(" + WHITELISTED_ATTRIBUTES.join("|") + ")=['\"]?[^\\s\\]]+['\"]?", "g");

  Discourse.Dialect.replaceBlock({
    start: /\[signup((?:\s+\w+=[^\s\]]+)*)\]([\s\S]*)/igm,
    stop: /\[\/signup\]/igm,

    emitter: function(blockContents, matches) {
      var o, contents = [];

      // post-process inside block contents
      if (blockContents.length) {
        var self = this, b;

        var postProcess = function(bc) {
          if (typeof bc === "string" || bc instanceof String) {
            var processed = self.processInline(String(bc));
            if (processed.length) {
              contents.push(["p"].concat(processed));
            }
          } else {
            contents.push(bc);
          }
        };

        while ((b = blockContents.shift()) !== undefined) {
          this.processBlock(b, blockContents).forEach(postProcess);
        }
      }

      // default signup attributes
      var attributes = { "class": "signup" };
      attributes[DATA_PREFIX + "status"] = "open";
      attributes[DATA_PREFIX + "name"] = DEFAULT_SIGNUP_NAME;

      // extract signup attributes
      (matches[1].match(ATTRIBUTES_REGEX) || []).forEach(function(m) {
        var attr = m.split("="), name = attr[0], value = attr[1];
        value = Handlebars.Utils.escapeExpression(value.replace(/["']/g, ""));
        attributes[DATA_PREFIX + name] = value;
      });

      // we might need these values later...
      var min = parseInt(attributes[DATA_PREFIX + "min"], 10),
          max = parseInt(attributes[DATA_PREFIX + "max"], 10),
          step = parseInt(attributes[DATA_PREFIX + "step"], 10);

      // generate the options when the type is "number"
      if (attributes[DATA_PREFIX + "type"] === "number") {
        // default values
        if (isNaN(min)) { min = 1; }
        if (isNaN(max)) { max = Discourse.SiteSettings.signup_maximum_options; }
        if (isNaN(step)) { step = 1; }
        // dynamically generate options
        contents.push(["bulletlist"]);
        for (o = min; o <= max; o += step) {
          contents[0].push(["listitem", String(o)]);
        }
      }

      // make sure there's only 1 child and it's a list with at least 1 option
      if (contents.length !== 1 || contents[0].length <= 1 || (contents[0][0] !== "numberlist" && contents[0][0] !== "bulletlist")) {
        return ["div"].concat(contents);
      }

      // make sure there's only options in the list
      for (o = 1; o < contents[0].length; o++) {
        if (contents[0][o][0] !== "listitem") {
          return ["div"].concat(contents);
        }
      }

      // TODO: remove non whitelisted content

      // add option id (hash)
      for (o = 1; o < contents[0].length; o++) {
        var attr = {};
        // compute md5 hash of the content of the option
        attr[DATA_PREFIX + "option-id"] = md5(JSON.stringify(contents[0][o].slice(1)));
        // store options attributes
        contents[0][o].splice(1, 0, attr);
      }

      var result = ["div", attributes],
          signup = ["div"];

      // 1 - SIGNUP CONTAINER
      var container = ["div", { "class": "signup-container" }].concat(contents);
      signup.push(container);

      // 2 - SIGNUP INFO
      var info = ["div", { "class": "signup-info" }];

      // # of voters
      info.push(["p",
                  ["span", { "class": "info-number" }, "0"],
                  ["span", { "class": "info-text"}, I18n.t("signup.voters", {
                    count: 0,
                    one: Discourse.SiteSettings.signup_voters_text_one,
                    other: Discourse.SiteSettings.signup_voters_text_other
                  })]
                ]);

      // multiple help text
      if (attributes[DATA_PREFIX + "type"] === "multiple") {
        var optionCount = contents[0].length - 1;

        // default values
        if (isNaN(min) || min < 1) { min = 1; }
        if (isNaN(max) || max > optionCount) { max = optionCount; }

        // add some help text
        var help;

        if (max > 0) {
          if (min === max) {
            if (min > 1) {
              help = I18n.t("signup.multiple.help.x_options", { count: min });
            }
          } else if (min > 1) {
            if (max < optionCount) {
              help = I18n.t("signup.multiple.help.between_min_and_max_options", { min: min, max: max });
            } else {
              help = I18n.t("signup.multiple.help.at_least_min_options", { count: min });
            }
          } else if (max <= optionCount) {
            help = I18n.t("signup.multiple.help.up_to_max_options", { count: max });
          }
        }

        if (help) { info.push(["p", help]); }
      }

      signup.push(info);

      // 3 - BUTTONS
      var buttons = ["div", { "class": "signup-buttons" }];

      // add "cast-votes" button
      if (attributes[DATA_PREFIX + "type"] === "multiple") {
        buttons.push(["a", { "class": "button cast-votes", "title": I18n.t("signup.cast-votes.title") }, I18n.t("signup.cast-votes.label")]);
      }

      // add "toggle-results" button
      buttons.push(["a", { "class": "button toggle-results", "title": I18n.t("signup.show-results.title") }, I18n.t("signup.show-results.label")]);

      // 4 - MIX IT ALL UP
      result.push(signup);
      result.push(buttons);

      return result;
    }
  });

  Discourse.Markdown.whiteListTag("div", "class", "signup");
  Discourse.Markdown.whiteListTag("div", "class", /^signup-(info|container|buttons)/);
  Discourse.Markdown.whiteListTag("div", "data-*");

  Discourse.Markdown.whiteListTag("span", "class", /^info-(number|text)/);

  Discourse.Markdown.whiteListTag("a", "class", /^button (cast-votes|toggle-results)/);

  Discourse.Markdown.whiteListTag("li", "data-*");
})();
