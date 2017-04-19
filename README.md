# ember-cli-deploy-consul-kv-index

> An ember-cli-deploy plugin to upload and manage index.html in a Consul key/value store

This plugin uploads a file, presumably index.html, to a specified Consul KV
store.

More often than not this plugin will be used in conjunction with the [lightning
method of deployment][1] where the ember application assets will be served from
S3 and the index.html file will be served from Consul. However, it can be used
to upload any file to a Consul store.

## What is an ember-cli-deploy plugin?

A plugin is an addon that can be executed as a part of the ember-cli-deploy
pipeline. A plugin will implement one or more of the ember-cli-deploy's pipeline
hooks.

For more information on what plugins are and how they work, please refer to the
[Plugin Documentation][2].

## Quick Start
To get up and running quickly, do the following:

- Ensure [ember-cli-deploy-build][4] is installed and configured.

- Install this plugin

```bash
$ ember install ember-cli-deploy-consul-kv-index
```

- Place the following configuration into `config/deploy.js`

```javascript
ENV['consul-kv-index'] = {
  host: '<your-consul-host>',
  port: <your-consul-port>
}
```

- Run the pipeline

```bash
$ ember deploy production
```

## Installation
Run the following command in your terminal:

```bash
ember install ember-cli-deploy-consul-kv-index
```

## ember-cli-deploy Hooks Implemented

For detailed information on what plugin hooks are and how they work, please
refer to the [Plugin Documentation][2].

- `setup`
- `configure`
- `upload`
- `activate`

## Configuration Options

For detailed information on how configuration of plugins works, please refer to
the [Plugin Documentation][2].

### host

The Consul host.

*Default:* `'localhost'`

### port

The Consul port.

*Default:* `8500`

### secure

Whether or not to enable HTTPS.

*Default:* `true`

### token

An ACL token to be included with each request to Consul.

*Default:* `null`

### filePattern

A file matching this pattern will be uploaded to Consul.

*Default:* `'index.html'`

### distDir

The root directory where the file matching `filePattern` will be searched for.
By default, this option will use the `distDir` property of the deployment
context.

*Default:* `context.distDir` if it exists, otherwise `tmp/deploy-dist`

### namespaceToken

The namespace to be used for the Consul key under which the file will be
uploaded to Consul. By default this option will use the `project.name()`
property from the deployment context.

*Default:* `context.project.name() || 'missing-namespace'`

### revisionKey

The unique revision number for the version of the file being uploaded to Consul.
This property will be used in conjunction with the `namespaceToken` to generate
the revision and metadata keys like so:

- `<namespace-token>/revisions/<revision-key>`
- `<namespace-token>/revisions/<revision-key>/metadata`

By default this option will use the `revisionData.revisionKey` property from the
deployment context.

*Default:* `context.revisionData.revisionKey || 'missing-revision-key'`

### revisionKeyToActivate

The unique revision number for the version of the file to be activated. By
default this option will use the `revision` argument passed in from the command
line, accessible by the `commandOptions.revision` property from the deployment
context.

*Default:* `this.readConfig('revisionKey')` if `--activate` passed to command. Otherwise `context.commandOptions.revision`

### aliases

A list of aliases that you'd like this revision to be linked to. This allows
lightning servers to look up revisions based on other alises. You might want to
do this if you'd like to refer to a revision by a git branch or ticket number
which would be a rolling alias to a specific revision at any one point in time.
Setting this property will make the following keys available:

- `<namespace>/revisions/<revision-key>/aliases #=> 'foo,bar'`
- `<namespace>/aliases/foo #=> '<revision-key>'`
- `<namespace>/aliases/bar #=> '<revision-key>'`

This way you can look up a list of aliases for a revision key, and also look up a revision key for an alias.

*Default:* `[]`

### recentRevisionsToken

The suffix to be used for the Consul key under which the recent revisions will
be stored. By default this option will be `"recent-revisions"`. This means, the
default recent revisions key will look like so:

`<namespace-token>/recent-revisions`

*Default:* `recent-revisions`

### activeRevisionToken

The suffix to be used for the Consul key under which the active revision will be
stored. By default this option will be `"active-revision"`. This means, the
default active revision key will look like so:

`<namespace-token>/active-revision`

*Default:* `active-revision`

### metadata

A JSON object containing metadata about the current revision, to be stored in
Consul. By default this property will be set to the `revisionData` property on
the context object if it's available. This metatda will be stored in a key as
follows:

`<namespace-token>/revisions/<revision-key>/metadata`

*Default:* `context.revisionData || {}`

### allowOverwrite

A flag to specify whether the revision should be overwritten if it already
exists in Consul.

*Default:* `true`

### maxRevisions

The maximum number of recent revisions to keep in Consul.

*Default:* `10`

## Activation

As well as uploading a file to Consul, *ember-cli-deploy-consul-kv-index* has
the ability to mark a revision of a deployed file as `active`. This is most
commonly used in the [lightning method of deployment][1] whereby an index.html
file is pushed to Consul and then served to the user by a web server. The web
server could be configured to return any existing revision of the index.html
file as requested by a query parameter. However, the revision marked as the
currently `active` revision would be returned if no query paramter is present.
For more detailed information on this method of deployment please refer to the
[ember-cli-deploy-lightning-pack README][1].

### How do I activate a revision?

A user can activate a revision by either:

- Passing a command line argument to the `deploy` command:

```bash
$ ember deploy --activate=true
```

- Running the `deploy:activate` command:

```bash
$ ember deploy:activate <revision-key>
```

- Setting the `activateOnDeploy` flag in `deploy.js`

```javascript
ENV.pipeline = {
  activateOnDeploy: true
}
```

### What does activation do?

When *ember-cli-deploy-consul-kv-index* uploads a file to Consul, it uploads it
under the key defined by a combination of the two config properties
`namespaceToken` and `revisionKey`.

So, if the `namespaceToken` was configured to be `my-app` and there had been 3
revisons deployed, then Consul might look something like this:

```bash
$ curl -X GET http://localhost:8500/v1/kv/my-app?keys

["my-app/recent-revisions", "my-app/revisions/9ab2021411f0cbc5ebd5ef8ddcd85cef",
"my-app/revisions/499f5ac793551296aaf7f1ec74b2ca79",
"my-app/revisions/f769d3afb67bd20ccdb083549048c86c"]
```

Activating a revison would add a new entry to Consul pointing to the currently
active revision:

```bash
$ ember deploy:activate f769d3afb67bd20ccdb083549048c86c

$ curl -X GET http://localhost:8500/v1/kv/my-app?keys

["my-app/recent-revisions", "my-app/revisions/9ab2021411f0cbc5ebd5ef8ddcd85cef",
"my-app/revisions/499f5ac793551296aaf7f1ec74b2ca79",
"my-app/revisions/f769d3afb67bd20ccdb083549048c86c", "my-app/active-revision"]

$ curl -X GET http://localhost:8500/v1/kv/my-app/active-revision?raw
f769d3afb67bd20ccdb083549048c86c
```

### When does activation occur?

Activation occurs during the `activate` hook of the pipeline. By default,
activation is turned off and must be explicitly enabled by one of the 3 methods
above.

## Listing Revisions

Another helpful part of the [lightning method of deployment][1] is using
[ember-cli-deploy-display-revisions][8] to quickly review previously deployed
revisions in your Consul instance.

### How do I display the revisions deployed to my Consul instance?

First, install the [ember-cli-deploy-display-revisions][8] plugin:

```
ember install ember-cli-deploy-display-revisions
```

Then use the following command:

```
$ ember deploy:list <environment>

- revision
- =============
- > f769d3afb67bd20ccdb083549048c86c
-   9ab2021411f0cbc5ebd5ef8ddcd85cef
-   499f5ac793551296aaf7f1ec74b2ca79
```

## Prerequisites

The following properties are expected to be present on the deployment `context`
object:

- `distDir`                     (provided by [ember-cli-deploy-build][4])
- `project.name()`              (provided by [ember-cli-deploy][5])
- `revisionData.revisionKey`    (provided by
  [ember-cli-deploy-revision-data][6])
- `commandOptions.revision`     (provided by [ember-cli-deploy][5])

## Running Tests

- `npm test`

<p align="center"><sub>Made with :heart: by The Kayako Engineering Team</sub></p>

[1]: https://github.com/lukemelia/ember-cli-deploy-lightning-pack
"ember-cli-deploy-lightning-pack"
[2]: http://ember-cli-deploy.com/plugins "Plugin Documentation"
[3]: https://github.com/silas/node-consul "Node Consul Client"
[4]: https://github.com/ember-cli-deploy/ember-cli-deploy-build
"ember-cli-deploy-build"
[5]: https://github.com/ember-cli/ember-cli-deploy "ember-cli-deploy"
[6]: https://github.com/ember-cli-deploy/ember-cli-deploy-revision-data
"ember-cli-deploy-revision-data"
[7]: https://github.com/ember-cli-deploy/ember-cli-deploy-ssh-tunnel
"ember-cli-deploy-ssh-tunnel"
[8]: https://github.com/ember-cli-deploy/ember-cli-deploy-display-revisions
"ember-cli-deploy-display-revisions"
