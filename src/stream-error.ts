export default class StreamError extends Error {
  constructor(public readonly cause: unknown) {
    super('Error during stream. See cause for more information.')
  }
}
