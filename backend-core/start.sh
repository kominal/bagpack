#!/bin/sh

echo "${TARGET_SSH_PRIVATE_KEY}" | ssh-add -

exec "$@"
