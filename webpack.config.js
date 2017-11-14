const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
  entry: {
    transfer: './functions/transfer',
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
    new UglifyJSPlugin(),
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: ['babel-loader'],
        exclude: /node_modules/,
      },
    ],
  },
};
