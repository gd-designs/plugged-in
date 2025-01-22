const path = require("path");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

module.exports = (env, argv) => ({
  mode: argv.mode === "production" ? "production" : "development",

  // This is necessary because Figma's 'eval' works differently than normal eval
  devtool: argv.mode === "production" ? false : "inline-source-map",

  entry: {
    code: "./src/code.ts", // Backend logic
  },

  module: {
    rules: [
      // Converts TypeScript code to JavaScript
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      // Allows importing and bundling CSS files (required for Monaco Editor)
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      // Allows importing and bundling font files (required for Monaco Editor)
      {
        test: /\.ttf$/,
        use: ["file-loader"],
      },
    ],
  },

  resolve: {
    extensions: [".ts", ".js"], // Resolve imports without specifying extensions
  },

  output: {
    filename: "[name].js", // Generates files matching entry point names
    path: path.resolve(__dirname, "dist"),
  },

  plugins: [
    new MonacoWebpackPlugin({
      languages: ["javascript", "html", "typescript"], // Include only necessary languages
      features: ["!gotoSymbol"], // Optional: disable features to reduce bundle size
    }),
  ],
});
