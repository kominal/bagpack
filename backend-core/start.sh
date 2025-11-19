#!/bin/sh

eval `ssh-agent -s`
echo "${TARGET_SSH_PRIVATE_KEY}" | ssh-add -

exec "$@"
