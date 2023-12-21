# Contributing to languageXchange

First off, thank you for considering contributing to languageXchange. It's people like you that make languageXchange such a great project.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/languagexchange/languagexchange/issues) if there's something similar to what you've observed or want to suggest. If there isn't, feel free to open a new issue!

## Fork & create a branch

If this is something you think you can fix, then fork the repository and create a branch with a descriptive name.

A good branch name would be (where issue #325 is the ticket you're working on):

```bash
git checkout -b your-branch-name
```

## Get the test suite running

Make sure you're able to run the test suite. If you're having trouble setting up the project, let us know and we can try to help.

## Make your changes

Make the changes you want to make.

## Create a pull request

At this point, you should switch back to your master branch and make sure it's up to date with the latest changes from the main project's master branch:

```bash
git remote add upstream git@github.com:original-owner-username/original-repository.git
git checkout master
git pull upstream master
```

Then update your feature branch from your local copy of master, and push it!

```bash
git checkout your-branch-name
git rebase master
git push --set-upstream origin your-branch-name
```

## Keeping your Pull Request updated

If a maintainer asks you to "rebase" your PR, they're saying that a lot of code has changed, and that you need to update your branch so it's easier to merge.

To update your branch, use the following commands:

```bash
git checkout your-branch-name
git pull --rebase upstream master
git push --force-with-lease origin your-branch-name
```

# Thank you for your contributions!
