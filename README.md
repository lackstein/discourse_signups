# Event Signup Sheet for Discourse

This is a modified polls plugin that shows the usernames of everyone that selected each option.
![Signup Sheet Example](http://i.imgur.com/1FR6oiC.png)

It has all the same basic features that are included in the default poll plugin, such as single
and multiple choice signups, and min/max number of selections for multiple signups.

There are also some additional goodies, like the ability to remove your vote and unsignup for
an event. There's also a button to automatically start a private message with everyone that
has signed up.

It also adds a calendar button to the text editor that automatically adds the markup for a
signup sheet to the post you're editing.
![Markup Example](http://i.imgur.com/aJI7Dey.png)

## Usage
Pretty much identical to the official polls plugin, just with 'signup' substituted for 'poll'

Example:
```bbcode
[signup type=multiple min=2 max=4]
- option 1
- option 2
- option 3
- option 4
[/signup]
```

Type, min, and max can all be ommitted, and you'll get a signup sheet that only allows one
option to be selected. Min and max are both optional for `type=multiple`.
