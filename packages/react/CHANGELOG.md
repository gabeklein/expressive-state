# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.73.1](https://github.com/gabeklein/expressive-mvc/compare/v0.73.0...v0.73.1) (2026-02-13)

### Bug Fixes

- prevent self-assignment in get function and add test for parent resolution ([cd43ba3](https://github.com/gabeklein/expressive-mvc/commit/cd43ba326356941364ed3e4170917b8f944149f9))

# [0.73.0](https://github.com/gabeklein/expressive-mvc/compare/v0.72.0...v0.73.0) (2026-02-12)

### Bug Fixes

- export Component from './component' in index.ts ([9d7c3a1](https://github.com/gabeklein/expressive-mvc/commit/9d7c3a184227d806794777b701895f9ea3c83b65))
- rename all deprecated jest matchers ([7c40666](https://github.com/gabeklein/expressive-mvc/commit/7c406666a6f82296ab25c53a700d153781664500))
- replace tsup with tsdown in react package ([d1e0eb7](https://github.com/gabeklein/expressive-mvc/commit/d1e0eb7e2d02859c48bcc69c5bd286bf062295ea))
- uncooperative builds ([fae4cb6](https://github.com/gabeklein/expressive-mvc/commit/fae4cb6ef1279f7befabdfc6d4806526f56c0c5d))

# [0.72.0](https://github.com/gabeklein/expressive-mvc/compare/v0.71.0...v0.72.0) (2026-01-25)

### Bug Fixes

- correct return statement in Model.as function ([4073b08](https://github.com/gabeklein/expressive-mvc/commit/4073b087928b62836e7b6b8df2e0ea8ec7259a66))
- correct typo in TODO comment for eager matching in model.get.ts ([449a847](https://github.com/gabeklein/expressive-mvc/commit/449a847a3b04a5a0c5e791937e5c3bc0f1ca726e))
- lower dev-dependancy version of react ([76601ed](https://github.com/gabeklein/expressive-mvc/commit/76601ed6bdf27d897c6e5f351fd9959802704c4f))
- remove .only from test for method creation ([951133c](https://github.com/gabeklein/expressive-mvc/commit/951133c7b3574d25f5b664ed22529ef0618f7d4b))
- remove Context export from index and adjust imports ([b0238a1](https://github.com/gabeklein/expressive-mvc/commit/b0238a1c128c2e93bc398ec33815424423d376a7))
- remove restriction on creating component from base Model ([01fb7fe](https://github.com/gabeklein/expressive-mvc/commit/01fb7fe847c7105bca512d10cef22960da2f20ca))
- render method will not intercept arguments from normal control flow ([c9a469d](https://github.com/gabeklein/expressive-mvc/commit/c9a469df7e63d8edcafc675f25d8ca641f4ee03e))
- replace v19 react dev dependancies across whole library and update examples ([e735c98](https://github.com/gabeklein/expressive-mvc/commit/e735c9866338522d4947dda0a170aeb42c82ed54))
- simplify component render for coverage ([d23b6c7](https://github.com/gabeklein/expressive-mvc/commit/d23b6c73d90adea958ce328022ae68b84526187b))
- simplify type checking logic in compat function ([d5a4d33](https://github.com/gabeklein/expressive-mvc/commit/d5a4d3384c2a95f61bb1337cf4c39b3188971326))
- streamline type handling in compat function for Model instances ([088aae1](https://github.com/gabeklein/expressive-mvc/commit/088aae1600e14a001a125b502aa542bac7e03264))
- update test to call is method on creation and remove unused didDestroy function ([9265fdd](https://github.com/gabeklein/expressive-mvc/commit/9265fddb112651857d2064afd4bf769fc8f959a6))
- update useMemo dependency in Context.use to ensure proper state management ([0287aa8](https://github.com/gabeklein/expressive-mvc/commit/0287aa8b99fe727d447bdd097b1d6ad74a7399cd))

### Code Refactoring

- remove explict Model.FC, rename Model.Component ([eefb5a1](https://github.com/gabeklein/expressive-mvc/commit/eefb5a1e46dca46b4bfead9237942e73ae3678d3))
- reorder type definitions for better clarity ([592ffe4](https://github.com/gabeklein/expressive-mvc/commit/592ffe457650f6bf9668a0bbbc0f0bae94445e7c))
- replace 'include' method with 'use' for context management consistency ([96c61ba](https://github.com/gabeklein/expressive-mvc/commit/96c61ba7ac72f05201e4a65fa34b0faf3d0a0b21))

- refactor!: implement use method in Model ([93ed23e](https://github.com/gabeklein/expressive-mvc/commit/93ed23e1788a0507bd927d03b16dcc3d536091d1))

### Features

- support direct passthrough of parameters from .use() to contructor ([181d1ee](https://github.com/gabeklein/expressive-mvc/commit/181d1ee803571c9e31f86fad12c8277d9bc3d147))

### BREAKING CHANGES

- Removes Model.Argument type
- Context.inlcude is not Context.use
- render method no longer implicitly called on .use()
- Deletes original Model.FC interface

# [0.71.0](https://github.com/gabeklein/expressive-mvc/compare/v0.70.0...v0.71.0) (2025-10-05)

- feat!: simplify 'is' callback handling in State interface and tests ([f77e413](https://github.com/gabeklein/expressive-mvc/commit/f77e413d5a049037b77a3cd1aedf29e2f835d1c3))

### BREAKING CHANGES

- is prop no longer accepts destroy callback

# [0.70.0](https://github.com/gabeklein/expressive-mvc/compare/v0.69.2...v0.70.0) (2025-09-15)

### Bug Fixes

- update RenderProps type to prevent passing 'is' prop to State components ([26ec4a3](https://github.com/gabeklein/expressive-mvc/commit/26ec4a3c190fde350f409537ee9869ab54df6869))

### Features

- enhance State interfaces and props for better compatibility and fallback support ([849f282](https://github.com/gabeklein/expressive-mvc/commit/849f28273291605e2c49950c8e6cc3e5b5638050))
- enhance provider and consumer functionality with fallback support ([6de2ba9](https://github.com/gabeklein/expressive-mvc/commit/6de2ba940de5769bcd745f88cef0103d9a629393))
- implement fallback prop ([d7402ca](https://github.com/gabeklein/expressive-mvc/commit/d7402ca4aa789c257f3c66ff94247cff8e6fbd89))

## [0.69.2](https://github.com/gabeklein/expressive-mvc/compare/v0.69.1...v0.69.2) (2025-09-11)

### Bug Fixes

- update Props type to omit State keys for better compatibility ([77a1cbe](https://github.com/gabeklein/expressive-mvc/commit/77a1cbef3faddeebab5f57e034ad798556a8325f))

## [0.69.1](https://github.com/gabeklein/expressive-mvc/compare/v0.69.0...v0.69.1) (2025-09-10)

**Note:** Version bump only for package @expressive/react

# [0.69.0](https://github.com/gabeklein/expressive-mvc/compare/v0.68.0...v0.69.0) (2025-09-05)

### Bug Fixes

- support assigning function components as render method ([fade81e](https://github.com/gabeklein/expressive-mvc/commit/fade81eba5a049cc1aa30366823516142bc449dc))

# [0.68.0](https://github.com/gabeklein/expressive-mvc/compare/v0.67.0...v0.68.0) (2025-08-21)

### Features

- **react:** add suspense fallback to Provider ([c334366](https://github.com/gabeklein/expressive-mvc/commit/c33436628c0bcdcec1c4b161feca225c8c248dd0))

# [0.67.0](https://github.com/gabeklein/expressive-mvc/compare/v0.66.2...v0.67.0) (2025-07-28)

**Note:** Version bump only for package @expressive/react
