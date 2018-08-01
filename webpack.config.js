const webpack = require('webpack');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

const entry = file => ['source-map-support/register', file];

module.exports = {
  mode: 'production',
  entry: {
    transfer: entry('./functions/transfer'),
  },
  target: 'node',
  externals: {
    'aws-sdk': 'aws-sdk',
  },
  output: {
    libraryTarget: 'commonjs2',
    path: `${__dirname}/out`,
    filename: '[name].js',
  },
  plugins: [
    new webpack.SourceMapDevToolPlugin({
      filename: '[file].map',
      append: '\n//# sourceMappingURL=./[url]',
    }),
    new UglifyJSPlugin({
      parallel: true,
      cache: true,
      sourceMap: true,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: ['babel-loader'],
        exclude: /node_modules/,
      },
    ],
  },
};
