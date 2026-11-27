import mongoose from 'mongoose'

/**
 * Drops the test database, then disconnects. Mongoose builds each model's indexes in the background (Model.init()),
 * and a build that finishes after dropDatabase() recreates its collection, which left smuhub_test_* databases behind.
 * So every model's build is awaited first (a failed build must not stop the drop).
 */
export async function dropTestDb() {
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init().catch(() => {})))
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
}
