import { MongoClient, type Db } from 'mongodb'

/**
 * One `MongoClient` for the whole process, shared with Better Auth's
 * `mongodbAdapter`. This is why there is no Mongoose: a second abstraction over
 * the same database would mean a second connection pool and a second schema
 * story competing with zod.
 */
export interface DbHandle {
  client: MongoClient
  db: Db
  close: () => Promise<void>
}

export async function connectToDatabase(uri: string, dbName: string): Promise<DbHandle> {
  const client = new MongoClient(uri, {
    retryWrites: true,
    // Surface a bad URI or unreachable cluster during boot, not on first query.
    serverSelectionTimeoutMS: 10_000,
  })

  await client.connect()

  return {
    client,
    db: client.db(dbName),
    close: () => client.close(),
  }
}
