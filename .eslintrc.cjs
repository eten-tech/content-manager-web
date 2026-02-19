module.exports = {
    root: true,
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:svelte/recommended', 'prettier'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'svelte-translate-check'],
    parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2020,
        extraFileExtensions: ['.svelte'],
    },
    env: {
        browser: true,
        es2017: true,
        node: true,
    },
    overrides: [
        {
            files: ['*.svelte'],
            parser: 'svelte-eslint-parser',
            parserOptions: {
                parser: '@typescript-eslint/parser',
                svelteFeatures: {
                    experimentalGenerics: true,
                },
            },
        },
    ],
    rules: {
        'require-await': 'error',
        'svelte/no-at-html-tags': 0,
        'svelte/require-each-key': 'error',
        eqeqeq: ['error', 'always'],
        'no-console': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'svelte-translate-check/missing-translations': 'error',
        '@typescript-eslint/no-non-null-assertion': 'off',
    },
};
