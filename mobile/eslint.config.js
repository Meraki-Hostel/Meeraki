// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'src/contract/domain.ts', 'src/contract/interfaces.ts']),
  expoConfig,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': ['error',
        { selector: "CallExpression[callee.name='alert']", message: 'Use Alert.alert or an inline Notice.' }],
    },
  },
]);
