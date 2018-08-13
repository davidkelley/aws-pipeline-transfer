module.exports = {
  prepare: [
    {
      'path': '@semantic-release/changelog',
      'changelogFile': 'CHANGELOG.md',
    },
    '@semantic-release/git'
  ],
  publish: [
    '@semantic-release/github',
  ],
}
