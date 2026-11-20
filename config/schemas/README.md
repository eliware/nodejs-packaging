# Published metadata schemas

The files in this directory define the stable Node.js 26 metadata contract. Each schema uses metadata version `0.1.0` and document schema number `1`.

The packaging pipeline owns these schemas. Update the representative tree in `test-fixtures/published-repository/` with each contract change. Copy the same fixture documents into nodejs-http and run its consumer tests before release.
