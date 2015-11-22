# name: signups
# about: Create signup options for events
# version: 0.3
# authors: Noah Lackstein, based on work by Vikhyat Korrapati (vikhyat), Régis Hanol (zogstrip)
# url: https://github.com/lackstein/discourse_signups

enabled_site_setting :signup_enabled

register_asset "stylesheets/common/signup.scss"
register_asset "stylesheets/desktop/signup.scss", :desktop
register_asset "stylesheets/mobile/signup.scss", :mobile

register_asset "javascripts/signup_dialect.js", :server_side

PLUGIN_NAME ||= "discourse_signups".freeze

SIGNUPS_CUSTOM_FIELD ||= "signups".freeze
VOTES_CUSTOM_FIELD ||= "signups-votes".freeze

after_initialize do

  # remove "Vote Now!" & "Show Results" links in emails
  Email::Styles.register_plugin_style do |fragment|
    fragment.css(".signup a.cast-votes, .signup a.toggle-results").each(&:remove)
  end

  module ::DiscourseSignups
    class Engine < ::Rails::Engine
      engine_name PLUGIN_NAME
      isolate_namespace DiscourseSignups
    end
  end

  class DiscourseSignups::Signup
    class << self

      def vote(post_id, signup_name, options, user_id)
        DistributedMutex.synchronize("#{PLUGIN_NAME}-#{post_id}") do
          post = Post.find_by(id: post_id)
          user = User.find_by(id: user_id)

          # post must not be deleted
          if post.nil? || post.trashed?
            raise StandardError.new I18n.t("signup.post_is_deleted")
          end

          # topic must be open
          if post.topic.try(:closed) || post.topic.try(:archived)
            raise StandardError.new I18n.t("signup.topic_must_be_open_to_vote")
          end

          signups = post.custom_fields[SIGNUPS_CUSTOM_FIELD]

          raise StandardError.new I18n.t("signup.no_signups_associated_with_this_post") if signups.blank?

          signup = signups[signup_name]

          raise StandardError.new I18n.t("signup.no_signup_with_this_name", name: signup_name) if signup.blank?
          raise StandardError.new I18n.t("signup.signup_must_be_open_to_vote") if signup["status"] != "open"

          # remove options that aren't available in the signup
          available_options = signup["options"].map { |o| o["id"] }.to_set
          options.select! { |o| available_options.include?(o) }

          #raise StandardError.new I18n.t("signup.requires_at_least_1_valid_option") if options.empty?

          votes = post.custom_fields["#{VOTES_CUSTOM_FIELD}-#{user_id}"] || {}
          vote = votes[signup_name] || []

          # increment counters only when the user hasn't casted a vote yet
          signup["voters"] += 1 if vote.size == 0 && !options.empty?
          # Decrement when cancelling a vote
          signup["voters"] -= 1 if vote.size != 0 && options.empty?

          votes[signup_name] = options
          post.custom_fields["#{VOTES_CUSTOM_FIELD}-#{user_id}"] = votes
          
          all_votes = post.custom_fields.select { |field| field =~ /^#{VOTES_CUSTOM_FIELD}-\d+/ }
          signup_votes = all_votes.map { |voter, signup_sheets| { user: User.find(voter.split("-").last), votes: signup_sheets[signup_name] } }

          signup["options"].each do |option|
            # Decrement counter if user had previously chosen this option
            option["votes"] -= 1 if vote.include?(option["id"])
            # (Re)increment counter if user (still) chose this option
            option["votes"] += 1 if options.include?(option["id"])
            
            # Rebuild list of users that have voted for this option
            option["voters"] = signup_votes.select { |ballot| ballot[:votes].include? option["id"] }.map { |ballot| ballot[:user].username } rescue []
          end

          post.custom_fields[SIGNUPS_CUSTOM_FIELD] = signups
          post.save_custom_fields(true)
          
          # Automatically subscribe the voter to notifications about the event
          # TopicUser.change(user, post.topic.id, notification_level: TopicUser.notification_levels[:watching])

          MessageBus.publish("/signups/#{post_id}", { signups: signups })

          return [signup, options]
        end
      end

      def toggle_status(post_id, signup_name, status, user_id)
        DistributedMutex.synchronize("#{PLUGIN_NAME}-#{post_id}") do
          post = Post.find_by(id: post_id)

          # post must not be deleted
          if post.nil? || post.trashed?
            raise StandardError.new I18n.t("signup.post_is_deleted")
          end

          # topic must be open
          if post.topic.try(:closed) || post.topic.try(:archived)
            raise StandardError.new I18n.t("signup.topic_must_be_open_to_toggle_status")
          end

          user = User.find_by(id: user_id)

          # either staff member or OP
          unless user_id == post.user_id || user.try(:staff?)
            raise StandardError.new I18n.t("signup.only_staff_or_op_can_toggle_status")
          end

          signups = post.custom_fields[SIGNUPS_CUSTOM_FIELD]

          raise StandardError.new I18n.t("signup.no_signups_associated_with_this_post") if signups.blank?
          raise StandardError.new I18n.t("signup.no_signup_with_this_name", name: signup_name) if signups[signup_name].blank?

          signups[signup_name]["status"] = status

          post.save_custom_fields(true)

          MessageBus.publish("/signups/#{post_id}", { signups: signups })

          signups[signup_name]
        end
      end

      def extract(raw, topic_id)
        # TODO: we should fix the callback mess so that the cooked version is available
        # in the validators instead of cooking twice
        cooked = PrettyText.cook(raw, topic_id: topic_id)
        parsed = Nokogiri::HTML(cooked)

        extracted_signups = []

        # extract signups
        parsed.css("div.signup").each do |p|
          signup = { "options" => [], "voters" => 0 }

          # extract attributes
          p.attributes.values.each do |attribute|
            if attribute.name.start_with?(DATA_PREFIX)
              signup[attribute.name[DATA_PREFIX.length..-1]] = attribute.value
            end
          end

          # extract options
          p.css("li[#{DATA_PREFIX}option-id]").each do |o|
            option_id = o.attributes[DATA_PREFIX + "option-id"].value
            signup["options"] << { "id" => option_id, "html" => o.inner_html, "votes" => 0, "voters" => [] }
          end

          # add the signup
          extracted_signups << signup
        end

        extracted_signups
      end
    end
  end

  require_dependency "application_controller"
  class DiscourseSignups::SignupsController < ::ApplicationController
    requires_plugin PLUGIN_NAME

    before_filter :ensure_logged_in

    def vote
      post_id   = params.require(:post_id)
      signup_name = params.require(:signup_name)
      params[:options] ||= []
      options   = params.permit(options: [])
      user_id   = current_user.id
      
      logger.error "SIGNUP ERROR: #{options.inspect}"
      
      begin
        signup, options = DiscourseSignups::Signup.vote(post_id, signup_name, options, user_id)
        render json: { signup: signup, vote: options }
      rescue StandardError => e
        logger.error "SIGNUP ERROR: #{e.message}"
        render_json_error e.message
      end
    end

    def toggle_status
      post_id   = params.require(:post_id)
      signup_name = params.require(:signup_name)
      status    = params.require(:status)
      user_id   = current_user.id

      begin
        signup = DiscourseSignups::Signup.toggle_status(post_id, signup_name, status, user_id)
        render json: { signup: signup }
      rescue StandardError => e
        render_json_error e.message
      end
    end

  end

  DiscourseSignups::Engine.routes.draw do
    put "/vote" => "signups#vote"
    put "/toggle_status" => "signups#toggle_status"
  end

  Discourse::Application.routes.append do
    mount ::DiscourseSignups::Engine, at: "/signups"
  end

  Post.class_eval do
    attr_accessor :signups

    after_save do
      next if self.signups.blank? || !self.signups.is_a?(Hash)

      post = self
      signups = self.signups

      DistributedMutex.synchronize("#{PLUGIN_NAME}-#{post.id}") do
        post.custom_fields[SIGNUPS_CUSTOM_FIELD] = signups
        post.save_custom_fields(true)
      end
    end
  end

  DATA_PREFIX ||= "data-signup-".freeze
  DEFAULT_SIGNUP_NAME ||= "signup".freeze

  validate(:post, :validate_signups) do
    # only care when raw has changed!
    return unless self.raw_changed?

    signups = {}

    extracted_signups = DiscourseSignups::Signup::extract(self.raw, self.topic_id)

    extracted_signups.each do |signup|
      # signups should have a unique name
      if signups.has_key?(signup["name"])
        signup["name"] == DEFAULT_SIGNUP_NAME ?
          self.errors.add(:base, I18n.t("signup.multiple_signups_without_name")) :
          self.errors.add(:base, I18n.t("signup.multiple_signups_with_same_name", name: signup["name"]))
        return
      end

      # options must be unique
      if signup["options"].map { |o| o["id"] }.uniq.size != signup["options"].size
        signup["name"] == DEFAULT_SIGNUP_NAME ?
          self.errors.add(:base, I18n.t("signup.default_signup_must_have_different_options")) :
          self.errors.add(:base, I18n.t("signup.named_signup_must_have_different_options", name: signup["name"]))
        return
      end

      # maximum # of options
      if signup["options"].size > SiteSetting.signup_maximum_options
        signup["name"] == DEFAULT_SIGNUP_NAME ?
          self.errors.add(:base, I18n.t("signup.default_signup_must_have_less_options", max: SiteSetting.signup_maximum_options)) :
          self.errors.add(:base, I18n.t("signup.named_signup_must_have_less_options", name: signup["name"], max: SiteSetting.signup_maximum_options))
        return
      end

      # signup with multiple choices
      if signup["type"] == "multiple"
        min = (signup["min"].presence || 1).to_i
        max = (signup["max"].presence || signup["options"].size).to_i

        if min > max || max <= 0 || max > signup["options"].size || min >= signup["options"].size
          signup["name"] == DEFAULT_SIGNUP_NAME ?
            self.errors.add(:base, I18n.t("signup.default_signup_with_multiple_choices_has_invalid_parameters")) :
            self.errors.add(:base, I18n.t("signup.named_signup_with_multiple_choices_has_invalid_parameters", name: signup["name"]))
          return
         end
      end

      # store the valid signup
      signups[signup["name"]] = signup
    end

    # are we updating a post?
    if self.id.present?
      post = self
      DistributedMutex.synchronize("#{PLUGIN_NAME}-#{post.id}") do
        # load previous signups
        previous_signups = post.custom_fields[SIGNUPS_CUSTOM_FIELD] || {}
        
        # extract options
        current_options = signups.values.map { |p| p["options"].map { |o| o["id"] } }.flatten.sort
        previous_options = previous_signups.values.map { |p| p["options"].map { |o| o["id"] } }.flatten.sort

        # are the signups different?
        if signups.keys != previous_signups.keys || current_options != previous_options
          
          has_votes = previous_signups.keys.map { |p| previous_signups[p]["voters"].to_i }.sum > 0

          # outside of the 5-minute edit window?
          if post.created_at < 5.minutes.ago && has_votes
            # cannot add/remove/rename signups
            if signups.keys.sort != previous_signups.keys.sort
              post.errors.add(:base, I18n.t("signup.cannot_change_signups_after_5_minutes"))
              return
            end

            # deal with option changes
            if User.staff.pluck(:id).include?(post.last_editor_id)
              # staff can only edit options
              signups.each_key do |signup_name|
                if signups[signup_name]["options"].size != previous_signups[signup_name]["options"].size && previous_signups[signup_name]["voters"].to_i > 0
                  post.errors.add(:base, I18n.t("signup.staff_cannot_add_or_remove_options_after_5_minutes"))
                  return
                end
              end
            else
              # OP cannot edit signup options
              post.errors.add(:base, I18n.t("signup.op_cannot_edit_options_after_5_minutes"))
              return
            end
          end

          # try to merge votes
          signups.each_key do |signup_name|
            next unless previous_signups.has_key?(signup_name)

            # when the # of options has changed, reset all the votes
            if signups[signup_name]["options"].size != previous_signups[signup_name]["options"].size
              PostCustomField.where(post_id: post.id)
                             .where("name LIKE '#{VOTES_CUSTOM_FIELD}-%'")
                             .destroy_all
              post.clear_custom_fields
              next
            end

            signups[signup_name]["voters"] = previous_signups[signup_name]["voters"]
            for o in 0...signups[signup_name]["options"].size
              signups[signup_name]["options"][o]["votes"] = previous_signups[signup_name]["options"][o]["votes"]
            end
          end

          # immediately store the signups
          post.custom_fields[SIGNUPS_CUSTOM_FIELD] = signups
          post.save_custom_fields(true)

          # publish the changes
          MessageBus.publish("/signups/s/#{post.id}", { signups: signups })
        end
      end
    else
      self.signups = signups
    end

    true
  end

  Post.register_custom_field_type(SIGNUPS_CUSTOM_FIELD, :json)
  Post.register_custom_field_type("#{VOTES_CUSTOM_FIELD}-*", :json)

  TopicView.add_post_custom_fields_whitelister do |user|
    whitelisted = [SIGNUPS_CUSTOM_FIELD]
    whitelisted << "#{VOTES_CUSTOM_FIELD}-#{user.id}" if user
    whitelisted
  end

  # tells the front-end we have a signup for that post
  on(:post_created) do |post|
    next if post.is_first_post? || post.custom_fields[SIGNUPS_CUSTOM_FIELD].blank?
    MessageBus.publish("/signups", { post_id: post.id })
  end

  add_to_serializer(:post, :signups, false) { post_custom_fields[SIGNUPS_CUSTOM_FIELD] }
  add_to_serializer(:post, :include_signups?) { post_custom_fields.present? && post_custom_fields[SIGNUPS_CUSTOM_FIELD].present? }

  add_to_serializer(:post, :signups_votes, false) { post_custom_fields["#{VOTES_CUSTOM_FIELD}-#{scope.user.id}"] }
  add_to_serializer(:post, :include_signups_votes?) { scope.user && post_custom_fields.present? && post_custom_fields["#{VOTES_CUSTOM_FIELD}-#{scope.user.id}"].present? }
end
