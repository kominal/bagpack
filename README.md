# Bagpack

Bagpack supports a range of data sources and provides a simple way to backup them.
To enable a source, you need to set the corresponding environment variables.

## Setup

TARGET_CONNECTION_STRING - The connection string to the storage where the backups will be stored (Format: <username>:<password>@<hostname>:<port>)
TARGET_DIRECTORY - The directory where the backups will be stored
MAIL_CONNECTION_STRING - The connection string to the mail server

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
