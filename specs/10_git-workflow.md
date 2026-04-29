## 0. GLOBAL INVARIANTS (NON-NEGOTIABLE)

* `main` **ONLY** contains released, production-ready code
* `develop` **ONLY** contains unreleased integration state
* **No direct commits** to `main`
* **No untagged releases**
* **Every tag corresponds to exactly one released commit**
* **Tags are immutable**
* **Only semantic version tags are valid**
* **Containers are built ONLY from tags**

Violation of any invariant = workflow failure.

---

## 1. BRANCH MODEL (GITFLOW)

### 1.1 Permanent Branches (NEVER DELETE)

| Branch    | Purpose                             | Rules                     |
| --------- | ----------------------------------- | ------------------------- |
| `main`    | Production releases only            | Protected, no direct push |
| `develop` | Integration branch for next release | Protected, merge-only     |

---

### 1.2 Temporary Branches (MUST BE DELETED)

| Prefix      | Base Branch | Merge Targets      | Purpose                   |
| ----------- | ----------- | ------------------ | ------------------------- |
| `feature/*` | `develop`   | `develop`          | New functionality         |
| `release/*` | `develop`   | `main` + `develop` | Release preparation       |
| `hotfix/*`  | `main`      | `main` + `develop` | Critical production fixes |

---

## 2. BRANCH NAMING RULES (STRICT)

### 2.1 General Rules

* lowercase only
* hyphens (`-`) only
* no spaces
* short, descriptive
* optional ticket prefix

### 2.2 Valid Examples

```text
feature/csv-export
feature/ticket-123-cli-args
release/1.2.0
hotfix/1.2.1
hotfix/fix-encoding-error
```

### 2.3 Invalid Examples (AGENTS MUST REJECT)

```text
Feature/NewFeature
feature_new
release/v1.2
hotfix 1.2.1
```

---

## 3. SEMANTIC VERSIONING (SemVer 2.0.0)

### 3.1 Version Format

```text
MAJOR.MINOR.PATCH[-prerelease][+build]
```

### 3.2 Stable Release Tags (ONLY THESE TRIGGER CI)

```text
v1.0.0
v2.1.3
```

### 3.3 Pre-release Ordering (STRICT)

```text
alpha < alpha.1 < beta < beta.1 < rc.1 < stable
```

---

### 3.4 Version Increment Rules (DETERMINISTIC)

| Change Type                      | Version Bump |
| -------------------------------- | ------------ |
| Breaking API / CLI / Config      | MAJOR        |
| New feature, backward compatible | MINOR        |
| Bugfix / performance             | PATCH        |

#### Reset Rules

* MAJOR bump → MINOR=0, PATCH=0
* MINOR bump → PATCH=0

---

### 3.5 Python-Specific Rules (FOR AGENTS)

| Change                                  | Bump  |
| --------------------------------------- | ----- |
| New CLI option                          | MINOR |
| Bugfix                                  | PATCH |
| Config format change                    | MAJOR |
| New export format                       | MINOR |
| Python minimum version bump             | MAJOR |
| Dependency bump without behavior change | PATCH |

---

## 4. CONVENTIONAL COMMITS (MANDATORY)

### 4.1 Commit Message Grammar

```text
<type>[optional scope]: <short description>

[optional body]

[optional footer]
```

### 4.2 Allowed Types (EXHAUSTIVE)

| Type     | Effect on Version |
| -------- | ----------------- |
| feat     | MINOR             |
| fix      | PATCH             |
| perf     | PATCH             |
| feat!    | MAJOR             |
| fix!     | MAJOR             |
| docs     | none              |
| style    | none              |
| refactor | none              |
| test     | none              |
| build    | none              |
| ci       | none              |
| chore    | none              |
| revert   | none              |

---

### 4.3 Breaking Changes (MANDATORY SIGNAL)

Either:

```text
feat!: change config format
```

OR

```text
feat: restructure CLI

BREAKING CHANGE: flags --input and --output are now required
```

Agents **MUST** treat both as MAJOR.

---

### 4.4 Scope Rules

* optional
* lowercase
* single logical component

Examples:

```text
feat(cli): add --dry-run
fix(converter): handle unicode
docs(readme): update usage
```

---

## 5. VERSION DERIVATION LOGIC (FOR AGENTS)

| Commit Type         | Version Effect |
| ------------------- | -------------- |
| fix, perf           | PATCH          |
| feat                | MINOR          |
| BREAKING CHANGE / ! | MAJOR          |
| others              | none           |

If multiple commits:

* MAJOR > MINOR > PATCH precedence

---

## 6. FEATURE WORKFLOW (DETERMINISTIC)

```bash
git checkout develop
git pull origin develop
git checkout -b feature/<name>

# work + commits (conventional commits)

git checkout develop
git pull origin develop
git merge --no-ff feature/<name>
git push origin develop

git branch -d feature/<name>
git push origin --delete feature/<name>
```

Rules:

* No tags
* No merge to `main`

---

## 7. RELEASE WORKFLOW

### 7.1 Create Release Branch

```bash
git checkout develop
git pull origin develop
git checkout -b release/X.Y.Z
```

### 7.2 On Release Branch

* update version in ALL relevant files
* update changelog
* ONLY bugfixes, docs, versioning

### 7.3 Finalize Release

```bash
git checkout main
git pull origin main
git merge --no-ff release/X.Y.Z
git tag -a vX.Y.Z -m "Release X.Y.Z"
git push origin main --tags

git checkout develop
git merge --no-ff release/X.Y.Z
git push origin develop

git branch -d release/X.Y.Z
git push origin --delete release/X.Y.Z
```

---

## 8. HOTFIX WORKFLOW (CRITICAL)

```bash
git checkout main
git pull origin main
git checkout -b hotfix/X.Y.Z

# apply fix + PATCH bump

git checkout main
git merge --no-ff hotfix/X.Y.Z
git tag -a vX.Y.Z -m "Hotfix X.Y.Z"
git push origin main --tags

git checkout develop
git merge --no-ff hotfix/X.Y.Z
git push origin develop

git branch -d hotfix/X.Y.Z
git push origin --delete hotfix/X.Y.Z
```

---

## 9. TAGGING RULES (STRICT)

### 9.1 When to Tag

| Event          | Tag |
| -------------- | --- |
| release → main | YES |
| hotfix → main  | YES |
| feature merge  | NO  |
| develop merge  | NO  |

### 9.2 Tag Format

```text
vMAJOR.MINOR.PATCH
```

* Annotated tags ONLY
* Lightweight tags are forbidden

---

## 10. CI/CD RULES (AUTOMATION TARGET)

### 10.1 Container Build Conditions

| Event         | Container |
| ------------- | --------- |
| feature/*     | ❌         |
| develop       | ❌         |
| release/*     | ❌         |
| hotfix/*      | ❌         |
| main (no tag) | ❌         |
| semantic tag  | ✅         |

---

### 10.2 Image Tagging

```text
registry/app:1.2.0
registry/app:latest
```

Rules:

* `latest` ALWAYS points to highest stable tag
* No `develop`, `snapshot`, or `feature` images

---

### 10.3 Tag Regex (CI MUST ENFORCE)

```text
^v\\d+\\.\\d+\\.\\d+$
```

---

## 11. RELEASE CHECKLIST (AGENT-VERIFIABLE)

* [ ] develop contains all intended features
* [ ] release/* created from develop
* [ ] version bumped everywhere
* [ ] changelog updated
* [ ] tests passing
* [ ] merged into main
* [ ] tag created on main
* [ ] merged back into develop
* [ ] release branch deleted
* [ ] container built and pushed

---

## 12. QUICK DECISION TABLE (FOR AGENTS)

| Question                 | Answer              |
| ------------------------ | ------------------- |
| Where do features merge? | develop             |
| Where do releases merge? | main                |
| Where do hotfixes start? | main                |
| Who can push to main?    | nobody              |
| When are tags created?   | after merge to main |
| New feature version?     | MINOR               |
| Bugfix version?          | PATCH               |
| Breaking change?         | MAJOR               |

---

## 13. MACHINE-INTENT SUMMARY

* This workflow is **state-machine driven**
* Branch names, commits, and tags are **inputs**
* Version number is a **derived artifact**
* CI/CD is **purely tag-driven**
* Humans may assist, but **agents enforce**


