const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  mode: 'development',
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
      },
      {
        test: /\.html$/,
        loader: "html-loader"
      },
      {
        test: /\.css$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: { url: false },
          }
        ]
      },
      {
        test: /\.wav$/,
        type: 'asset/resource'
      },
    ]
  },
  resolve: {
    extensions: [
      '.ts'
    ]
  },
  output: {
    filename: 'bundle.js',
    path: path.join(__dirname, 'dist')
  },
  devServer: {
    compress: true,
    port: 8080,
    open: true,
    static: {
      directory: "./dist/index.html",
    }
  },
  plugins: [
    new HtmlWebpackPlugin({ template: "./src/index.html" })
  ],
  resolve: {
		extensions: ['.ts', '.js'],
		alias: { path: 'path-browserify' }
	}
};