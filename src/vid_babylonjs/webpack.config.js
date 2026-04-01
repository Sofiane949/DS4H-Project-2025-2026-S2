import path from 'path';
import { fileURLToPath } from 'url';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: './src/index.tsx',
  mode: 'development',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    library: {
      type: 'module',
    },
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
        // Force l'utilisation du fichier complet de Babylon
        'babylonjs': path.resolve(__dirname, 'node_modules/babylonjs/babylon.js')
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    // On s'assure que BABYLON est défini globalement dans le bundle
    new webpack.ProvidePlugin({
      BABYLON: 'babylonjs'
    })
  ]
};
