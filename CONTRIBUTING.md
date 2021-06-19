# Contributing to Houdini

🎉🎉 First off, thanks for the interest in contributing to Houdini! 🎉🎉

This document should hopefully provide some guidance for working on the project including
a general introduction to the internal architecture and the relevant files/directories.

## Table of Contents

1. [General Introduction](#general-introduction)
    1. [Local Development](#local-development)
1. [The Compiler](#the-compiler)
1. [The Proprocessor](#the-preprocessor)

## General Introduction

At a high level, houdini is broken up into two parts: a command-line tool and a preprocessor. The
command-line tool is responsible for a variety of tasks including scaffolding a new project,
validating a project's documents, and generating the associated artifacts that the runtime
needs to do its job. The preprocessor handles optimizing the user's code for their specific
platform and runtime.

### Local Development

The quickest way to test and develop new features is by using the [example project](./example) located
at the root of the repository. The easiest way to get started is to execute `yarn && yarn build` at
the root of the repository which will handle the details of linking everything up. Once yarn is done,
execute `yarn generate && yarn dev` inside of the example directory to start the development server.
You will also need to start the example app's api with `yarn api` (in a separate terminal, also inside
the example directory). After all of this, you should be able to visit `localhost:3000` in a web browser
and see a working todo list.

## The compiler

## The preprocessor
