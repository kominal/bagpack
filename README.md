# Bagpack

Bagpack supports a range of data sources and provides a simple way to backup them.
To enable a source, you need to set the corresponding environment variables.

## Setup

TARGET_CONNECTION_STRING - The connection string to the storage where the backups will be stored (Format: <username>@<hostname>:<port>)
TARGET_SSH_PRIVATE_KEY - The private SSH key used to connect to the target server
TARGET_DIRECTORY - The directory where the backups will be stored
MAIL_CONNECTION_STRING - The connection string used to send reports (Format: smtps://user@example.com:topsecret@smtp.example.com)
MAIL_SENDER - The email address used as sender for the reports
MAIL_RECIPIENTS - Comma separated list of email recipients for the reports

## Supported Sources

### MongoDB

MONGODB_CONNECTION_STRING - MongoDB connection string

#### Restore

To restore a MongoDB backup, you can use the following command:

```bash
docker run -p 27017:27017 -v ${PWD}/:/backup --rm --name mongodb mongo:latest
docker exec -it mongodb bash
mongorestore --gzip --archive=/backup/<backup-file>
```
