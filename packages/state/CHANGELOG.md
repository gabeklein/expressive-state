# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.73.1](https://github.com/gabeklein/expressive-mvc/compare/v0.73.0...v0.73.1) (2026-02-13)

### Bug Fixes

- improved test for sibling fetch ([54d29f3](https://github.com/gabeklein/expressive-mvc/commit/54d29f3b565c64039fa340b40228e30a811cc424))
- prevent self-assignment in get function and add test for parent resolution ([cd43ba3](https://github.com/gabeklein/expressive-mvc/commit/cd43ba326356941364ed3e4170917b8f944149f9))

# [0.73.0](https://github.com/gabeklein/expressive-mvc/compare/v0.72.0...v0.73.0) (2026-02-12)

### Bug Fixes

- rename all deprecated jest matchers ([7c40666](https://github.com/gabeklein/expressive-mvc/commit/7c406666a6f82296ab25c53a700d153781664500))
- replace state types within namespace ([36be3d1](https://github.com/gabeklein/expressive-mvc/commit/36be3d11a5cbedfbe8d398466aaf921de12938f3))
- uncooperative builds ([fae4cb6](https://github.com/gabeklein/expressive-mvc/commit/fae4cb6ef1279f7befabdfc6d4806526f56c0c5d))
- update didDestroy call to include order in child context ([d7a9cd8](https://github.com/gabeklein/expressive-mvc/commit/d7a9cd853e9eec630485fa0d4438123374d596ff))

### Features

- switch to tsdown ([de3c002](https://github.com/gabeklein/expressive-mvc/commit/de3c0020bacd4bd912409a0e59ba80c57119b07c))

# [0.72.0](https://github.com/gabeklein/expressive-mvc/compare/v0.71.0...v0.72.0) (2026-01-25)

### Bug Fixes

- exract Instruction type from Model, add namespace ([058a90c](https://github.com/gabeklein/expressive-mvc/commit/058a90c239cfa6cf4f27dbd09d33852609b62b29))
- properly bailout on context mismatch ([63aad16](https://github.com/gabeklein/expressive-mvc/commit/63aad169c935c9a7bc9db0eac15cedb4c062a7ca))
- remove async from attempt-retry function ([0184fbb](https://github.com/gabeklein/expressive-mvc/commit/0184fbb253c8fe2a020776ae2033187c45949f33))
- remove has export from index.ts ([8196c1c](https://github.com/gabeklein/expressive-mvc/commit/8196c1c110c9c3fa5dddab93e412338cb7a60ac1))
- remove tests which conflict with new behavior ([9fa1252](https://github.com/gabeklein/expressive-mvc/commit/9fa1252b44fbf106e5f9c70e37f83af730893cd9))
- replace missing namespace ([16d349d](https://github.com/gabeklein/expressive-mvc/commit/16d349d47c4e31c31ebc14fc372062e5c7b94711))
- update Instruction type reference in EffectCallback and Setter ([1df8373](https://github.com/gabeklein/expressive-mvc/commit/1df8373209f32ecd062aa918b10b4176cb44f6ef))
- update Model reference to Instruction in set function ([0c6093b](https://github.com/gabeklein/expressive-mvc/commit/0c6093b6a9355d4a69cddf2ddb07d9986053eb9c))
- update useMemo dependency in Context.use to ensure proper state management ([0287aa8](https://github.com/gabeklein/expressive-mvc/commit/0287aa8b99fe727d447bdd097b1d6ad74a7399cd))

### Code Refactoring

- reorder type definitions for better clarity ([592ffe4](https://github.com/gabeklein/expressive-mvc/commit/592ffe457650f6bf9668a0bbbc0f0bae94445e7c))
- replace 'include' method with 'use' for context management consistency ([96c61ba](https://github.com/gabeklein/expressive-mvc/commit/96c61ba7ac72f05201e4a65fa34b0faf3d0a0b21))

- refactor!: consolidated compute overloads from get into set ([c12adfd](https://github.com/gabeklein/expressive-mvc/commit/c12adfdea2e0cbb06bcc987c41c7de8f0990b9f2))
- feature!: Merge Context.has into Context.get as overload ([2e7e9a4](https://github.com/gabeklein/expressive-mvc/commit/2e7e9a4d1871b77f47a691b7928abc3c58ccebf9))

### Features

- support direct passthrough of parameters from .use() to contructor ([181d1ee](https://github.com/gabeklein/expressive-mvc/commit/181d1ee803571c9e31f86fad12c8277d9bc3d147))

### BREAKING CHANGES

- get(this, compute) is removed!
- Removed Context.has
- Removes Model.Argument type
- Context.inlcude is not Context.use

# [0.71.0](https://github.com/gabeklein/expressive-mvc/compare/v0.70.0...v0.71.0) (2025-10-05)

### Features

- refactor input handling in Context.include ([f4823a2](https://github.com/gabeklein/expressive-mvc/commit/f4823a29dc3590b04c4027c382b5715731df590b))

# [0.70.0](https://github.com/gabeklein/expressive-mvc/compare/v0.69.2...v0.70.0) (2025-09-15)

### Features

- add subscription for methods passed to get() ([67edf28](https://github.com/gabeklein/expressive-mvc/commit/67edf28f0b596398dfa31cc7518e8aacd8d958a2))

## [0.69.2](https://github.com/gabeklein/expressive-mvc/compare/v0.69.1...v0.69.2) (2025-09-11)

**Note:** Version bump only for package @expressive/mvc

## [0.69.1](https://github.com/gabeklein/expressive-mvc/compare/v0.69.0...v0.69.1) (2025-09-10)

### Bug Fixes

- add coverage for Observable method ([b7a7d9e](https://github.com/gabeklein/expressive-mvc/commit/b7a7d9e06731df3a628303266f42cf33f78e192d))
- correct signature of createEffect ([1174916](https://github.com/gabeklein/expressive-mvc/commit/11749166f9eb573fef07308b3f542d05ef9317bf))
- enhance setter handling in assign function to prevent errors ([86fa3b8](https://github.com/gabeklein/expressive-mvc/commit/86fa3b8677659ae0c95ee25ad46c9f8886ff5a6c))
- update Observable interface to allow void, returning `this` ([41fbca8](https://github.com/gabeklein/expressive-mvc/commit/41fbca881e323b249925a07fb7e51108e4ab29d3))

# [0.69.0](https://github.com/gabeklein/expressive-mvc/compare/v0.68.0...v0.69.0) (2025-09-05)

### Bug Fixes

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

- improve error messages for destroyed model updates ([0393f3c](https://github.com/gabeklein/expressive-mvc/commit/0393f3ca8ee73a41c35a9789a2eee12bef376eca))

### Features

- fetch original methods using model.get ([013c082](https://github.com/gabeklein/expressive-mvc/commit/013c08293a4d0d9e3845950b16e4024ddcfbb7a1))

# [0.67.0](https://github.com/gabeklein/expressive-mvc/compare/v0.66.2...v0.67.0) (2025-07-28)

### Features

- **ref:** trigger set instructions on assignment ([3be9fdf](https://github.com/gabeklein/expressive-mvc/commit/3be9fdf870f36e69717f2034141ac1ad5c09e772))
