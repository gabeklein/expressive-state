# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.73.1](https://github.com/gabeklein/expressive-mvc/compare/v0.73.0...v0.73.1) (2026-02-13)

### Bug Fixes

- improved test for sibling fetch ([54d29f3](https://github.com/gabeklein/expressive-mvc/commit/54d29f3b565c64039fa340b40228e30a811cc424))
- prevent self-assignment in get function and add test for parent resolution ([cd43ba3](https://github.com/gabeklein/expressive-mvc/commit/cd43ba326356941364ed3e4170917b8f944149f9))

# [0.73.0](https://github.com/gabeklein/expressive-mvc/compare/v0.72.0...v0.73.0) (2026-02-12)

### Bug Fixes

- export Component from './component' in index.ts ([9d7c3a1](https://github.com/gabeklein/expressive-mvc/commit/9d7c3a184227d806794777b701895f9ea3c83b65))
- point preact import of State to @/react/state ([9212349](https://github.com/gabeklein/expressive-mvc/commit/9212349c7a7c5dabf358fe209e46affb2f949b8b))
- rename all deprecated jest matchers ([7c40666](https://github.com/gabeklein/expressive-mvc/commit/7c406666a6f82296ab25c53a700d153781664500))
- replace state types within namespace ([36be3d1](https://github.com/gabeklein/expressive-mvc/commit/36be3d11a5cbedfbe8d398466aaf921de12938f3))
- replace tsup with tsdown in react package ([d1e0eb7](https://github.com/gabeklein/expressive-mvc/commit/d1e0eb7e2d02859c48bcc69c5bd286bf062295ea))
- uncooperative builds ([fae4cb6](https://github.com/gabeklein/expressive-mvc/commit/fae4cb6ef1279f7befabdfc6d4806526f56c0c5d))
- update didDestroy call to include order in child context ([d7a9cd8](https://github.com/gabeklein/expressive-mvc/commit/d7a9cd853e9eec630485fa0d4438123374d596ff))
- update files.exclude settings to hide additional files and directories ([a68913b](https://github.com/gabeklein/expressive-mvc/commit/a68913b0bf43623e34cc437127a373ccc96291bc))
- update Jest program path to use pnpm and remove unnecessary config args ([a0d0128](https://github.com/gabeklein/expressive-mvc/commit/a0d01282c8180edebe241ebdfba663da6ad8f50f))

### Features

- switch to tsdown ([de3c002](https://github.com/gabeklein/expressive-mvc/commit/de3c0020bacd4bd912409a0e59ba80c57119b07c))

# [0.72.0](https://github.com/gabeklein/expressive-mvc/compare/v0.71.0...v0.72.0) (2026-01-25)

### Bug Fixes

- correct argument order in model.set function within Provider component ([4e66d5c](https://github.com/gabeklein/expressive-mvc/commit/4e66d5c85a5f47f8cfd46bf9c1e24a5293c0ffa5))
- correct return statement in Model.as function ([4073b08](https://github.com/gabeklein/expressive-mvc/commit/4073b087928b62836e7b6b8df2e0ea8ec7259a66))
- correct typo in TODO comment for eager matching in model.get.ts ([449a847](https://github.com/gabeklein/expressive-mvc/commit/449a847a3b04a5a0c5e791937e5c3bc0f1ca726e))
- exract Instruction type from Model, add namespace ([058a90c](https://github.com/gabeklein/expressive-mvc/commit/058a90c239cfa6cf4f27dbd09d33852609b62b29))
- lower dev-dependancy version of react ([76601ed](https://github.com/gabeklein/expressive-mvc/commit/76601ed6bdf27d897c6e5f351fd9959802704c4f))
- properly bailout on context mismatch ([63aad16](https://github.com/gabeklein/expressive-mvc/commit/63aad169c935c9a7bc9db0eac15cedb4c062a7ca))
- remove .only from test for method creation ([951133c](https://github.com/gabeklein/expressive-mvc/commit/951133c7b3574d25f5b664ed22529ef0618f7d4b))
- remove async from attempt-retry function ([0184fbb](https://github.com/gabeklein/expressive-mvc/commit/0184fbb253c8fe2a020776ae2033187c45949f33))
- remove Context export from index and adjust imports ([b0238a1](https://github.com/gabeklein/expressive-mvc/commit/b0238a1c128c2e93bc398ec33815424423d376a7))
- remove has export from index.ts ([8196c1c](https://github.com/gabeklein/expressive-mvc/commit/8196c1c110c9c3fa5dddab93e412338cb7a60ac1))
- remove restriction on creating component from base Model ([01fb7fe](https://github.com/gabeklein/expressive-mvc/commit/01fb7fe847c7105bca512d10cef22960da2f20ca))
- remove tests which conflict with new behavior ([9fa1252](https://github.com/gabeklein/expressive-mvc/commit/9fa1252b44fbf106e5f9c70e37f83af730893cd9))
- render method will not intercept arguments from normal control flow ([c9a469d](https://github.com/gabeklein/expressive-mvc/commit/c9a469df7e63d8edcafc675f25d8ca641f4ee03e))
- replace 'Context.include' method with 'use' in preact Provider ([fbc09a3](https://github.com/gabeklein/expressive-mvc/commit/fbc09a3b7f2b1dfa97a43c96045b25547d82076a))
- replace missing namespace ([16d349d](https://github.com/gabeklein/expressive-mvc/commit/16d349d47c4e31c31ebc14fc372062e5c7b94711))
- replace v19 react dev dependancies across whole library and update examples ([e735c98](https://github.com/gabeklein/expressive-mvc/commit/e735c9866338522d4947dda0a170aeb42c82ed54))
- simplify component render for coverage ([d23b6c7](https://github.com/gabeklein/expressive-mvc/commit/d23b6c73d90adea958ce328022ae68b84526187b))
- simplify type checking logic in compat function ([d5a4d33](https://github.com/gabeklein/expressive-mvc/commit/d5a4d3384c2a95f61bb1337cf4c39b3188971326))
- streamline type handling in compat function for Model instances ([088aae1](https://github.com/gabeklein/expressive-mvc/commit/088aae1600e14a001a125b502aa542bac7e03264))
- update Instruction type reference in EffectCallback and Setter ([1df8373](https://github.com/gabeklein/expressive-mvc/commit/1df8373209f32ecd062aa918b10b4176cb44f6ef))
- update Model reference to Instruction in set function ([0c6093b](https://github.com/gabeklein/expressive-mvc/commit/0c6093b6a9355d4a69cddf2ddb07d9986053eb9c))
- update test to call is method on creation and remove unused didDestroy function ([9265fdd](https://github.com/gabeklein/expressive-mvc/commit/9265fddb112651857d2064afd4bf769fc8f959a6))
- update useMemo dependency in Context.use to ensure proper state management ([0287aa8](https://github.com/gabeklein/expressive-mvc/commit/0287aa8b99fe727d447bdd097b1d6ad74a7399cd))

### Code Refactoring

- remove explict Model.FC, rename Model.Component ([eefb5a1](https://github.com/gabeklein/expressive-mvc/commit/eefb5a1e46dca46b4bfead9237942e73ae3678d3))
- reorder type definitions for better clarity ([592ffe4](https://github.com/gabeklein/expressive-mvc/commit/592ffe457650f6bf9668a0bbbc0f0bae94445e7c))
- replace 'include' method with 'use' for context management consistency ([96c61ba](https://github.com/gabeklein/expressive-mvc/commit/96c61ba7ac72f05201e4a65fa34b0faf3d0a0b21))

- refactor!: consolidated compute overloads from get into set ([c12adfd](https://github.com/gabeklein/expressive-mvc/commit/c12adfdea2e0cbb06bcc987c41c7de8f0990b9f2))
- feature!: Merge Context.has into Context.get as overload ([2e7e9a4](https://github.com/gabeklein/expressive-mvc/commit/2e7e9a4d1871b77f47a691b7928abc3c58ccebf9))
- refactor!: implement use method in Model ([93ed23e](https://github.com/gabeklein/expressive-mvc/commit/93ed23e1788a0507bd927d03b16dcc3d536091d1))

### Features

- support direct passthrough of parameters from .use() to contructor ([181d1ee](https://github.com/gabeklein/expressive-mvc/commit/181d1ee803571c9e31f86fad12c8277d9bc3d147))

### BREAKING CHANGES

- get(this, compute) is removed!
- Removed Context.has
- Removes Model.Argument type
- Context.inlcude is not Context.use
- render method no longer implicitly called on .use()
- Deletes original Model.FC interface

# [0.71.0](https://github.com/gabeklein/expressive-mvc/compare/v0.70.0...v0.71.0) (2025-10-05)

- feat!: simplify 'is' callback handling in State interface and tests ([f77e413](https://github.com/gabeklein/expressive-mvc/commit/f77e413d5a049037b77a3cd1aedf29e2f835d1c3))

### Features

- refactor input handling in Context.include ([f4823a2](https://github.com/gabeklein/expressive-mvc/commit/f4823a29dc3590b04c4027c382b5715731df590b))

### BREAKING CHANGES

- is prop no longer accepts destroy callback

# [0.70.0](https://github.com/gabeklein/expressive-mvc/compare/v0.69.2...v0.70.0) (2025-09-15)

### Bug Fixes

- update RenderProps type to prevent passing 'is' prop to State components ([26ec4a3](https://github.com/gabeklein/expressive-mvc/commit/26ec4a3c190fde350f409537ee9869ab54df6869))

### Features

- add subscription for methods passed to get() ([67edf28](https://github.com/gabeklein/expressive-mvc/commit/67edf28f0b596398dfa31cc7518e8aacd8d958a2))
- enhance State interfaces and props for better compatibility and fallback support ([849f282](https://github.com/gabeklein/expressive-mvc/commit/849f28273291605e2c49950c8e6cc3e5b5638050))
- enhance provider and consumer functionality with fallback support ([6de2ba9](https://github.com/gabeklein/expressive-mvc/commit/6de2ba940de5769bcd745f88cef0103d9a629393))
- implement fallback prop ([d7402ca](https://github.com/gabeklein/expressive-mvc/commit/d7402ca4aa789c257f3c66ff94247cff8e6fbd89))

## [0.69.2](https://github.com/gabeklein/expressive-mvc/compare/v0.69.1...v0.69.2) (2025-09-11)

### Bug Fixes

- update Props type to omit State keys for better compatibility ([77a1cbe](https://github.com/gabeklein/expressive-mvc/commit/77a1cbef3faddeebab5f57e034ad798556a8325f))

## [0.63.6](https://github.com/gabeklein/expressive-mvc/compare/v0.63.5...v0.63.6) (2025-06-26)

## [0.69.1](https://github.com/gabeklein/expressive-mvc/compare/v0.69.0...v0.69.1) (2025-09-10)

### Bug Fixes

- add coverage for Observable method ([b7a7d9e](https://github.com/gabeklein/expressive-mvc/commit/b7a7d9e06731df3a628303266f42cf33f78e192d))
- correct signature of createEffect ([1174916](https://github.com/gabeklein/expressive-mvc/commit/11749166f9eb573fef07308b3f542d05ef9317bf))
- enhance setter handling in assign function to prevent errors ([86fa3b8](https://github.com/gabeklein/expressive-mvc/commit/86fa3b8677659ae0c95ee25ad46c9f8886ff5a6c))
- update Observable interface to allow void, returning `this` ([41fbca8](https://github.com/gabeklein/expressive-mvc/commit/41fbca881e323b249925a07fb7e51108e4ab29d3))

# [0.69.0](https://github.com/gabeklein/expressive-mvc/compare/v0.68.0...v0.69.0) (2025-09-05)

### Bug Fixes

- support assigning function components as render method ([fade81e](https://github.com/gabeklein/expressive-mvc/commit/fade81eba5a049cc1aa30366823516142bc449dc))
- update foo method assignment to use current property ([2b6b960](https://github.com/gabeklein/expressive-mvc/commit/2b6b9606709181b374f8ad79db39a00a624de356))

- feat!: removed ref-function from object ([6b2db41](https://github.com/gabeklein/expressive-mvc/commit/6b2db41b7047304821ff39dcd186017da1207b13))
- fix(ref)!: update ref type to not implicitly allow null ([77cdb48](https://github.com/gabeklein/expressive-mvc/commit/77cdb48746eea281162df8d740fcb4633bb6cc12))

### Features

- **ref:** add 'is' and 'key' properties to reference objects ([1aa7cd8](https://github.com/gabeklein/expressive-mvc/commit/1aa7cd8cf4f62bc6507ef1afa3e47e99832e3cd1))

### BREAKING CHANGES

- ref properties no longer callable
- ref properties no longer implicitly expect null in typescript

# [0.68.0](https://github.com/gabeklein/expressive-mvc/compare/v0.67.0...v0.68.0) (2025-08-21)

### Bug Fixes

- add conventional commits flag to lerna publish script ([6d25716](https://github.com/gabeklein/expressive-mvc/commit/6d257165050b28c6b00be5a3ddd1f8734722b21a))
- improve error messages for destroyed model updates ([0393f3c](https://github.com/gabeklein/expressive-mvc/commit/0393f3ca8ee73a41c35a9789a2eee12bef376eca))

### Features

- fetch original methods using model.get ([013c082](https://github.com/gabeklein/expressive-mvc/commit/013c08293a4d0d9e3845950b16e4024ddcfbb7a1))
- **react:** add suspense fallback to Provider ([c334366](https://github.com/gabeklein/expressive-mvc/commit/c33436628c0bcdcec1c4b161feca225c8c248dd0))

# [0.67.0](https://github.com/gabeklein/expressive-mvc/compare/v0.66.2...v0.67.0) (2025-07-28)

### Features

- **ref:** trigger set instructions on assignment ([3be9fdf](https://github.com/gabeklein/expressive-mvc/commit/3be9fdf870f36e69717f2034141ac1ad5c09e772))
