const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    libraryTarget: 'module',
  },
  experiments: {
    outputModule: true,
  },
  mode: 'production',
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'AudioProcessor.js', to: '.' },
        { from: 'descriptor.json', to: '.' },
        { from: 'shaders', to: 'shaders' },
      ],
    }),
  ],
};
