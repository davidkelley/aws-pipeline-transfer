module.exports = {
  prepare: [
    {
      'path': '@semantic-release/changelog',
      'changelogFile': 'CHANGELOG.md',
    },
    '@semantic-release/git'
  ],
  publish: [
    {
      'path': '@semantic-release/exec',
      'cmd': 'aws serverlessrepo create-application-version --cli-input-json file://create-application-version.json --template-body file://packaged.yml --semantic-version ${nextRelease.version}',
    },
    '@semantic-release/github',
  ],
}
