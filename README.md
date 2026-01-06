A moderation tool used for removing and locking an entire comment tree, starting either with a single comment or at an entire post level.

Run Comment Mop using the three-dot menu or mod shield menu (depending on platform) and chose the "Mop" option. You can opt to remove and/or lock, and skip mod-distinguished comments if desired.

From version 9.2, you can configure the default options for the Mop form in your app settings, which you can find via the [Developer Platform app portal](https://developers.reddit.com/my/communities).

Mopping extremely large chains can fail, if this happens please try again, ensuring that the option to skip already actioned comments is enabled.

## Credits

This app was originally written by /u/FlyingLaserTurtle, with contributions from /u/ni5arga.

For support for Comment Mop, please contact /u/fsv (the current maintainer) rather than either of the above users.

## Source code and license

Comment Mop is open source and licensed under the BSD Three Clause license. [The source code is available on GitHub here](https://github.com/fsvreddit/comment-nuke).

## Change History

### v9.2.3

* More reliable mopping of extremely large threads

### v9.2.0

* Fix an error that causes Comment Mop to fail consistently for certain users
* The ability to set defaults for the Comment Mop form if the default values don't suit your sub's workflow
* Add new option to skip comments that have already been removed/locked
* Performance and reliability improvements
* Update to latest Dev Platform version
