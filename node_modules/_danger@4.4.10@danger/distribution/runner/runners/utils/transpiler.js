"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var json5_1 = __importDefault(require("json5"));
var debug_1 = require("../../../debug");
var disableTranspilation = process.env.DANGER_DISABLE_TRANSPILATION === "true";
var hasNativeTypeScript = false;
var hasBabel = false;
var hasBabelTypeScript = false;
var hasFlow = false;
var hasChecked = false;
var d = debug_1.debug("transpiler:setup");
// Yes, lots of linter disables, but I want to support TS/Babel/Neither correctly
exports.checkForNodeModules = function () {
    if (disableTranspilation) {
        hasChecked = true;
        d("DANGER_DISABLE_TRANSPILATION environment variable has been set to true, skipping transpilation");
        return;
    }
    try {
        require.resolve("typescript"); // tslint:disable-line
        hasNativeTypeScript = true;
    }
    catch (e) {
        d("Does not have TypeScript set up");
    }
    try {
        require.resolve("@babel/core"); // tslint:disable-line
        require("@babel/polyfill"); // tslint:disable-line
        hasBabel = true;
        try {
            require.resolve("@babel/plugin-transform-typescript"); // tslint:disable-line
            hasBabelTypeScript = true;
        }
        catch (e) {
            d("Does not have Babel 7 TypeScript set up");
        }
        try {
            require.resolve("@babel/plugin-transform-flow-strip-types"); // tslint:disable-line
            hasFlow = true;
        }
        catch (e) {
            d("Does not have Flow set up");
        }
    }
    catch (e) {
        d("Does not have Babel set up");
    }
    hasChecked = true;
};
// Now that we have a sense of what exists inside the users' node modules
exports.typescriptify = function (content) {
    var ts = require("typescript"); // tslint:disable-line
    var compilerOptions = json5_1.default.parse(fs.readFileSync("tsconfig.json", "utf8"));
    var result = ts.transpileModule(content, sanitizeTSConfig(compilerOptions));
    return result.outputText;
};
var sanitizeTSConfig = function (config) {
    if (!config.compilerOptions) {
        return config;
    }
    var safeConfig = config;
    // It can make sense to ship TS code with modules
    // for `import`/`export` syntax, but as we're running
    // the transpiled code on vanilla node - it'll need to
    // be used with plain old commonjs
    //
    // @see https://github.com/apollographql/react-apollo/pull/1402#issuecomment-351810274
    //
    if (safeConfig.compilerOptions.module) {
        safeConfig.compilerOptions.module = "commonjs";
    }
    return safeConfig;
};
exports.babelify = function (content, filename, extraPlugins) {
    var babel = require("@babel/core"); // tslint:disable-line
    if (!babel.transform) {
        return content;
    }
    var options = babel.loadOptions ? babel.loadOptions({}) : { plugins: [] };
    var fileOpts = {
        filename: filename,
        filenameRelative: filename,
        sourceMap: false,
        sourceFileName: undefined,
        sourceType: "module",
        plugins: extraPlugins.concat(options.plugins),
    };
    var result = babel.transform(content, fileOpts);
    return result.code;
};
exports.default = (function (code, filename) {
    if (!hasChecked) {
        exports.checkForNodeModules();
    }
    var filetype = path.extname(filename);
    var isModule = filename.includes("node_modules");
    if (isModule) {
        return code;
    }
    var result = code;
    if (hasNativeTypeScript && filetype.startsWith(".ts")) {
        result = exports.typescriptify(code);
    }
    else if (hasBabel && hasBabelTypeScript && filetype.startsWith(".ts")) {
        result = exports.babelify(code, filename, ["transform-typescript"]);
    }
    else if (hasBabel && filetype.startsWith(".js")) {
        result = exports.babelify(code, filename, hasFlow ? ["@babel/plugin-transform-flow-strip-types"] : []);
    }
    return result;
});
//# sourceMappingURL=transpiler.js.map